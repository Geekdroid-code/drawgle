import { randomUUID } from "crypto";

import { logger, runs, streams, task } from "@trigger.dev/sdk";

import { hasApprovedDesignTokens } from "@/lib/design-tokens";
import { indexScreenCode } from "@/lib/generation/block-index";
import { assembleProjectContext } from "@/lib/generation/context";
import { generateEmbedding, generateScreenSummary } from "@/lib/generation/embeddings";
import { buildScreenStream, extractCode, planUiFlow } from "@/lib/generation/service";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { DesignTokens, PromptImagePayload, ProjectCharter, ScreenPlan } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

type GenerateUiFlowPayload = {
  generationRunId: string;
  projectId: string;
  ownerId: string;
  prompt: string;
  designTokens?: DesignTokens | null;
  imagePath?: string | null;
  plannedScreens?: ScreenPlan[] | null;
  requiresBottomNav?: boolean;
  projectCharter?: ProjectCharter | null;
};

type BuildScreenTaskPayload = {
  screenId: string;
  projectId: string;
  screenPlan: ScreenPlan;
  prompt: string;
  designTokens?: DesignTokens | null;
  image?: PromptImagePayload | null;
  requiresBottomNav: boolean;
  projectContext?: string | null;
};

type ReservedScreenSlot = Database["public"]["Functions"]["reserve_screen_slots"]["Returns"][number];

const now = () => new Date().toISOString();

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildPlaceholderCode = (screenName: string, designTokens?: DesignTokens | null) => {
  const background = designTokens?.tokens?.color?.background?.primary ?? "#f8fafc";
  const foreground = designTokens?.tokens?.color?.text?.high_emphasis ?? "#111827";

  return `<div class="min-h-screen w-full flex flex-col items-center justify-center gap-4" style="background:${background};color:${foreground}">
    <div class="w-10 h-10 rounded-full border-4 border-black/10 border-t-black/70 animate-spin"></div>
    <div class="text-sm font-semibold tracking-wide uppercase">Building</div>
    <div class="text-lg font-medium">${escapeHtml(screenName)}</div>
  </div>`;
};

const buildErrorCode = (message: string) => `<div class="min-h-screen w-full flex flex-col items-center justify-center gap-3 bg-red-50 text-red-700 px-6 text-center">
  <div class="text-lg font-semibold">Generation failed</div>
  <div class="text-sm leading-6">${escapeHtml(message)}</div>
</div>`;

async function updateProject(admin: AdminClient, projectId: string, patch: Database["public"]["Tables"]["projects"]["Update"]) {
  const { error } = await admin.from("projects").update({ ...patch, updated_at: now() }).eq("id", projectId);
  if (error) {
    throw error;
  }
}

async function updateGenerationRun(
  admin: AdminClient,
  generationRunId: string,
  patch: Database["public"]["Tables"]["generation_runs"]["Update"],
) {
  const { error } = await admin
    .from("generation_runs")
    .update({ ...patch, updated_at: now() })
    .eq("id", generationRunId);

  if (error) {
    throw error;
  }
}

async function loadPromptImage(admin: AdminClient, imagePath?: string | null): Promise<PromptImagePayload | null> {
  if (!imagePath) {
    return null;
  }

  const { data, error } = await admin.storage.from("generation-assets").download(imagePath);
  if (error) {
    throw error;
  }

  const arrayBuffer = await data.arrayBuffer();
  return {
    data: Buffer.from(arrayBuffer).toString("base64"),
    mimeType: data.type || "application/octet-stream",
  };
}

