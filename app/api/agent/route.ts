import { Buffer } from "node:buffer";

import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { routeAgentPrompt } from "@/lib/agent/router";
import { normalizeDesignTokens } from "@/lib/design-tokens";
import { persistProjectMessageMemory, persistProjectMessageMemoryPair } from "@/lib/generation/message-memory";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { insertProjectMessage } from "@/lib/supabase/queries";
import { ACTIVE_GENERATION_STATUSES, type DesignTokens, type GenerationStatus, type NavigationPlan, type ProjectCharter, type PromptImagePayload } from "@/lib/types";
import type { generateUiFlowTask } from "@/trigger/generate-ui-flow";
import type { modifyScreenTask } from "@/trigger/modify-screen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().trim().max(10000),
  image: z
    .object({
      data: z.string().min(1),
      mimeType: z.string().min(1),
    })
    .nullable()
    .optional(),
  selectedScreenId: z.string().uuid().nullable().optional(),
  focusedScreenId: z.string().uuid().nullable().optional(),
  selectedElementHtml: z.string().nullable().optional(),
  selectedElementDrawgleId: z.string().nullable().optional(),
  selectedElementTarget: z.enum(["screen", "navigation"]).nullable().optional(),
  selectedElementPreview: z.string().nullable().optional(),
}).superRefine((value, ctx) => {
  if (!value.prompt.trim() && !value.image) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide a prompt or image.",
      path: ["prompt"],
    });
  }
});

const now = () => new Date().toISOString();
const providerLeakPattern = /\b(gemini|google|openai|gpt|anthropic|claude|model provider|large language model|llm|system prompt|tool call|router)\b/i;
const identityQuestionPattern = /\b(who are you|what are you|which model|what model|are you gemini|are you gpt|powered by|who built you)\b/i;

const whiteLabelAgentMessage = (prompt: string, message?: string | null) => {
  const fallback = "I am Drawgle AI, your mobile app design assistant. I can help you create new screens, edit existing designs, and refine UI details on this canvas.";
  const cleanMessage = message?.trim() || fallback;

  if (identityQuestionPattern.test(prompt) || providerLeakPattern.test(cleanMessage)) {
    return fallback;
  }

  return cleanMessage;
};

