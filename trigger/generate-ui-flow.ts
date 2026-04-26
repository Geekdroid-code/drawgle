import { randomUUID } from "crypto";

import { logger, runs, streams, task } from "@trigger.dev/sdk";

import { ensureDrawgleIds } from "@/lib/drawgle-dom";
import { indexScreenCode } from "@/lib/generation/block-index";
import { assembleProjectContext } from "@/lib/generation/context";
import { generateEmbedding, generateScreenSummary } from "@/lib/generation/embeddings";
import { buildNavigationShellCode, buildScreenStream, extractCode, fallbackProjectCharter, planUiFlow } from "@/lib/generation/service";
import { createNavigationArchitecture, deriveRequiresBottomNav } from "@/lib/navigation";
import {
  applyNavigationPlanToScreens,
  indexNavigationShell,
  normalizeNavigationPlan,
  sanitizeScreenCodeForSharedNavigation,
} from "@/lib/project-navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { DesignTokens, NavigationArchitecture, NavigationPlan, PromptImagePayload, ProjectCharter, ScreenPlan } from "@/lib/types";

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
  navigationArchitecture?: NavigationArchitecture | null;
  navigationPlan?: NavigationPlan | null;
  projectCharter?: ProjectCharter | null;
};

type BuildScreenTaskPayload = {
  generationRunId: string;
  screenId: string;
  projectId: string;
  screenPlan: ScreenPlan;
  prompt: string;
  designTokens?: DesignTokens | null;
  image?: PromptImagePayload | null;
  requiresBottomNav: boolean;
  navigationArchitecture?: NavigationArchitecture | null;
  navigationPlan?: NavigationPlan | null;
  projectContext?: string | null;
};


type ReservedScreenSlot = Database["public"]["Functions"]["reserve_screen_slots"]["Returns"][number];

const now = () => new Date().toISOString();
const planningActivityKey = (generationRunId: string) => `run:${generationRunId}:planning`;
const summaryActivityKey = (generationRunId: string) => `run:${generationRunId}:summary`;
const screenBuildActivityKey = (screenId: string) => `screen:${screenId}:build`;

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