async function reserveScreenSlots(admin: AdminClient, projectId: string, slotCount: number) {
  const { data, error } = await admin.rpc("reserve_screen_slots", {
    input_project_id: projectId,
    input_slot_count: slotCount,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as ReservedScreenSlot[];
}

export const buildScreenTask = task({
  id: "build-screen",
  retry: {
    maxAttempts: 3,
    factor: 1.8,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
    randomize: true,
  },
  queue: {
    // Per-project limit via concurrencyKey at trigger time.  Each project
    // gets its own virtual queue capped at 2 concurrent Gemini streaming
    // calls, which avoids 429 rate-limit errors while still letting
    // different users build in parallel.
    concurrencyLimit: 2,
  },
  maxDuration: 300,
  run: async (payload: BuildScreenTaskPayload) => {
    // Pipe the Gemini async generator so the frontend can subscribe
    // via useRealtimeRunWithStreams and render partial HTML in real time.
    const { stream: codeStream } = await streams.pipe(
      "code",
      buildScreenStream({
        screenPlan: payload.screenPlan,
        designTokens: payload.designTokens,
        prompt: payload.prompt,
        image: payload.image,
        requiresBottomNav: payload.requiresBottomNav,
        projectContext: payload.projectContext,
      }),
    );

    // Consume the tee'd stream locally to accumulate the full response.
    let rawText = "";
    for await (const chunk of codeStream) {
      rawText += chunk;
    }

    const code = extractCode(rawText);
    const blockIndex = indexScreenCode(code);

    // Persist the final code directly so the parent only polls for status.
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from("screens")
      .update({
        code,
        block_index: blockIndex as never,
        status: "ready",
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.screenId);

    if (updateError) {
      logger.error("Failed to persist screen code", {
        screenId: payload.screenId,
        error: updateError,
      });
      throw updateError;
    }

    // Fire-and-forget: enrich the screen with a semantic embedding so it
    // can be retrieved as context for future generations.  This runs as a
    // separate child task so buildScreenTask reaches COMPLETED immediately
    // after saving the code — unblocking the parent from starting the next
    // screen without waiting 1-2 minutes for extra Gemini API calls.
    await enrichScreenTask.trigger(
      {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        code,
      },
      {
        // Use a separate concurrency namespace so embedding calls never
        // compete with build-screen streaming for Gemini API quota.
        concurrencyKey: `enrich-${payload.projectId}`,
      },
    );

    logger.info("Built screen", {
      screenId: payload.screenId,
      screenName: payload.screenPlan.name,
    });

    return { screenId: payload.screenId };
  },
});

export const enrichScreenTask = task({
  id: "enrich-screen",
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 15000,
  },
  maxDuration: 120,
  run: async ({ screenId, screenName, code }: { screenId: string; screenName: string; code: string }) => {
    const admin = createAdminClient();

    const summary = await generateScreenSummary(screenName, code);
    const embedding = await generateEmbedding(summary, "RETRIEVAL_DOCUMENT");

    const { error } = await admin
      .from("screens")
      .update({
        summary,
        embedding: embedding as never,
        updated_at: new Date().toISOString(),
      })
      .eq("id", screenId);

    if (error) {
      throw error;
    }

    logger.info("Enriched screen embedding", { screenId, screenName });
  },
});

export const generateUiFlowTask = task({
  id: "generate-ui-flow",
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 30000,
    randomize: true,
  },
  queue: {
    concurrencyLimit: 4,
  },
  maxDuration: 900,
  onFailure: async ({ payload, error }) => {
    const admin = createAdminClient();
    const message = error instanceof Error ? error.message : String(error);

    await updateGenerationRun(admin, payload.generationRunId, {
      status: "failed",
      error: message,
      completed_at: now(),
    });

    await updateProject(admin, payload.projectId, {
      status: "failed",
    });

    // Mark any placeholder screens from this run as failed so they
    // don't stay stuck in the "building" spinner forever.
    await admin
      .from("screens")
      .update({
        status: "failed",
        error: message,
        code: buildErrorCode(message),
        updated_at: now(),
      })
      .eq("generation_run_id", payload.generationRunId)
      .eq("status", "building");
  },
  run: async (payload: GenerateUiFlowPayload) => {
    const admin = createAdminClient();

    if (!hasApprovedDesignTokens(payload.designTokens)) {
      throw new Error("Approved design tokens are required before planning or building screens.");
    }

    const designTokens = payload.designTokens;

    await updateProject(admin, payload.projectId, {
      status: "generating",
      design_tokens: designTokens as never,
      project_charter: (payload.projectCharter ?? null) as never,
    });

    await updateGenerationRun(admin, payload.generationRunId, {
      status: "planning",
      error: null,
    });

    const [promptImage, planningContext] = await Promise.all([
      loadPromptImage(admin, payload.imagePath),
      assembleProjectContext({
        admin,
        projectId: payload.projectId,
        userPrompt: payload.prompt,
      }),
    ]);

    logger.info("Assembled project context", {
      generationRunId: payload.generationRunId,
      projectId: payload.projectId,
      contextChars: planningContext.length,
      approxTokens: Math.round(planningContext.length / 4),
    });

    const plan = payload.plannedScreens && payload.plannedScreens.length > 0
      ? {
          requiresBottomNav: payload.requiresBottomNav ?? false,
          charter: payload.projectCharter ?? null,
          screens: payload.plannedScreens,
        }
      : await planUiFlow({
          prompt: payload.prompt,
          image: promptImage,
          designTokens,
          projectContext: planningContext,
        });

    if (plan.charter) {
      await updateProject(admin, payload.projectId, {
        project_charter: plan.charter as never,
      });
    }

    const buildContext = payload.plannedScreens && payload.plannedScreens.length > 0
      ? planningContext
      : await assembleProjectContext({
          admin,
          projectId: payload.projectId,
          userPrompt: payload.prompt,
        });

    const screenPlans = plan.screens.length > 0 ? plan.screens : [{
      name: "New Screen",
      type: "root",
      description: payload.prompt,
    }];

    const reservedSlots = await reserveScreenSlots(admin, payload.projectId, screenPlans.length);

    await updateGenerationRun(admin, payload.generationRunId, {
      status: "building",
      requires_bottom_nav: plan.requiresBottomNav,
      requested_screen_count: screenPlans.length,
    });

    // Concurrent execution: trigger ALL build-screen tasks at once so
    // every screen starts streaming to the canvas immediately.  Trigger.dev's
    // per-project concurrencyKey (limit 2) ensures at most 2 Gemini streaming
    // calls per project — avoiding 429 rate limits while keeping throughput
    // high.  Screens beyond the limit queue in Trigger.dev and auto-start
    // as slots open.  All screens get stream tokens from the trigger call
    // immediately, so the frontend can subscribe before execution begins.
    //
    // For each screen we trigger the build task FIRST, grab the handle
    // (which carries publicAccessToken), then INSERT the placeholder row
    // with trigger_run_id + stream_public_token already set so the
    // frontend subscribes from the very first Realtime INSERT event.
    let successfulScreens = 0;
    let failedScreens = 0;

    type ScreenHandle = {
      screenId: string;
      handleId: string;
    };

    // Phase 1: trigger all builds and insert placeholders concurrently.
    const screenHandles: ScreenHandle[] = [];

    await Promise.all(
      screenPlans.map(async (screenPlan, index) => {
        const screenId = randomUUID();

        try {
          const handle = await (buildScreenTask as any).trigger(
            {
              screenId,
              projectId: payload.projectId,
              screenPlan,
              prompt: payload.prompt,
              designTokens,
              image: index === 0 ? promptImage : null,
              requiresBottomNav: plan.requiresBottomNav,
              projectContext: buildContext,
            },
            {
              // Each unique concurrencyKey gets its own copy of the task's
              // queue (concurrencyLimit: 2).  This means each project can
              // run at most 2 Gemini streaming calls at once — enough
              // throughput to feel fast while staying under rate limits.
              // Different projects are fully independent.
              concurrencyKey: `project-${payload.projectId}`,
            },
          );

          const { error: insertError } = await admin
            .from("screens")
            .insert({
              id: screenId,
              owner_id: payload.ownerId,
              project_id: payload.projectId,
              generation_run_id: payload.generationRunId,
              name: screenPlan.name,
              prompt: screenPlan.description,
              code: buildPlaceholderCode(screenPlan.name, designTokens),
              status: "building",
              trigger_run_id: handle.id,
              stream_public_token: handle.publicAccessToken ?? null,
              position_x: reservedSlots[index]?.position_x ?? 4800 + index * 450,
              position_y: reservedSlots[index]?.position_y ?? 4600,
              sort_index: reservedSlots[index]?.sort_index ?? index,
              created_at: now(),
              updated_at: now(),
            });

          if (insertError) {
            throw new Error(`Failed to insert placeholder for "${screenPlan.name}": ${insertError.message}`);
          }

          screenHandles.push({ screenId, handleId: handle.id });
        } catch (triggerError) {
          failedScreens += 1;
          logger.error("Failed to trigger/insert screen", {
            screenName: screenPlan.name,
            error: triggerError,
          });
        }
      }),
    );

    // Phase 2: poll all running builds concurrently.
    await Promise.all(
      screenHandles.map(async ({ screenId, handleId }) => {
        try {
          const result = await runs.poll(handleId, { pollIntervalMs: 2000 });

          if (result?.status === "COMPLETED") {
            successfulScreens += 1;
          } else {
            failedScreens += 1;
            const message = result?.error?.message ?? "Unknown error";
            await admin
              .from("screens")
              .update({
                code: buildErrorCode(message),
                status: "failed",
                error: message,
                updated_at: now(),
              })
              .eq("id", screenId);
          }
        } catch (pollError) {
          failedScreens += 1;
          const message = pollError instanceof Error ? pollError.message : String(pollError);
          await admin
            .from("screens")
            .update({
              code: buildErrorCode(message),
              status: "failed",
              error: message,
              updated_at: now(),
            })
            .eq("id", screenId);
        }
      }),
    );

    const finishedStatus = successfulScreens === 0 ? "failed" : "completed";
    const errorSummary = failedScreens > 0 ? `${failedScreens} screen(s) failed during generation.` : null;

    await updateGenerationRun(admin, payload.generationRunId, {
      status: finishedStatus,
      error: errorSummary,
      completed_at: now(),
      metadata: {
        successfulScreens,
        failedScreens,
      } as never,
    });

    await updateProject(admin, payload.projectId, {
      status: finishedStatus === "completed" ? "completed" : "failed",
    });

    logger.info("UI flow generation completed", {
      generationRunId: payload.generationRunId,
      successfulScreens,
      failedScreens,
    });

    return {
      generationRunId: payload.generationRunId,
      successfulScreens,
      failedScreens,
    };
  },
});