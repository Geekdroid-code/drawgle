import { detectTargetBlocks, indexScreenCode } from "@/lib/generation/block-index";
import { assembleChatContext } from "@/lib/generation/context";
import { generateEmbedding } from "@/lib/generation/embeddings";
import { editNavigationShellCode, editScreenStream } from "@/lib/generation/service";
import { applyEdits } from "@/lib/diff-engine";
import { sanitizeScreenCodeForSharedNavigation } from "@/lib/project-navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  fetchProjectMessages,
  insertProjectMessage,
  updateProjectMessageEmbedding,
} from "@/lib/supabase/queries";
import type { DesignTokens, NavigationArchitecture, NavigationPlan, ProjectCharter, ScreenBlockIndex, ScreenChromePolicy } from "@/lib/types";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ProjectMessageInput = Parameters<typeof insertProjectMessage>[1];

const isNavigationEditPrompt = (prompt: string) =>
  /\b(nav|navigation|tab bar|tabs|bottom bar|bottom nav|bottom navigation|floating dock|dock)\b/i.test(prompt);

const isNavigationElementHtml = (html?: string | null) =>
  /data-drawgle-primary-nav|data-nav-item-id/i.test(html ?? "");

async function upsertActivityMessage(
  admin: ReturnType<typeof createAdminClient>,
  activityKey: string,
  input: ProjectMessageInput,
) {
  const metadata = {
    ...(input.metadata ?? {}),
    activityKey,
  };

  const { data: existingMessage, error: existingError } = await admin
    .from("project_messages")
    .select("id, metadata")
    .eq("project_id", input.projectId)
    .eq("owner_id", input.ownerId)
    .contains("metadata", { activityKey })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existingMessage) {
    return insertProjectMessage(admin, {
      ...input,
      metadata,
    });
  }

  const existingMetadata = existingMessage.metadata &&
    typeof existingMessage.metadata === "object" &&
    !Array.isArray(existingMessage.metadata)
    ? existingMessage.metadata as Record<string, unknown>
    : {};

  const { data, error } = await admin
    .from("project_messages")
    .update({
      screen_id: input.screenId ?? null,
      role: input.role,
      content: input.content,
      message_type: input.messageType ?? "chat",
      metadata: {
        ...existingMetadata,
        ...metadata,
      } as never,
    })
    .eq("id", existingMessage.id)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return { id: data.id };
}

