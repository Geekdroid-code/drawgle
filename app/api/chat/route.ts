import { detectTargetBlocks, indexScreenCode } from "@/lib/generation/block-index";
import { assembleChatContext } from "@/lib/generation/context";
import { generateEmbedding } from "@/lib/generation/embeddings";
import { editScreenStream } from "@/lib/generation/service";
import { applyEdits } from "@/lib/diff-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  fetchProjectMessages,
  insertProjectMessage,
  updateProjectMessageEmbedding,
} from "@/lib/supabase/queries";
import type { DesignTokens, NavigationArchitecture, ProjectCharter, ScreenBlockIndex } from "@/lib/types";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const {
      projectId,
      prompt,
      selectedScreenId,
      selectedElementHtml,
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

    // Save user message
    const userMessage = await insertProjectMessage(admin, {
      projectId,
      ownerId: user.id,
      screenId: selectedScreenId ?? null,
      role: "user",
      content: prompt.trim(),
      messageType: "chat",
    });

    // Determine intent: if a screen is selected, treat as edit
    if (selectedScreenId) {
      return handleEditIntent({
        admin,
        projectId,
        ownerId: user.id,
        screenId: selectedScreenId,
        prompt: prompt.trim(),
        userMessageId: userMessage.id,
        designTokens: (project.design_tokens as DesignTokens | null) ?? null,
        navigationArchitecture: ((project.project_charter as ProjectCharter | null)?.navigationArchitecture ?? null) as NavigationArchitecture | null,
        selectedElementHtml: typeof selectedElementHtml === "string" && selectedElementHtml.length > 0
          ? selectedElementHtml
          : null,
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
  navigationArchitecture,
  selectedElementHtml,
}: {
  admin: ReturnType<typeof createAdminClient>;
  projectId: string;
  ownerId: string;
  screenId: string;
  prompt: string;
  userMessageId: string;
  designTokens?: DesignTokens | null;
  navigationArchitecture?: NavigationArchitecture | null;
  /** The outerHTML of a visually selected element, or null for block-index fallback. */
  selectedElementHtml?: string | null;
}) {
  // Fetch screen (use admin to bypass RLS — ownership already verified)
  const { data: screen, error: screenError } = await admin
    .from("screens")
    .select("id, name, code, block_index")
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

  await insertProjectMessage(admin, {
    projectId,
    ownerId,
    screenId,
    role: "system",
    content: `Editing ${targetNames} in ${screen.name}...`,
    messageType: "chat",
    metadata: { action: "edit_start", targetBlockIds },
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
          const nextCode = applyEdits(screenCode, fullResponse);

          if (nextCode === screenCode) {
            await insertProjectMessage(admin, {
              projectId,
              ownerId,
              screenId,
              role: "system",
              content: `No material code changes were applied to ${screen.name}.`,
              messageType: "chat",
              metadata: { action: "edit_noop" },
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

          const modelMessage = await insertProjectMessage(admin, {
            projectId,
            ownerId,
            screenId,
            role: "model",
            content: fullResponse,
            messageType: "edit_applied",
            metadata: { screenName: screen.name },
          });

          void embedMessagePair(admin, userMessageId, prompt, modelMessage.id, fullResponse);
          controller.close();
          return;
        }

        const modelMessage = await insertProjectMessage(admin, {
          projectId,
          ownerId,
          screenId,
          role: "model",
          content: fullResponse,
          messageType: "chat",
          metadata: {},
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