async function mergeGenerationRunMetadata(
  admin: AdminClient,
  generationRunId: string,
  metadataPatch: Record<string, unknown>,
) {
  const { data, error } = await admin
    .from("generation_runs")
    .select("metadata")
    .eq("id", generationRunId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const currentMetadata = data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
    ? data.metadata as Record<string, unknown>
    : {};

  await updateGenerationRun(admin, generationRunId, {
    metadata: {
      ...currentMetadata,
      ...metadataPatch,
    } as never,
  });
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

async function postStatusMessage(
  admin: AdminClient,
  projectId: string,
  ownerId: string,
  content: string,
  messageType: Database["public"]["Tables"]["project_messages"]["Insert"]["message_type"],
  metadata: Record<string, unknown> = {},
  screenId?: string | null,
) {
  try {
    const activityKey = typeof metadata.activityKey === "string" && metadata.activityKey.trim()
      ? metadata.activityKey
      : null;

    if (activityKey) {
      let existingMessageQuery = admin
        .from("project_messages")
        .select("id, metadata")
        .eq("project_id", projectId)
        .eq("owner_id", ownerId)
        .contains("metadata", { activityKey })
        .order("created_at", { ascending: false })
        .limit(1);

      existingMessageQuery = screenId
        ? existingMessageQuery.eq("screen_id", screenId)
        : existingMessageQuery.is("screen_id", null);

      const { data: existingMessage, error: existingMessageError } = await existingMessageQuery.maybeSingle();

      if (existingMessageError) {
        logger.warn("Failed to find existing status message; inserting a new one", {
          activityKey,
          error: existingMessageError,
        });
      } else if (existingMessage) {
        const existingMetadata = existingMessage.metadata &&
          typeof existingMessage.metadata === "object" &&
          !Array.isArray(existingMessage.metadata)
          ? existingMessage.metadata as Record<string, unknown>
          : {};

        const { error: updateError } = await admin
          .from("project_messages")
          .update({
            content,
            message_type: messageType ?? "chat",
            metadata: {
              ...existingMetadata,
              ...metadata,
            } as never,
            screen_id: screenId ?? null,
          })
          .eq("id", existingMessage.id);

        if (updateError) {
          logger.warn("Failed to update existing status message; inserting a new one", {
            activityKey,
            messageId: existingMessage.id,
            error: updateError,
          });
        } else {
          return;
        }
      }
    }

    await admin.from("project_messages").insert({
      project_id: projectId,
      owner_id: ownerId,
      screen_id: screenId ?? null,
      role: "system",
      content,
      message_type: messageType ?? "chat",
      metadata: metadata as never,
    });
  } catch (err) {
    logger.warn("Failed to post status message", { content, error: err });
  }
}

export const buildScreenTask = task({
  id: "build-screen",
  retry: {
    // One generation attempt per screen build avoids silent duplicate LLM
    // charges when upstream output or infrastructure is flaky.
    maxAttempts: 1,
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
        navigationArchitecture: payload.navigationArchitecture,
        navigationPlan: payload.navigationPlan,
        projectContext: payload.projectContext,
      }),
    );

    // Consume the tee'd stream locally to accumulate the full response.
    let rawText = "";
    for await (const chunk of codeStream) {
      rawText += chunk;
    }

    const extractedCode = extractCode(rawText);
    const code = ensureDrawgleIds(sanitizeScreenCodeForSharedNavigation(extractedCode, payload.screenPlan)).code;
    const blockIndex = indexScreenCode(code);

    // Persist the final code directly so the parent only polls for status.
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from("screens")
      .update({
        code,
        block_index: blockIndex as never,
        chrome_policy: (payload.screenPlan.chromePolicy ?? null) as never,
        navigation_item_id: payload.screenPlan.navigationItemId ?? null,
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
    maxAttempts: 1,
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
    maxAttempts: 1,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 30000,
    randomize: true,
  },
  queue: {
    concurrencyLimit: 4,
  },
  maxDuration: 900,
  onFailure: async ({ payload, error }: { payload: GenerateUiFlowPayload; error: unknown }) => {
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
    const { data: stuckScreens } = await admin
      .from("screens")
      .select("id, name")
      .eq("generation_run_id", payload.generationRunId)
      .eq("status", "building");

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

    await Promise.all((stuckScreens ?? []).map((screen) =>
      postStatusMessage(
        admin,
        payload.projectId,
        payload.ownerId,
        `${screen.name} failed`,
        "error",
        {
          generationRunId: payload.generationRunId,
          screenName: screen.name,
          activityKey: screenBuildActivityKey(screen.id),
          error: message,
        },
        screen.id,
      ),
    ));

    await postStatusMessage(
      admin,
      payload.projectId,
      payload.ownerId,
      "Generation failed",
      "error",
      {
        generationRunId: payload.generationRunId,
        activityKey: summaryActivityKey(payload.generationRunId),
        error: message,
      },
    );
  },
  run: async (payload: GenerateUiFlowPayload) => {
    const admin = createAdminClient();

    const designTokens = payload.designTokens;
    const { data: existingProject } = await admin
      .from("projects")
      .select("project_charter")
      .eq("id", payload.projectId)
      .maybeSingle();
    const existingCharter = (existingProject?.project_charter as ProjectCharter | null) ?? null;
    const requestedNavigationArchitecture = createNavigationArchitecture({
      navigationArchitecture: payload.navigationArchitecture ?? payload.projectCharter?.navigationArchitecture ?? existingCharter?.navigationArchitecture ?? null,
      requiresBottomNav: payload.requiresBottomNav ?? deriveRequiresBottomNav(existingCharter?.navigationArchitecture),
    });

    const projectUpdate: Database["public"]["Tables"]["projects"]["Update"] = {
      status: "generating",
      design_tokens: designTokens as never,
    };

    if (payload.projectCharter !== undefined) {
      projectUpdate.project_charter = (payload.projectCharter ?? null) as never;
    }

    await updateProject(admin, payload.projectId, projectUpdate);

    await updateGenerationRun(admin, payload.generationRunId, {
      status: "planning",
      error: null,
    });

    await postStatusMessage(
      admin,
      payload.projectId,
      payload.ownerId,
      "Planning screens...",
      "generation_started",
      {
        generationRunId: payload.generationRunId,
        activityKey: planningActivityKey(payload.generationRunId),
      },
    );

    const [promptImage, planningContext] = await Promise.all([
      loadPromptImage(admin, payload.imagePath),
      assembleProjectContext({
        admin,
        projectId: payload.projectId,
        userPrompt: payload.prompt,
      }),
    ]);
    const requestedCharter = payload.projectCharter ?? existingCharter ?? (
      payload.plannedScreens && payload.plannedScreens.length > 0
        ? fallbackProjectCharter({
            prompt: payload.prompt,
            image: promptImage,
            navigationArchitecture: requestedNavigationArchitecture,
            existingCharter,
          })
        : null
    );

    logger.info("Assembled project context", {
      generationRunId: payload.generationRunId,
      projectId: payload.projectId,
      contextChars: planningContext.length,
      approxTokens: Math.round(planningContext.length / 4),
    });

    const plan = payload.plannedScreens && payload.plannedScreens.length > 0
      ? {
          requiresBottomNav: deriveRequiresBottomNav(requestedNavigationArchitecture),
          navigationArchitecture: requestedNavigationArchitecture,
          navigationPlan: normalizeNavigationPlan({
            navigationPlan: payload.navigationPlan,
            screens: payload.plannedScreens,
            navigationArchitecture: requestedNavigationArchitecture,
            requiresBottomNav: deriveRequiresBottomNav(requestedNavigationArchitecture),
          }),
          charter: requestedCharter!,
          screens: payload.plannedScreens,
        }
      : await planUiFlow({
          prompt: payload.prompt,
          image: promptImage,
          designTokens,
          projectContext: planningContext,
          existingCharter: requestedCharter,
        });
    plan.screens = applyNavigationPlanToScreens(plan.screens, plan.navigationPlan);

    const navigationShellCode = ensureDrawgleIds(await buildNavigationShellCode({
      navigationPlan: plan.navigationPlan,
      designTokens,
      prompt: payload.prompt,
      image: promptImage,
      projectCharter: plan.charter,
    })).code;

    const { error: navigationUpsertError } = await admin
      .from("project_navigation")
      .upsert({
        project_id: payload.projectId,
        owner_id: payload.ownerId,
        plan: plan.navigationPlan as never,
        shell_code: navigationShellCode,
        block_index: indexNavigationShell(navigationShellCode) as never,
        status: plan.navigationPlan.enabled ? "ready" : "queued",
        error: null,
        updated_at: now(),
      }, { onConflict: "project_id" });

    if (navigationUpsertError) {
      throw navigationUpsertError;
    }

    if (plan.charter) {
      await updateProject(admin, payload.projectId, {
        project_charter: plan.charter as never,
      });
    }

    await mergeGenerationRunMetadata(admin, payload.generationRunId, {
      navigationArchitecture: plan.navigationArchitecture,
      navigationPlan: plan.navigationPlan,
      plannedScreens: plan.screens.map((screenPlan) => ({
        name: screenPlan.name,
        type: screenPlan.type,
        chromePolicy: screenPlan.chromePolicy ?? null,
        navigationItemId: screenPlan.navigationItemId ?? null,
      })),
    });

    const buildContext = payload.plannedScreens && payload.plannedScreens.length > 0
      ? planningContext
      : await assembleProjectContext({
          admin,
          projectId: payload.projectId,
          userPrompt: payload.prompt,
        });

    const screenPlans: ScreenPlan[] = plan.screens.length > 0 ? plan.screens : [{
      name: "New Screen",
      type: "root",
      description: payload.prompt,
    }];

    await postStatusMessage(
      admin,
      payload.projectId,
      payload.ownerId,
      `Planned ${screenPlans.length} screen${screenPlans.length === 1 ? "" : "s"}`,
      "generation_completed",
      {
        generationRunId: payload.generationRunId,
        plannedScreenCount: screenPlans.length,
        activityKey: planningActivityKey(payload.generationRunId),
      },
    );

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
      screenName: string;
    };

    // Phase 1: trigger all builds and insert placeholders concurrently.
    const screenHandles: ScreenHandle[] = [];

    await Promise.all(
      screenPlans.map(async (screenPlan, index) => {
        const screenId = randomUUID();

        try {
          const handle = await (buildScreenTask as any).trigger(
            {
              generationRunId: payload.generationRunId,
              screenId,
              projectId: payload.projectId,
              screenPlan,
              prompt: payload.prompt,
              designTokens,
              image: index === 0 ? promptImage : null,
              requiresBottomNav: plan.requiresBottomNav,
              navigationArchitecture: plan.navigationArchitecture,
              navigationPlan: plan.navigationPlan,
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
              chrome_policy: (screenPlan.chromePolicy ?? null) as never,
              navigation_item_id: screenPlan.navigationItemId ?? null,
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

          screenHandles.push({ screenId, handleId: handle.id, screenName: screenPlan.name });

          await postStatusMessage(
            admin,
            payload.projectId,
            payload.ownerId,
            `Building ${screenPlan.name}...`,
            "generation_started",
            {
              screenName: screenPlan.name,
              generationRunId: payload.generationRunId,
              activityKey: screenBuildActivityKey(screenId),
            },
            screenId,
          );
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
      screenHandles.map(async ({ screenId, handleId, screenName }) => {
        try {
          const result = await runs.poll(handleId, { pollIntervalMs: 2000 });

          if (result?.status === "COMPLETED") {
            successfulScreens += 1;

            await postStatusMessage(
              admin,
              payload.projectId,
              payload.ownerId,
              `${screenName} ready`,
              "generation_completed",
              {
                generationRunId: payload.generationRunId,
                screenName,
                activityKey: screenBuildActivityKey(screenId),
              },
              screenId,
            );
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

            await postStatusMessage(
              admin,
              payload.projectId,
              payload.ownerId,
              `${screenName} failed`,
              "error",
              {
                generationRunId: payload.generationRunId,
                screenName,
                activityKey: screenBuildActivityKey(screenId),
                error: message,
              },
              screenId,
            );
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

          await postStatusMessage(
            admin,
            payload.projectId,
            payload.ownerId,
            `${screenName} failed`,
            "error",
            {
              generationRunId: payload.generationRunId,
              screenName,
              activityKey: screenBuildActivityKey(screenId),
              error: message,
            },
            screenId,
          );
        }
      }),
    );

    const finishedStatus = successfulScreens === 0 ? "failed" : "completed";
    const errorSummary = failedScreens > 0 ? `${failedScreens} screen(s) failed during generation.` : null;

    await updateGenerationRun(admin, payload.generationRunId, {
      status: finishedStatus,
      error: errorSummary,
      completed_at: now(),
    });

    await mergeGenerationRunMetadata(admin, payload.generationRunId, {
      successfulScreens,
      failedScreens,
    });

    await updateProject(admin, payload.projectId, {
      status: finishedStatus === "completed" ? "completed" : "failed",
    });

    const completionContent = finishedStatus === "completed"
      ? `Created ${successfulScreens} screen${successfulScreens === 1 ? "" : "s"}`
      : `Generation finished with ${failedScreens} failure${failedScreens > 1 ? "s" : ""}`;

    await postStatusMessage(
      admin,
      payload.projectId,
      payload.ownerId,
      completionContent,
      finishedStatus === "completed" ? "generation_completed" : "error",
      {
        generationRunId: payload.generationRunId,
        successfulScreens,
        failedScreens,
        activityKey: summaryActivityKey(payload.generationRunId),
      },
    );

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
