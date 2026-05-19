import { randomUUID } from "crypto";

import { logger, runs, streams, task } from "@trigger.dev/sdk";

import { ensureDrawgleIds } from "@/lib/drawgle-dom";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import { loadCuratedStyleReferenceImage, matchCuratedStyleReference } from "@/lib/generation/curated-style-references";
import { indexScreenCode } from "@/lib/generation/block-index";
import { assembleProjectContext } from "@/lib/generation/context";
import { generateEmbedding, generateScreenSummary } from "@/lib/generation/embeddings";
import {
  buildScreenHealthError,
  detectScreenHealth,
  hasGenerationCompleteSentinel,
  isBlockingScreenHealthFailure,
  screenStatusForHealth,
  stripGenerationCompleteSentinel,
  validateSourceCompletion,
  validateGeneratedScreenCode,
  validateScreenAssetPolicy,
  validateStaticDrawgleHtml,
} from "@/lib/generation/screen-quality";
import { buildNavigationShellCode, buildScreenStream, extractCode, fallbackProjectCharter, generateDesignTokens, planUiFlow } from "@/lib/generation/service";
import { CriticalAssetResolutionError, planVisualAssets, reconcilePendingFalAssetJobs, resolveProjectAssets } from "@/lib/generation/visual-assets";
import { createNavigationArchitecture, deriveRequiresBottomNav } from "@/lib/navigation";
import {
  applyNavigationPlanToScreens,
  indexNavigationShell,
  normalizeNavigationPlan,
  sanitizeScreenCodeForSharedNavigation,
} from "@/lib/project-navigation";
import { tokenizeStaticDrawgleHtml } from "@/lib/token-runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { DesignTokens, ImageReferenceMode, NavigationArchitecture, NavigationPlan, PlanningMode, ProjectAssetManifest, PromptImagePayload, ProjectCharter, ReferenceMode, ReferenceSource, ScreenAssetManifest, ScreenPlan } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

type GenerateUiFlowPayload = {
  generationRunId: string;
  projectId: string;
  ownerId: string;
  prompt: string;
  designTokens?: DesignTokens | null;
  imagePath?: string | null;
  imageReferenceMode?: ImageReferenceMode;
  plannedScreens?: ScreenPlan[] | null;
  requiresBottomNav?: boolean;
  navigationArchitecture?: NavigationArchitecture | null;
  navigationPlan?: NavigationPlan | null;
  projectCharter?: ProjectCharter | null;
  planningMode?: PlanningMode;
};

type BuildScreenTaskPayload = {
  generationRunId: string;
  screenId: string;
  projectId: string;
  screenPlan: ScreenPlan;
  prompt: string;
  designTokens?: DesignTokens | null;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode;
  referenceSource?: ReferenceSource | null;
  referenceId?: string | null;
  requiresBottomNav: boolean;
  navigationArchitecture?: NavigationArchitecture | null;
  navigationPlan?: NavigationPlan | null;
  assetManifest?: ScreenAssetManifest[];
  projectCharter?: ProjectCharter | null;
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

const collectFinishReasons = (chunk: unknown, finishReasons: Set<string>) => {
  if (!chunk || typeof chunk !== "object") {
    return;
  }

  const candidates = (chunk as { candidates?: Array<{ finishReason?: unknown }> }).candidates;
  if (!Array.isArray(candidates)) {
    return;
  }

  for (const candidate of candidates) {
    if (typeof candidate.finishReason === "string" && candidate.finishReason.trim()) {
      finishReasons.add(candidate.finishReason.trim());
    }
  }
};

type GeminiUsageMetadata = Record<string, number>;

type GenerationAttemptDiagnostics = {
  attempt: number;
  task: "screen_build";
  retryReason: "initial" | "completion_retry" | "structural_retry";
  streamed: boolean;
  model: string;
  maxOutputTokens: number | null;
  finishReasons: string[];
  usageMetadata: GeminiUsageMetadata | null;
  rawLength: number;
  extractedLength: number;
  sentinelPresent: boolean;
  completionCodes: string[];
  staticCodes: string[];
  qualityIssues: string[];
  qualityWarnings: string[];
  missingAnchors: string[];
};

const collectUsageMetadata = (chunk: unknown, usage: GeminiUsageMetadata) => {
  if (!chunk || typeof chunk !== "object") {
    return;
  }

  const rawUsage = (chunk as { usageMetadata?: unknown }).usageMetadata;
  if (!rawUsage || typeof rawUsage !== "object" || Array.isArray(rawUsage)) {
    return;
  }

  for (const [key, value] of Object.entries(rawUsage)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      usage[key] = value;
    }
  }
};

