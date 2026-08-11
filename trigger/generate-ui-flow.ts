import { randomUUID } from "crypto";

import { logger, runs, streams, task } from "@trigger.dev/sdk";

import { ensureDrawgleIds } from "@/lib/drawgle-dom";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import { cleanErrorMessage, cleanUnknownError, isPersistJsonError, USER_FACING_PERSIST_FAILED_ERROR } from "@/lib/ai/error-handler";
import {
  buildScreenPersistPatch,
  persistWithOptionalQualityDiagnostics,
  sanitizeScreenCodeForPersist,
  sanitizeTextForJson,
} from "@/lib/generation/persist-safe";
import { resolveBuilderProviderIdentity } from "@/lib/generation/builder-diagnostics";
import { buildStaticScreenQualityDiagnostics, normalizeGeneratedUiContracts } from "@/lib/generation/ui-contract-normalizer";
import {
  getCuratedStyleReferenceById,
  loadCuratedStyleReferenceImage,
  matchCuratedStyleReference,
} from "@/lib/generation/curated-style-references";
import type { CuratedStyleSelectionDiagnostics } from "@/lib/generation/curated-style-selection";
import { getDesignStylePack, isDesignStyleId, summarizeDesignStyle } from "@/lib/generation/design-styles";
import { CURATED_STYLE_EMBEDDING_MODEL } from "@/lib/generation/curated-style-index-core";
import { indexScreenCode } from "@/lib/generation/block-index";
import { buildFirstScreenPriorityBatches } from "@/lib/generation/build-scheduler";
import { buildBuilderProjectContract } from "@/lib/generation/builder-product-contract";
import { assembleProjectContext } from "@/lib/generation/context";
import { transitionGenerationJournalPhase as setJournalPhase } from "@/lib/generation/journal";
import {
  buildStateVariantEditActivityKey,
  buildStateVariantEditInstruction,
  buildStateVariantFailurePatch,
  stateVariantScreenName,
} from "@/lib/agent/state-variant-build";
import { executeModifyScreenTask } from "@/lib/generation/edit-runner";
import { buildScreenSummaryLocally } from "@/lib/generation/embeddings";
import {
  buildScreenHealthError,
  detectScreenHealth,
  hasGenerationCompleteSentinel,
  hydrateScreenAssetSlots,
  isBlockingScreenHealthFailure,
  normalizeSharedNavigationClearanceHtml,
  normalizeStaticDrawgleHtml,
  screenStatusForHealth,
  sanitizeStaticDrawgleHtml,
  sanitizeScreenAssetUsage,
  stripGenerationCompleteSentinel,
  validateSourceCompletion,
  validateGeneratedScreenCode,
  validateScreenAssetPolicy,
  validateStaticDrawgleHtml,
} from "@/lib/generation/screen-quality";
import {
  buildNavigationShellCode,
  buildScreenStream,
  extractCode,
  fallbackProjectCharter,
  generateDesignTokens,
  planScreenBriefsForBuild,
  planProjectBlueprint,
  planUiFlow,
  screenPlansNeedBuildEnrichment,
} from "@/lib/generation/service";
import { screenBuildOutputTokenBudget } from "@/lib/generation/screen-budget";
import { analyzeReferenceImageForScope, preflightGenerationScope } from "@/lib/generation/scope-contract";
import { planVisualAssets, resolveProjectAssets } from "@/lib/generation/visual-assets";
import { resolveReferenceImageAttachment } from "@/lib/generation/reference-image";
import { resolveGenerationPromptMode } from "@/lib/generation/prompt-routing";
import { loadStoredPromptImage } from "@/lib/generation/prompt-reference-storage";
import { resolveGenerationReferencePolicy } from "@/lib/generation/reference-policy";
import { resolveProjectReferenceDna } from "@/lib/generation/reference-dna";
import {
  bindReservationToScreen,
  appendGenerationCredits,
  captureGenerationCredit,
  CreditReservationError,
  generationOutputKey,
  getGenerationCreditSummary,
  MAX_TOTAL_OUTPUTS_PER_RUN,
  releaseGenerationCredit,
  releaseGenerationCreditRemainder,
  reserveGenerationCredits,
  STATE_GENERATION_CREDIT_COST,
} from "@/lib/generation/credit-reservations";
import {
  buildProjectRoadmap,
  createRoadmapBuildRecommendation,
  markRoadmapItemForScreen,
  persistProjectRoadmap,
  screenRoadmapKey,
  stateRoadmapKey,
} from "@/lib/generation/project-roadmap";
import { createNavigationArchitecture, deriveRequiresBottomNav } from "@/lib/navigation";
import {
  applyReferenceNavigationAppearance,
  applyNavigationPlanToScreens,
  detectLocalNavigationMarkup,
  indexNavigationShell,
  normalizeNavigationPlan,
  sanitizeScreenCodeForSharedNavigation,
  willRenderSharedNavigationShell,
} from "@/lib/project-navigation";
import { tokenizeStaticDrawgleHtml } from "@/lib/token-runtime";
import { detectTokenDrift } from "@/lib/token-drift";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePublishedStylePreset } from "@/lib/published-style-presets";
import { getGenerationEngineVersion, getScreenBuilderProvider, isProgressiveFirstScreenEnabled } from "@/lib/env/server";
import { enrichScreenMemoryTask } from "@/trigger/enrich-screen-memory";
import type { Database, ProjectScreenRoadmapRow } from "@/lib/supabase/database.types";
import type { AssetRequirement, BuilderProjectContractV1, DesignStylePack, DesignTokens, GenerationJournalMetadata, GenerationPreviewMetadata, GenerationPromptMode, GenerationReferencePolicy, GenerationRetryContext, GenerationScopeContract, ImageReferenceMode, LlmProviderEvent, NavigationArchitecture, NavigationPlan, PlannedUiFlow, PlanningMode, ProjectAssetManifest, ProjectRoadmap, PromptImagePayload, ProjectCharter, ReferenceAnalysis, ReferenceImageRole, ReferenceMode, ReferenceSource, ScreenAssetManifest, ScreenBaseStatePlan, ScreenPlan, ScreenPlanningSeed, ScreenStateVariantPlan } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

type GenerateUiFlowPayload = {
  generationRunId: string;
  projectId: string;
  ownerId: string;
  prompt: string;
  designTokens?: DesignTokens | null;
  imagePath?: string | null;
  imageReferenceMode?: ImageReferenceMode;
  referencePolicy?: GenerationReferencePolicy | null;
  designStyleId?: string | null;
  stylePresetSlug?: string | null;
  plannedScreens?: ScreenPlan[] | null;
  screenPlanningSeeds?: ScreenPlanningSeed[] | null;
  requiresBottomNav?: boolean;
  navigationArchitecture?: NavigationArchitecture | null;
  navigationPlan?: NavigationPlan | null;
  projectCharter?: ProjectCharter | null;
  scopeContract?: GenerationScopeContract | null;
  referenceAnalysis?: ReferenceAnalysis | null;
  planningMode?: PlanningMode;
  baseState?: ScreenBaseStatePlan | null;
  stateVariants?: ScreenStateVariantPlan[] | null;
  approvalUserMessageId?: string | null;
  retryContext?: GenerationRetryContext | null;
  projectRoadmap?: ProjectRoadmap | null;
  initialBatchItemKeys?: string[] | null;
  isNewProject?: boolean;
};

type BuildScreenTaskPayload = {
  generationRunId: string;
  screenId: string;
  projectId: string;
  ownerId: string;
  screenPlan: ScreenPlan;
  prompt: string;
  designTokens?: DesignTokens | null;
  image?: PromptImagePayload | null;
  referenceImageRole?: ReferenceImageRole | null;
  referenceAttachmentReason?: string | null;
  referenceGeometryConfidence?: string | null;
  promptMode: GenerationPromptMode;
  referenceMode?: ReferenceMode;
  referenceSource?: ReferenceSource | null;
  referenceId?: string | null;
  referenceScreenIndex?: number | null;
  referenceScreenCount?: number | null;
  designStyleId?: string | null;
  designStyle?: DesignStylePack | null;
  requiresBottomNav: boolean;
  navigationArchitecture?: NavigationArchitecture | null;
  navigationPlan?: NavigationPlan | null;
  assetRequirements?: AssetRequirement[];
  assetManifest?: ScreenAssetManifest[];
  projectCharter?: ProjectCharter | null;
  productContract?: BuilderProjectContractV1 | null;
  projectContext?: string | null;
  isFirstScreen?: boolean;
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

const buildErrorCode = (message: string) => {
  const userMessage = cleanErrorMessage(message);
  return `<div class="min-h-screen w-full flex flex-col items-center justify-center gap-3 bg-red-50 text-red-700 px-6 text-center">
  <div class="text-lg font-semibold">Generation failed</div>
  <div class="text-sm leading-6">${escapeHtml(userMessage)}</div>
</div>`;
};

const toUserFacingScreenError = (error: unknown) =>
  cleanUnknownError(error, USER_FACING_PERSIST_FAILED_ERROR);

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

type PerformanceAiUsage = {
  modelCalls: number;
  tokens: Record<string, number>;
  byStage: Record<string, { modelCalls: number; tokens: Record<string, number> }>;
};

const createPerformanceAiUsage = (): PerformanceAiUsage => ({
  modelCalls: 0,
  tokens: {},
  byStage: {},
});

const recordPerformanceAiUsage = (
  usage: PerformanceAiUsage,
  stage: string,
  raw: Record<string, unknown>,
) => {
  const numericUsage = Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, number] =>
      typeof entry[1] === "number" && Number.isFinite(entry[1]),
    ),
  );
  if (Object.keys(numericUsage).length === 0) return;
  usage.modelCalls += 1;
  const stageUsage = usage.byStage[stage] ?? { modelCalls: 0, tokens: {} };
  stageUsage.modelCalls += 1;
  for (const [key, value] of Object.entries(numericUsage)) {
    usage.tokens[key] = (usage.tokens[key] ?? 0) + value;
    stageUsage.tokens[key] = (stageUsage.tokens[key] ?? 0) + value;
  }
  usage.byStage[stage] = stageUsage;
};