export async function POST(req: Request) {
  try {
    const {
      projectId,
      prompt,
      selectedScreenId,
      selectedElementHtml,
      selectedElementTarget,
    } = await req.json();

    if (!projectId || !prompt?.trim()) {
      return NextResponse.json(
        { error: "projectId and prompt are required." },
        { status: 400 },
      );
    }

    // Auth
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Verify project ownership
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, owner_id, design_tokens, project_charter")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project || project.owner_id !== user.id) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const cleanSelectedElementHtml = typeof selectedElementHtml === "string" && selectedElementHtml.length > 0
      ? selectedElementHtml
      : null;
    const requestTargetsNavigation =
      selectedElementTarget === "navigation" ||
      isNavigationElementHtml(cleanSelectedElementHtml) ||
      isNavigationEditPrompt(prompt.trim());

    // Save user message
    const userMessage = await insertProjectMessage(admin, {
      projectId,
      ownerId: user.id,
      screenId: requestTargetsNavigation ? null : selectedScreenId ?? null,
      role: "user",
      content: prompt.trim(),
      messageType: "chat",
    });

    // Determine intent: if a screen is selected, treat as edit
    if (selectedScreenId || requestTargetsNavigation) {
      return handleEditIntent({
        admin,
        projectId,
        ownerId: user.id,
        screenId: selectedScreenId ?? null,
        prompt: prompt.trim(),
        userMessageId: userMessage.id,
        designTokens: (project.design_tokens as DesignTokens | null) ?? null,
        projectCharter: (project.project_charter as ProjectCharter | null) ?? null,
        navigationArchitecture: ((project.project_charter as ProjectCharter | null)?.navigationArchitecture ?? null) as NavigationArchitecture | null,
        selectedElementHtml: cleanSelectedElementHtml,
        selectedElementTarget: selectedElementTarget === "navigation" ? "navigation" : "screen",
        requestTargetsNavigation,
      });
    }

    // No screen selected — currently respond with guidance.
    // Screen creation flow (plan + build) stays on existing /api/plan + /api/generations
    // to avoid duplicating the full generation pipeline in this route.
    // The ChatPanel frontend will detect "create" intent and call those APIs directly,
    // while posting system messages into project_messages for status visibility.
    return NextResponse.json({
      intent: "create",
      message: "Use the screen creation flow for this request.",
    });
  } catch (error: unknown) {
    console.error("Chat API Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Edit intent — scoped block editing with streaming
// ---------------------------------------------------------------------------

async function handleEditIntent({
  admin,
  projectId,
  ownerId,
  screenId,
  prompt,
  userMessageId,
  designTokens,
  projectCharter,
  navigationArchitecture,
  selectedElementHtml,
  selectedElementTarget,
  requestTargetsNavigation,
}: {
  admin: ReturnType<typeof createAdminClient>;
  projectId: string;
  ownerId: string;
  screenId: string | null;
  prompt: string;
  userMessageId: string;
  designTokens?: DesignTokens | null;
  projectCharter?: ProjectCharter | null;
  navigationArchitecture?: NavigationArchitecture | null;
  /** The outerHTML of a visually selected element, or null for block-index fallback. */
  selectedElementHtml?: string | null;
  selectedElementTarget?: "screen" | "navigation";
  requestTargetsNavigation?: boolean;
}) {
  // Fetch screen (use admin to bypass RLS — ownership already verified)
  const editActivityKey = `edit:${userMessageId}`;
  const requestedNavigationEdit = requestTargetsNavigation ?? isNavigationEditPrompt(prompt);
  const selectedNavigationElement = selectedElementTarget === "navigation" || isNavigationElementHtml(selectedElementHtml);

  if (requestedNavigationEdit || selectedNavigationElement) {
    const { data: projectNavigation, error: navigationError } = await admin
      .from("project_navigation")
      .select("id, shell_code, block_index, plan")
      .eq("project_id", projectId)
      .maybeSingle();

    if (!navigationError && projectNavigation?.shell_code) {
      const navigationCode = projectNavigation.shell_code;
      const navigationPlan = projectNavigation.plan as unknown as NavigationPlan;

      await upsertActivityMessage(admin, editActivityKey, {
        projectId,
        ownerId,
        screenId: null,
        role: "system",
        content: "Editing shared project navigation...",
        messageType: "chat",
        metadata: { action: "navigation_edit_start", target: "project_navigation", screenName: "Navigation", userMessageId },
      });

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const nextCode = await editNavigationShellCode({
              prompt,
              currentShellCode: navigationCode,
              navigationPlan,
              designTokens,
              projectCharter,
              selectedElementHtml: selectedNavigationElement ? selectedElementHtml : null,
            });

            if (nextCode !== navigationCode) {
              const { error: updateError } = await admin
                .from("project_navigation")
                .update({
                  shell_code: nextCode,
                  block_index: indexScreenCode(nextCode) as never,
                  status: "ready",
                  error: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", projectNavigation.id);

              if (updateError) {
                throw updateError;
              }
            }

            const fullResponse = "Updated shared project navigation.";
            controller.enqueue(new TextEncoder().encode(fullResponse));

            const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
              projectId,
              ownerId,
              screenId: null,
              role: "model",
              content: fullResponse,
              messageType: "edit_applied",
              metadata: { action: "edit_applied", target: "project_navigation", screenName: "Navigation", userMessageId },
            });

            void embedMessagePair(admin, userMessageId, prompt, modelMessage.id, fullResponse);

            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/plain" },
      });
    }

    return NextResponse.json(
      { error: navigationError?.message ?? "Shared project navigation was not found for this project." },
      { status: 404 },
    );
  }

  if (!screenId) {
    return NextResponse.json({
      intent: "create",
      message: "Use the screen creation flow for this request.",
    });
  }

  const { data: screen, error: screenError } = await admin
    .from("screens")
    .select("id, name, code, block_index, chrome_policy, navigation_item_id")
    .eq("id", screenId)
    .maybeSingle();

  if (screenError || !screen) {
    return NextResponse.json({ error: "Screen not found." }, { status: 404 });
  }

  const screenCode = typeof screen.code === "string" && screen.code.length > 0 ? screen.code : "";
  const blockIndex = ((screen.block_index as ScreenBlockIndex | null) ?? indexScreenCode(screenCode));

  // Detect target blocks for scoped editing (skipped when visual element selection is available)
  const resolution = selectedElementHtml
    ? { scope: "scoped" as const, targetBlockIds: [] }
    : detectTargetBlocks(prompt, blockIndex);
  const targetBlockIds = resolution.scope === "scoped" && !selectedElementHtml ? resolution.targetBlockIds : [];

  // Build chat context from project_messages
  const allMessages = await fetchProjectMessages(admin, projectId);
  
  const chatHistory = selectedElementHtml 
    ? [{ role: "user" as const, content: prompt }]
    : await assembleChatContext({
        admin,
        projectId,
        userPrompt: prompt,
        recentMessages: allMessages,
      });

  // Post system status message
  const targetNames = selectedElementHtml
    ? "selected element"
    : targetBlockIds.length > 0
      ? targetBlockIds.map((id) => blockIndex.blocks.find((b) => b.id === id)?.name ?? id).join(", ")
      : "full screen";

  await upsertActivityMessage(admin, editActivityKey, {
    projectId,
    ownerId,
    screenId,
    role: "system",
    content: `Editing ${targetNames} in ${screen.name}...`,
    messageType: "chat",
    metadata: { action: "edit_start", targetBlockIds, screenName: screen.name, userMessageId },
  });

  // Stream the edit response
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";

      try {
        for await (const chunk of editScreenStream({
          messages: chatHistory,
          screenCode,
          blockIndex,
          targetBlockIds,
          designTokens,
          navigationArchitecture,
          selectedElementHtml,
        })) {
          fullResponse += chunk;
          controller.enqueue(new TextEncoder().encode(chunk));
        }

        if (fullResponse.includes("<edit>")) {
          const editedCode = applyEdits(screenCode, fullResponse);
          const nextCode = sanitizeScreenCodeForSharedNavigation(editedCode, {
            name: screen.name,
            type: "root",
            description: "",
            chromePolicy: (screen.chrome_policy as ScreenChromePolicy | null) ?? null,
            navigationItemId: typeof screen.navigation_item_id === "string" ? screen.navigation_item_id : null,
          });

          if (nextCode === screenCode) {
            await upsertActivityMessage(admin, editActivityKey, {
              projectId,
              ownerId,
              screenId,
              role: "system",
              content: `No material code changes were applied to ${screen.name}.`,
              messageType: "chat",
              metadata: { action: "edit_noop", screenName: screen.name, userMessageId },
            });

            controller.close();
            return;
          }

          const { error: updateError } = await admin
            .from("screens")
            .update({
              code: nextCode,
              block_index: indexScreenCode(nextCode) as never,
              status: "ready",
              error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", screenId);

          if (updateError) {
            throw updateError;
          }

          const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
            projectId,
            ownerId,
            screenId,
            role: "model",
            content: fullResponse,
            messageType: "edit_applied",
            metadata: { action: "edit_applied", screenName: screen.name, userMessageId },
          });

          void embedMessagePair(admin, userMessageId, prompt, modelMessage.id, fullResponse);
          controller.close();
          return;
        }

        const noEditContent = fullResponse.trim() || `No material code changes were applied to ${screen.name}.`;
        const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
          projectId,
          ownerId,
          screenId,
          role: "model",
          content: noEditContent,
          messageType: "chat",
          metadata: { action: "edit_noop", screenName: screen.name, userMessageId },
        });

        void embedMessagePair(admin, userMessageId, prompt, modelMessage.id, noEditContent);

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain" },
  });
}

// ---------------------------------------------------------------------------
// Background embedding for messages
// ---------------------------------------------------------------------------

async function embedMessagePair(
  admin: ReturnType<typeof createAdminClient>,
  userMessageId: string,
  userContent: string,
  modelMessageId: string,
  modelContent: string,
) {
  try {
    // Embed user message
    const userEmbedding = await generateEmbedding(userContent, "RETRIEVAL_DOCUMENT");
    await updateProjectMessageEmbedding(admin, userMessageId, userContent.slice(0, 500), userEmbedding);

    // Embed model message (use first 500 chars as summary)
    const modelSummary = modelContent.includes("<edit>")
      ? "Applied code edits to screen"
      : modelContent.slice(0, 500);
    const modelEmbedding = await generateEmbedding(modelSummary, "RETRIEVAL_DOCUMENT");
    await updateProjectMessageEmbedding(admin, modelMessageId, modelSummary, modelEmbedding);
  } catch (error) {
    console.error("Failed to embed chat messages", error);
  }
}