const buildAttemptDiagnostics = ({
  attempt,
  retryReason,
  streamed,
  build,
  completion,
  staticQuality,
  quality,
}: {
  attempt: number;
  retryReason: GenerationAttemptDiagnostics["retryReason"];
  streamed: boolean;
  build: Awaited<ReturnType<typeof collectScreenBuild>>;
  completion?: ReturnType<typeof validateSourceCompletion> | null;
  staticQuality?: ReturnType<typeof validateStaticDrawgleHtml> | null;
  quality?: ReturnType<typeof validateGeneratedScreenCode> | null;
}): GenerationAttemptDiagnostics => {
  const policy = geminiPolicyForTask("screen_build");

  return {
    attempt,
    task: "screen_build",
    retryReason,
    streamed,
    model: policy.model,
    maxOutputTokens: typeof policy.config.maxOutputTokens === "number" ? policy.config.maxOutputTokens : null,
    finishReasons: build.finishReasons,
    usageMetadata: Object.keys(build.usageMetadata).length > 0 ? build.usageMetadata : null,
    rawLength: build.rawText.length,
    extractedLength: build.extractedCode.length,
    sentinelPresent: hasGenerationCompleteSentinel(build.extractedCode),
    completionCodes: completion?.codes ?? [],
    staticCodes: staticQuality?.codes ?? [],
    qualityIssues: quality?.issues ?? [],
    qualityWarnings: quality?.warnings ?? [],
    missingAnchors: quality?.missingAnchors ?? [],
  };
};

const appendScreenBuildDiagnostics = async (
  admin: AdminClient,
  generationRunId: string,
  screenId: string,
  diagnostics: GenerationAttemptDiagnostics[],
) => {
  try {
    await mergeGenerationRunMetadata(admin, generationRunId, {
      [`screenBuildDiagnostics:${screenId}`]: diagnostics,
    });
  } catch (error) {
    logger.warn("Failed to persist screen generation diagnostics", {
      generationRunId,
      screenId,
      error,
    });
  }
};

const humanizeScreenBuildFailure = (screenName: string, error?: string | null) => {
  const message = error ?? "";

  if (/missing_completion_sentinel|max_tokens|needs_regeneration|incomplete|trailing_open_tag|unclosed_comment|unclosed_root/i.test(message)) {
    return `${screenName} could not be built because the generated HTML was incomplete.`;
  }

  if (/static_html|structurally|jsx|script|duplicate|tag_imbalance|invalid/i.test(message)) {
    return `${screenName} could not be built because the generated HTML was structurally invalid.`;
  }

  return `${screenName} could not be built. Try regenerating this screen.`;
};

const compactBuildContext = (context: string | null | undefined) => {
  const trimmed = context?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 6000);
};

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

async function collectScreenBuild(input: BuildScreenTaskPayload, screenPlan: ScreenPlan) {
  let rawText = "";
  const finishReasons = new Set<string>();
  const usageMetadata: GeminiUsageMetadata = {};

  const { stream: codeStream } = await streams.pipe(
    "code",
    buildScreenStream({
      screenPlan,
      designTokens: input.designTokens,
      prompt: input.prompt,
      image: input.image,
      referenceMode: input.referenceMode,
      referenceSource: input.referenceSource,
      referenceId: input.referenceId,
      requiresBottomNav: input.requiresBottomNav,
      navigationArchitecture: input.navigationArchitecture,
      navigationPlan: input.navigationPlan,
      assetManifest: input.assetManifest,
      projectContext: input.projectContext,
      onResponseChunk: (chunk) => {
        collectFinishReasons(chunk, finishReasons);
        collectUsageMetadata(chunk, usageMetadata);
      },
      onLlmInput: (snapshot) => {
        logger.info(`[LLM INPUT] ${snapshot.screenName}`, {
          model: snapshot.model,
          hasImage: snapshot.hasImage,
          referenceMode: snapshot.referenceMode,
          referenceSource: snapshot.referenceSource,
          referenceId: snapshot.referenceId,
          systemInstructionLength: snapshot.systemInstruction.length,
          systemInstruction: snapshot.systemInstruction,
          userPartCount: snapshot.userParts.length,
          userParts: snapshot.userParts,
        });
      },
    }),
  );

  for await (const chunk of codeStream) {
    rawText += chunk;
  }

  return {
    rawText,
    extractedCode: extractCode(rawText),
    finishReasons: Array.from(finishReasons),
    usageMetadata,
  };
}