type GenerationAttemptDiagnostics = {
  attempt: number;
  task: "screen_build";
  retryReason: "initial" | "completion_retry" | "structural_retry";
  streamed: boolean;
  model: string;
  provider: string;
  requestedModel: string;
  actualModel: string;
  fallbackUsed: boolean;
  hasImage: boolean;
  referenceImageRole: ReferenceImageRole | null;
  referenceAttachmentReason: string | null;
  calibrationContractVersion: number | null;
  navigationAppearanceSource: "reference" | "project-native" | null;
  referenceGeometryConfidence: string | null;
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
  sanitizedCodes: string[];
  tokenDriftWarnings: string[];
  localNavigationReasons: string[];
  localNavigationCandidates: string[];
  assetSanitizedMisuseCount: number;
  assetRepairedMetadataCount: number;
  assetHydratedCount: number;
  assetPlaceholderUseCount: number;
  assetOutcomes: Record<string, unknown>;
  assetSanitizationWarnings: string[];
  navigationClearanceOwner: string | null;
  navigationClearanceLegacyPaddingReplacedCount: number;
  navigationClearanceSpacerRemovedCount: number;
  navigationClearanceAmbiguousOwnerCount: number;
  htmlNormalized: boolean;
  htmlParseErrors: string[];
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
  tokenDrift,
  sanitizedCodes = [],
}: {
  attempt: number;
  retryReason: GenerationAttemptDiagnostics["retryReason"];
  streamed: boolean;
  build: Awaited<ReturnType<typeof collectScreenBuild>>;
  completion?: ReturnType<typeof validateSourceCompletion> | null;
  staticQuality?: ReturnType<typeof validateStaticDrawgleHtml> | null;
  quality?: ReturnType<typeof validateGeneratedScreenCode> | null;
  tokenDrift?: ReturnType<typeof detectTokenDrift> | null;
  sanitizedCodes?: string[];
}): GenerationAttemptDiagnostics => {
  return {
    attempt,
    task: "screen_build",
    retryReason,
    streamed,
    model: build.providerDiagnostics.actualModel,
    provider: build.providerDiagnostics.provider,
    requestedModel: build.providerDiagnostics.requestedModel,
    actualModel: build.providerDiagnostics.actualModel,
    fallbackUsed: build.providerDiagnostics.fallbackUsed,
    hasImage: build.providerDiagnostics.hasImage,
    referenceImageRole: build.providerDiagnostics.referenceImageRole,
    referenceAttachmentReason: build.providerDiagnostics.referenceAttachmentReason,
    calibrationContractVersion: build.providerDiagnostics.calibrationContractVersion,
    navigationAppearanceSource: build.providerDiagnostics.navigationAppearanceSource,
    referenceGeometryConfidence: build.providerDiagnostics.referenceGeometryConfidence,
    maxOutputTokens: build.maxOutputTokens ?? null,
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
    sanitizedCodes,
    tokenDriftWarnings: tokenDrift?.warnings ?? [],
    localNavigationReasons: [],
    localNavigationCandidates: [],
    assetSanitizedMisuseCount: 0,
    assetRepairedMetadataCount: 0,
    assetHydratedCount: 0,
    assetPlaceholderUseCount: 0,
    assetOutcomes: {},
    assetSanitizationWarnings: [],
    navigationClearanceOwner: null,
    navigationClearanceLegacyPaddingReplacedCount: 0,
    navigationClearanceSpacerRemovedCount: 0,
    navigationClearanceAmbiguousOwnerCount: 0,
    htmlNormalized: false,
    htmlParseErrors: [],
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
  const message = cleanErrorMessage(error ?? "");

  if (/incomplete|could not be finished because the generated layout was incomplete/i.test(message)) {
    return `${screenName} could not be built because the generated layout was incomplete.`;
  }

  if (/visual assets|asset policy/i.test(message)) {
    return `${screenName} was generated but did not satisfy the required visual assets.`;
  }

  if (/invalid|structurally/i.test(message) && !/could not be saved/i.test(message)) {
    return `${screenName} could not be built because the generated layout was invalid.`;
  }

  if (/could not be saved|retry/i.test(message)) {
    return `${screenName} was generated but could not be saved. Please retry.`;
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

async function settleProjectStatus(admin: AdminClient, projectId: string, runSucceeded: boolean) {
  if (runSucceeded) {
    await updateProject(admin, projectId, { status: "completed" });
    return;
  }
  const { count, error } = await admin
    .from("screens")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("status", "ready");
  if (error) throw error;
  await updateProject(admin, projectId, { status: (count ?? 0) > 0 ? "completed" : "failed" });
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

const metadataRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

async function mergeGenerationPerformance(
  admin: AdminClient,
  generationRunId: string,
  patch: Record<string, unknown>,
) {
  const { data, error } = await admin
    .from("generation_runs")
    .select("metadata")
    .eq("id", generationRunId)
    .maybeSingle();
  if (error) throw error;

  const metadata = metadataRecord(data?.metadata);
  const current = metadataRecord(metadata.performanceV1);
  const currentStages = metadataRecord(current.stages);
  const patchStages = metadataRecord(patch.stages);
  await updateGenerationRun(admin, generationRunId, {
    metadata: {
      ...metadata,
      performanceV1: {
        version: 1,
        ...current,
        ...patch,
        stages: { ...currentStages, ...patchStages },
      },
    } as never,
  });
}

const performanceStage = (startedAt: string, startedMs: number) => ({
  startedAt,
  completedAt: now(),
  durationMs: Math.max(0, Date.now() - startedMs),
});


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


type StateVariantBuildResult = {
  successfulVariants: number;
  failedVariants: number;
  successfulRoadmapItemIds: string[];
};

async function buildStateVariantsForParent({
  admin,
  payload,
  parentScreenId,
  parentRoadmapStableKey,
  variants,
}: {
  admin: AdminClient;
  payload: GenerateUiFlowPayload;
  parentScreenId: string;
  parentRoadmapStableKey: string;
  variants: ScreenStateVariantPlan[];
}): Promise<StateVariantBuildResult> {
  if (variants.length === 0) {
    return { successfulVariants: 0, failedVariants: 0, successfulRoadmapItemIds: [] };
  }

  let successfulVariants = 0;
  let failedVariants = 0;
  const successfulRoadmapItemIds: string[] = [];

  try {
    const { data: parentScreen, error: parentError } = await admin
      .from("screens")
      .select("id, name, prompt, code, block_index, chrome_policy, navigation_item_id, roadmap_item_id")
      .eq("id", parentScreenId)
      .maybeSingle();

    if (parentError || !parentScreen?.code) {
      throw parentError ?? new Error("Parent screen source was not available for state variants.");
    }

    const reservedSlots = await reserveScreenSlots(admin, payload.projectId, variants.length);

    for (let index = 0; index < variants.length; index++) {
      const variant = variants[index];
      const variantRoadmapStableKey = variant.roadmapStableKey
        ?? stateRoadmapKey(parentRoadmapStableKey, variant.stateKey);
      const outputKey = generationOutputKey(payload.generationRunId, "state", variantRoadmapStableKey);
      const reusableVariantScreenId = payload.retryContext?.reuseStateVariantIdsByKey?.[variant.stateKey] ?? null;
      const variantScreenId = reusableVariantScreenId ?? randomUUID();
      const variantName = stateVariantScreenName(parentScreen.name, variant.stateLabel);
      const instruction = buildStateVariantEditInstruction(parentScreen.name, variant);
      const editActivityKey = buildStateVariantEditActivityKey(payload.generationRunId, variant.id);
      const buildActivityKey = screenBuildActivityKey(variantScreenId);
      let rowInserted = false;

      try {
        const variantRow = {
            id: variantScreenId,
            owner_id: payload.ownerId,
            project_id: payload.projectId,
            generation_run_id: payload.generationRunId,
            roadmap_item_id: variant.roadmapItemId ?? null,
            parent_screen_id: parentScreen.id,
            state_key: variant.stateKey,
            state_label: variant.stateLabel,
            state_role: variant.stateRole,
            name: variantName,
            prompt: [
              parentScreen.prompt,
              `State variant: ${variant.stateLabel}`,
              variant.description,
              variant.editInstruction,
            ].filter(Boolean).join("\n\n"),
            code: parentScreen.code,
            block_index: (parentScreen.block_index ?? null) as never,
            chrome_policy: (parentScreen.chrome_policy ?? null) as never,
            navigation_item_id: parentScreen.navigation_item_id ?? null,
            status: "building",
            trigger_run_id: null,
            stream_public_token: null,
            position_x: reservedSlots[index]?.position_x ?? 4800 + (index + 1) * 450,
            position_y: reservedSlots[index]?.position_y ?? 5050,
            sort_index: reservedSlots[index]?.sort_index ?? index,
            created_at: now(),
            updated_at: now(),
          };
        const { error: insertError } = reusableVariantScreenId
          ? await admin
              .from("screens")
              .update({
                generation_run_id: payload.generationRunId,
                roadmap_item_id: variantRow.roadmap_item_id,
                parent_screen_id: variantRow.parent_screen_id,
                state_key: variantRow.state_key,
                state_label: variantRow.state_label,
                state_role: variantRow.state_role,
                name: variantRow.name,
                prompt: variantRow.prompt,
                code: variantRow.code,
                block_index: variantRow.block_index,
                chrome_policy: variantRow.chrome_policy,
                navigation_item_id: variantRow.navigation_item_id,
                status: variantRow.status,
                error: null,
                trigger_run_id: null,
                stream_public_token: null,
                updated_at: variantRow.updated_at,
              })
              .eq("id", reusableVariantScreenId)
              .eq("project_id", payload.projectId)
              .eq("owner_id", payload.ownerId)
          : await admin.from("screens").insert(variantRow);

        if (insertError) {
          throw insertError;
        }

        rowInserted = true;

        await bindReservationToScreen({
          admin,
          ownerId: payload.ownerId,
          generationRunId: payload.generationRunId,
          outputKey,
          screenId: variantScreenId,
        });
        await markRoadmapItemForScreen({
          admin,
          roadmapItemId: variant.roadmapItemId,
          screenId: variantScreenId,
          status: "building",
        });

        await postStatusMessage(
          admin,
          payload.projectId,
          payload.ownerId,
          `Creating ${variantName}...`,
          "generation_started",
          {
            generationRunId: payload.generationRunId,
            screenName: variantName,
            parentScreenId: parentScreen.id,
            stateVariantId: variant.id,
            stateKey: variant.stateKey,
            activityKey: buildActivityKey,
          },
          variantScreenId,
        );

        const result = await executeModifyScreenTask({
          projectId: payload.projectId,
          ownerId: payload.ownerId,
          screenId: variantScreenId,
          prompt: instruction,
          resolvedInstruction: instruction,
          userMessageId: payload.approvalUserMessageId ?? payload.generationRunId,
          activityKey: editActivityKey,
          selectedElementTarget: "screen",
          selectedElementHtml: null,
          selectedElementDrawgleId: null,
          requestTargetsNavigation: false,
          targetScope: "whole_screen",
          editOperation: "content_change",
          editStrategy: "screen_root_region_replace",
          conversationContext: null,
          recoveryContext: {
            kind: "state_variant_edit",
            parentScreenId: parentScreen.id,
            stateVariantId: variant.id,
            stateKey: variant.stateKey,
          },
          routerDecision: {
            action: "state_variant_edit",
            targetScope: "whole_screen",
            editStrategy: "screen_root_region_replace",
          },
        }, (label, data) => logger.info(label, data));

        const { data: editedVariant } = await admin
          .from("screens")
          .select("code, status, error")
          .eq("id", variantScreenId)
          .maybeSingle();

        const materialChange = Boolean(
          result.changed &&
          editedVariant?.status === "ready" &&
          editedVariant.code &&
          editedVariant.code !== parentScreen.code,
        );

        if (!materialChange) {
          const message = editedVariant?.error
            ?? (editedVariant?.status !== "ready"
              ? "State variant was not durably saved as ready."
              : "State variant edit produced no material code change from the parent.");
          await admin
            .from("screens")
            .update({
              ...buildStateVariantFailurePatch(message),
              updated_at: now(),
            })
            .eq("id", variantScreenId);

          await postStatusMessage(
            admin,
            payload.projectId,
            payload.ownerId,
            `${variantName} failed`,
            "error",
            {
              generationRunId: payload.generationRunId,
              screenName: variantName,
              parentScreenId: parentScreen.id,
              stateVariantId: variant.id,
              activityKey: buildActivityKey,
              error: message,
            },
            variantScreenId,
          );
          failedVariants += 1;
          await releaseGenerationCredit({
            admin,
            ownerId: payload.ownerId,
            generationRunId: payload.generationRunId,
            outputKey,
            reason: message,
          });
          await markRoadmapItemForScreen({
            admin,
            roadmapItemId: variant.roadmapItemId,
            screenId: variantScreenId,
            status: "failed",
          });
          continue;
        }

        successfulVariants += 1;
        if (variant.roadmapItemId) successfulRoadmapItemIds.push(variant.roadmapItemId);
        await captureGenerationCredit({
          admin,
          ownerId: payload.ownerId,
          generationRunId: payload.generationRunId,
          outputKey,
          screenId: variantScreenId,
        }).catch((creditError) => logger.error("State screen was saved but credit capture will need reconciliation", {
          outputKey,
          screenId: variantScreenId,
          error: creditError,
        }));
        await markRoadmapItemForScreen({
          admin,
          roadmapItemId: variant.roadmapItemId,
          screenId: variantScreenId,
          status: "ready",
        }).catch((roadmapError) => logger.error("State screen was saved but roadmap settlement failed", {
          outputKey,
          screenId: variantScreenId,
          error: roadmapError,
        }));
        await postStatusMessage(
          admin,
          payload.projectId,
          payload.ownerId,
          `${variantName} ready`,
          "generation_completed",
          {
            generationRunId: payload.generationRunId,
            screenName: variantName,
            parentScreenId: parentScreen.id,
            stateVariantId: variant.id,
            activityKey: buildActivityKey,
          },
          variantScreenId,
        );

        await enrichScreenMemoryTask.trigger(
          { screenId: variantScreenId },
          { concurrencyKey: `screen-memory-${variantScreenId}` },
        );
      } catch (variantError) {
        failedVariants += 1;
        const message = cleanErrorMessage(variantError instanceof Error ? variantError.message : String(variantError));
        await releaseGenerationCredit({
          admin,
          ownerId: payload.ownerId,
          generationRunId: payload.generationRunId,
          outputKey,
          reason: message,
        }).catch((creditError) => logger.error("Failed to release state credit", { outputKey, error: creditError }));
        await markRoadmapItemForScreen({
          admin,
          roadmapItemId: variant.roadmapItemId,
          screenId: variantScreenId,
          status: "failed",
        }).catch((roadmapError) => logger.error("Failed to mark state roadmap item", { outputKey, error: roadmapError }));
        logger.error("Failed to build state variant", {
          generationRunId: payload.generationRunId,
          parentScreenId: parentScreen.id,
          variantId: variant.id,
          error: variantError,
        });

        if (rowInserted) {
          await admin
            .from("screens")
            .update({
              ...buildStateVariantFailurePatch(message),
              updated_at: now(),
            })
            .eq("id", variantScreenId);
        }

        await postStatusMessage(
          admin,
          payload.projectId,
          payload.ownerId,
          `${variantName} failed`,
          "error",
          {
            generationRunId: payload.generationRunId,
            screenName: variantName,
            parentScreenId: parentScreen.id,
            stateVariantId: variant.id,
            activityKey: buildActivityKey,
            error: message,
          },
          rowInserted ? variantScreenId : undefined,
        );
      }
    }
  } catch (error) {
    failedVariants += variants.length;
    const message = cleanErrorMessage(error instanceof Error ? error.message : String(error));
    logger.error("Failed to prepare state variants", {
      generationRunId: payload.generationRunId,
      parentScreenId,
      error,
    });
    await postStatusMessage(
      admin,
      payload.projectId,
      payload.ownerId,
      `State variants failed: ${message}`,
      "error",
      {
        generationRunId: payload.generationRunId,
        parentScreenId,
        activityKey: `run:${payload.generationRunId}:state_variants`,
        error: message,
      },
    );
  }

  return { successfulVariants, failedVariants, successfulRoadmapItemIds };
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

const journalActivityKey = (generationRunId: string) => `run:${generationRunId}:journal`;

function createGenerationJournal(generationRunId: string): GenerationJournalMetadata {
  return {
    version: 1,
    generationRunId,
    status: "planning",
    title: "Designing your app",
    detail: "Turning the brief into a buildable mobile UI plan.",
    activePhase: "brief",
    phases: [
      { id: "brief", label: "Brief received", status: "active", startedAt: now() },
      { id: "reference", label: "Reference direction", status: "pending" },
      { id: "design", label: "Design system", status: "pending" },
      { id: "blueprint", label: "Project blueprint", status: "pending" },
      { id: "screens", label: "Screen plan", status: "pending" },
      { id: "assets", label: "Visual assets", status: "pending" },
      { id: "build", label: "Screen build", status: "pending" },
    ],
    screens: [],
    assetSummary: null,
  };
}

function journalPhaseForError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("navigation shell") || normalized.includes("project navigation")) return "blueprint";
  if (normalized.includes("asset") || normalized.includes("visual")) return "assets";
  if (normalized.includes("design token") || normalized.includes("design system")) return "design";
  if (normalized.includes("plan") || normalized.includes("schema") || normalized.includes("screen brief")) return "screens";
  return "build";
}

async function postGenerationJournal(
  admin: AdminClient,
  projectId: string,
  ownerId: string,
  journal: GenerationJournalMetadata,
) {
  await postStatusMessage(
    admin,
    projectId,
    ownerId,
    journal.title,
    journal.status === "completed" ? "generation_completed" : journal.status === "failed" ? "error" : "generation_started",
    {
      generationRunId: journal.generationRunId,
      activityKey: journalActivityKey(journal.generationRunId),
      generationJournal: journal,
      ui: { variant: "generation_journal" },
    },
  );
}

const logProviderEvent = (event: LlmProviderEvent) => {
  const label = event.event || "llm:provider_event";

  if (event.level === "error") {
    logger.error(label, event);
    return;
  }

  if (event.level === "warn") {
    logger.warn(label, event);
    return;
  }

  logger.info(label, event);
};

async function collectScreenBuild(
  input: BuildScreenTaskPayload,
  screenPlan: ScreenPlan,
  onFirstChunk?: () => void | Promise<void>,
) {
  let rawText = "";
  const finishReasons = new Set<string>();
  const usageMetadata: GeminiUsageMetadata = {};
  const provider = getScreenBuilderProvider();
  const attemptedModels = new Set<string>();
  let requestedModel = "unknown";
  let actualModel = "unknown";
  const captureProviderEvent = (event: LlmProviderEvent) => {
    logProviderEvent(event);
    if (typeof event.model === "string" && event.model.trim()) {
      attemptedModels.add(event.model);
      actualModel = event.model;
    }
  };

  const { stream: codeStream } = await streams.pipe(
    "code",
    buildScreenStream({
      screenPlan,
      designTokens: input.designTokens,
      designStyle: input.designStyle,
      prompt: input.prompt,
      image: input.image,
      referenceImageRole: input.referenceImageRole,
      referenceAttachmentReason: input.referenceAttachmentReason,
      promptMode: input.promptMode,
      referenceMode: input.referenceMode,
      referenceSource: input.referenceSource,
      referenceId: input.referenceId,
      referenceScreenIndex: input.referenceScreenIndex ?? screenPlan.referenceScreenIndex ?? null,
      referenceScreenCount: input.referenceScreenCount ?? screenPlan.referenceScreenCount ?? null,
      requiresBottomNav: input.requiresBottomNav,
      navigationArchitecture: input.navigationArchitecture,
      navigationPlan: input.navigationPlan,
      assetRequirements: input.assetRequirements,
      assetManifest: input.assetManifest,
      productContract: input.productContract,
      projectContext: input.projectContext,
      onProviderEvent: captureProviderEvent,
      onResponseChunk: (chunk) => {
        collectFinishReasons(chunk, finishReasons);
        collectUsageMetadata(chunk, usageMetadata);
      },
      onLlmInput: (snapshot) => {
        requestedModel = snapshot.model;
        if (actualModel === "unknown") actualModel = snapshot.model;
        attemptedModels.add(snapshot.model);
        logger.info(`[LLM INPUT] ${snapshot.screenName}`, {
          model: snapshot.model,
          hasImage: snapshot.hasImage,
          referenceImageRole: snapshot.referenceImageRole ?? null,
          referenceAttachmentReason: snapshot.referenceAttachmentReason ?? null,
          calibrationContractVersion: snapshot.calibrationContractVersion ?? null,
          promptMode: snapshot.promptMode,
          referenceMode: snapshot.referenceMode,
          referenceSource: snapshot.referenceSource,
          referenceId: snapshot.referenceId,
          referenceScreenIndex: snapshot.referenceScreenIndex ?? null,
          referenceScreenCount: snapshot.referenceScreenCount ?? null,
          systemInstructionLength: snapshot.systemInstruction.length,
          systemInstruction: snapshot.systemInstruction,
          userPartCount: snapshot.userParts.length,
          userParts: snapshot.userParts,
        });
      },
    }),
  );

  let receivedFirstChunk = false;
  for await (const chunk of codeStream) {
    if (!receivedFirstChunk) {
      receivedFirstChunk = true;
      await onFirstChunk?.();
    }
    rawText += chunk;
  }

  return {
    rawText,
    extractedCode: extractCode(rawText),
    finishReasons: Array.from(finishReasons),
    usageMetadata,
    maxOutputTokens: screenBuildOutputTokenBudget(screenPlan),
    providerDiagnostics: {
      ...resolveBuilderProviderIdentity({ provider, requestedModel, observedModels: attemptedModels }),
      hasImage: Boolean(input.image),
      referenceImageRole: input.referenceImageRole ?? null,
      referenceAttachmentReason: input.referenceAttachmentReason ?? null,
      calibrationContractVersion: screenPlan.referenceTransfer?.version ?? null,
      navigationAppearanceSource: input.navigationPlan?.appearance?.source ?? null,
      referenceGeometryConfidence: input.referenceGeometryConfidence ?? null,
    },
  };
}

async function collectNonStreamingScreenBuild(input: BuildScreenTaskPayload, screenPlan: ScreenPlan) {
  let rawText = "";
  const finishReasons = new Set<string>();
  const usageMetadata: GeminiUsageMetadata = {};
  const provider = getScreenBuilderProvider();
  const attemptedModels = new Set<string>();
  let requestedModel = "unknown";
  let actualModel = "unknown";
  const captureProviderEvent = (event: LlmProviderEvent) => {
    logProviderEvent(event);
    if (typeof event.model === "string" && event.model.trim()) {
      attemptedModels.add(event.model);
      actualModel = event.model;
    }
  };

  for await (const chunk of buildScreenStream({
    screenPlan,
    designTokens: input.designTokens,
    designStyle: input.designStyle,
    prompt: input.prompt,
    image: input.image,
    referenceImageRole: input.referenceImageRole,
    referenceAttachmentReason: input.referenceAttachmentReason,
    promptMode: input.promptMode,
    referenceMode: input.referenceMode,
    referenceSource: input.referenceSource,
    referenceId: input.referenceId,
    referenceScreenIndex: input.referenceScreenIndex ?? screenPlan.referenceScreenIndex ?? null,
    referenceScreenCount: input.referenceScreenCount ?? screenPlan.referenceScreenCount ?? null,
    requiresBottomNav: input.requiresBottomNav,
    navigationArchitecture: input.navigationArchitecture,
    navigationPlan: input.navigationPlan,
    assetRequirements: input.assetRequirements,
    assetManifest: input.assetManifest,
    productContract: input.productContract,
    projectContext: input.projectContext,
    onProviderEvent: captureProviderEvent,
    onResponseChunk: (responseChunk) => {
      collectFinishReasons(responseChunk, finishReasons);
      collectUsageMetadata(responseChunk, usageMetadata);
    },
    onLlmInput: (snapshot) => {
      requestedModel = snapshot.model;
      if (actualModel === "unknown") actualModel = snapshot.model;
      attemptedModels.add(snapshot.model);
      logger.info(`[LLM INPUT] ${snapshot.screenName}`, {
        model: snapshot.model,
        hasImage: snapshot.hasImage,
        referenceImageRole: snapshot.referenceImageRole ?? null,
        referenceAttachmentReason: snapshot.referenceAttachmentReason ?? null,
        calibrationContractVersion: snapshot.calibrationContractVersion ?? null,
        promptMode: snapshot.promptMode,
        referenceMode: snapshot.referenceMode,
        referenceSource: snapshot.referenceSource,
        referenceId: snapshot.referenceId,
        referenceScreenIndex: snapshot.referenceScreenIndex ?? null,
        referenceScreenCount: snapshot.referenceScreenCount ?? null,
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
    maxOutputTokens: screenBuildOutputTokenBudget(screenPlan),
    providerDiagnostics: {
      ...resolveBuilderProviderIdentity({ provider, requestedModel, observedModels: attemptedModels }),
      hasImage: Boolean(input.image),
      referenceImageRole: input.referenceImageRole ?? null,
      referenceAttachmentReason: input.referenceAttachmentReason ?? null,
      calibrationContractVersion: screenPlan.referenceTransfer?.version ?? null,
      navigationAppearanceSource: input.navigationPlan?.appearance?.source ?? null,
      referenceGeometryConfidence: input.referenceGeometryConfidence ?? null,
    },
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
    const generationEngineVersion = getGenerationEngineVersion();
    const admin = createAdminClient();
    const failWithoutSavingGeneratedCode = async ({
      error,
      metadata,
    }: {
      error: string;
      metadata?: Record<string, unknown>;
    }) => {
      const userError = toUserFacingScreenError(error);
      const failureCode = buildErrorCode("This preview could not be finalized. Use Retry to rebuild the screen.");
      const failurePatch = buildScreenPersistPatch({
        code: failureCode,
        status: "failed",
        error: userError,
        blockIndex: indexScreenCode(failureCode),
      });
      await admin
        .from("screens")
        .update(failurePatch)
        .eq("id", payload.screenId);

      logger.warn("Screen generation output was rejected before save", {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        error: userError,
        rawError: error,
        ...metadata,
      });

      return {
        screenId: payload.screenId,
        status: "failed" as const,
        error: userError,
        usageByAttempt: attempts.map((attempt) => attempt.usageMetadata).filter(Boolean),
      };
    };

    const failAfterSavingGeneratedCode = async ({
      error,
      code,
      blockIndex,
      metadata,
    }: {
      error: string;
      code: string;
      blockIndex: ReturnType<typeof indexScreenCode>;
      metadata?: Record<string, unknown>;
    }) => {
      const userError = toUserFacingScreenError(error);
      const failurePatch = buildScreenPersistPatch({
        code,
        status: "failed",
        error: userError,
        blockIndex,
        chromePolicy: payload.screenPlan.chromePolicy ?? null,
        navigationItemId: payload.screenPlan.navigationItemId ?? null,
      });
      await admin
        .from("screens")
        .update(failurePatch)
        .eq("id", payload.screenId);

      logger.warn("Screen generation output was saved with blocking diagnostics", {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        error: userError,
        rawError: error,
        ...metadata,
      });

      return {
        screenId: payload.screenId,
        status: "failed" as const,
        error: userError,
        usageByAttempt: attempts.map((attempt) => attempt.usageMetadata).filter(Boolean),
      };
    };

    const persistScreenRow = async (patch: Record<string, unknown>) => {
      const result = await persistWithOptionalQualityDiagnostics(
        patch,
        async (nextPatch) => {
          const { error } = await admin
            .from("screens")
            .update(nextPatch)
            .eq("id", payload.screenId);
          return { error };
        },
      );
      if (
        Object.prototype.hasOwnProperty.call(patch, "quality_diagnostics")
        && !result.qualityDiagnosticsPersisted
        && !result.error
      ) {
        logger.warn("Screen saved without optional quality diagnostics because telemetry schema is unavailable", {
          screenId: payload.screenId,
        });
      }
      return result.error;
    };

    const buildPayload: BuildScreenTaskPayload = {
      ...payload,
      projectContext: compactBuildContext(payload.projectContext),
    };
    const attempts: GenerationAttemptDiagnostics[] = [];
    const pendingAssetRequirements = payload.assetRequirements
      ?? (payload.assetManifest?.length
        ? []
        : await planVisualAssets({
            prompt: payload.prompt,
            screens: [payload.screenPlan],
            charter: payload.projectCharter,
            designTokens: payload.designTokens,
            referenceMode: payload.referenceMode,
          }));
    buildPayload.assetRequirements = pendingAssetRequirements;
    const assetResolutionStartedAt = now();
    const assetResolutionStartedMs = Date.now();
    const assetResolutionPromise: Promise<ProjectAssetManifest> = payload.assetManifest?.length
      ? Promise.resolve({
          requirements: pendingAssetRequirements,
          assetsByScreen: { [payload.screenPlan.name]: payload.assetManifest },
          failures: [],
          diagnostics: [],
        })
      : resolveProjectAssets({
          admin,
          ownerId: payload.ownerId,
          projectId: payload.projectId,
          generationRunId: payload.generationRunId,
          requirements: pendingAssetRequirements,
        });

    // Pipe the first Gemini async generator so the frontend can subscribe
    // via useRealtimeRunWithStreams and render partial HTML in real time.
    let build: Awaited<ReturnType<typeof collectScreenBuild>>;
    try {
      build = await collectScreenBuild(buildPayload, payload.screenPlan, payload.isFirstScreen
        ? async () => {
            await mergeGenerationPerformance(admin, payload.generationRunId, {
              firstStreamChunkAt: now(),
            });
          }
        : undefined);
    } catch (error) {
      await assetResolutionPromise.catch((assetError) => {
        logger.warn("Asset resolution also failed after builder stream failure", {
          screenId: payload.screenId,
          error: assetError,
        });
      });
      throw error;
    }
    const resolvedAssets = await assetResolutionPromise;
    const resolvedAssetManifest = resolvedAssets.assetsByScreen[payload.screenPlan.name] ?? [];
    const assetResolutionDurationMs = Math.max(0, Date.now() - assetResolutionStartedMs);
    const { error: assetUsageBindError } = await admin
      .from("project_asset_usages")
      .update({ screen_id: payload.screenId })
      .eq("project_id", payload.projectId)
      .eq("generation_run_id", payload.generationRunId)
      .eq("screen_name", payload.screenPlan.name)
      .is("screen_id", null);
    if (assetUsageBindError) {
      logger.warn("Failed to bind per-screen visual asset usages", {
        screenId: payload.screenId,
        error: assetUsageBindError,
      });
    }
    await mergeGenerationPerformance(admin, payload.generationRunId, {
      screenAssets: {
        [payload.screenId]: {
          screenName: payload.screenPlan.name,
          startedAt: assetResolutionStartedAt,
          completedAt: now(),
          durationMs: assetResolutionDurationMs,
          requirementCount: pendingAssetRequirements.length,
          failureCount: resolvedAssets.failures?.length ?? 0,
        },
      },
    });
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

    if (!completion.valid && generationEngineVersion === "v1") {
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

    if (!completion.valid) {
      await appendScreenBuildDiagnostics(admin, payload.generationRunId, payload.screenId, attempts);
      return failWithoutSavingGeneratedCode({
        error: `[screen_generation:incomplete_html] ${completion.issues.join(" | ")}`,
        metadata: { attempts, generationEngineVersion, completionCodes: completion.codes, finishReasons: build.finishReasons },
      });
    }

    extractedCode = stripGenerationCompleteSentinel(extractedCode);
    let normalization = normalizeStaticDrawgleHtml(extractedCode);
    attempts[attempts.length - 1] = {
      ...attempts[attempts.length - 1],
      htmlNormalized: normalization.changed,
      htmlParseErrors: normalization.parseErrors,
    };
    if (!normalization.valid) {
      await appendScreenBuildDiagnostics(admin, payload.generationRunId, payload.screenId, attempts);
      return failWithoutSavingGeneratedCode({
        error: `[screen_generation:incomplete_html] Generated HTML could not be normalized safely: ${normalization.incompleteParseErrors.join(", ") || "empty output"}.`,
        metadata: { attempts, generationEngineVersion, htmlParseErrors: normalization.parseErrors },
      });
    }
    extractedCode = normalization.code;
    let sanitization = sanitizeStaticDrawgleHtml(extractedCode);
    extractedCode = sanitization.code;
    let staticQuality = validateStaticDrawgleHtml({ code: extractedCode, requireSingleScreenRoot: true });
    let quality = validateGeneratedScreenCode({ code: extractedCode, screenPlan: payload.screenPlan });
    attempts[attempts.length - 1] = {
      ...attempts[attempts.length - 1],
      sanitizedCodes: sanitization.removedCodes,
      staticCodes: staticQuality.codes,
      qualityIssues: quality.issues,
      qualityWarnings: quality.warnings,
      missingAnchors: quality.missingAnchors,
    };

    if ((!staticQuality.valid || !quality.valid) && generationEngineVersion === "v1") {
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
      let structuralSanitization: ReturnType<typeof sanitizeStaticDrawgleHtml> | null = null;
      if (completion.valid) {
        extractedCode = stripGenerationCompleteSentinel(extractedCode);
        normalization = normalizeStaticDrawgleHtml(extractedCode);
        extractedCode = normalization.code;
        structuralSanitization = sanitizeStaticDrawgleHtml(extractedCode);
        extractedCode = structuralSanitization.code;
        if (normalization.valid) {
          structuralStaticQuality = validateStaticDrawgleHtml({ code: extractedCode, requireSingleScreenRoot: true });
          structuralQuality = validateGeneratedScreenCode({ code: extractedCode, screenPlan: structuralRetryPlan });
        }
      }

      attempts.push(buildAttemptDiagnostics({
        attempt: attempts.length + 1,
        retryReason: "structural_retry",
        streamed: false,
        build,
        completion,
        staticQuality: structuralStaticQuality,
        quality: structuralQuality,
        sanitizedCodes: structuralSanitization?.removedCodes ?? [],
      }));
      const structuralAttempt = attempts.at(-1);
      if (structuralAttempt && completion.valid) {
        structuralAttempt.htmlNormalized = normalization.changed;
        structuralAttempt.htmlParseErrors = normalization.parseErrors;
      }

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

      if (!normalization.valid) {
        await appendScreenBuildDiagnostics(admin, payload.generationRunId, payload.screenId, attempts);
        return failWithoutSavingGeneratedCode({
          error: `[screen_generation:incomplete_html] Generated HTML could not be normalized safely: ${normalization.incompleteParseErrors.join(", ") || "empty output"}.`,
          metadata: { attempts, htmlParseErrors: normalization.parseErrors },
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

    if (!staticQuality.valid || !quality.valid) {
      await appendScreenBuildDiagnostics(admin, payload.generationRunId, payload.screenId, attempts);
      return failWithoutSavingGeneratedCode({
        error: `[screen_generation:invalid_static_html] ${[...staticQuality.issues, ...quality.issues].join(" | ")}`,
        metadata: { attempts, generationEngineVersion, staticCodes: staticQuality.codes, qualityIssues: quality.issues },
      });
    }

    const finalizeGeneratedCode = (sourceCode: string) => {
      const sanitizedCode = sanitizeScreenCodeForSharedNavigation(sourceCode, payload.screenPlan, {
        projectNavigationEnabled: Boolean(payload.navigationPlan?.enabled),
        navigationPlan: payload.navigationPlan ?? null,
      });
      const clearanceNormalization = normalizeSharedNavigationClearanceHtml({
        code: sanitizedCode,
        enabled: Boolean(
          payload.navigationPlan?.enabled &&
          // Reserving bottom clearance for a shell that will not render leaves
          // dead space under the content instead of room for navigation.
          willRenderSharedNavigationShell(payload.navigationPlan) &&
          (payload.screenPlan.chromePolicy?.showPrimaryNavigation || payload.screenPlan.navigationItemId),
        ),
      });
      const contractNormalization = normalizeGeneratedUiContracts({
        code: clearanceNormalization.code,
        designTokens: payload.designTokens,
      });
      const tokenizedCode = tokenizeStaticDrawgleHtml(contractNormalization.code, payload.designTokens).code;
      const code = ensureDrawgleIds(tokenizedCode).code;
      const tokenDrift = detectTokenDrift(code, { scope: "screen" });
      return {
        code,
        tokenDrift,
        contractReport: contractNormalization.report,
        clearanceDiagnostics: clearanceNormalization.diagnostics,
      };
    };

    let finalized = finalizeGeneratedCode(extractedCode);
    attempts[attempts.length - 1] = {
      ...attempts[attempts.length - 1],
      tokenDriftWarnings: finalized.tokenDrift.warnings,
      navigationClearanceOwner: finalized.clearanceDiagnostics.ownerSelector,
      navigationClearanceLegacyPaddingReplacedCount: finalized.clearanceDiagnostics.legacyPaddingReplacedCount,
      navigationClearanceSpacerRemovedCount: finalized.clearanceDiagnostics.spacerRemovedCount,
      navigationClearanceAmbiguousOwnerCount: finalized.clearanceDiagnostics.ambiguousOwnerCount,
    };

    if (finalized.tokenDrift.hasSevereDrift) {
      logger.warn("Screen build has token drift diagnostics; saving without paid token retry", {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        warnings: finalized.tokenDrift.warnings.slice(0, 8),
      });
    }
    if (finalized.tokenDrift.warnings.length > 0) {
      logger.warn("Screen build contains token drift diagnostics", {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        warnings: finalized.tokenDrift.warnings.slice(0, 12),
      });
    }

    if (quality.warnings.length > 0 || quality.missingAnchors.length > 0) {
      logger.warn("Screen build contains soft quality diagnostics", {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        warnings: quality.warnings,
        missingAnchors: quality.missingAnchors,
      });
    }

    const assetHydration = hydrateScreenAssetSlots({
      code: finalized.code,
      assetManifest: resolvedAssetManifest,
    });
    const assetSanitization = sanitizeScreenAssetUsage({
      code: assetHydration.code,
      assetManifest: resolvedAssetManifest,
    });
    const latestAttempt = attempts.at(-1);
    if (latestAttempt) {
      latestAttempt.assetSanitizedMisuseCount = assetSanitization.sanitizedMisuseCount;
      latestAttempt.assetRepairedMetadataCount = assetSanitization.repairedMetadataCount;
      latestAttempt.assetHydratedCount = assetHydration.hydratedAssetCount;
      latestAttempt.assetPlaceholderUseCount = assetHydration.placeholderUseCount;
      latestAttempt.assetOutcomes = assetHydration.outcomes;
      latestAttempt.assetSanitizationWarnings = assetSanitization.warnings;
    }
    let code = assetSanitization.code;
    const localNavigation = payload.navigationPlan?.enabled
      ? detectLocalNavigationMarkup(code)
      : { hasLocalNavigation: false, reasons: [], candidates: [] };
    if (localNavigation.hasLocalNavigation) {
      const latestAttempt = attempts.at(-1);
      if (latestAttempt) {
        latestAttempt.localNavigationReasons = localNavigation.reasons;
        latestAttempt.localNavigationCandidates = localNavigation.candidates;
        latestAttempt.qualityWarnings = Array.from(new Set([
          ...latestAttempt.qualityWarnings,
          "Suspected local primary navigation remains; the paid screen was preserved for review.",
        ]));
      }

      logger.warn("Screen build retained suspected local navigation; preserving paid output with diagnostics", {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        reasons: localNavigation.reasons,
        candidates: localNavigation.candidates,
      });
    }

    const health = detectScreenHealth({ code, screenPrompt: payload.screenPlan.description });
    const assetPolicy = validateScreenAssetPolicy({ code, assetManifest: resolvedAssetManifest });
    let blockIndex = indexScreenCode(code);
    const screenStatus = screenStatusForHealth(health);

    logger.info("Screen generation diagnostics", {
      screenId: payload.screenId,
      screenName: payload.screenPlan.name,
      attempts,
      health,
      assetPolicy,
      assetHydration,
      assetSanitization: {
        changed: assetSanitization.changed,
        sanitizedMisuseCount: assetSanitization.sanitizedMisuseCount,
        repairedMetadataCount: assetSanitization.repairedMetadataCount,
        warnings: assetSanitization.warnings,
        invalidUrls: assetSanitization.invalidUrls,
        roleMismatches: assetSanitization.roleMismatches,
      },
    });

    if (assetPolicy.warnings.length > 0 || assetSanitization.warnings.length > 0) {
      const latestAttempt = attempts.at(-1);
      if (latestAttempt) {
        latestAttempt.qualityWarnings = Array.from(new Set([
          ...latestAttempt.qualityWarnings,
          ...assetSanitization.warnings,
          ...assetPolicy.warnings,
        ]));
      }

      logger.warn("Screen build saved with external image URL diagnostics", {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        invalidUrls: assetPolicy.invalidUrls,
        sanitizedMisuseCount: assetSanitization.sanitizedMisuseCount,
      });
    }

    if (!assetPolicy.valid) {
      await appendScreenBuildDiagnostics(admin, payload.generationRunId, payload.screenId, attempts);
      const missingAssetDetails = [
        ...assetPolicy.missingCriticalSlotIds.map((requirementId) => `slot:${requirementId}`),
        ...assetPolicy.missingRequiredUrls.map((url) => `url:${url}`),
      ].slice(0, 4);
      const policyReason = `Generated screen did not satisfy required critical visual assets: ${missingAssetDetails.join(", ")}`;
      return failAfterSavingGeneratedCode({
        error: `[screen_generation:invalid_image_url] ${policyReason}`,
        code,
        blockIndex,
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
    const summary =
      generationEngineVersion === "v2"
        ? buildScreenSummaryLocally(payload.screenPlan.name, code, payload.screenPlan.description, blockIndex)
        : undefined;
    const healthError = buildScreenHealthError(health);
    const codeSanitize = sanitizeScreenCodeForPersist(code);
    if (codeSanitize.changed) {
      logger.warn("Sanitized screen code before persist", {
        screenId: payload.screenId,
        removedNullBytes: codeSanitize.removedNullBytes,
        fixedLoneSurrogates: codeSanitize.fixedLoneSurrogates,
        removedControlChars: codeSanitize.removedControlChars,
        originalLength: code.length,
        sanitizedLength: codeSanitize.value.length,
      });
      code = codeSanitize.value;
      blockIndex = indexScreenCode(code);
    }

    let persistPatch = buildScreenPersistPatch({
      code,
      status: screenStatus,
      error: healthError,
      summary,
      blockIndex,
      chromePolicy: payload.screenPlan.chromePolicy ?? null,
      navigationItemId: payload.screenPlan.navigationItemId ?? null,
      qualityDiagnostics: buildStaticScreenQualityDiagnostics(code, finalized.contractReport),
    });

    let updateError = await persistScreenRow(persistPatch);

    // Retry once with a deeper sanitize if PostgREST rejected the JSON body.
    if (updateError && isPersistJsonError(updateError)) {
      logger.warn("Retrying screen persist after JSON body rejection", {
        screenId: payload.screenId,
        error: updateError,
      });
      const retrySanitize = sanitizeScreenCodeForPersist(code);
      code = retrySanitize.value;
      // Drop block_index on retry — large/odd indexes can rarely break body encoding.
      blockIndex = indexScreenCode(code);
      persistPatch = buildScreenPersistPatch({
        code,
        status: screenStatus,
        error: healthError,
        summary: summary ? sanitizeTextForJson(summary).value : summary,
        blockIndex: null,
        chromePolicy: payload.screenPlan.chromePolicy ?? null,
        navigationItemId: payload.screenPlan.navigationItemId ?? null,
        qualityDiagnostics: buildStaticScreenQualityDiagnostics(code, finalized.contractReport),
      });
      updateError = await persistScreenRow(persistPatch);
    }

    if (updateError) {
      const userError = toUserFacingScreenError(updateError);
      logger.error("Failed to persist screen code", {
        screenId: payload.screenId,
        error: updateError,
        userError,
        codeLength: code.length,
        isPersistJsonError: isPersistJsonError(updateError),
      });

      // Last resort: keep generated HTML when possible so refresh doesn't wipe a good preview.
      const fallbackPatch = buildScreenPersistPatch({
        code,
        status: "failed",
        error: userError,
        blockIndex: null,
        chromePolicy: payload.screenPlan.chromePolicy ?? null,
        navigationItemId: payload.screenPlan.navigationItemId ?? null,
      });
      const fallbackError = await persistScreenRow(fallbackPatch);
      if (fallbackError) {
        const placeholder = buildErrorCode(userError);
        await persistScreenRow(
          buildScreenPersistPatch({
            code: placeholder,
            status: "failed",
            error: userError,
            blockIndex: indexScreenCode(placeholder),
          }),
        );
      }

      // Always keep diagnostics for failed persists.
      const latestAttempt = attempts.at(-1);
      if (latestAttempt) {
        latestAttempt.qualityWarnings = Array.from(
          new Set([
            ...latestAttempt.qualityWarnings,
            `persist_failed:${userError}`,
          ]),
        );
      }
      await appendScreenBuildDiagnostics(admin, payload.generationRunId, payload.screenId, attempts);

      return {
        screenId: payload.screenId,
        status: "failed" as const,
        error: userError,
        sanitizedMisuseCount: assetSanitization.sanitizedMisuseCount,
        repairedMetadataCount: assetSanitization.repairedMetadataCount,
        hydratedAssetCount: assetHydration.hydratedAssetCount,
        placeholderUseCount: assetHydration.placeholderUseCount,
        usedResolvedAssetCount: assetPolicy.resolvedAssetUseCount,
        ignoredResolvedAssetIds: assetPolicy.ignoredResolvedAssetIds,
        assetOutcomes: {
          hydration: assetHydration.outcomes,
          usesByRequirement: assetPolicy.usesByRequirement,
        },
        assetResolution: {
          requirements: pendingAssetRequirements,
          failures: resolvedAssets.failures ?? [],
          diagnostics: resolvedAssets.diagnostics ?? [],
          durationMs: assetResolutionDurationMs,
        },
        usageByAttempt: attempts.map((attempt) => attempt.usageMetadata).filter(Boolean),
      };
    }

    await appendScreenBuildDiagnostics(admin, payload.generationRunId, payload.screenId, attempts);

    // Queue one non-blocking retrieval-memory refresh. The task reads the
    // latest saved source, so stale task payloads cannot overwrite newer edits.
    await enrichScreenMemoryTask.trigger(
      { screenId: payload.screenId },
      { concurrencyKey: `screen-memory-${payload.screenId}` },
    );

    logger.info("Built screen", {
      screenId: payload.screenId,
      screenName: payload.screenPlan.name,
    });

    return {
      screenId: payload.screenId,
      status: screenStatus,
      sanitizedMisuseCount: assetSanitization.sanitizedMisuseCount,
      repairedMetadataCount: assetSanitization.repairedMetadataCount,
      hydratedAssetCount: assetHydration.hydratedAssetCount,
      placeholderUseCount: assetHydration.placeholderUseCount,
      usedResolvedAssetCount: assetPolicy.resolvedAssetUseCount,
      ignoredResolvedAssetIds: assetPolicy.ignoredResolvedAssetIds,
      assetOutcomes: {
        hydration: assetHydration.outcomes,
        usesByRequirement: assetPolicy.usesByRequirement,
      },
      assetResolution: {
        requirements: pendingAssetRequirements,
        failures: resolvedAssets.failures ?? [],
        diagnostics: resolvedAssets.diagnostics ?? [],
        durationMs: assetResolutionDurationMs,
      },
      usageByAttempt: attempts.map((attempt) => attempt.usageMetadata).filter(Boolean),
    };
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
  // Parent build plus up to three sequential state edit passes can exceed the old 900s ceiling.
  maxDuration: 1800,
  onFailure: async ({ payload, error }: { payload: GenerateUiFlowPayload; error: unknown }) => {
    const admin = createAdminClient();
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = cleanErrorMessage(rawMessage);
    const returnedCredits = await releaseGenerationCreditRemainder({
      admin,
      ownerId: payload.ownerId,
      generationRunId: payload.generationRunId,
      reason: message,
    }).catch((creditError) => {
      logger.error("Failed to return reserved credits after generation failure", {
        generationRunId: payload.generationRunId,
        error: creditError,
      });
      return 0;
    });

    await updateGenerationRun(admin, payload.generationRunId, {
      status: "failed",
      error: message,
      completed_at: now(),
    });
    await mergeGenerationRunMetadata(admin, payload.generationRunId, {
      returnedCredits,
      creditSettlement: "failure_cleanup",
      generationPreview: null,
    });

    // Mark any placeholder screens from this run as failed so they
    // don't stay stuck in the "building" spinner forever.
    const { data: stuckScreens } = await admin
      .from("screens")
      .select("id, name")
      .eq("generation_run_id", payload.generationRunId)
      .in("status", ["queued", "building"]);

    if ((stuckScreens ?? []).length > 0) {
      const stuckScreenIds = (stuckScreens ?? []).map((screen) => screen.id);
      await admin
        .from("project_screen_roadmap")
        .update({ status: "failed" })
        .in("generated_screen_id", stuckScreenIds);
    }

    await admin
      .from("screens")
      .update({
        status: "failed",
        error: message,
        code: buildErrorCode(message),
        updated_at: now(),
      })
      .eq("generation_run_id", payload.generationRunId)
      .in("status", ["queued", "building"]);
    await settleProjectStatus(admin, payload.projectId, false);

    await Promise.all((stuckScreens ?? []).map((screen) =>
      postStatusMessage(
        admin,
        payload.projectId,
        payload.ownerId,
        humanizeScreenBuildFailure(screen.name, message),
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

    const failedJournal = createGenerationJournal(payload.generationRunId);
    failedJournal.status = "failed";
    failedJournal.title = "Generation failed";
    failedJournal.detail = message;
    failedJournal.activePhase = null;
    failedJournal.screens = (stuckScreens ?? []).map((screen) => ({
      name: screen.name,
      status: "failed",
      description: message,
    }));
    setJournalPhase(failedJournal, journalPhaseForError(message), "failed", message);
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, failedJournal);

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
        returnedCredits,
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
    const generationEngineVersion = getGenerationEngineVersion();
    const admin = createAdminClient();
    const generationJournal = createGenerationJournal(payload.generationRunId);
    const aiUsage = createPerformanceAiUsage();
    const llmLogFor = (stage: string) => (label: string, data: Record<string, unknown>) => {
      logger.info(label, data);
      if (label.startsWith("[TOKEN USAGE]")) {
        recordPerformanceAiUsage(aiUsage, stage, data);
      }
    };
    const taskStartedAt = now();
    await mergeGenerationPerformance(admin, payload.generationRunId, {
      taskStartedAt,
      queueWaitMeasuredAt: taskStartedAt,
    });

    let designTokens = payload.designTokens ?? null;
    const { data: existingProject } = await admin
      .from("projects")
      .select("project_charter, design_tokens")
      .eq("id", payload.projectId)
      .maybeSingle();
    const existingCharter = (existingProject?.project_charter as ProjectCharter | null) ?? null;
    const projectReferenceDna = resolveProjectReferenceDna(payload.projectCharter ?? existingCharter)?.dna ?? null;
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
    setJournalPhase(generationJournal, "brief", "completed", "Received the project brief and queued planning.");
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

    const contextStartedAt = now();
    const contextStartedMs = Date.now();
    const referenceStartedAt = now();
    const referenceStartedMs = Date.now();
    const planningContextPromise = assembleProjectContext({
      admin,
      projectId: payload.projectId,
      userPrompt: payload.prompt,
      retrieveScreenMemory: payload.isNewProject !== true,
    }).then((value) => ({
      value,
      stage: performanceStage(contextStartedAt, contextStartedMs),
    }));
    const storedPromptImage = await loadStoredPromptImage(admin, payload.imagePath).catch((error) => {
      if (payload.referencePolicy !== "project_reference") throw error;
      logger.warn("[PROJECT REFERENCE] Stored project upload could not be loaded; continuing with project memory.", {
        projectId: payload.projectId,
        imagePath: payload.imagePath,
        error,
      });
      return null;
    });
    const publishedStylePreset = !storedPromptImage
      ? await resolvePublishedStylePreset(payload.stylePresetSlug)
      : null;
    const designStyle = publishedStylePreset?.stylePack ?? (!storedPromptImage
      ? getDesignStylePack(
          isDesignStyleId(payload.designStyleId)
            ? payload.designStyleId
            : payload.projectCharter?.designStyle?.id ?? existingCharter?.designStyle?.id ?? null,
        )
      : null);
    const hasInheritedProjectImage = payload.referencePolicy === "project_reference";
    let referencePolicy = resolveGenerationReferencePolicy({
      hasCurrentUserImage: Boolean(storedPromptImage) && !hasInheritedProjectImage,
      hasProjectReferenceImage: Boolean(storedPromptImage) && hasInheritedProjectImage,
      hasExplicitStyle: Boolean(designStyle),
      isExistingProject: payload.isNewProject !== true,
      requestedPolicy: payload.referencePolicy,
    });
    if (referencePolicy === "project_reference" && !storedPromptImage) {
      referencePolicy = "project_memory";
    }
    if (referencePolicy === "user_upload" && !storedPromptImage) {
      throw new Error("The uploaded reference image is unavailable. Please attach it again and retry.");
    }

    let promptImage = storedPromptImage;
    let referenceMode: ReferenceMode = "user_recreate";
    let referenceSource: ReferenceSource | null = null;
    let referenceId: string | null = null;
    let referenceCatalogHash: string | null = null;
    const curatedStyleSelectionDiagnostics: CuratedStyleSelectionDiagnostics[] = [];

    if (referencePolicy === "user_upload") {
      referenceMode = payload.imageReferenceMode === "style" ? "user_style" : "user_recreate";
      referenceSource = "user_upload";
    } else if (referencePolicy === "project_reference") {
      referenceMode = "user_style";
      referenceSource = "project_upload";
    } else if (referencePolicy === "explicit_style" && designStyle) {
      referenceMode = "curated_style";
      referenceSource = "curated";
      referenceId = designStyle.id;
    } else if (referencePolicy === "project_memory") {
      promptImage = null;
      referenceMode = "user_style";
      referenceSource = "project_memory";
    } else if (projectReferenceDna?.sourceReferenceId) {
      const persistedReference = getCuratedStyleReferenceById(projectReferenceDna.sourceReferenceId);
      const curatedImage = persistedReference
        ? await loadCuratedStyleReferenceImage(persistedReference)
        : null;
      promptImage = curatedImage;
      referenceMode = curatedImage ? "curated_style" : "internal_style";
      referenceSource = "curated";
      referenceId = curatedImage ? persistedReference?.id ?? null : null;
      referenceCatalogHash = curatedImage
        ? projectReferenceDna.sourceReferenceCatalogHash ?? null
        : null;
      if (!curatedImage) {
        logger.warn("[CURATED STYLE REFERENCE] Persisted reference could not be reused.", {
          referenceId: projectReferenceDna.sourceReferenceId,
        });
      }
    } else {
      const match = await matchCuratedStyleReference({
        prompt: payload.prompt,
        planningMode: payload.planningMode ?? "project",
        existingCharter,
        llmLog: llmLogFor("reference"),
        onSelection: (diagnostics) => {
          curatedStyleSelectionDiagnostics.push(diagnostics);
        },
      });

      if (!match) {
        referenceMode = "internal_style";
        referenceSource = null;
      } else {
        logger.info("[CURATED STYLE REFERENCE] selected", {
          referenceId: match.reference.id,
          similarity: match.similarity,
          runnerUp: match.runnerUp,
        });
        const curatedImage = await loadCuratedStyleReferenceImage(match.reference);
        promptImage = curatedImage;
        referenceMode = curatedImage ? "curated_style" : "internal_style";
        referenceSource = "curated";
        referenceId = curatedImage ? match.reference.id : null;
        referenceCatalogHash = curatedImage ? match.catalogHash : null;
      }
    }
    const planningContextResult = await planningContextPromise;
    const planningContext = planningContextResult.value;
    await mergeGenerationPerformance(admin, payload.generationRunId, {
      stages: {
        context: planningContextResult.stage,
        reference: performanceStage(referenceStartedAt, referenceStartedMs),
      },
    });

    const curatedStyleSelectionDiagnostic = curatedStyleSelectionDiagnostics[0] ?? null;
    const reusableProjectReferenceDna = projectReferenceDna && (
      referencePolicy === "project_reference"
      || referencePolicy === "project_memory"
      || Boolean(payload.plannedScreens?.length || payload.screenPlanningSeeds?.length)
    )
      ? projectReferenceDna
      : null;
    setJournalPhase(
      generationJournal,
      "reference",
      "completed",
      referencePolicy === "user_upload"
        ? referenceMode === "user_recreate"
          ? "Using the uploaded image as structural UI evidence."
          : "Using the uploaded image as style direction."
        : referencePolicy === "project_reference"
          ? "Using the project's persisted user reference as visual style direction."
          : referencePolicy === "project_memory"
            ? "Using the existing project's screens, charter, and design tokens as visual direction."
            : referencePolicy === "explicit_style"
              ? `Using the explicitly selected design style${referenceId ? `: ${referenceId}` : ""}.`
              : referenceId
                ? `Matched internal style reference: ${referenceId}.`
                : curatedStyleSelectionDiagnostic?.rejectionReason === "constraint_conflict"
                  ? "No curated reference satisfied the user's explicit design constraints; using prompt-only design direction."
                  : "No curated reference passed the confidence checks; using prompt-only design direction.",
    );
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

    const scopeStartedAt = now();
    const scopeStartedMs = Date.now();
    const scopePreflight = payload.scopeContract
      ? payload.referenceAnalysis ?? reusableProjectReferenceDna?.analysis
        ? {
            scopeContract: { ...payload.scopeContract, referenceMode },
            referenceAnalysis: payload.referenceAnalysis ?? reusableProjectReferenceDna?.analysis ?? null,
            referenceAnalysisResult: null,
          }
        : payload.projectCharter || existingCharter
          ? {
              scopeContract: { ...payload.scopeContract, referenceMode },
              referenceAnalysis: null as ReferenceAnalysis | null,
              referenceAnalysisResult: null,
            }
        : await analyzeReferenceImageForScope({
            prompt: payload.prompt,
            image: promptImage,
            referenceMode,
            llmLog: llmLogFor("reference"),
          }).then((referenceAnalysisResult) => ({
            scopeContract: { ...payload.scopeContract!, referenceMode },
            referenceAnalysis: referenceAnalysisResult.analysis,
            referenceAnalysisResult,
          }))
      : await preflightGenerationScope({
          prompt: payload.prompt,
          image: promptImage,
          referenceMode,
          planningMode: payload.planningMode ?? "project",
          cachedReferenceAnalysis: reusableProjectReferenceDna?.analysis,
          llmLog: llmLogFor("scope"),
        });
    const scopeContract = scopePreflight.scopeContract;
    const referenceAnalysis = scopePreflight.referenceAnalysis;
    const promptMode = resolveGenerationPromptMode({
      referenceMode,
      hasImage: Boolean(promptImage),
      hasDesignStyle: Boolean(designStyle),
      hasReferenceAnalysis: Boolean(referenceAnalysis),
      hasProjectVisualMemory: Boolean(
        reusableProjectReferenceDna
        || projectReferenceDna
        || referenceSource === "project_memory"
        || referenceSource === "project_upload"
      ),
    });
    await mergeGenerationPerformance(admin, payload.generationRunId, {
      stages: { scope: performanceStage(scopeStartedAt, scopeStartedMs) },
    });


    await updateGenerationRun(admin, payload.generationRunId, {
      requested_screen_count: scopeContract.finalScreenCount ?? null,
    });

    await mergeGenerationRunMetadata(admin, payload.generationRunId, {
      requestedImageReferenceMode: payload.imageReferenceMode ?? "recreate",
      referencePolicy,
      requestedDesignStyleId: payload.designStyleId ?? null,
      requestedStylePresetSlug: publishedStylePreset?.slug ?? null,
      requestedStylePresetVersion: publishedStylePreset?.version ?? null,
      referenceMode,
      promptMode,
      referenceSource,
      referenceId,
      referenceCatalogHash,
      curatedStyleSelection: curatedStyleSelectionDiagnostic ? {
        ...curatedStyleSelectionDiagnostic,
        appliedReferenceId: referenceId,
        applied: Boolean(referenceId && referenceCatalogHash),
      } : (
        referenceId && referenceCatalogHash
          ? {
              selector: "embedding-v1",
              model: CURATED_STYLE_EMBEDDING_MODEL,
              catalogHash: referenceCatalogHash,
              referenceId,
            }
          : null
      ),
      designStyle: summarizeDesignStyle(designStyle),
      scopeContract,
      referenceDnaCache: reusableProjectReferenceDna
        ? {
            hit: true,
            schemaVersion: reusableProjectReferenceDna.schemaVersion,
            source: reusableProjectReferenceDna.source,
            sourceImagePath: reusableProjectReferenceDna.sourceImagePath ?? null,
          }
        : { hit: false },
      referenceAnalysisDiagnostics: scopePreflight.referenceAnalysisResult
        ? {
            source: scopePreflight.referenceAnalysisResult.source,
            confidence: scopePreflight.referenceAnalysisResult.confidence,
            scopeConfidence: scopePreflight.referenceAnalysisResult.scopeConfidence ?? scopePreflight.referenceAnalysisResult.confidence,
            visualEvidenceConfidence: scopePreflight.referenceAnalysisResult.visualEvidenceConfidence ?? "low",
            evidenceCompleteness: scopePreflight.referenceAnalysisResult.evidenceCompleteness ?? null,
            screenCountEstimate: scopePreflight.referenceAnalysisResult.screenCountEstimate,
            screenReferenceCount: scopePreflight.referenceAnalysisResult.screenReferenceCount,
            diagnostics: scopePreflight.referenceAnalysisResult.diagnostics,
            validationIssues: scopePreflight.referenceAnalysisResult.validationIssues ?? [],
          }
        : null,
    });

    const designStartedAt = now();
    const designStartedMs = Date.now();
    if (!designTokens) {
      setJournalPhase(generationJournal, "design", "active", "Extracting the visual system and token direction.");
      await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

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
        designStyle,
        referenceAnalysis,
        llmLog: llmLogFor("design"),
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
      setJournalPhase(generationJournal, "design", "completed", "Design tokens are ready for the build.");
      await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);
    } else {
      setJournalPhase(generationJournal, "design", "completed", "Using the approved project design tokens.");
      await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);
    }
    await mergeGenerationPerformance(admin, payload.generationRunId, {
      stages: { design: performanceStage(designStartedAt, designStartedMs) },
    });

    const requestedCharter = payload.projectCharter ?? existingCharter ?? (
      (payload.plannedScreens && payload.plannedScreens.length > 0) || (payload.screenPlanningSeeds && payload.screenPlanningSeeds.length > 0)
        ? fallbackProjectCharter({
            prompt: payload.prompt,
            image: referenceMode === "user_recreate" ? promptImage : null,
            referenceMode,
            referenceAnalysis,
            designStyle,
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

    const planningMode = payload.planningMode ?? "project";
    const planningSeeds = payload.screenPlanningSeeds ?? [];
    const legacyPlannedScreens = payload.plannedScreens ?? [];
    const seedScreens: ScreenPlan[] = planningSeeds.length > 0
      ? planningSeeds.map((seed) => ({
          name: seed.name,
          type: seed.type,
          description: seed.summary,
          roadmapStableKey: seed.roadmapStableKey ?? null,
          stateVariants: [],
          assetNeeds: [],
        }))
      : legacyPlannedScreens;
    const hasSeedScreens = seedScreens.length > 0;
    const hasPlanningSeeds = planningSeeds.length > 0;
    // New approval payloads are always intent-only seeds. Legacy compact plans are
    // also upgraded before build, while old builder-grade retry payloads stay compatible.
    const shouldPlanScreenBriefsFromSeeds = hasPlanningSeeds
      || (legacyPlannedScreens.length > 0 && screenPlansNeedBuildEnrichment(legacyPlannedScreens));
    const blueprintStartedAt = now();
    const blueprintStartedMs = Date.now();
    let screenBriefsStartedAt: string | null = shouldPlanScreenBriefsFromSeeds ? now() : null;
    let screenBriefsStartedMs: number | null = shouldPlanScreenBriefsFromSeeds ? Date.now() : null;

    if (hasSeedScreens) {
      setJournalPhase(generationJournal, "blueprint", "completed", "Using existing project structure.");
      if (shouldPlanScreenBriefsFromSeeds) {
        setJournalPhase(generationJournal, "screens", "active", "Drafting builder-ready screen briefs.");
      } else {
        setJournalPhase(generationJournal, "screens", "completed", `Using approved plan for ${seedScreens.length} screen${seedScreens.length === 1 ? "" : "s"}.`);
      }
    } else {
      setJournalPhase(generationJournal, "blueprint", "active", "Choosing navigation scope and project structure.");
    }
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);
    if (hasSeedScreens) {
      generationJournal.screens = seedScreens.map((screen) => ({
        name: screen.name,
        type: screen.type,
        description: screen.description,
        status: shouldPlanScreenBriefsFromSeeds ? "briefing" : "planned",
      }));
      const generationPreview: GenerationPreviewMetadata = {
        version: 1,
        stage: shouldPlanScreenBriefsFromSeeds ? "screen_briefs" : "asset_resolution",
        screens: seedScreens.map((screen, index) => ({
          stableKey: screen.roadmapStableKey ?? screenRoadmapKey(screen.name),
          roadmapItemId: screen.roadmapItemId ?? null,
          name: screen.name,
          type: screen.type,
          index,
        })),
        updatedAt: now(),
      };
      await mergeGenerationRunMetadata(admin, payload.generationRunId, { generationPreview });
      await mergeGenerationPerformance(admin, payload.generationRunId, {
        blueprintPreviewAt: generationPreview.updatedAt,
        stages: { blueprint: performanceStage(blueprintStartedAt, blueprintStartedMs) },
      });
    }

    const progressiveFirstScreen = isProgressiveFirstScreenEnabled()
      && !hasSeedScreens
      && planningMode === "project";
    let remainingBriefsStarter: (() => Promise<{ screens: ScreenPlan[]; droppedScreenNames?: string[] }>) | null = null;
    let plan: PlannedUiFlow;

    if (hasSeedScreens) {
      plan = {
          requiresBottomNav: Boolean(payload.navigationPlan?.enabled),
          navigationArchitecture: requestedNavigationArchitecture,
          navigationPlan: normalizeNavigationPlan({
            navigationPlan: payload.navigationPlan,
            screens: seedScreens,
            navigationArchitecture: requestedNavigationArchitecture,
            requiresBottomNav: deriveRequiresBottomNav(requestedNavigationArchitecture),
            strictScreenLinks: planningMode !== "single-screen",
          }),
          charter: requestedCharter!,
          screens: seedScreens,
          scopeContract,
          screenCountContract: undefined,
          screenCountEnforcement: "none" as const,
          intentContract: undefined,
          screenFamilyContract: undefined,
          roadmap: payload.projectRoadmap ?? undefined,
          initialBatchItemKeys: payload.initialBatchItemKeys ?? undefined,
          requestedParentCount: payload.projectRoadmap?.requestedParentCount ?? null,
          remainingUnplannedCount: payload.projectRoadmap?.remainingUnplannedCount ?? 0,
        };
    } else if (progressiveFirstScreen) {
      const blueprint = await planProjectBlueprint({
        prompt: payload.prompt,
        image: promptImage,
        referenceMode,
        referenceId,
        referenceCatalogHash,
        designStyle,
        designTokens,
        scopeContract,
        referenceAnalysis,
        referenceDna: reusableProjectReferenceDna,
        screenFamilyContract: reusableProjectReferenceDna?.screenFamilyContract,
        projectContext: planningContext,
        existingCharter: requestedCharter,
        existingNavigationPlan: payload.navigationPlan ?? null,
        planningMode,
        onProgress: async (event) => {
          if (event.type !== "blueprint_ready") return;
          const blueprintReadyAt = now();
          setJournalPhase(generationJournal, "blueprint", "completed", `Project structure is ready for ${event.screens.length} screen${event.screens.length === 1 ? "" : "s"}.`);
          setJournalPhase(generationJournal, "screens", "active", `Briefing ${event.screens[0]?.name ?? "the first screen"} first.`);
          generationJournal.screens = event.screens.map((screen) => ({
            name: screen.name,
            type: screen.type,
            status: "briefing",
          }));
          await mergeGenerationRunMetadata(admin, payload.generationRunId, {
            generationPreview: {
              version: 1,
              stage: "screen_briefs",
              screens: event.screens,
              updatedAt: blueprintReadyAt,
            } satisfies GenerationPreviewMetadata,
          });
          await mergeGenerationPerformance(admin, payload.generationRunId, {
            blueprintReadyAt,
            blueprintPreviewAt: blueprintReadyAt,
            stages: { blueprint: performanceStage(blueprintStartedAt, blueprintStartedMs) },
          });
          await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);
        },
        llmLog: llmLogFor("blueprint"),
      });
      const seedPlans: ScreenPlan[] = blueprint.screenSeeds.map((seed) => ({
        name: seed.name,
        type: seed.type,
        description: seed.summary,
        roadmapStableKey: seed.roadmapStableKey ?? screenRoadmapKey(seed.name),
        roadmapPriority: seed.roadmapPriority,
        explicitlyRequested: seed.explicitlyRequested,
        referenceScreenIndex: seed.referenceScreenIndex ?? null,
        referenceScreenCount: seed.referenceScreenCount ?? null,
        stateVariants: [],
        assetNeeds: [],
      }));
      if (seedPlans.length === 0) throw new Error("The project blueprint did not return an initial screen seed.");
      const firstBriefStartedAt = now();
      const firstBriefStartedMs = Date.now();
      await mergeGenerationPerformance(admin, payload.generationRunId, { firstBriefStartedAt });
      let firstBrief: ScreenPlan;
      let remainingAlreadyPlanned = false;
      try {
        const firstResult = await planScreenBriefsForBuild({
          screens: [seedPlans[0]],
          prompt: payload.prompt,
          charter: blueprint.charter,
          navigationArchitecture: blueprint.navigationArchitecture,
          navigationPlan: blueprint.navigationPlan,
          designTokens,
          designStyle,
          projectContext: planningContext,
          planningMode,
          referenceMode,
          force: true,
          llmLog: llmLogFor("firstScreenBrief"),
        });
        firstBrief = firstResult.screens[0];
      } catch (error) {
        if (seedPlans.length === 1) throw error;
        logger.warn("First screen brief failed; promoting the first valid remaining brief", {
          screenName: seedPlans[0].name,
          error,
        });
        const promoted = await planScreenBriefsForBuild({
          screens: seedPlans.slice(1),
          prompt: payload.prompt,
          charter: blueprint.charter,
          navigationArchitecture: blueprint.navigationArchitecture,
          navigationPlan: blueprint.navigationPlan,
          designTokens,
          designStyle,
          projectContext: planningContext,
          planningMode,
          referenceMode,
          force: true,
          llmLog: llmLogFor("promotedScreenBriefs"),
        });
        seedPlans.splice(0, seedPlans.length, ...promoted.screens);
        firstBrief = seedPlans[0];
        remainingAlreadyPlanned = true;
      }
      const firstBriefReadyAt = now();
      await mergeGenerationPerformance(admin, payload.generationRunId, {
        firstBriefReadyAt,
        stages: { firstBrief: performanceStage(firstBriefStartedAt, firstBriefStartedMs) },
      });
      plan = {
        requiresBottomNav: blueprint.requiresBottomNav,
        navigationArchitecture: blueprint.navigationArchitecture,
        navigationPlan: normalizeNavigationPlan({
          navigationPlan: blueprint.navigationPlan,
          screens: [firstBrief, ...seedPlans.slice(1)],
          navigationArchitecture: blueprint.navigationArchitecture,
          requiresBottomNav: blueprint.requiresBottomNav,
          strictScreenLinks: true,
        }),
        charter: blueprint.charter,
        screens: [firstBrief, ...seedPlans.slice(1)],
        scopeContract: blueprint.scopeContract,
        screenCountContract: blueprint.screenCountContract,
        screenCountEnforcement: blueprint.screenCountEnforcement,
        intentContract: blueprint.intentContract,
        screenFamilyContract: blueprint.screenFamilyContract,
        roadmap: blueprint.roadmap,
        initialBatchItemKeys: blueprint.initialBatchItemKeys,
        requestedParentCount: blueprint.requestedParentCount,
        remainingUnplannedCount: blueprint.remainingUnplannedCount,
      };
      const remainingSeeds = seedPlans.slice(1);
      if (remainingSeeds.length > 0 && !remainingAlreadyPlanned) {
        remainingBriefsStarter = async () => {
          const remainingBriefsStartedAt = now();
          const remainingBriefsStartedMs = Date.now();
          await mergeGenerationPerformance(admin, payload.generationRunId, { remainingBriefsStartedAt });
          const result = await planScreenBriefsForBuild({
            screens: remainingSeeds,
            prompt: payload.prompt,
            charter: blueprint.charter,
            navigationArchitecture: blueprint.navigationArchitecture,
            navigationPlan: blueprint.navigationPlan,
            designTokens,
            designStyle,
            projectContext: planningContext,
            planningMode,
            referenceMode,
            force: true,
            llmLog: llmLogFor("remainingScreenBriefs"),
          });
          const remainingBriefsReadyAt = now();
          await mergeGenerationPerformance(admin, payload.generationRunId, {
            remainingBriefsReadyAt,
            stages: { remainingBriefs: performanceStage(remainingBriefsStartedAt, remainingBriefsStartedMs) },
          });
          return { screens: result.screens, droppedScreenNames: result.droppedScreenNames };
        };
      }
    } else {
      plan = await planUiFlow({
          prompt: payload.prompt,
          image: promptImage,
          referenceMode,
          referenceId,
          referenceCatalogHash,
          designStyle,
          designTokens,
          scopeContract,
          referenceAnalysis,
          referenceDna: reusableProjectReferenceDna,
          screenFamilyContract: reusableProjectReferenceDna?.screenFamilyContract,
          projectContext: planningContext,
          existingCharter: requestedCharter,
          existingNavigationPlan: payload.navigationPlan ?? null,
          planningMode,
          onProgress: async (event) => {
            if (event.type === "blueprint_ready") {
              screenBriefsStartedAt = now();
              screenBriefsStartedMs = Date.now();
              setJournalPhase(
                generationJournal,
                "blueprint",
                "completed",
                `Project structure is ready for ${event.screens.length} screen${event.screens.length === 1 ? "" : "s"}.`,
              );
              setJournalPhase(
                generationJournal,
                "screens",
                "active",
                "Writing builder-ready briefs for every planned screen.",
              );
              generationJournal.screens = event.screens.map((screen) => ({
                name: screen.name,
                type: screen.type,
                status: "briefing",
              }));
              const generationPreview: GenerationPreviewMetadata = {
                version: 1,
                stage: "screen_briefs",
                screens: event.screens,
                updatedAt: now(),
              };
              await mergeGenerationRunMetadata(admin, payload.generationRunId, { generationPreview });
              await mergeGenerationPerformance(admin, payload.generationRunId, {
                blueprintPreviewAt: generationPreview.updatedAt,
                stages: { blueprint: performanceStage(blueprintStartedAt, blueprintStartedMs) },
              });
              await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);
            }
          },
          llmLog: llmLogFor("blueprint"),
        });
    }

    if (shouldPlanScreenBriefsFromSeeds && !progressiveFirstScreen) {
      if (!requestedCharter) {
        throw new Error("Add-screen planning requires the existing project charter before any build can begin.");
      }
      const plannedBriefs = await planScreenBriefsForBuild({
        screens: plan.screens,
        prompt: payload.prompt,
        charter: requestedCharter,
        navigationArchitecture: plan.navigationArchitecture,
        navigationPlan: plan.navigationPlan,
        designTokens,
        designStyle,
        projectContext: planningContext,
        planningMode,
        referenceMode,
        force: true,
        llmLog: llmLogFor("screenBriefs"),
      });
      plan = {
        ...plan,
        screens: plannedBriefs.screens,
        navigationPlan: normalizeNavigationPlan({
          navigationPlan: plan.navigationPlan,
          screens: plannedBriefs.screens,
          navigationArchitecture: plan.navigationArchitecture,
          requiresBottomNav: deriveRequiresBottomNav(plan.navigationArchitecture),
          strictScreenLinks: planningMode !== "single-screen",
        }),
      };
      setJournalPhase(
        generationJournal,
        "screens",
        "completed",
        plannedBriefs.planned
          ? `Planned ${plan.screens.length} builder-ready screen${plan.screens.length === 1 ? "" : "s"}.`
          : `Prepared ${plan.screens.length} screen${plan.screens.length === 1 ? "" : "s"} for build.`,
      );
      await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);
    }
    if (screenBriefsStartedAt && screenBriefsStartedMs !== null) {
      await mergeGenerationPerformance(admin, payload.generationRunId, {
        stages: {
          briefs: performanceStage(screenBriefsStartedAt, screenBriefsStartedMs),
        },
      });
    }

	    if (
      !payload.plannedScreens?.length
      && !payload.screenPlanningSeeds?.length
      && plan.charter.referenceDna
      && !plan.charter.referenceDna.sourceImagePath
      && payload.imagePath
      && (referencePolicy === "user_upload" || referencePolicy === "project_reference")
    ) {
      plan.charter = {
        ...plan.charter,
        referenceDna: {
          ...plan.charter.referenceDna,
          sourceImagePath: payload.imagePath,
        },
	      };
	    }
	    // The requested reference mode is a fact about the user's request and does
	    // not depend on whether analysis succeeded. Deriving origin only from
	    // referenceDna meant that any failed reference analysis persisted an
	    // Image-to-UI project as `prompt`, so every later add-screen and edit
	    // forgot the project had ever started from a reference.
	    const requestedOrigin: NonNullable<ProjectCharter["projectOrigin"]> = referenceMode === "user_recreate"
	      ? "image_to_ui"
	      : referenceMode || referenceId
	        ? "style_reference"
	        : "prompt";
	    const projectOrigin = existingCharter?.projectOrigin
	      ?? payload.projectCharter?.projectOrigin
	      ?? (projectReferenceDna?.referenceMode === "user_recreate" || plan.charter.referenceDna?.referenceMode === "user_recreate"
	        ? "image_to_ui"
	        : projectReferenceDna || plan.charter.referenceDna
	          ? "style_reference"
	          : requestedOrigin);
	    plan.charter = { ...plan.charter, projectOrigin };
	    const curatedNavigationFallback = referenceSource === "curated"
	      ? getCuratedStyleReferenceById(referenceId)
	      : null;
	    plan.navigationPlan = applyReferenceNavigationAppearance({
	      navigationPlan: plan.navigationPlan,
	      referenceAnalysis,
	      curatedNavigationTags: curatedNavigationFallback?.selectionProfile.navigation ?? [],
	      curatedMaterialTags: curatedNavigationFallback?.selectionProfile.materials ?? [],
	      designTokens,
	    });
	    plan.requiresBottomNav = plan.navigationPlan.enabled;
	    plan.screens = applyNavigationPlanToScreens(plan.screens, plan.navigationPlan);
	    if (payload.stateVariants?.length && plan.screens.length === 1) {
	      plan.screens[0] = { ...plan.screens[0], stateVariants: payload.stateVariants };
	    }

	    const roadmapSeed = payload.projectRoadmap ?? plan.roadmap ?? buildProjectRoadmap({
	      screens: plan.screens,
	      navigationPlan: plan.navigationPlan,
	      requestedParentCount: plan.requestedParentCount ?? plan.scopeContract?.finalScreenCount ?? scopeContract?.finalScreenCount ?? null,
	    });
	    let projectRoadmap = buildProjectRoadmap({
	      screens: plan.screens,
	      navigationPlan: plan.navigationPlan,
	      requestedParentCount: roadmapSeed.requestedParentCount,
	      tranche: roadmapSeed.tranche,
	      plannedItems: roadmapSeed.items,
	    });
	    const persistedRoadmapRows = await persistProjectRoadmap({
	      admin,
	      projectId: payload.projectId,
	      ownerId: payload.ownerId,
	      roadmap: projectRoadmap,
	    }) as ProjectScreenRoadmapRow[];
	    const roadmapByKey = new Map(persistedRoadmapRows.map((item) => [item.stable_key, item]));
	    plan.screens = plan.screens.slice(0, 5).map((screenPlan) => {
	      const stableKey = screenPlan.roadmapStableKey ?? screenRoadmapKey(screenPlan.name);
	      const roadmapItem = roadmapByKey.get(stableKey);
	      const variants = (screenPlan.stateVariants ?? []).map((variant) => {
	        const variantStableKey = variant.roadmapStableKey ?? stateRoadmapKey(stableKey, variant.stateKey);
	        return {
	          ...variant,
	          roadmapStableKey: variantStableKey,
	          roadmapItemId: roadmapByKey.get(variantStableKey)?.id ?? variant.roadmapItemId ?? null,
	        };
	      });
	      return {
	        ...screenPlan,
	        roadmapStableKey: stableKey,
	        roadmapItemId: roadmapItem?.id ?? screenPlan.roadmapItemId ?? null,
	        stateVariants: variants,
	      };
	    });

	    const retryOnlyStateVariants = payload.retryContext?.mode === "state_variants"
	      && Boolean(payload.retryContext.parentScreenId);
	    const stateGroups = plan.screens.map((screenPlan) => ({
	      parent: screenPlan,
	      variants: (screenPlan.stateVariants ?? []).filter((variant) =>
	        payload.stateVariants?.length
	          ? payload.stateVariants.some((selected) => selected.id === variant.id)
	          : variant.defaultSelected || variant.explicitlyRequested,
	      ),
	    }));
	    const parentOutputs = retryOnlyStateVariants ? [] : plan.screens;
	    const stateCapacity = Math.max(0, MAX_TOTAL_OUTPUTS_PER_RUN - parentOutputs.length);
	    let remainingStateCapacity = stateCapacity;
	    let selectedStateGroups = stateGroups.map((group) => {
	      const variants = group.variants.slice(0, remainingStateCapacity);
	      remainingStateCapacity -= variants.length;
	      return { ...group, variants };
	    }).filter((group) => group.variants.length > 0);
	    const reservationOutputs = [
	      ...parentOutputs.map((screenPlan) => ({
	        outputKey: generationOutputKey(
	          payload.generationRunId,
	          "screen",
	          screenPlan.roadmapStableKey ?? screenRoadmapKey(screenPlan.name),
	        ),
	        outputKind: "screen" as const,
	        roadmapItemId: screenPlan.roadmapItemId ?? null,
	        metadata: { screenName: screenPlan.name },
	      })),
	      ...selectedStateGroups.flatMap((group) => group.variants.map((variant) => ({
	        outputKey: generationOutputKey(
	          payload.generationRunId,
	          "state",
	          variant.roadmapStableKey ?? stateRoadmapKey(group.parent.roadmapStableKey ?? screenRoadmapKey(group.parent.name), variant.stateKey),
	        ),
	        outputKind: "state" as const,
	        amount: STATE_GENERATION_CREDIT_COST,
	        roadmapItemId: variant.roadmapItemId ?? null,
	        metadata: { screenName: group.parent.name, stateLabel: variant.stateLabel },
	      }))),
	    ];
	    if (reservationOutputs.length === 0) {
	      throw new Error("This generation has no unbuilt roadmap outputs to reserve.");
	    }
	    let reservationSummary;
	    try {
	      reservationSummary = await reserveGenerationCredits({
	        admin,
	        ownerId: payload.ownerId,
	        projectId: payload.projectId,
	        generationRunId: payload.generationRunId,
	        outputs: reservationOutputs,
	      });
	    } catch (error) {
	      if (error instanceof CreditReservationError && error.code === "insufficient_credits") {
	        await postStatusMessage(admin, payload.projectId, payload.ownerId, error.message, "error", {
	          generationRunId: payload.generationRunId,
	          activityKey: `run:${payload.generationRunId}:credits_error`,
	        });
	      }
	      throw error;
	    }
	    const queuedRoadmapIds = reservationOutputs
	      .map((output) => output.roadmapItemId)
	      .filter((id): id is string => Boolean(id));
	    if (queuedRoadmapIds.length > 0) {
	      const { error: roadmapQueueError } = await admin
	        .from("project_screen_roadmap")
	        .update({ status: "queued" })
	        .in("id", queuedRoadmapIds)
	        .neq("status", "ready");
	      if (roadmapQueueError) throw roadmapQueueError;
	    }
    const navigationTelemetry = {
      version: plan.navigationPlan.version ?? 1,
      decision: plan.navigationPlan.decision ?? (plan.navigationPlan.enabled ? "legacy-enabled" : "none"),
      evidenceSource: plan.navigationPlan.evidence?.source ?? null,
      enabled: plan.navigationPlan.enabled,
      itemCount: plan.navigationPlan.items.length,
      generatedDestinations: plan.navigationPlan.items.filter((item) => item.availability !== "planned" && item.linkedScreenName).length,
      plannedDestinations: plan.navigationPlan.items.filter((item) => item.availability === "planned" || !item.linkedScreenName).length,
      anatomy: plan.navigationPlan.design?.anatomy ?? null,
    };
    logger.info("Navigation planning telemetry", navigationTelemetry);
    await mergeGenerationRunMetadata(admin, payload.generationRunId, {
      navigationV2: navigationTelemetry,
    });
    setJournalPhase(
      generationJournal,
      "blueprint",
      "completed",
      plan.navigationPlan.enabled ? "Shared navigation is planned for this project." : "No shared navigation is needed for this run.",
    );
    setJournalPhase(
      generationJournal,
      "screens",
      progressiveFirstScreen && remainingBriefsStarter ? "active" : "completed",
      progressiveFirstScreen && remainingBriefsStarter
        ? `First brief ready; ${Math.max(0, plan.screens.length - 1)} remaining screen${plan.screens.length === 2 ? "" : "s"} will be planned during the first build.`
        : `Planned ${plan.screens.length} screen${plan.screens.length === 1 ? "" : "s"}.`,
    );
    generationJournal.screens = plan.screens.map((screenPlan, index) => ({
      name: screenPlan.name,
      type: screenPlan.type,
      description: screenPlan.description,
      chrome: screenPlan.chromePolicy?.chrome ?? null,
      navigationItemId: screenPlan.navigationItemId ?? null,
      assetNeedCount: screenPlan.assetNeeds?.length ?? 0,
      status: progressiveFirstScreen && remainingBriefsStarter && index > 0 ? "briefing" : "planned",
    }));
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

    if (!retryOnlyStateVariants) {
      const rawNavigationShellCode = await buildNavigationShellCode({
        navigationPlan: plan.navigationPlan,
        designTokens,
        prompt: payload.prompt,
        image: referenceMode === "user_recreate" ? promptImage : null,
        referenceMode,
        referenceId,
        designStyle,
        projectCharter: plan.charter,
        llmLog: llmLogFor("navigation"),
      });
      const navigationShellCode = ensureDrawgleIds(tokenizeStaticDrawgleHtml(rawNavigationShellCode, designTokens).code, "dg-nav").code;

      const { error: navigationUpsertError } = await admin
        .from("project_navigation")
        .upsert({
          project_id: payload.projectId,
          owner_id: payload.ownerId,
          plan: plan.navigationPlan as never,
          shell_code: navigationShellCode,
          block_index: indexNavigationShell(navigationShellCode) as never,
          status: "ready",
          error: null,
          updated_at: now(),
        }, { onConflict: "project_id" });

      if (navigationUpsertError) {
        throw navigationUpsertError;
      }
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
      scopeContract: plan.scopeContract ?? scopeContract,
      designStyle: summarizeDesignStyle(designStyle),
      designTokenSnapshot: designTokens ?? null,
      plannedScreens: plan.screens.map((screenPlan) => ({
        name: screenPlan.name,
        type: screenPlan.type,
        description: screenPlan.description,
        chromePolicy: screenPlan.chromePolicy ?? null,
        layoutContract: screenPlan.layoutContract ?? null,
        referenceTransfer: screenPlan.referenceTransfer ?? null,
	        navigationItemId: screenPlan.navigationItemId ?? null,
	        assetNeeds: screenPlan.assetNeeds ?? [],
	        roadmapStableKey: screenPlan.roadmapStableKey ?? null,
	        roadmapItemId: screenPlan.roadmapItemId ?? null,
	        roadmapPriority: screenPlan.roadmapPriority ?? null,
	        explicitlyRequested: screenPlan.explicitlyRequested ?? false,
	        stateVariants: screenPlan.stateVariants ?? [],
	      })),
	      roadmap: projectRoadmap,
	      initialBatchItemKeys: plan.initialBatchItemKeys ?? plan.screens.map((screen) => screen.roadmapStableKey).filter(Boolean),
	      requestedParentCount: projectRoadmap.requestedParentCount,
	      remainingUnplannedCount: projectRoadmap.remainingUnplannedCount,
	      stateVariants: selectedStateGroups.flatMap((group) => group.variants),
	      selectedStateVariantIds: selectedStateGroups.flatMap((group) => group.variants.map((variant) => variant.id)),
	      creditReservation: reservationSummary,
      screenCountContract: plan.screenCountContract ?? null,
      screenCountEnforcement: plan.screenCountEnforcement ?? "none",
      intentContract: plan.intentContract ?? null,
      screenFamilyContract: plan.screenFamilyContract ?? null,
      plannedScreenCount: plan.screens.length,
      navigationEnabled: plan.navigationPlan.enabled,
      generationPreview: {
        version: 1,
        stage: progressiveFirstScreen ? "screen_briefs" : "asset_resolution",
        screens: plan.screens.map((screenPlan, index) => ({
          stableKey: screenPlan.roadmapStableKey ?? screenRoadmapKey(screenPlan.name),
          roadmapItemId: screenPlan.roadmapItemId ?? null,
          name: screenPlan.name,
          type: screenPlan.type,
          index,
        })),
        updatedAt: now(),
      } satisfies GenerationPreviewMetadata,
    });

    generationJournal.screens = generationJournal.screens?.map((screen) =>
      screen.status === "ready" || screen.status === "failed" || progressiveFirstScreen
        ? screen
        : { ...screen, status: "preparing_assets" },
    );
    setJournalPhase(
      generationJournal,
      "assets",
      progressiveFirstScreen ? "completed" : "active",
      progressiveFirstScreen
        ? "Each screen resolves its own assets concurrently with HTML streaming."
        : "Resolving curated assets, stock photos, or simple placeholders.",
    );
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

    if (!progressiveFirstScreen) await postStatusMessage(
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

    const assetPlanningStartedAt = now();
    const assetPlanningStartedMs = Date.now();
    const assetRequirements = retryOnlyStateVariants || progressiveFirstScreen ? [] : await planVisualAssets({
      prompt: payload.prompt,
      screens: plan.screens,
      charter: plan.charter,
      designTokens,
      referenceMode,
      intentContract: plan.intentContract ?? null,
      llmLog: llmLogFor("assetPlanning"),
    });
    await mergeGenerationPerformance(admin, payload.generationRunId, {
      stages: { assetPlanning: performanceStage(assetPlanningStartedAt, assetPlanningStartedMs) },
    });
    const assetResolutionStartedAt = now();
    const assetResolutionStartedMs = Date.now();
    let lastAssetJournalPostMs = 0;

    const projectAssetManifest: ProjectAssetManifest = retryOnlyStateVariants || progressiveFirstScreen
      ? { requirements: [], assetsByScreen: {}, failures: [], diagnostics: [] }
      : await resolveProjectAssets({
          admin,
          ownerId: payload.ownerId,
          projectId: payload.projectId,
          generationRunId: payload.generationRunId,
          requirements: assetRequirements,
          onProgress: async (progress) => {
            const timestampMs = Date.now();
            const shouldPost = progress.completed === 1
              || progress.completed === progress.total
              || timestampMs - lastAssetJournalPostMs >= 1000;
            if (!shouldPost) return;
            lastAssetJournalPostMs = timestampMs;
            const failureSuffix = progress.failures > 0 ? ` ${progress.failures} failed.` : "";
            const detail = `Resolved ${progress.completed} of ${progress.total} asset requirement${progress.total === 1 ? "" : "s"}.${failureSuffix}`;
            setJournalPhase(generationJournal, "assets", "active", detail);
            generationJournal.assetSummary = {
              requested: progress.total,
              resolved: progress.resolved,
              placeholders: progress.placeholders,
              failures: progress.failures,
            };
            await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);
          },
        });
    const assetDiagnostics = projectAssetManifest.diagnostics ?? [];
    await mergeGenerationPerformance(admin, payload.generationRunId, {
      stages: { assetResolution: performanceStage(assetResolutionStartedAt, assetResolutionStartedMs) },
    });

    const requirementCount = Math.max(assetRequirements.length, 1);
    const assetLaunchMetrics = {
      curatedHitRate: assetDiagnostics.filter((item) => item.selectedVia === "curated").length / requirementCount,
      stockFallbackRate: assetDiagnostics.filter((item) => item.selectedSource === "stock").length / requirementCount,
      placeholderRate: assetDiagnostics.filter((item) => item.selectedSource === "placeholder").length / requirementCount,
      semanticRejectionRate: assetDiagnostics.filter((item) => Boolean(item.rejectionCode)).length / requirementCount,
      cacheHitRate: assetDiagnostics.filter((item) => item.cacheHit).length / requirementCount,
      apiCalls: assetDiagnostics.reduce((sum, item) => sum + item.apiCallCount, 0),
      r2Writes: assetDiagnostics.reduce((sum, item) => sum + item.r2WriteCount, 0),
      sanitizerActions: 0,
      repairedMetadataCount: 0,
      hydratedAssetCount: 0,
      postBuildPlaceholderCount: 0,
      usedResolvedAssetCount: 0,
      ignoredResolvedAssetCount: 0,
      resolvedToUsedRate: 0,
    };

    await mergeGenerationRunMetadata(admin, payload.generationRunId, {
      generationEngineVersion,
      assetRequirements,
      assetManifest: projectAssetManifest,
      assetResolutionDiagnostics: assetDiagnostics,
      assetLaunchMetrics,
    });

    const resolvedAssetCount = Object.values(projectAssetManifest.assetsByScreen)
      .flat()
      .filter((asset) => !asset.placeholder && asset.url)
      .length;
    const placeholderAssetCount = Object.values(projectAssetManifest.assetsByScreen)
      .flat()
      .filter((asset) => asset.placeholder)
      .length;
    const assetStatusTitle = progressiveFirstScreen
      ? "Visual assets will resolve during each screen build"
      : assetRequirements.length === 0
      ? "No bitmap assets requested by planner"
      : resolvedAssetCount === 0 && placeholderAssetCount > 0
        ? "Bitmap assets requested, no match found, placeholders used"
        : placeholderAssetCount > 0
          ? `Resolved ${resolvedAssetCount} visual asset${resolvedAssetCount === 1 ? "" : "s"}, using ${placeholderAssetCount} placeholder${placeholderAssetCount === 1 ? "" : "s"}`
          : `Resolved ${resolvedAssetCount} visual asset${resolvedAssetCount === 1 ? "" : "s"}`;

    if (!progressiveFirstScreen) await postStatusMessage(
      admin,
      payload.projectId,
      payload.ownerId,
      assetStatusTitle,
      "generation_completed",
      {
        generationRunId: payload.generationRunId,
        activityKey: `run:${payload.generationRunId}:assets`,
        assetRequirementCount: assetRequirements.length,
        resolvedAssetCount,
        placeholderAssetCount,
      },
    );
    setJournalPhase(generationJournal, "assets", "completed", assetStatusTitle);
    generationJournal.assetSummary = progressiveFirstScreen ? undefined : {
      requested: assetRequirements.length,
      resolved: resolvedAssetCount,
      placeholders: placeholderAssetCount,
      failures: projectAssetManifest.failures?.length ?? 0,
    };
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

    const shouldSendBuildContext = Boolean(payload.plannedScreens?.length || payload.screenPlanningSeeds?.length) || (payload.planningMode ?? "project") === "single-screen";
    const buildContext = shouldSendBuildContext ? compactBuildContext(planningContext) : null;

    const baseScreenPlans: ScreenPlan[] = plan.screens.length > 0 ? plan.screens : [{
      name: "New Screen",
      type: "root",
      description: payload.prompt,
    }];
	    const referenceTargetCount = plan.scopeContract?.finalScreenCount ?? plan.scopeContract?.imageScreenCount ?? baseScreenPlans.length;
    const resolvedScreenPlans: ScreenPlan[] = referenceMode === "user_recreate"
      ? baseScreenPlans.map((screenPlan, index) => ({
          ...screenPlan,
          referenceScreenIndex: screenPlan.referenceScreenIndex ?? index + 1,
          referenceScreenCount: screenPlan.referenceScreenCount ?? referenceTargetCount,
        }))
      : baseScreenPlans;
    let screenPlans = retryOnlyStateVariants ? [] : resolvedScreenPlans;

	    let stateVariantCount = selectedStateGroups.reduce((total, group) => total + group.variants.length, 0);
	    let plannedOutputCount = screenPlans.length + stateVariantCount;

    await postStatusMessage(
      admin,
      payload.projectId,
      payload.ownerId,
      `Planned ${plannedOutputCount} screen${plannedOutputCount === 1 ? "" : "s"}`,
      "generation_completed",
      {
        generationRunId: payload.generationRunId,
        plannedScreenCount: plannedOutputCount,
        baseScreenCount: screenPlans.length,
	        stateVariantCount,
	        reservedCredits: reservationSummary.reservedCredits,
	        activityKey: planningActivityKey(payload.generationRunId),
	      },
	    );

    const reservedSlots = screenPlans.length > 0
      ? await reserveScreenSlots(admin, payload.projectId, screenPlans.length)
      : [];

    await updateGenerationRun(admin, payload.generationRunId, {
      status: "building",
      requires_bottom_nav: plan.requiresBottomNav,
      requested_screen_count: plannedOutputCount,
    });
    const buildStartedAt = now();
    const buildStartedMs = Date.now();
    await mergeGenerationRunMetadata(admin, payload.generationRunId, {
      generationPreview: {
        version: 1,
        stage: "building",
        screens: plan.screens.map((screenPlan, index) => ({
          stableKey: screenPlan.roadmapStableKey ?? screenRoadmapKey(screenPlan.name),
          roadmapItemId: screenPlan.roadmapItemId ?? null,
          name: screenPlan.name,
          type: screenPlan.type,
          index,
        })),
        updatedAt: buildStartedAt,
      } satisfies GenerationPreviewMetadata,
    });
    await mergeGenerationPerformance(admin, payload.generationRunId, { buildStartedAt });
    generationJournal.status = "building";
    setJournalPhase(generationJournal, "build", "active", `Building ${plannedOutputCount} screen${plannedOutputCount === 1 ? "" : "s"} on the canvas.`);
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

    // Sequential build: each screen is triggered, inserted, and polled to
    // completion before the next one starts.  This means Screen 1 appears
    // on the canvas as soon as it is ready, Screen 2 starts immediately
    // after, and so on — giving the user continuous visible progress
    // rather than a long wait for all screens to finish simultaneously.
    let successfulScreens = 0;
    let failedScreens = 0;
    let successfulStateVariants = 0;
    let failedStateVariants = 0;
    let sanitizerActions = 0;
    let repairedMetadataCount = 0;
    let hydratedAssetCount = 0;
    let postBuildPlaceholderCount = 0;
    let usedResolvedAssetCount = 0;
    const ignoredResolvedAssetIds = new Set<string>();
    const postBuildAssetOutcomes: Record<string, unknown> = {};
    const perScreenAssetResolution: Record<string, unknown> = {};
    const successfulRoadmapItemIds = new Set<string>();
    const readyParentScreenIds = new Map<string, string>();
    let settlementQueue: Promise<void> = Promise.resolve();
    let journalWriteQueue: Promise<void> = Promise.resolve();
    const postGenerationJournalSerial = () => {
      const snapshot = structuredClone(generationJournal);
      journalWriteQueue = journalWriteQueue.then(() =>
        postGenerationJournal(admin, payload.projectId, payload.ownerId, snapshot),
      );
      return journalWriteQueue;
    };
    const serializeSettlement = <T,>(operation: () => Promise<T>): Promise<T> => {
      const result = settlementQueue.then(operation, operation);
      settlementQueue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    };


    if (retryOnlyStateVariants && payload.retryContext?.parentScreenId) {
      for (const stateGroup of selectedStateGroups) {
        const variantResult = await buildStateVariantsForParent({
          admin,
          payload,
          parentScreenId: payload.retryContext.parentScreenId,
          parentRoadmapStableKey: stateGroup.parent.roadmapStableKey
            ?? screenRoadmapKey(stateGroup.parent.name),
          variants: stateGroup.variants,
        });
        successfulStateVariants += variantResult.successfulVariants;
        failedStateVariants += variantResult.failedVariants;
        successfulScreens += variantResult.successfulVariants;
        failedScreens += variantResult.failedVariants;
        variantResult.successfulRoadmapItemIds.forEach((id) => successfulRoadmapItemIds.add(id));
      }
    }

    let remainingBriefsPromise: Promise<{ screens: ScreenPlan[]; droppedScreenNames?: string[] }> | null = null;
    const screenEntries = screenPlans.map((screenPlan, index) => ({ screenPlan, index }));
    let screenBatches = buildFirstScreenPriorityBatches(screenEntries, 2);
    for (let batchIndex = 0; batchIndex < screenBatches.length; batchIndex += 1) {
      const batch = screenBatches[batchIndex];
      await Promise.all(batch.map(async ({ screenPlan, index }) => {
      const parentRoadmapStableKey = screenPlan.roadmapStableKey ?? screenRoadmapKey(screenPlan.name);
      const outputKey = generationOutputKey(payload.generationRunId, "screen", parentRoadmapStableKey);
      const selectedStateGroup = selectedStateGroups.find((group) =>
        (group.parent.roadmapStableKey ?? screenRoadmapKey(group.parent.name)) === parentRoadmapStableKey,
      );
      const hasSelectedStateVariants = Boolean(selectedStateGroup?.variants.length);
      const reusableScreenId = payload.retryContext?.reuseScreenIdsByName?.[
        screenPlan.name.trim().toLowerCase().replace(/\s+/g, " ")
      ] ?? null;
      const screenId = reusableScreenId ?? randomUUID();
      let rowInserted = false;

      try {
        const referenceAttachment = resolveReferenceImageAttachment({
          engineVersion: generationEngineVersion,
          image: promptImage,
          referenceMode,
          referenceTransfer: screenPlan.referenceTransfer,
          screenLayoutRegions: screenPlan.layoutContract?.regions,
        });
        logger.info("Reference image builder attachment resolved", {
          screenName: screenPlan.name,
          attached: referenceAttachment.attach,
          role: referenceAttachment.role,
          reason: referenceAttachment.reason,
          calibrationContractVersion: referenceAttachment.calibrationContractVersion,
          featureEnabled: referenceAttachment.featureEnabled,
        });
        generationJournal.screens = generationJournal.screens?.map((screen) =>
          screen.name === screenPlan.name ? { ...screen, status: "queued" } : screen,
        );
        await postGenerationJournalSerial();

        if (reusableScreenId) {
          const { error: resetError } = await admin
            .from("screens")
            .update({
              generation_run_id: payload.generationRunId,
              roadmap_item_id: screenPlan.roadmapItemId ?? null,
              parent_screen_id: null,
              state_key: hasSelectedStateVariants ? payload.baseState?.stateKey ?? "base" : null,
              state_label: hasSelectedStateVariants ? payload.baseState?.stateLabel ?? "Base" : null,
              state_role: hasSelectedStateVariants ? "base" : null,
              name: screenPlan.name,
              prompt: screenPlan.description,
              code: buildPlaceholderCode(screenPlan.name, designTokens),
              chrome_policy: (screenPlan.chromePolicy ?? null) as never,
              navigation_item_id: screenPlan.navigationItemId ?? null,
              status: "queued",
              error: null,
              trigger_run_id: null,
              stream_public_token: null,
              updated_at: now(),
            })
            .eq("id", reusableScreenId)
            .eq("project_id", payload.projectId)
            .eq("owner_id", payload.ownerId);
          if (resetError) throw resetError;
          rowInserted = true;
        }


        if (!reusableScreenId) {
          const { error: placeholderInsertError } = await admin.from("screens").insert({
            id: screenId,
            owner_id: payload.ownerId,
            project_id: payload.projectId,
            generation_run_id: payload.generationRunId,
            roadmap_item_id: screenPlan.roadmapItemId ?? null,
            parent_screen_id: null,
            state_key: hasSelectedStateVariants ? payload.baseState?.stateKey ?? "base" : null,
            state_label: hasSelectedStateVariants ? payload.baseState?.stateLabel ?? "Base" : null,
            state_role: hasSelectedStateVariants ? "base" : null,
            name: screenPlan.name,
            prompt: screenPlan.description,
            code: buildPlaceholderCode(screenPlan.name, designTokens),
            chrome_policy: (screenPlan.chromePolicy ?? null) as never,
            navigation_item_id: screenPlan.navigationItemId ?? null,
            status: "queued",
            trigger_run_id: null,
            stream_public_token: null,
            position_x: reservedSlots[index]?.position_x ?? 4800 + index * 450,
            position_y: reservedSlots[index]?.position_y ?? 4600,
            sort_index: reservedSlots[index]?.sort_index ?? index,
            created_at: now(),
            updated_at: now(),
          });
          if (placeholderInsertError) {
            throw new Error(`Failed to insert queued screen "${screenPlan.name}": ${placeholderInsertError.message}`);
          }
        }
        rowInserted = true;
        if (index === 0) {
          await mergeGenerationPerformance(admin, payload.generationRunId, { firstScreenRowAt: now() });
        }
        const handle = await (buildScreenTask as any).trigger(
          {
            generationRunId: payload.generationRunId,
            screenId,
            projectId: payload.projectId,
            ownerId: payload.ownerId,
            screenPlan,
            prompt: payload.prompt,
            designTokens,
            image: referenceAttachment.attach ? promptImage : null,
            referenceImageRole: referenceAttachment.role,
            referenceAttachmentReason: referenceAttachment.reason,
            referenceGeometryConfidence: referenceAnalysis?.geometryProfile
              ? (["high", "medium", "low"] as const)
                  .map((confidence) => `${confidence}=${referenceAnalysis.geometryProfile!.measurements.filter((item) => item.confidence === confidence).length}`)
                  .join(",")
              : null,
            promptMode,
            referenceMode,
            referenceSource,
            referenceId,
            referenceScreenIndex: screenPlan.referenceScreenIndex ?? index + 1,
            referenceScreenCount: screenPlan.referenceScreenCount ?? referenceTargetCount,
            designStyleId: designStyle?.id ?? null,
            designStyle,
            requiresBottomNav: plan.requiresBottomNav,
            navigationArchitecture: plan.navigationArchitecture,
            navigationPlan: plan.navigationPlan,
            assetRequirements: progressiveFirstScreen ? undefined : [],
            assetManifest: projectAssetManifest.assetsByScreen[screenPlan.name] ?? [],
            projectCharter: plan.charter,
            productContract: buildBuilderProjectContract({
              charter: plan.charter,
              screenFamily: plan.screenFamilyContract,
              screenPlan,
              navigationPlan: plan.navigationPlan,
              designTokens,
            }),
            projectContext: buildContext,
            isFirstScreen: index === 0,
          },
          {
            concurrencyKey: `project-${payload.projectId}`,
          },
        );
        if (index === 0) {
          const firstBuilderTriggeredAt = now();
          await mergeGenerationPerformance(admin, payload.generationRunId, { firstBuilderTriggeredAt });
          if (remainingBriefsStarter && !remainingBriefsPromise) {
            remainingBriefsPromise = remainingBriefsStarter();
            setJournalPhase(
              generationJournal,
              "screens",
              "active",
              `Building ${screenPlan.name} while planning ${Math.max(0, screenPlans.length - 1)} remaining screen${screenPlans.length === 2 ? "" : "s"}.`,
            );
            await postGenerationJournalSerial();
          }
        }

        const { error: triggerBindError } = await admin
          .from("screens")
          .update({
            status: "building",
            trigger_run_id: handle.id,
            stream_public_token: handle.publicAccessToken ?? null,
            updated_at: now(),
          })
          .eq("id", screenId)
          .eq("project_id", payload.projectId)
          .eq("owner_id", payload.ownerId);
        if (triggerBindError) {
          throw new Error(`Failed to bind screen builder for "${screenPlan.name}": ${triggerBindError.message}`);
        }
        generationJournal.screens = generationJournal.screens?.map((screen) =>
          screen.name === screenPlan.name ? { ...screen, status: "building" } : screen,
        );
        await postGenerationJournalSerial();

        await serializeSettlement(() => bindReservationToScreen({
          admin,
          ownerId: payload.ownerId,
          generationRunId: payload.generationRunId,
          outputKey,
          screenId,
        }));
        await serializeSettlement(() => markRoadmapItemForScreen({
          admin,
          roadmapItemId: screenPlan.roadmapItemId,
          screenId,
          status: "building",
        }));

        const { error: usageScreenError } = await admin
          .from("project_asset_usages")
          .update({ screen_id: screenId })
          .eq("project_id", payload.projectId)
          .eq("generation_run_id", payload.generationRunId)
          .eq("screen_name", screenPlan.name)
          .is("screen_id", null);
        if (usageScreenError) {
          logger.warn("Failed to attach visual asset usages to screen", {
            screenId,
            screenName: screenPlan.name,
            error: usageScreenError,
          });
        }

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
        const buildOutput = result?.output as {
          sanitizedMisuseCount?: number;
          repairedMetadataCount?: number;
          hydratedAssetCount?: number;
          placeholderUseCount?: number;
          usedResolvedAssetCount?: number;
          ignoredResolvedAssetIds?: string[];
          assetOutcomes?: Record<string, unknown>;
          assetResolution?: Record<string, unknown>;
          usageByAttempt?: Array<Record<string, unknown>>;
        } | undefined;
        for (const usageMetadata of buildOutput?.usageByAttempt ?? []) {
          recordPerformanceAiUsage(aiUsage, "build", usageMetadata);
        }
        sanitizerActions += buildOutput?.sanitizedMisuseCount ?? 0;
        repairedMetadataCount += buildOutput?.repairedMetadataCount ?? 0;
        hydratedAssetCount += buildOutput?.hydratedAssetCount ?? 0;
        postBuildPlaceholderCount += buildOutput?.placeholderUseCount ?? 0;
        usedResolvedAssetCount += buildOutput?.usedResolvedAssetCount ?? 0;
        for (const assetId of buildOutput?.ignoredResolvedAssetIds ?? []) {
          ignoredResolvedAssetIds.add(assetId);
        }
        if (buildOutput?.assetOutcomes) {
          postBuildAssetOutcomes[screenPlan.name] = buildOutput.assetOutcomes;
        }
        if (buildOutput?.assetResolution) {
          perScreenAssetResolution[screenPlan.name] = buildOutput.assetResolution;
        }

        if (result?.status === "COMPLETED") {
          const { data: completedScreen } = await admin
            .from("screens")
            .select("status, error")
            .eq("id", screenId)
            .maybeSingle();

          if (completedScreen?.status !== "ready") {
            failedScreens += 1;
            const completedScreenError = toUserFacingScreenError(
              completedScreen?.error
                ?? "Screen builder completed without a durably saved ready screen.",
            );
            await serializeSettlement(() => releaseGenerationCredit({
              admin,
              ownerId: payload.ownerId,
              generationRunId: payload.generationRunId,
              outputKey,
              reason: completedScreenError,
            })).catch((creditError) => logger.error("Failed to release rejected screen credit", {
              outputKey,
              error: creditError,
            }));
            await serializeSettlement(() => markRoadmapItemForScreen({
              admin,
              roadmapItemId: screenPlan.roadmapItemId,
              screenId,
              status: "failed",
            })).catch((roadmapError) => logger.error("Failed to settle rejected screen roadmap item", {
              outputKey,
              error: roadmapError,
            }));
            // Only overwrite code when the child left placeholder/empty content.
            // Never clobber generated HTML with a raw technical error card.
            const { data: failedRow } = await admin
              .from("screens")
              .select("code")
              .eq("id", screenId)
              .maybeSingle();
            const existingCode = typeof failedRow?.code === "string" ? failedRow.code : "";
            const looksLikeGeneratedHtml =
              existingCode.includes("data-drawgle-id") ||
              (existingCode.includes("<div") && !existingCode.includes("Generation failed"));
            const failurePatch = buildScreenPersistPatch({
              code: looksLikeGeneratedHtml ? existingCode : buildErrorCode(completedScreenError),
              status: "failed",
              error: completedScreenError,
            });
            await admin
              .from("screens")
              .update(failurePatch)
              .eq("id", screenId)
              .neq("status", "ready");
            generationJournal.screens = generationJournal.screens?.map((screen) =>
              screen.name === screenPlan.name ? { ...screen, status: "failed" } : screen,
            );
            await postGenerationJournalSerial();

            await postStatusMessage(
              admin,
              payload.projectId,
              payload.ownerId,
              humanizeScreenBuildFailure(screenPlan.name, completedScreenError),
              "error",
              {
                generationRunId: payload.generationRunId,
                screenName: screenPlan.name,
                activityKey: screenBuildActivityKey(screenId),
                error: completedScreenError,
              },
              screenId,
            );
          } else {
            successfulScreens += 1;
            if (index === 0) {
              await mergeGenerationPerformance(admin, payload.generationRunId, { firstReadyAt: now() });
            }
            if (screenPlan.roadmapItemId) successfulRoadmapItemIds.add(screenPlan.roadmapItemId);
            readyParentScreenIds.set(parentRoadmapStableKey, screenId);
            await serializeSettlement(() => captureGenerationCredit({
              admin,
              ownerId: payload.ownerId,
              generationRunId: payload.generationRunId,
              outputKey,
              screenId,
            })).catch((creditError) => logger.error("Screen was saved but credit capture will need reconciliation", {
              outputKey,
              screenId,
              error: creditError,
            }));
            await serializeSettlement(() => markRoadmapItemForScreen({
              admin,
              roadmapItemId: screenPlan.roadmapItemId,
              screenId,
              status: "ready",
            })).catch((roadmapError) => logger.error("Screen was saved but roadmap settlement failed", {
              outputKey,
              screenId,
              error: roadmapError,
            }));
            generationJournal.screens = generationJournal.screens?.map((screen) =>
              screen.name === screenPlan.name ? { ...screen, status: "ready" } : screen,
            );
            await postGenerationJournalSerial();

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
          const message = toUserFacingScreenError(result?.error?.message ?? result?.error ?? "Unknown error");
          await serializeSettlement(() => releaseGenerationCredit({
            admin,
            ownerId: payload.ownerId,
            generationRunId: payload.generationRunId,
            outputKey,
            reason: message,
          })).catch((creditError) => logger.error("Failed to release unsuccessful screen credit", {
            outputKey,
            error: creditError,
          }));
          await serializeSettlement(() => markRoadmapItemForScreen({
            admin,
            roadmapItemId: screenPlan.roadmapItemId,
            screenId,
            status: "failed",
          })).catch((roadmapError) => logger.error("Failed to settle unsuccessful screen roadmap item", {
            outputKey,
            error: roadmapError,
          }));
          generationJournal.screens = generationJournal.screens?.map((screen) =>
            screen.name === screenPlan.name ? { ...screen, status: "failed" } : screen,
          );
          await postGenerationJournalSerial();
          const { data: failedRow } = await admin
            .from("screens")
            .select("code")
            .eq("id", screenId)
            .maybeSingle();
          const existingCode = typeof failedRow?.code === "string" ? failedRow.code : "";
          const looksLikeGeneratedHtml =
            existingCode.includes("data-drawgle-id") ||
            (existingCode.includes("<div") && !existingCode.includes("Generation failed"));
          await admin
            .from("screens")
            .update(
              buildScreenPersistPatch({
                code: looksLikeGeneratedHtml ? existingCode : buildErrorCode(message),
                status: "failed",
                error: message,
              }),
            )
            .eq("id", screenId);

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
            screenId,
          );
        }
      } catch (screenError) {
        failedScreens += 1;
        const rawMessage = screenError instanceof Error ? screenError.message : String(screenError);
        const message = toUserFacingScreenError(rawMessage);
        await serializeSettlement(() => releaseGenerationCredit({
          admin,
          ownerId: payload.ownerId,
          generationRunId: payload.generationRunId,
          outputKey,
          reason: message,
        })).catch((creditError) => logger.error("Failed to release screen credit", { outputKey, error: creditError }));
        await serializeSettlement(() => markRoadmapItemForScreen({
          admin,
          roadmapItemId: screenPlan.roadmapItemId,
          screenId: rowInserted ? screenId : null,
          status: "failed",
        })).catch((roadmapError) => logger.error("Failed to mark screen roadmap item", { outputKey, error: roadmapError }));
        logger.error("Failed to build screen", { screenName: screenPlan.name, error: screenError });
        generationJournal.screens = generationJournal.screens?.map((screen) =>
          screen.name === screenPlan.name ? { ...screen, status: "failed" } : screen,
        );
        await postGenerationJournalSerial();

        if (rowInserted) {
          const { data: failedRow } = await admin
            .from("screens")
            .select("code")
            .eq("id", screenId)
            .maybeSingle();
          const existingCode = typeof failedRow?.code === "string" ? failedRow.code : "";
          const looksLikeGeneratedHtml =
            existingCode.includes("data-drawgle-id") ||
            (existingCode.includes("<div") && !existingCode.includes("Generation failed"));
          await admin
            .from("screens")
            .update(
              buildScreenPersistPatch({
                code: looksLikeGeneratedHtml ? existingCode : buildErrorCode(message),
                status: "failed",
                error: message,
              }),
            )
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
      }));

      // The assignment happens inside a nested callback, so control-flow
      // analysis narrows this to `never` without an explicit annotation.
      const pendingRemainingBriefs = remainingBriefsPromise as Promise<{
        screens: ScreenPlan[];
        droppedScreenNames?: string[];
      }> | null;
      if (batchIndex === 0 && pendingRemainingBriefs) {
        try {
          const remainingResult = await pendingRemainingBriefs;
          const remainingScreens: ScreenPlan[] = remainingResult.screens;
          // Briefs the planner could not bring up to builder grade are real
          // losses against the requested scope. Recording them keeps the run
          // from reporting a clean completion for a partially delivered app.
          if (remainingResult.droppedScreenNames?.length) {
            await mergeGenerationRunMetadata(admin, payload.generationRunId, {
              droppedScreenBriefs: remainingResult.droppedScreenNames,
              droppedScreenBriefCount: remainingResult.droppedScreenNames.length,
            });
            // A dropped brief has no builder behind it. Leaving its roadmap row
            // queued showed an endless "Writing brief" spinner the user could
            // never resolve, which is worse than the silent loss it replaced.
            const { error: droppedRoadmapError } = await admin
              .from("project_screen_roadmap")
              .update({ status: "failed" })
              .eq("project_id", payload.projectId)
              .in("name", remainingResult.droppedScreenNames)
              .in("status", ["planned", "queued", "building"]);
            if (droppedRoadmapError) {
              logger.error("Failed to mark dropped screen briefs as failed", {
                generationRunId: payload.generationRunId,
                error: droppedRoadmapError,
              });
            }
            logger.warn("Some screen briefs were dropped after the bounded planner repair", {
              generationRunId: payload.generationRunId,
              dropped: remainingResult.droppedScreenNames,
            });
          }
          screenPlans = [screenPlans[0], ...remainingScreens];
          projectRoadmap = buildProjectRoadmap({
            screens: screenPlans,
            navigationPlan: plan.navigationPlan,
            requestedParentCount: projectRoadmap.requestedParentCount,
            tranche: projectRoadmap.tranche,
            plannedItems: projectRoadmap.items,
          });
          const refreshedRoadmapRows = await persistProjectRoadmap({
            admin,
            projectId: payload.projectId,
            ownerId: payload.ownerId,
            roadmap: projectRoadmap,
          }) as ProjectScreenRoadmapRow[];
          const refreshedRoadmapByKey = new Map(refreshedRoadmapRows.map((item) => [item.stable_key, item]));
          screenPlans = screenPlans.map((screenPlan) => {
            const stableKey = screenPlan.roadmapStableKey ?? screenRoadmapKey(screenPlan.name);
            return {
              ...screenPlan,
              roadmapStableKey: stableKey,
              roadmapItemId: refreshedRoadmapByKey.get(stableKey)?.id ?? screenPlan.roadmapItemId ?? null,
              stateVariants: (screenPlan.stateVariants ?? []).map((variant) => {
                const variantStableKey = variant.roadmapStableKey ?? stateRoadmapKey(stableKey, variant.stateKey);
                return {
                  ...variant,
                  roadmapStableKey: variantStableKey,
                  roadmapItemId: refreshedRoadmapByKey.get(variantStableKey)?.id ?? variant.roadmapItemId ?? null,
                };
              }),
            };
          });
          const alreadySelectedVariantIds = new Set(selectedStateGroups.flatMap((group) => group.variants.map((variant) => variant.id)));
          let remainingVariantCapacity = Math.max(
            0,
            MAX_TOTAL_OUTPUTS_PER_RUN - screenPlans.length - alreadySelectedVariantIds.size,
          );
          const discoveredStateGroups = screenPlans.slice(1).flatMap((parent) => {
            const variants = (parent.stateVariants ?? [])
              .filter((variant) => !alreadySelectedVariantIds.has(variant.id))
              .filter((variant) => variant.defaultSelected || variant.explicitlyRequested)
              .slice(0, remainingVariantCapacity);
            remainingVariantCapacity -= variants.length;
            return variants.length > 0 ? [{ parent, variants }] : [];
          });
          if (discoveredStateGroups.length > 0) {
            const appendOutputs = discoveredStateGroups.flatMap((group) => group.variants.map((variant) => ({
              outputKey: generationOutputKey(
                payload.generationRunId,
                "state",
                variant.roadmapStableKey ?? stateRoadmapKey(group.parent.roadmapStableKey ?? screenRoadmapKey(group.parent.name), variant.stateKey),
              ),
              outputKind: "state" as const,
              amount: STATE_GENERATION_CREDIT_COST,
              roadmapItemId: variant.roadmapItemId ?? null,
              metadata: { screenName: group.parent.name, stateLabel: variant.stateLabel },
            })));
            try {
              const appended = await appendGenerationCredits({
                admin,
                ownerId: payload.ownerId,
                projectId: payload.projectId,
                generationRunId: payload.generationRunId,
                outputs: appendOutputs,
              });
              reservationSummary = {
                ...reservationSummary,
                reservedCredits: reservationSummary.reservedCredits + appended.reservedCredits,
                outputCount: reservationSummary.outputCount + appended.outputCount,
                availableBalance: appended.availableBalance,
              };
              selectedStateGroups = [...selectedStateGroups, ...discoveredStateGroups];
              stateVariantCount = selectedStateGroups.reduce((total, group) => total + group.variants.length, 0);
              plannedOutputCount = screenPlans.length + stateVariantCount;
            } catch (error) {
              if (!(error instanceof CreditReservationError) || error.code !== "insufficient_credits") throw error;
              logger.warn("Skipping optional state variants because incremental credits are unavailable", {
                generationRunId: payload.generationRunId,
                variantCount: appendOutputs.length,
              });
            }
          }
          plan.screens = screenPlans;
          plan.navigationPlan = normalizeNavigationPlan({
            navigationPlan: plan.navigationPlan,
            screens: screenPlans,
            navigationArchitecture: plan.navigationArchitecture,
            requiresBottomNav: plan.requiresBottomNav,
            strictScreenLinks: true,
          });
          const remainingEntries = screenPlans.slice(1).map((screenPlan, offset) => ({
            screenPlan,
            index: offset + 1,
          }));
          const remainingBatches: typeof screenBatches = [];
          for (let index = 0; index < remainingEntries.length; index += 2) {
            remainingBatches.push(remainingEntries.slice(index, index + 2));
          }
          screenBatches = [screenBatches[0], ...remainingBatches];
          generationJournal.screens = generationJournal.screens?.map((screen) => {
            const planned = remainingScreens.find((item) => item.name === screen.name);
            return planned ? { ...screen, description: planned.description, status: "planned" } : screen;
          });
          setJournalPhase(generationJournal, "screens", "completed", `Planned ${screenPlans.length} builder-ready screens.`);
          await mergeGenerationRunMetadata(admin, payload.generationRunId, {
            plannedScreens: screenPlans,
            plannedScreenCount: screenPlans.length,
          });
          await postGenerationJournalSerial();
        } catch (error) {
          logger.error("Remaining screen planning failed after first builder handoff", {
            generationRunId: payload.generationRunId,
            error,
          });
          // The requested screens were never built. Record them so run
          // accounting cannot present this as a completed full-scope run.
          await mergeGenerationRunMetadata(admin, payload.generationRunId, {
            droppedScreenBriefs: screenPlans.slice(1).map((screen) => screen.name),
            droppedScreenBriefCount: Math.max(0, screenPlans.length - 1),
            remainingBriefsError: error instanceof Error ? error.message : String(error),
          });
          screenPlans = screenPlans.slice(0, 1);
          plan.screens = screenPlans;
          screenBatches = [screenBatches[0]];
          setJournalPhase(generationJournal, "screens", "failed", "The first screen was retained; remaining screen briefs can be retried.");
          await postGenerationJournalSerial();
        }
      }
    }
    await journalWriteQueue;
    await settlementQueue;

    if (!retryOnlyStateVariants) {
      for (const stateGroup of selectedStateGroups) {
        const parentRoadmapStableKey = stateGroup.parent.roadmapStableKey
          ?? screenRoadmapKey(stateGroup.parent.name);
        const parentScreenId = readyParentScreenIds.get(parentRoadmapStableKey);
        if (!parentScreenId || stateGroup.variants.length === 0) continue;
        const variantResult = await buildStateVariantsForParent({
          admin,
          payload,
          parentScreenId,
          parentRoadmapStableKey,
          variants: stateGroup.variants,
        });
        successfulStateVariants += variantResult.successfulVariants;
        failedStateVariants += variantResult.failedVariants;
        successfulScreens += variantResult.successfulVariants;
        failedScreens += variantResult.failedVariants;
        variantResult.successfulRoadmapItemIds.forEach((id) => successfulRoadmapItemIds.add(id));
      }
    }

    const returnedCredits = await releaseGenerationCreditRemainder({
      admin,
      ownerId: payload.ownerId,
      generationRunId: payload.generationRunId,
      reason: "Generation output was not delivered.",
    });
    const creditSummary = await getGenerationCreditSummary({
      admin,
      ownerId: payload.ownerId,
      generationRunId: payload.generationRunId,
    });
    const roadmapRecommendation = successfulScreens === 0 || plan.charter.projectOrigin === "image_to_ui"
      ? null
      : await createRoadmapBuildRecommendation({
          admin,
          projectId: payload.projectId,
          ownerId: payload.ownerId,
          contextRoadmapItemIds: Array.from(successfulRoadmapItemIds),
        }).catch((roadmapError) => {
          logger.error("Failed to prepare contextual screen suggestions", {
            generationRunId: payload.generationRunId,
            error: roadmapError,
          });
          return null;
        });

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
      plannedScreenCount: plannedOutputCount,
      baseScreenCount: screenPlans.length,
      stateVariantCount,
      successfulStateVariants,
      failedStateVariants,
      creditReservation: creditSummary,
      returnedCredits,
      roadmapRecommendation,
      assetLaunchMetrics: {
        ...assetLaunchMetrics,
        sanitizerActions,
        repairedMetadataCount,
        hydratedAssetCount,
        postBuildPlaceholderCount,
        usedResolvedAssetCount,
        ignoredResolvedAssetCount: ignoredResolvedAssetIds.size,
        resolvedToUsedRate: resolvedAssetCount > 0
          ? Math.min(1, usedResolvedAssetCount / resolvedAssetCount)
          : 0,
      },
      postBuildAssetOutcomes,
      perScreenAssetResolution,
      generationPreview: null,
    });

    await mergeGenerationPerformance(admin, payload.generationRunId, {
      completedAt: now(),
      stages: { build: performanceStage(buildStartedAt, buildStartedMs) },
      modelCalls: aiUsage.modelCalls,
      tokenUsage: aiUsage.tokens,
      usageByStage: aiUsage.byStage,
    });

    await settleProjectStatus(admin, payload.projectId, finishedStatus === "completed");

    const plannedScreenCount = plannedOutputCount;
    const partialFailure = successfulScreens > 0 && failedScreens > 0;
    const completionContent = finishedStatus === "completed"
      ? partialFailure
        ? `Created ${successfulScreens} of ${plannedScreenCount} screens`
        : `Created ${successfulScreens} screen${successfulScreens === 1 ? "" : "s"}`
      : `Generation finished with ${failedScreens} failure${failedScreens > 1 ? "s" : ""}`;
    generationJournal.status = finishedStatus;
    generationJournal.title = completionContent;
    generationJournal.detail = finishedStatus === "completed"
      ? partialFailure
        ? `Delivered ${successfulScreens} screen${successfulScreens === 1 ? "" : "s"} to the canvas. ${failedScreens} screen${failedScreens === 1 ? "" : "s"} failed.`
        : `Delivered ${successfulScreens} screen${successfulScreens === 1 ? "" : "s"} to the canvas.`
      : errorSummary;
    setJournalPhase(
      generationJournal,
      "build",
      finishedStatus === "completed" ? "completed" : "failed",
      generationJournal.detail,
    );
    generationJournal.activePhase = null;
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

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
            ? partialFailure
              ? `Delivered ${successfulScreens} of ${plannedScreenCount} screens. ${failedScreens} failed.`
              : `Delivered ${successfulScreens} screen${successfulScreens === 1 ? "" : "s"}.`
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
      ? partialFailure
        ? `Done - I created ${successfulScreens} of ${plannedScreenCount} screens and added ${successfulScreens === 1 ? "it" : "them"} to the canvas. ${failedScreens} screen${failedScreens === 1 ? "" : "s"} failed during generation.`
        : `Done - I created ${successfulScreens} screen${successfulScreens === 1 ? "" : "s"} and added ${successfulScreens === 1 ? "it" : "them"} to the canvas.`
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

    if (finishedStatus === "completed" && roadmapRecommendation) {
      const { data: existingRecommendation } = await admin
        .from("project_messages")
        .select("id")
        .eq("project_id", payload.projectId)
        .eq("owner_id", payload.ownerId)
        .contains("metadata", { recommendationForGenerationRunId: payload.generationRunId })
        .limit(1)
        .maybeSingle();
      if (!existingRecommendation) {
        await admin.from("project_messages").insert({
          project_id: payload.projectId,
          owner_id: payload.ownerId,
          screen_id: null,
          role: "system",
          content: roadmapRecommendation.title,
          message_type: "chat",
          metadata: {
            ui: { variant: "screen_suggestions" },
            action: "roadmap_recommendation",
            generationRunId: payload.generationRunId,
            recommendationForGenerationRunId: payload.generationRunId,
            roadmapRecommendation,
          } as never,
        });
      }
    }

    logger.info("UI flow generation completed", {
      generationRunId: payload.generationRunId,
      successfulScreens,
      failedScreens,
      plannedScreenCount: plannedOutputCount,
      baseScreenCount: screenPlans.length,
      stateVariantCount,
      successfulStateVariants,
      failedStateVariants,
      returnedCredits,
    });

    return {
      generationRunId: payload.generationRunId,
      successfulScreens,
      failedScreens,
      stateVariantCount,
      successfulStateVariants,
      failedStateVariants,
      returnedCredits,
    };
  },
});
