import { logger, runs, streams, task } from "@trigger.dev/sdk";

import { buildScreenStream, extractCode, getDefaultDesignTokens, planUiFlow } from "@/lib/generation/service";
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
  screenPlan: ScreenPlan;
  prompt: string;
  designTokens?: DesignTokens | null;
  image?: PromptImagePayload | null;
  requiresBottomNav: boolean;
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
    concurrencyLimit: 8,
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
      }),
    );

    // Consume the tee'd stream locally to accumulate the full response.
    let rawText = "";
    for await (const chunk of codeStream) {
      rawText += chunk;
    }

    const code = extractCode(rawText);

    // Persist the final code directly so the parent only polls for status.
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from("screens")
      .update({
        code,
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

    logger.info("Built screen", {
      screenId: payload.screenId,
      screenName: payload.screenPlan.name,
    });

    return { screenId: payload.screenId };
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

    await updateProject(admin, payload.projectId, {
      status: "generating",
      design_tokens: (payload.designTokens ?? getDefaultDesignTokens()) as never,
      project_charter: (payload.projectCharter ?? null) as never,
    });

    await updateGenerationRun(admin, payload.generationRunId, {
      status: "planning",
      error: null,
    });

    const promptImage = await loadPromptImage(admin, payload.imagePath);
    const plan = payload.plannedScreens && payload.plannedScreens.length > 0
      ? {
          requiresBottomNav: payload.requiresBottomNav ?? false,
          charter: payload.projectCharter ?? null,
          screens: payload.plannedScreens,
        }
      : await planUiFlow({
          prompt: payload.prompt,
          image: promptImage,
          designTokens: payload.designTokens,
        });

    if (plan.charter) {
      await updateProject(admin, payload.projectId, {
        project_charter: plan.charter as never,
      });
    }

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

    const placeholderScreens: Database["public"]["Tables"]["screens"]["Insert"][] = screenPlans.map((screenPlan, index) => ({
      owner_id: payload.ownerId,
      project_id: payload.projectId,
      generation_run_id: payload.generationRunId,
      name: screenPlan.name,
      prompt: screenPlan.description,
      code: buildPlaceholderCode(screenPlan.name, payload.designTokens),
      status: "building",
      position_x: reservedSlots[index]?.position_x ?? 4800 + index * 450,
      position_y: reservedSlots[index]?.position_y ?? 4600,
      sort_index: reservedSlots[index]?.sort_index ?? index,
      created_at: now(),
      updated_at: now(),
    }));

    const { data: insertedScreens, error: insertError } = await admin
      .from("screens")
      .insert(placeholderScreens)
      .select("id, name, sort_index");

    if (insertError) {
      throw insertError;
    }

    const buildPayloads = (insertedScreens ?? []).map((screen, index) => ({
      screenId: screen.id,
      screenPlan: screenPlans[index],
      prompt: payload.prompt,
      designTokens: payload.designTokens,
      image: index === 0 ? promptImage : null,
      requiresBottomNav: plan.requiresBottomNav,
    }));

    // Sequential "domino" execution: trigger one screen at a time so we
    // never blast the Gemini API with concurrent requests that hit TPM /
    // RPM rate limits (HTTP 429) and trigger exponential back-off.
    // Each screen streams to the canvas as it builds, giving the user
    // something to watch while the next one is queued.
    let successfulScreens = 0;
    let failedScreens = 0;

    for (const [index, buildPayload] of buildPayloads.entries()) {
      const screen = insertedScreens?.[index];
      if (!screen) continue;

      try {
        // Trigger the child run and immediately persist its stream token
        // so the frontend can subscribe before the first chunk arrives.
        const handle = await (buildScreenTask as any).trigger(buildPayload);

        const { error: screenUpdateError } = await admin
          .from("screens")
          .update({
            trigger_run_id: handle.id,
            stream_public_token: handle.publicAccessToken ?? null,
            updated_at: now(),
          })
          .eq("id", screen.id);

        if (screenUpdateError) {
          throw new Error(
            `Failed to save trigger_run_id to screen ${screen.id}: ${screenUpdateError.message}`,
          );
        }

        // Wait for this screen to finish before starting the next one.
        const result = await runs.poll(handle.id, { pollIntervalMs: 2000 });

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
            .eq("id", screen.id);
        }
      } catch (screenError) {
        failedScreens += 1;
        const message = screenError instanceof Error ? screenError.message : String(screenError);
        await admin
          .from("screens")
          .update({
            code: buildErrorCode(message),
            status: "failed",
            error: message,
            updated_at: now(),
          })
          .eq("id", screen.id);
      }
    }

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