async function findActiveGenerationRun(admin: ReturnType<typeof createAdminClient>, projectId: string) {
  const { data, error } = await admin
    .from("generation_runs")
    .select("id, status")
    .eq("project_id", projectId)
    .in("status", [...ACTIVE_GENERATION_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as { id: string; status: GenerationStatus } | null;
}

const uploadPromptImage = async ({
  admin,
  ownerId,
  image,
}: {
  admin: ReturnType<typeof createAdminClient>;
  ownerId: string;
  image?: PromptImagePayload | null;
}) => {
  if (!image) {
    return null;
  }

  const extension = image.mimeType.split("/")[1] ?? "bin";
  const imagePath = `${ownerId}/prompt-images/${crypto.randomUUID()}.${extension}`;

  const { error } = await admin.storage
    .from("generation-assets")
    .upload(imagePath, Buffer.from(image.data, "base64"), {
      contentType: image.mimeType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return imagePath;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = requestSchema.parse(await request.json());
    const prompt = payload.prompt.trim();

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, owner_id, design_tokens, project_charter")
      .eq("id", payload.projectId)
      .maybeSingle();

    if (projectError || !project || project.owner_id !== user.id) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const [{ data: screens, error: screensError }, { data: projectNavigation }, activeGeneration] = await Promise.all([
      admin
        .from("screens")
        .select("id, name, status, summary, chrome_policy, navigation_item_id")
        .eq("project_id", payload.projectId)
        .order("sort_index", { ascending: true }),
      admin
        .from("project_navigation")
        .select("plan")
        .eq("project_id", payload.projectId)
        .maybeSingle(),
      findActiveGenerationRun(admin, payload.projectId),
    ]);

    if (screensError) {
      throw screensError;
    }

    const screenContext = (screens ?? []).map((screen) => {
      const chromePolicy = screen.chrome_policy &&
        typeof screen.chrome_policy === "object" &&
        !Array.isArray(screen.chrome_policy)
        ? screen.chrome_policy as { chrome?: unknown }
        : null;

      return {
        id: screen.id,
        name: screen.name,
        status: screen.status,
        summary: screen.summary,
        chrome: typeof chromePolicy?.chrome === "string" ? chromePolicy.chrome : null,
        navigationItemId: screen.navigation_item_id,
      };
    });
    const selectedScreenId = payload.selectedScreenId ?? payload.focusedScreenId ?? null;
    const navigationPlan = (projectNavigation?.plan as NavigationPlan | null) ?? null;
    const routerDecision = await routeAgentPrompt({
      prompt,
      hasImage: Boolean(payload.image),
      activeScreenId: selectedScreenId,
      selectedElement: {
        targetType: payload.selectedElementTarget ?? null,
        drawgleId: payload.selectedElementDrawgleId ?? null,
        textPreview: payload.selectedElementPreview ?? null,
      },
      screens: screenContext,
      navigation: navigationPlan
        ? {
            enabled: navigationPlan.enabled,
            kind: navigationPlan.kind,
            itemLabels: navigationPlan.items.map((item) => item.label),
          }
        : null,
      activeGeneration: activeGeneration ? { id: activeGeneration.id, status: activeGeneration.status } : null,
    });

    const routerMetadata = {
      agentRouter: {
        tool: routerDecision.tool,
        confidence: routerDecision.confidence,
        reason: routerDecision.reason,
        targetScreenId: routerDecision.targetScreenId ?? null,
        targetType: routerDecision.targetType ?? null,
        targetScope: routerDecision.targetScope ?? null,
      },
    };

    if (routerDecision.tool === "chat_response") {
      const message = whiteLabelAgentMessage(prompt, routerDecision.message);

      const userMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "user",
        content: prompt || "[image]",
        messageType: "chat",
        metadata: routerMetadata,
      });

      const modelMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "model",
        content: message,
        messageType: "chat",
        metadata: routerMetadata,
      });

      await persistProjectMessageMemoryPair({
        admin,
        userMessageId: userMessage.id,
        userContent: prompt || "[image]",
        modelMessageId: modelMessage.id,
        modelContent: message,
      }).catch((error) => {
        console.error("Failed to persist agent chat memory", error);
      });

      return NextResponse.json({
        intent: "chat_response",
        message,
        routerDecision,
      });
    }

    if (routerDecision.tool === "create_new_screen") {
      if (activeGeneration) {
        const message = "A screen generation is already running. Let that finish, then ask me for the next screen.";

        const userMessage = await insertProjectMessage(admin, {
          projectId: payload.projectId,
          ownerId: user.id,
          screenId: null,
          role: "user",
          content: prompt || "[image]",
          messageType: "chat",
          metadata: routerMetadata,
        });
        const modelMessage = await insertProjectMessage(admin, {
          projectId: payload.projectId,
          ownerId: user.id,
          screenId: null,
          role: "model",
          content: message,
          messageType: "chat",
          metadata: {
            ...routerMetadata,
            activeGenerationRunId: activeGeneration.id,
          },
        });

        await persistProjectMessageMemoryPair({
          admin,
          userMessageId: userMessage.id,
          userContent: prompt || "[image]",
          modelMessageId: modelMessage.id,
          modelContent: message,
        }).catch((error) => {
          console.error("Failed to persist active-generation chat memory", error);
        });

        return NextResponse.json({ intent: "chat_response", message, routerDecision }, { status: 409 });
      }

      const designTokens = project.design_tokens
        ? normalizeDesignTokens(project.design_tokens as DesignTokens)
        : null;
      const projectCharter = (project.project_charter as ProjectCharter | null) ?? null;
      const imagePath = await uploadPromptImage({
        admin,
        ownerId: user.id,
        image: payload.image ?? null,
      });

      await admin
        .from("projects")
        .update({
          status: "queued",
          updated_at: now(),
        })
        .eq("id", payload.projectId);

      const { data: generationRun, error: generationRunError } = await admin
        .from("generation_runs")
        .insert({
          project_id: payload.projectId,
          owner_id: user.id,
          prompt: routerDecision.instruction?.trim() || prompt,
          image_path: imagePath,
          status: "queued",
          metadata: {
            requestedFrom: "agent-router",
            planningMode: "single-screen",
            routerDecision,
          } as never,
          created_at: now(),
          updated_at: now(),
        })
        .select("id")
        .single();

      if (generationRunError || !generationRun) {
        throw generationRunError ?? new Error("Failed to create generation run.");
      }

      const handle = await tasks.trigger<typeof generateUiFlowTask>(
        "generate-ui-flow",
        {
          generationRunId: generationRun.id,
          projectId: payload.projectId,
          ownerId: user.id,
          prompt: routerDecision.instruction?.trim() || prompt,
          imagePath,
          designTokens,
          plannedScreens: null,
          requiresBottomNav: navigationPlan?.enabled || projectCharter?.navigationArchitecture?.primaryNavigation === "bottom-tabs",
          navigationArchitecture: projectCharter?.navigationArchitecture ?? null,
          navigationPlan,
          projectCharter,
          planningMode: "single-screen",
        },
        {
          concurrencyKey: user.id,
          ttl: "30m",
        },
      );

      await admin
        .from("generation_runs")
        .update({
          trigger_run_id: handle.id,
          updated_at: now(),
        })
        .eq("id", generationRun.id);

      const userMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "user",
        content: prompt || "[image]",
        messageType: "chat",
        metadata: {
          ...routerMetadata,
          generationRunId: generationRun.id,
        },
      });

      await persistProjectMessageMemory({
        admin,
        messageId: userMessage.id,
        role: "user",
        content: prompt || "[image]",
      }).catch((error) => {
        console.error("Failed to persist create-request memory", error);
      });

      return NextResponse.json(
        {
          intent: "create_new_screen",
          generationRunId: generationRun.id,
          triggerRunId: handle.id,
          routerDecision,
        },
        { status: 202 },
      );
    }

    const targetType = routerDecision.targetType ?? payload.selectedElementTarget ?? "screen";
    const targetScope = routerDecision.targetScope ?? (targetType === "navigation" ? "navigation" : "screen");
    const requestTargetsNavigation = targetType === "navigation" || targetScope === "navigation";
    const targetScreenId = requestTargetsNavigation
      ? null
      : routerDecision.targetScreenId && screenContext.some((screen) => screen.id === routerDecision.targetScreenId)
        ? routerDecision.targetScreenId
        : selectedScreenId;
    const originalPromptExplicitlyTargetsWholeScreen =
      /\b(screen|page|full screen|entire screen|whole screen|app background|screen background|layout|overall)\b/i.test(prompt);
    const shouldUseSelectedElement =
      !requestTargetsNavigation &&
      Boolean(payload.selectedElementDrawgleId) &&
      (targetScope === "selected_element" || !originalPromptExplicitlyTargetsWholeScreen);

    if (!requestTargetsNavigation && !targetScreenId) {
      const message = routerDecision.message?.trim() || "Which screen should I modify? Select a screen or mention its name, then tell me the change.";

      const userMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "user",
        content: prompt || "[image]",
        messageType: "chat",
        metadata: routerMetadata,
      });
      const modelMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "model",
        content: message,
        messageType: "chat",
        metadata: routerMetadata,
      });

      await persistProjectMessageMemoryPair({
        admin,
        userMessageId: userMessage.id,
        userContent: prompt || "[image]",
        modelMessageId: modelMessage.id,
        modelContent: message,
      }).catch((error) => {
        console.error("Failed to persist clarification memory", error);
      });

      return NextResponse.json({ intent: "chat_response", message, routerDecision });
    }

    const userMessage = await insertProjectMessage(admin, {
      projectId: payload.projectId,
      ownerId: user.id,
      screenId: targetScreenId,
      role: "user",
      content: prompt || "[image]",
      messageType: "chat",
      metadata: routerMetadata,
    });
    const activityKey = `edit:${userMessage.id}`;
    const targetScreen = targetScreenId ? screenContext.find((screen) => screen.id === targetScreenId) : null;
    const queuedMessage = await insertProjectMessage(admin, {
      projectId: payload.projectId,
      ownerId: user.id,
      screenId: targetScreenId,
      role: "system",
      content: requestTargetsNavigation
        ? "Queued edit for shared project navigation..."
        : `Queued edit for ${targetScreen?.name ?? "selected screen"}...`,
      messageType: "chat",
      metadata: {
        ...routerMetadata,
        activityKey,
        action: requestTargetsNavigation ? "navigation_edit_queued" : "edit_queued",
        screenName: requestTargetsNavigation ? "Navigation" : targetScreen?.name ?? null,
        userMessageId: userMessage.id,
        editJob: {
          status: "queued",
          targetType: requestTargetsNavigation ? "navigation" : "screen",
          screenId: targetScreenId,
          drawgleId: shouldUseSelectedElement ? payload.selectedElementDrawgleId ?? null : null,
        },
      },
    });

    const handle = await tasks.trigger<typeof modifyScreenTask>(
      "modify-screen",
      {
        projectId: payload.projectId,
        ownerId: user.id,
        prompt,
        userMessageId: userMessage.id,
        screenId: targetScreenId,
        selectedElementHtml: shouldUseSelectedElement ? payload.selectedElementHtml ?? null : null,
        selectedElementDrawgleId: shouldUseSelectedElement ? payload.selectedElementDrawgleId ?? null : null,
        selectedElementTarget: requestTargetsNavigation ? "navigation" : "screen",
        requestTargetsNavigation,
        routerDecision: routerMetadata.agentRouter,
      },
      {
        concurrencyKey: `edit:${payload.projectId}:${requestTargetsNavigation ? "navigation" : targetScreenId}`,
        ttl: "10m",
      },
    );

    await admin
      .from("project_messages")
      .update({
        metadata: {
          ...routerMetadata,
          activityKey,
          action: requestTargetsNavigation ? "navigation_edit_queued" : "edit_queued",
          screenName: requestTargetsNavigation ? "Navigation" : targetScreen?.name ?? null,
          userMessageId: userMessage.id,
          triggerRunId: handle.id,
          editJob: {
            status: "queued",
            targetType: requestTargetsNavigation ? "navigation" : "screen",
            screenId: targetScreenId,
            drawgleId: shouldUseSelectedElement ? payload.selectedElementDrawgleId ?? null : null,
          },
        } as never,
      })
      .eq("id", queuedMessage.id);

    return NextResponse.json(
      {
        intent: "modify_screen",
        triggerRunId: handle.id,
        targetType: requestTargetsNavigation ? "navigation" : "screen",
        screenId: targetScreenId,
        routerDecision,
      },
      { status: 202 },
    );
  } catch (error: unknown) {
    console.error("Agent route error", error);
    const message = error instanceof Error ? error.message : "Internal server error";

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid agent request.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