async function collectNonStreamingScreenBuild(input: BuildScreenTaskPayload, screenPlan: ScreenPlan) {
  let rawText = "";
  const finishReasons = new Set<string>();
  const usageMetadata: GeminiUsageMetadata = {};

  for await (const chunk of buildScreenStream({
    screenPlan,
    designTokens: input.designTokens,
    prompt: input.prompt,
    image: input.image,
    referenceMode: input.referenceMode,
    referenceSource: input.referenceSource,
    referenceId: input.referenceId,
    requiresBottomNav: input.requiresBottomNav,
    navigationArchitecture: input.navigationArchitecture,
    navigationPlan: input.navigationPlan,
    assetManifest: input.assetManifest,
    projectContext: input.projectContext,
    onResponseChunk: (responseChunk) => {
      collectFinishReasons(responseChunk, finishReasons);
      collectUsageMetadata(responseChunk, usageMetadata);
    },
    onLlmInput: (snapshot) => {
      logger.info(`[LLM INPUT] ${snapshot.screenName}`, {
        model: snapshot.model,
        hasImage: snapshot.hasImage,
        referenceMode: snapshot.referenceMode,
        referenceSource: snapshot.referenceSource,
        referenceId: snapshot.referenceId,
        systemInstructionLength: snapshot.systemInstruction.length,
        systemInstruction: snapshot.systemInstruction,
        userPartCount: snapshot.userParts.length,
        userParts: snapshot.userParts,
      });
    },
  })) {
    rawText += chunk;
  }

  return {
    rawText,
    extractedCode: extractCode(rawText),
    finishReasons: Array.from(finishReasons),
    usageMetadata,
  };
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
    const admin = createAdminClient();
    const failWithoutSavingGeneratedCode = async ({
      error,
      metadata,
    }: {
      error: string;
      metadata?: Record<string, unknown>;
    }) => {
      await admin
        .from("screens")
        .update({
          status: "failed",
          error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.screenId);

      logger.warn("Screen generation output was rejected before save", {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        error,
        ...metadata,
      });

      return { screenId: payload.screenId, status: "failed" as const, error };
    };

    const buildPayload: BuildScreenTaskPayload = {
      ...payload,
      projectContext: compactBuildContext(payload.projectContext),
    };
    const attempts: GenerationAttemptDiagnostics[] = [];

    // Pipe the first Gemini async generator so the frontend can subscribe
    // via useRealtimeRunWithStreams and render partial HTML in real time.
    let build = await collectScreenBuild(buildPayload, payload.screenPlan);
    let extractedCode = build.extractedCode;
    let completion = validateSourceCompletion({
      code: extractedCode,
      requireSentinel: true,
      finishReasons: build.finishReasons,
    });

    if (Object.keys(build.usageMetadata).length > 0) {
      logger.info(`[TOKEN USAGE] ${payload.screenPlan.name}`, build.usageMetadata);
    }

    attempts.push(buildAttemptDiagnostics({
      attempt: attempts.length + 1,
      retryReason: "initial",
      streamed: true,
      build,
      completion,
    }));

    if (!completion.valid) {
      logger.warn("Screen build failed completion guard; retrying once", {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        issues: completion.issues,
        finishReasons: build.finishReasons,
        diagnostics: attempts[attempts.length - 1],
      });

      const retryPlan: ScreenPlan = {
        ...payload.screenPlan,
        description: [
          payload.screenPlan.description,
          "SOURCE COMPLETION RETRY: The previous response was incomplete, hit an output limit, or missed the required final sentinel.",
          "Return one complete static HTML screen from the opening root div through every required closing tag.",
          "Do not stop early, abbreviate, summarize, or add commentary.",
          "End with <!-- DRAWGLE_GENERATION_COMPLETE --> on its own final line.",
        ].join("\n\n"),
      };

      build = await collectNonStreamingScreenBuild({ ...buildPayload, projectContext: null }, retryPlan);
      extractedCode = build.extractedCode;
      completion = validateSourceCompletion({
        code: extractedCode,
        requireSentinel: true,
        finishReasons: build.finishReasons,
      });
      attempts.push(buildAttemptDiagnostics({
        attempt: attempts.length + 1,
        retryReason: "completion_retry",
        streamed: false,
        build,
        completion,
      }));

      if (!completion.valid) {
        await appendScreenBuildDiagnostics(admin, payload.generationRunId, payload.screenId, attempts);
        return failWithoutSavingGeneratedCode({
          error: `[screen_generation:incomplete_html] ${completion.issues.join(" | ")}`,
          metadata: {
            attempts,
            completionCodes: completion.codes,
            finishReasons: build.finishReasons,
          },
        });
      }
    }

    extractedCode = stripGenerationCompleteSentinel(extractedCode);
    let staticQuality = validateStaticDrawgleHtml({ code: extractedCode, requireSingleScreenRoot: true });
    let quality = validateGeneratedScreenCode({ code: extractedCode, screenPlan: payload.screenPlan });
    attempts[attempts.length - 1] = {
      ...attempts[attempts.length - 1],
      staticCodes: staticQuality.codes,
      qualityIssues: quality.issues,
      qualityWarnings: quality.warnings,
      missingAnchors: quality.missingAnchors,
    };

    if (!staticQuality.valid || !quality.valid) {
      logger.warn("Screen build failed hard HTML validation; retrying once with structural repair instructions", {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        staticIssues: staticQuality.issues,
        staticCodes: staticQuality.codes,
        qualityIssues: quality.issues,
        diagnostics: attempts[attempts.length - 1],
      });

      const structuralRetryPlan: ScreenPlan = {
        ...payload.screenPlan,
        description: [
          payload.screenPlan.description,
          "STRUCTURAL HTML RETRY: The previous response was rejected before save because the HTML structure was invalid.",
          staticQuality.issues.length > 0 ? `Hard static issues to fix: ${staticQuality.issues.join(" | ")}` : null,
          quality.issues.length > 0 ? `Hard quality/parser issues to fix: ${quality.issues.join(" | ")}` : null,
          "Return one complete static HTML screen with exactly one min-h-screen root. Do not include JSX, scripts, duplicate roots, duplicate data-drawgle-id values, or unbalanced tags.",
          "End with <!-- DRAWGLE_GENERATION_COMPLETE --> on its own final line.",
        ].filter(Boolean).join("\n\n"),
      };

      build = await collectNonStreamingScreenBuild({ ...buildPayload, projectContext: null }, structuralRetryPlan);
      extractedCode = build.extractedCode;
      completion = validateSourceCompletion({
        code: extractedCode,
        requireSentinel: true,
        finishReasons: build.finishReasons,
      });

      let structuralStaticQuality: ReturnType<typeof validateStaticDrawgleHtml> | null = null;
      let structuralQuality: ReturnType<typeof validateGeneratedScreenCode> | null = null;
      if (completion.valid) {
        extractedCode = stripGenerationCompleteSentinel(extractedCode);
        structuralStaticQuality = validateStaticDrawgleHtml({ code: extractedCode, requireSingleScreenRoot: true });
        structuralQuality = validateGeneratedScreenCode({ code: extractedCode, screenPlan: structuralRetryPlan });
      }

      attempts.push(buildAttemptDiagnostics({
        attempt: attempts.length + 1,
        retryReason: "structural_retry",
        streamed: false,
        build,
        completion,
        staticQuality: structuralStaticQuality,
        quality: structuralQuality,
      }));

      if (!completion.valid) {
        await appendScreenBuildDiagnostics(admin, payload.generationRunId, payload.screenId, attempts);
        return failWithoutSavingGeneratedCode({
          error: `[screen_generation:incomplete_html] ${completion.issues.join(" | ")}`,
          metadata: {
            attempts,
            completionCodes: completion.codes,
            finishReasons: build.finishReasons,
          },
        });
      }

      staticQuality = structuralStaticQuality!;
      quality = structuralQuality!;

      if (!staticQuality.valid || !quality.valid) {
        await appendScreenBuildDiagnostics(admin, payload.generationRunId, payload.screenId, attempts);
        return failWithoutSavingGeneratedCode({
          error: `[screen_generation:invalid_static_html] ${[...staticQuality.issues, ...quality.issues].join(" | ")}`,
          metadata: {
            attempts,
            staticCodes: staticQuality.codes,
            qualityIssues: quality.issues,
          },
        });
      }
    }

    if (quality.warnings.length > 0 || quality.missingAnchors.length > 0) {
      logger.warn("Screen build saved with soft quality diagnostics", {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        warnings: quality.warnings,
        missingAnchors: quality.missingAnchors,
      });
    }

    const sanitizedCode = sanitizeScreenCodeForSharedNavigation(extractedCode, payload.screenPlan);
    const tokenizedCode = tokenizeStaticDrawgleHtml(sanitizedCode, payload.designTokens).code;
    const code = ensureDrawgleIds(tokenizedCode).code;
    const health = detectScreenHealth({ code, screenPrompt: payload.screenPlan.description });
    const assetPolicy = validateScreenAssetPolicy({ code, assetManifest: payload.assetManifest });
    const blockIndex = indexScreenCode(code);
    const screenStatus = screenStatusForHealth(health);

    logger.info("Screen generation diagnostics", {
      screenId: payload.screenId,
      screenName: payload.screenPlan.name,
      attempts,
      health,
      assetPolicy,
    });

    if (!assetPolicy.valid) {
      await appendScreenBuildDiagnostics(admin, payload.generationRunId, payload.screenId, attempts);
      const policyReason = assetPolicy.invalidUrls.length > 0
        ? `Generated screen used unapproved image URLs: ${assetPolicy.invalidUrls.slice(0, 4).join(", ")}`
        : `Generated screen did not use required critical visual assets: ${assetPolicy.missingRequiredUrls.slice(0, 4).join(", ")}`;
      return failWithoutSavingGeneratedCode({
        error: `[screen_generation:invalid_image_url] ${policyReason}`,
        metadata: {
          attempts,
          assetPolicy,
        },
      });
    }

    if (isBlockingScreenHealthFailure(health)) {
      await appendScreenBuildDiagnostics(admin, payload.generationRunId, payload.screenId, attempts);
      return failWithoutSavingGeneratedCode({
        error: buildScreenHealthError(health) ?? "[screen_generation:failed_static_html] Generated source failed health checks.",
        metadata: {
          attempts,
          health,
        },
      });
    }

    // Persist the final code directly so the parent only polls for status.
    const { error: updateError } = await admin
      .from("screens")
      .update({
        code,
        block_index: blockIndex as never,
        chrome_policy: (payload.screenPlan.chromePolicy ?? null) as never,
        navigation_item_id: payload.screenPlan.navigationItemId ?? null,
        status: screenStatus,
        error: buildScreenHealthError(health),
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

    await appendScreenBuildDiagnostics(admin, payload.generationRunId, payload.screenId, attempts);

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

    return { screenId: payload.screenId, status: screenStatus };
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
        ui: { variant: "action_card" },
        agentStep: {
          kind: "generation",
          status: "failed",
          title: "Generation failed",
          detail: message,
          targetLabel: "Screen generation",
          processLines: [message],
        },
      },
    );
  },
  run: async (payload: GenerateUiFlowPayload) => {
    const admin = createAdminClient();

    reconcilePendingFalAssetJobs({ admin, limit: 6 }).catch((error) => {
      logger.warn("Visual asset reconciliation failed", { error });
    });

    let designTokens = payload.designTokens ?? null;
    const { data: existingProject } = await admin
      .from("projects")
      .select("project_charter, design_tokens")
      .eq("id", payload.projectId)
      .maybeSingle();
    const existingCharter = (existingProject?.project_charter as ProjectCharter | null) ?? null;
    if (!designTokens && existingProject?.design_tokens) {
      designTokens = existingProject.design_tokens as DesignTokens;
    }
    const requestedNavigationArchitecture = createNavigationArchitecture({
      navigationArchitecture: payload.navigationArchitecture ?? payload.projectCharter?.navigationArchitecture ?? existingCharter?.navigationArchitecture ?? null,
      requiresBottomNav: payload.requiresBottomNav ?? deriveRequiresBottomNav(existingCharter?.navigationArchitecture),
    });

    const projectUpdate: Database["public"]["Tables"]["projects"]["Update"] = {
      status: "generating",
    };

    if (designTokens) {
      projectUpdate.design_tokens = designTokens as never;
    }

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

    const [uploadedPromptImage, planningContext] = await Promise.all([
      loadPromptImage(admin, payload.imagePath),
      assembleProjectContext({
        admin,
        projectId: payload.projectId,
        userPrompt: payload.prompt,
      }),
    ]);
    let promptImage = uploadedPromptImage;
    let referenceMode: ReferenceMode = uploadedPromptImage && payload.imageReferenceMode === "style"
      ? "user_style"
      : "user_recreate";
    let referenceSource: ReferenceSource | null = uploadedPromptImage ? "user_upload" : null;
    let referenceId: string | null = null;

    if (!uploadedPromptImage) {
      const match = matchCuratedStyleReference({
        prompt: payload.prompt,
        planningMode: payload.planningMode ?? "project",
        existingCharter,
      });

      if (!match) {
        throw new Error("No curated style reference is available for no-image generation.");
      }

      logger.info("[CURATED STYLE REFERENCE] selected", {
        referenceId: match.reference.id,
        score: match.score,
        matchedTags: match.matchedTags,
      });
      const curatedImage = await loadCuratedStyleReferenceImage(match.reference);
      if (!curatedImage) {
        throw new Error(`Selected curated style reference could not be loaded: ${match.reference.id}`);
      }

      promptImage = curatedImage;
      referenceMode = "curated_style";
      referenceSource = "curated";
      referenceId = match.reference.id;
    }

    await mergeGenerationRunMetadata(admin, payload.generationRunId, {
      requestedImageReferenceMode: payload.imageReferenceMode ?? "recreate",
      referenceMode,
      referenceSource,
      referenceId,
    });

    if (!designTokens) {
      await postStatusMessage(
        admin,
        payload.projectId,
        payload.ownerId,
        "Analyzing design system...",
        "generation_started",
        {
          generationRunId: payload.generationRunId,
          activityKey: `run:${payload.generationRunId}:design`,
        },
      );

      designTokens = await generateDesignTokens({
        prompt: payload.prompt,
        image: promptImage,
        referenceMode,
        referenceId,
        llmLog: (label, data) => logger.info(label, data),
      });

      await updateProject(admin, payload.projectId, {
        design_tokens: designTokens as never,
      });

      await mergeGenerationRunMetadata(admin, payload.generationRunId, {
        designTokenSnapshot: designTokens,
      });

      
      await postStatusMessage(
        admin,
        payload.projectId,
        payload.ownerId,
        "Design system ready",
        "generation_completed",
        {
          generationRunId: payload.generationRunId,
          activityKey: `run:${payload.generationRunId}:design`,
          action: "design_system_ready",
        },
      );
    }
    const requestedCharter = payload.projectCharter ?? existingCharter ?? (
      payload.plannedScreens && payload.plannedScreens.length > 0
        ? fallbackProjectCharter({
            prompt: payload.prompt,
            image: referenceMode === "user_recreate" ? promptImage : null,
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
          referenceMode,
          referenceId,
          designTokens,
          projectContext: planningContext,
          existingCharter: requestedCharter,
          existingNavigationPlan: payload.navigationPlan ?? null,
          planningMode: payload.planningMode ?? "project",
          llmLog: (label, data) => logger.info(label, data),
        });
    plan.screens = applyNavigationPlanToScreens(plan.screens, plan.navigationPlan);

    const rawNavigationShellCode = await buildNavigationShellCode({
      navigationPlan: plan.navigationPlan,
      designTokens,
      prompt: payload.prompt,
      image: referenceMode === "user_recreate" ? promptImage : null,
      referenceMode,
      referenceId,
      projectCharter: plan.charter,
      llmLog: (label, data) => logger.info(label, data),
    });
    const navigationShellCode = ensureDrawgleIds(tokenizeStaticDrawgleHtml(rawNavigationShellCode, designTokens).code).code;

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
      charter: plan.charter,
      designTokenSnapshot: designTokens ?? null,
      plannedScreens: plan.screens.map((screenPlan) => ({
        name: screenPlan.name,
        type: screenPlan.type,
        description: screenPlan.description,
        chromePolicy: screenPlan.chromePolicy ?? null,
        navigationItemId: screenPlan.navigationItemId ?? null,
      })),
    });

    await postStatusMessage(
      admin,
      payload.projectId,
      payload.ownerId,
      "Resolving visual assets...",
      "generation_started",
      {
        generationRunId: payload.generationRunId,
        activityKey: `run:${payload.generationRunId}:assets`,
      },
    );

    const assetRequirements = referenceMode === "user_recreate"
      ? []
      : await planVisualAssets({
          prompt: payload.prompt,
          screens: plan.screens,
          charter: plan.charter,
          designTokens,
          llmLog: (label, data) => logger.info(label, data),
        });
    let projectAssetManifest: ProjectAssetManifest;
    try {
      projectAssetManifest = await resolveProjectAssets({
        admin,
        ownerId: payload.ownerId,
        projectId: payload.projectId,
        generationRunId: payload.generationRunId,
        requirements: assetRequirements,
      });
    } catch (error) {
      if (error instanceof CriticalAssetResolutionError) {
        await mergeGenerationRunMetadata(admin, payload.generationRunId, {
          assetRequirements,
          assetFailures: error.failures,
        });
        await postStatusMessage(
          admin,
          payload.projectId,
          payload.ownerId,
          "Critical visual assets could not be resolved",
          "error",
          {
            generationRunId: payload.generationRunId,
            activityKey: `run:${payload.generationRunId}:assets`,
            assetFailures: error.failures,
          },
        );
      }

      throw error;
    }

    await mergeGenerationRunMetadata(admin, payload.generationRunId, {
      assetRequirements,
      assetManifest: projectAssetManifest,
    });

    await postStatusMessage(
      admin,
      payload.projectId,
      payload.ownerId,
      assetRequirements.length > 0
        ? `Resolved ${Object.values(projectAssetManifest.assetsByScreen).reduce((count, assets) => count + assets.length, 0)} visual asset${Object.values(projectAssetManifest.assetsByScreen).reduce((count, assets) => count + assets.length, 0) === 1 ? "" : "s"}`
        : "No external visual assets needed",
      "generation_completed",
      {
        generationRunId: payload.generationRunId,
        activityKey: `run:${payload.generationRunId}:assets`,
        assetRequirementCount: assetRequirements.length,
      },
    );

    const shouldSendBuildContext = Boolean(payload.plannedScreens?.length) || (payload.planningMode ?? "project") === "single-screen";
    const buildContext = shouldSendBuildContext ? compactBuildContext(planningContext) : null;

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

    // Sequential build: each screen is triggered, inserted, and polled to
    // completion before the next one starts.  This means Screen 1 appears
    // on the canvas as soon as it is ready, Screen 2 starts immediately
    // after, and so on — giving the user continuous visible progress
    // rather than a long wait for all screens to finish simultaneously.
    let successfulScreens = 0;
    let failedScreens = 0;

    for (let index = 0; index < screenPlans.length; index++) {
      const screenPlan = screenPlans[index];
      const screenId = randomUUID();
      let rowInserted = false;

      try {
        const shouldAttachReferenceImage = referenceMode === "user_recreate" && index === 0;

        const handle = await (buildScreenTask as any).trigger(
          {
            generationRunId: payload.generationRunId,
            screenId,
            projectId: payload.projectId,
            screenPlan,
            prompt: payload.prompt,
            designTokens,
            image: shouldAttachReferenceImage ? promptImage : null,
            referenceMode,
            referenceSource,
            referenceId,
            requiresBottomNav: plan.requiresBottomNav,
            navigationArchitecture: plan.navigationArchitecture,
            navigationPlan: plan.navigationPlan,
            assetManifest: projectAssetManifest.assetsByScreen[screenPlan.name] ?? [],
            projectCharter: plan.charter,
            projectContext: buildContext,
          },
          {
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

        rowInserted = true;

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

        // Wait for this screen to complete before moving to the next one.
        const result = await runs.poll(handle.id, { pollIntervalMs: 2000 });

        if (result?.status === "COMPLETED") {
          const { data: completedScreen } = await admin
            .from("screens")
            .select("status, error")
            .eq("id", screenId)
            .maybeSingle();

          if (completedScreen?.status === "failed") {
            failedScreens += 1;

            await postStatusMessage(
              admin,
              payload.projectId,
              payload.ownerId,
              humanizeScreenBuildFailure(screenPlan.name, completedScreen.error),
              "error",
              {
                generationRunId: payload.generationRunId,
                screenName: screenPlan.name,
                activityKey: screenBuildActivityKey(screenId),
                error: completedScreen.error ?? "Screen generation failed.",
              },
              screenId,
            );
          } else {
            successfulScreens += 1;

            await postStatusMessage(
              admin,
              payload.projectId,
              payload.ownerId,
              `${screenPlan.name} ready`,
              "generation_completed",
              {
                generationRunId: payload.generationRunId,
                screenName: screenPlan.name,
                activityKey: screenBuildActivityKey(screenId),
              },
              screenId,
            );
          }
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
            `${screenPlan.name} failed`,
            "error",
            {
              generationRunId: payload.generationRunId,
              screenName: screenPlan.name,
              activityKey: screenBuildActivityKey(screenId),
              error: message,
            },
            screenId,
          );
        }
      } catch (screenError) {
        failedScreens += 1;
        const message = screenError instanceof Error ? screenError.message : String(screenError);
        logger.error("Failed to build screen", { screenName: screenPlan.name, error: screenError });

        if (rowInserted) {
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

        await postStatusMessage(
          admin,
          payload.projectId,
          payload.ownerId,
          humanizeScreenBuildFailure(screenPlan.name, message),
          "error",
          {
            generationRunId: payload.generationRunId,
            screenName: screenPlan.name,
            activityKey: screenBuildActivityKey(screenId),
            error: message,
          },
          rowInserted ? screenId : undefined,
        );
      }
    }

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
        ui: { variant: "action_card" },
        agentStep: {
          kind: "generation",
          status: finishedStatus === "completed" ? "completed" : "failed",
          title: completionContent,
          detail: finishedStatus === "completed"
            ? `Delivered ${successfulScreens} screen${successfulScreens === 1 ? "" : "s"}.`
            : errorSummary,
          targetLabel: successfulScreens === 1 ? "1 screen" : `${successfulScreens} screens`,
          processLines: [
            "Approved plan entered the generation queue.",
            failedScreens > 0 ? `${failedScreens} screen(s) failed during generation.` : null,
            successfulScreens > 0 ? `${successfulScreens} screen(s) saved to the canvas.` : null,
          ].filter(Boolean),
        },
      },
    );

    const completionMessage = finishedStatus === "completed"
      ? `Done - I created ${successfulScreens} screen${successfulScreens === 1 ? "" : "s"} and added ${successfulScreens === 1 ? "it" : "them"} to the canvas.`
      : `I could not finish that screen build. ${errorSummary ?? "Please try again with a tighter brief."}`;
    const { data: existingCompletion } = await admin
      .from("project_messages")
      .select("id")
      .eq("project_id", payload.projectId)
      .eq("owner_id", payload.ownerId)
      .contains("metadata", { completionForGenerationRunId: payload.generationRunId })
      .limit(1)
      .maybeSingle();

    if (!existingCompletion) {
      await admin.from("project_messages").insert({
        project_id: payload.projectId,
        owner_id: payload.ownerId,
        screen_id: null,
        role: "model",
        content: completionMessage,
        message_type: finishedStatus === "completed" ? "chat" : "error",
        metadata: {
          ui: { variant: finishedStatus === "completed" ? "chat" : "error" },
          action: "generation_completion",
          generationRunId: payload.generationRunId,
          completionForGenerationRunId: payload.generationRunId,
        } as never,
      });
    }

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
