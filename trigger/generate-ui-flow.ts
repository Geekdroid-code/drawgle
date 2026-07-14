import { randomUUID } from "crypto";

import { logger, runs, streams, task } from "@trigger.dev/sdk";

import { ensureDrawgleIds } from "@/lib/drawgle-dom";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import { cleanErrorMessage } from "@/lib/ai/error-handler";
import { loadCuratedStyleReferenceImage, matchCuratedStyleReference } from "@/lib/generation/curated-style-references";
import { getDesignStylePack, isDesignStyleId, summarizeDesignStyle } from "@/lib/generation/design-styles";
import { indexScreenCode } from "@/lib/generation/block-index";
import { assembleProjectContext } from "@/lib/generation/context";
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
  isBlockingScreenHealthFailure,
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
import { buildNavigationShellCode, buildScreenStream, extractCode, fallbackProjectCharter, generateDesignTokens, planUiFlow } from "@/lib/generation/service";
import { screenBuildOutputTokenBudget } from "@/lib/generation/screen-budget";
import { analyzeReferenceImageForScope, preflightGenerationScope } from "@/lib/generation/scope-contract";
import { planVisualAssets, resolveProjectAssets } from "@/lib/generation/visual-assets";
import { shouldAttachReferenceImage } from "@/lib/generation/reference-image";
import { loadStoredPromptImage } from "@/lib/generation/prompt-reference-storage";
import { resolveGenerationReferencePolicy } from "@/lib/generation/reference-policy";
import { createNavigationArchitecture, deriveRequiresBottomNav } from "@/lib/navigation";
import {
  applyNavigationPlanToScreens,
  detectLocalNavigationMarkup,
  indexNavigationShell,
  normalizeNavigationPlan,
  sanitizeScreenCodeForSharedNavigation,
} from "@/lib/project-navigation";
import { tokenizeStaticDrawgleHtml } from "@/lib/token-runtime";
import { detectTokenDrift } from "@/lib/token-drift";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePublishedStylePreset } from "@/lib/published-style-presets";
import { adminCreditService } from "@/lib/credits";
import { getGenerationEngineVersion } from "@/lib/env/server";
import { enrichScreenMemoryTask } from "@/trigger/enrich-screen-memory";
import type { Database } from "@/lib/supabase/database.types";
import type { DesignStylePack, DesignTokens, GenerationJournalMetadata, GenerationReferencePolicy, GenerationRetryContext, GenerationScopeContract, ImageReferenceMode, LlmProviderEvent, NavigationArchitecture, NavigationPlan, PlanningMode, ProjectAssetManifest, PromptImagePayload, ProjectCharter, ReferenceAnalysis, ReferenceMode, ReferenceSource, ScreenAssetManifest, ScreenBaseStatePlan, ScreenPlan, ScreenStateVariantPlan } from "@/lib/types";

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
  referenceScreenIndex?: number | null;
  referenceScreenCount?: number | null;
  designStyleId?: string | null;
  designStyle?: DesignStylePack | null;
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
  sanitizedCodes: string[];
  tokenDriftWarnings: string[];
  localNavigationReasons: string[];
  localNavigationCandidates: string[];
  assetSanitizedMisuseCount: number;
  assetSanitizationWarnings: string[];
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
  const policy = geminiPolicyForTask("screen_build");

  return {
    attempt,
    task: "screen_build",
    retryReason,
    streamed,
    model: policy.model,
    maxOutputTokens: build.maxOutputTokens ?? (typeof policy.config.maxOutputTokens === "number" ? policy.config.maxOutputTokens : null),
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
    assetSanitizationWarnings: [],
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
  const message = error ?? "";

  if (/missing_completion_sentinel|max_tokens|needs_regeneration|incomplete|trailing_open_tag|unclosed_comment|unclosed_root/i.test(message)) {
    return `${screenName} could not be built because the generated HTML was incomplete.`;
  }

  if (/invalid_image_url|asset_policy|critical visual assets|required critical visual assets/i.test(message)) {
    return `${screenName} was generated but did not satisfy the required visual asset policy.`;
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
};

async function buildStateVariantsForParent({
  admin,
  payload,
  parentScreenId,
  variants,
}: {
  admin: AdminClient;
  payload: GenerateUiFlowPayload;
  parentScreenId: string;
  variants: ScreenStateVariantPlan[];
}): Promise<StateVariantBuildResult> {
  if (variants.length === 0) {
    return { successfulVariants: 0, failedVariants: 0 };
  }

  let successfulVariants = 0;
  let failedVariants = 0;

  try {
    const { data: parentScreen, error: parentError } = await admin
      .from("screens")
      .select("id, name, prompt, code, block_index, chrome_policy, navigation_item_id")
      .eq("id", parentScreenId)
      .maybeSingle();

    if (parentError || !parentScreen?.code) {
      throw parentError ?? new Error("Parent screen source was not available for state variants.");
    }

    const reservedSlots = await reserveScreenSlots(admin, payload.projectId, variants.length);

    for (let index = 0; index < variants.length; index++) {
      const variant = variants[index];
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
          .select("code")
          .eq("id", variantScreenId)
          .maybeSingle();

        const materialChange = Boolean(result.changed && editedVariant?.code && editedVariant.code !== parentScreen.code);

        if (!materialChange) {
          const message = "State variant edit produced no material code change from the parent.";
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
          continue;
        }

        successfulVariants += 1;
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

  return { successfulVariants, failedVariants };
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
      { id: "brief", label: "Brief received", status: "active" },
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

function setJournalPhase(
  journal: GenerationJournalMetadata,
  phaseId: string,
  status: GenerationJournalMetadata["phases"][number]["status"],
  detail?: string | null,
) {
  journal.phases = journal.phases.map((phase) =>
    phase.id === phaseId ? { ...phase, status, detail: detail ?? phase.detail ?? null } : phase,
  );
  journal.activePhase = status === "completed" || status === "failed" ? journal.activePhase : phaseId;
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

async function collectScreenBuild(input: BuildScreenTaskPayload, screenPlan: ScreenPlan) {
  let rawText = "";
  const finishReasons = new Set<string>();
  const usageMetadata: GeminiUsageMetadata = {};

  const { stream: codeStream } = await streams.pipe(
    "code",
    buildScreenStream({
      screenPlan,
      designTokens: input.designTokens,
      designStyle: input.designStyle,
      prompt: input.prompt,
      image: input.image,
      referenceMode: input.referenceMode,
      referenceSource: input.referenceSource,
      referenceId: input.referenceId,
      referenceScreenIndex: input.referenceScreenIndex ?? screenPlan.referenceScreenIndex ?? null,
      referenceScreenCount: input.referenceScreenCount ?? screenPlan.referenceScreenCount ?? null,
      requiresBottomNav: input.requiresBottomNav,
      navigationArchitecture: input.navigationArchitecture,
      navigationPlan: input.navigationPlan,
      assetManifest: input.assetManifest,
      projectContext: input.projectContext,
      onProviderEvent: logProviderEvent,
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

  for await (const chunk of codeStream) {
    rawText += chunk;
  }

  return {
    rawText,
    extractedCode: extractCode(rawText),
    finishReasons: Array.from(finishReasons),
    usageMetadata,
    maxOutputTokens: screenBuildOutputTokenBudget(screenPlan),
  };
}

async function collectNonStreamingScreenBuild(input: BuildScreenTaskPayload, screenPlan: ScreenPlan) {
  let rawText = "";
  const finishReasons = new Set<string>();
  const usageMetadata: GeminiUsageMetadata = {};

  for await (const chunk of buildScreenStream({
    screenPlan,
    designTokens: input.designTokens,
    designStyle: input.designStyle,
    prompt: input.prompt,
    image: input.image,
    referenceMode: input.referenceMode,
    referenceSource: input.referenceSource,
    referenceId: input.referenceId,
    referenceScreenIndex: input.referenceScreenIndex ?? screenPlan.referenceScreenIndex ?? null,
    referenceScreenCount: input.referenceScreenCount ?? screenPlan.referenceScreenCount ?? null,
    requiresBottomNav: input.requiresBottomNav,
    navigationArchitecture: input.navigationArchitecture,
    navigationPlan: input.navigationPlan,
    assetManifest: input.assetManifest,
    projectContext: input.projectContext,
    onProviderEvent: logProviderEvent,
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
      const failureCode = buildErrorCode("This preview could not be finalized. Use Retry to rebuild the screen.");
      await admin
        .from("screens")
        .update({
          code: failureCode,
          block_index: indexScreenCode(failureCode) as never,
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
      await admin
        .from("screens")
        .update({
          code,
          block_index: blockIndex as never,
          chrome_policy: (payload.screenPlan.chromePolicy ?? null) as never,
          navigation_item_id: payload.screenPlan.navigationItemId ?? null,
          status: "failed",
          error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.screenId);

      logger.warn("Screen generation output was saved with blocking diagnostics", {
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
      });
      const tokenizedCode = tokenizeStaticDrawgleHtml(sanitizedCode, payload.designTokens).code;
      const code = ensureDrawgleIds(tokenizedCode).code;
      const tokenDrift = detectTokenDrift(code, { scope: "screen" });
      return { code, tokenDrift };
    };

    let finalized = finalizeGeneratedCode(extractedCode);
    attempts[attempts.length - 1] = {
      ...attempts[attempts.length - 1],
      tokenDriftWarnings: finalized.tokenDrift.warnings,
    };

    if (finalized.tokenDrift.hasSevereDrift) {
      logger.warn("Screen build has token drift diagnostics; saving without paid token retry", {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        warnings: finalized.tokenDrift.warnings.slice(0, 8),
      });
    }
    if (finalized.tokenDrift.warnings.length > 0) {
      logger.warn("Screen build saved with token drift diagnostics", {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        warnings: finalized.tokenDrift.warnings.slice(0, 12),
      });
    }

    if (quality.warnings.length > 0 || quality.missingAnchors.length > 0) {
      logger.warn("Screen build saved with soft quality diagnostics", {
        screenId: payload.screenId,
        screenName: payload.screenPlan.name,
        warnings: quality.warnings,
        missingAnchors: quality.missingAnchors,
      });
    }

    const assetSanitization = sanitizeScreenAssetUsage({
      code: finalized.code,
      assetManifest: payload.assetManifest,
    });
    const latestAttempt = attempts.at(-1);
    if (latestAttempt) {
      latestAttempt.assetSanitizedMisuseCount = assetSanitization.sanitizedMisuseCount;
      latestAttempt.assetSanitizationWarnings = assetSanitization.warnings;
    }
    const code = assetSanitization.code;
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
    const assetPolicy = validateScreenAssetPolicy({ code, assetManifest: payload.assetManifest });
    const blockIndex = indexScreenCode(code);
    const screenStatus = screenStatusForHealth(health);

    logger.info("Screen generation diagnostics", {
      screenId: payload.screenId,
      screenName: payload.screenPlan.name,
      attempts,
      health,
      assetPolicy,
      assetSanitization: {
        changed: assetSanitization.changed,
        sanitizedMisuseCount: assetSanitization.sanitizedMisuseCount,
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
      const policyReason = `Generated screen did not use required critical visual assets: ${assetPolicy.missingRequiredUrls.slice(0, 4).join(", ")}`;
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
    const { error: updateError } = await admin
      .from("screens")
      .update({
        code,
        summary: generationEngineVersion === "v2"
          ? buildScreenSummaryLocally(payload.screenPlan.name, code, payload.screenPlan.description, blockIndex)
          : undefined,
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
    setJournalPhase(generationJournal, "brief", "completed", "Received the project brief and queued planning.");
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

    const [storedPromptImage, planningContext] = await Promise.all([
      loadStoredPromptImage(admin, payload.imagePath).catch((error) => {
        if (payload.referencePolicy !== "project_reference") throw error;
        logger.warn("[PROJECT REFERENCE] Stored project upload could not be loaded; continuing with project memory.", {
          projectId: payload.projectId,
          imagePath: payload.imagePath,
          error,
        });
        return null;
      }),
      assembleProjectContext({
        admin,
        projectId: payload.projectId,
        userPrompt: payload.prompt,
      }),
    ]);
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
      isExistingProject: payload.planningMode === "single-screen" || planningContext.includes("RELEVANT EXISTING SCREENS"),
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
    } else {
      const match = matchCuratedStyleReference({
        prompt: payload.prompt,
        planningMode: payload.planningMode ?? "project",
        existingCharter,
      });

      if (!match) {
        referenceMode = "internal_style";
        referenceSource = "curated";
      } else {
        logger.info("[CURATED STYLE REFERENCE] selected", {
          referenceId: match.reference.id,
          score: match.score,
          matchedTags: match.matchedTags,
        });
        const curatedImage = await loadCuratedStyleReferenceImage(match.reference);
        promptImage = curatedImage;
        referenceMode = curatedImage ? "curated_style" : "internal_style";
        referenceSource = "curated";
        referenceId = match.reference.id;
      }
    }
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
              : `Matched internal style reference${referenceId ? `: ${referenceId}` : ""}.`,
    );
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

    const scopePreflight = payload.scopeContract
      ? payload.referenceAnalysis
        ? {
            scopeContract: payload.scopeContract,
            referenceAnalysis: payload.referenceAnalysis,
            referenceAnalysisResult: null,
          }
        : payload.projectCharter || existingCharter
          ? {
              scopeContract: payload.scopeContract,
              referenceAnalysis: null as ReferenceAnalysis | null,
              referenceAnalysisResult: null,
            }
        : await analyzeReferenceImageForScope({
            prompt: payload.prompt,
            image: promptImage,
            referenceMode,
            llmLog: (label, data) => logger.info(label, data),
          }).then((referenceAnalysisResult) => ({
            scopeContract: payload.scopeContract!,
            referenceAnalysis: referenceAnalysisResult.analysis,
            referenceAnalysisResult,
          }))
      : await preflightGenerationScope({
          prompt: payload.prompt,
          image: promptImage,
          referenceMode,
          planningMode: payload.planningMode ?? "project",
          llmLog: (label, data) => logger.info(label, data),
        });
    const scopeContract = scopePreflight.scopeContract;
    const referenceAnalysis = scopePreflight.referenceAnalysis;

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
      referenceSource,
      referenceId,
      designStyle: summarizeDesignStyle(designStyle),
      scopeContract,
      referenceAnalysisDiagnostics: scopePreflight.referenceAnalysisResult
        ? {
            source: scopePreflight.referenceAnalysisResult.source,
            confidence: scopePreflight.referenceAnalysisResult.confidence,
            screenCountEstimate: scopePreflight.referenceAnalysisResult.screenCountEstimate,
            screenReferenceCount: scopePreflight.referenceAnalysisResult.screenReferenceCount,
            diagnostics: scopePreflight.referenceAnalysisResult.diagnostics,
            validationIssues: scopePreflight.referenceAnalysisResult.validationIssues ?? [],
          }
        : null,
    });

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
      setJournalPhase(generationJournal, "design", "completed", "Design tokens are ready for the build.");
      await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);
    } else {
      setJournalPhase(generationJournal, "design", "completed", "Using the approved project design tokens.");
      await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);
    }
    const requestedCharter = payload.projectCharter ?? existingCharter ?? (
      payload.plannedScreens && payload.plannedScreens.length > 0
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

    setJournalPhase(generationJournal, "blueprint", "active", "Choosing navigation scope and project structure.");
    setJournalPhase(generationJournal, "screens", "active", "Drafting builder-ready screen briefs.");
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

    const plan = payload.plannedScreens && payload.plannedScreens.length > 0
      ? {
          requiresBottomNav: Boolean(payload.navigationPlan?.enabled),
          navigationArchitecture: requestedNavigationArchitecture,
          navigationPlan: normalizeNavigationPlan({
            navigationPlan: payload.navigationPlan,
            screens: payload.plannedScreens,
            navigationArchitecture: requestedNavigationArchitecture,
            requiresBottomNav: deriveRequiresBottomNav(requestedNavigationArchitecture),
            strictScreenLinks: (payload.planningMode ?? "project") !== "single-screen",
          }),
          charter: requestedCharter!,
          screens: payload.plannedScreens,
          scopeContract,
          screenCountContract: null,
          screenCountEnforcement: "none" as const,
          intentContract: null,
          screenFamilyContract: null,
        }
      : await planUiFlow({
          prompt: payload.prompt,
          image: promptImage,
          referenceMode,
          referenceId,
          designStyle,
          designTokens,
          scopeContract,
          referenceAnalysis,
          projectContext: planningContext,
          existingCharter: requestedCharter,
          existingNavigationPlan: payload.navigationPlan ?? null,
          planningMode: payload.planningMode ?? "project",
          llmLog: (label, data) => logger.info(label, data),
        });
    plan.screens = applyNavigationPlanToScreens(plan.screens, plan.navigationPlan);
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
    setJournalPhase(generationJournal, "screens", "completed", `Planned ${plan.screens.length} screen${plan.screens.length === 1 ? "" : "s"}.`);
    generationJournal.screens = plan.screens.map((screenPlan) => ({
      name: screenPlan.name,
      type: screenPlan.type,
      description: screenPlan.description,
      chrome: screenPlan.chromePolicy?.chrome ?? null,
      navigationItemId: screenPlan.navigationItemId ?? null,
      assetNeedCount: screenPlan.assetNeeds?.length ?? 0,
      status: "planned",
    }));
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

    const rawNavigationShellCode = await buildNavigationShellCode({
      navigationPlan: plan.navigationPlan,
      designTokens,
      prompt: payload.prompt,
      image: referenceMode === "user_recreate" ? promptImage : null,
      referenceMode,
      referenceId,
      designStyle,
      projectCharter: plan.charter,
      llmLog: (label, data) => logger.info(label, data),
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
        navigationItemId: screenPlan.navigationItemId ?? null,
        assetNeeds: screenPlan.assetNeeds ?? [],
      })),
      screenCountContract: plan.screenCountContract ?? null,
      screenCountEnforcement: plan.screenCountEnforcement ?? "none",
      intentContract: plan.intentContract ?? null,
      screenFamilyContract: plan.screenFamilyContract ?? null,
      plannedScreenCount: plan.screens.length,
      navigationEnabled: plan.navigationPlan.enabled,
    });

    setJournalPhase(generationJournal, "assets", "active", "Resolving curated assets, stock photos, or simple placeholders.");
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

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

    const assetRequirements = await planVisualAssets({
      prompt: payload.prompt,
      screens: plan.screens,
      charter: plan.charter,
      designTokens,
      referenceMode,
      intentContract: plan.intentContract ?? null,
      llmLog: (label, data) => logger.info(label, data),
    });
    const projectAssetManifest = await resolveProjectAssets({
      admin,
      ownerId: payload.ownerId,
      projectId: payload.projectId,
      generationRunId: payload.generationRunId,
      requirements: assetRequirements,
    });
    const assetDiagnostics = projectAssetManifest.diagnostics ?? [];
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
    const assetStatusTitle = assetRequirements.length === 0
      ? "No bitmap assets requested by planner"
      : resolvedAssetCount === 0 && placeholderAssetCount > 0
        ? "Bitmap assets requested, no match found, placeholders used"
        : placeholderAssetCount > 0
          ? `Resolved ${resolvedAssetCount} visual asset${resolvedAssetCount === 1 ? "" : "s"}, using ${placeholderAssetCount} placeholder${placeholderAssetCount === 1 ? "" : "s"}`
          : `Resolved ${resolvedAssetCount} visual asset${resolvedAssetCount === 1 ? "" : "s"}`;

    await postStatusMessage(
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
    generationJournal.assetSummary = {
      requested: assetRequirements.length,
      resolved: resolvedAssetCount,
      placeholders: placeholderAssetCount,
    };
    await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

    const shouldSendBuildContext = Boolean(payload.plannedScreens?.length) || (payload.planningMode ?? "project") === "single-screen";
    const buildContext = shouldSendBuildContext ? compactBuildContext(planningContext) : null;

    const baseScreenPlans: ScreenPlan[] = plan.screens.length > 0 ? plan.screens : [{
      name: "New Screen",
      type: "root",
      description: payload.prompt,
    }];
    const retryOnlyStateVariants = payload.retryContext?.mode === "state_variants"
      && Boolean(payload.retryContext.parentScreenId);
    const referenceTargetCount = plan.scopeContract?.finalScreenCount ?? plan.scopeContract?.imageScreenCount ?? baseScreenPlans.length;
    const resolvedScreenPlans: ScreenPlan[] = referenceMode === "user_recreate"
      ? baseScreenPlans.map((screenPlan, index) => ({
          ...screenPlan,
          referenceScreenIndex: screenPlan.referenceScreenIndex ?? index + 1,
          referenceScreenCount: screenPlan.referenceScreenCount ?? referenceTargetCount,
        }))
      : baseScreenPlans;
    const screenPlans = retryOnlyStateVariants ? [] : resolvedScreenPlans;

    const requestedStateVariants = (payload.stateVariants ?? []).slice(0, 3);
    const shouldBuildStateVariants = (screenPlans.length === 1 || retryOnlyStateVariants) && requestedStateVariants.length > 0;
    const stateVariantsToBuild = shouldBuildStateVariants ? requestedStateVariants : [];
    const plannedOutputCount = screenPlans.length + stateVariantsToBuild.length;

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
        stateVariantCount: stateVariantsToBuild.length,
        activityKey: planningActivityKey(payload.generationRunId),
      },
    );
    // Each screen build costs 20 credits (planning is completely free!)
    const requiredCredits = plannedOutputCount * 20;
    const creditCheck = await adminCreditService.hasCredits(payload.ownerId, requiredCredits);

    if (!creditCheck.hasCredits) {
      const errorMessage = `Insufficient credits to build planned screens. (Required: ${requiredCredits}, Balance: ${creditCheck.currentBalance}). Please upgrade your plan.`;
      
      await updateGenerationRun(admin, payload.generationRunId, {
        status: "failed",
        error: errorMessage,
        completed_at: now(),
      });
      
      await updateProject(admin, payload.projectId, {
        status: "failed",
      });

      await postStatusMessage(
        admin,
        payload.projectId,
        payload.ownerId,
        errorMessage,
        "error",
        {
          generationRunId: payload.generationRunId,
          activityKey: `run:${payload.generationRunId}:credits_error`,
        }
      );
      
      throw new Error(errorMessage);
    }

    const reservedSlots = screenPlans.length > 0
      ? await reserveScreenSlots(admin, payload.projectId, screenPlans.length)
      : [];

    await updateGenerationRun(admin, payload.generationRunId, {
      status: "building",
      requires_bottom_nav: plan.requiresBottomNav,
      requested_screen_count: plannedOutputCount,
    });
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

    if (retryOnlyStateVariants && payload.retryContext?.parentScreenId) {
      const variantResult = await buildStateVariantsForParent({
        admin,
        payload,
        parentScreenId: payload.retryContext.parentScreenId,
        variants: stateVariantsToBuild,
      });
      successfulStateVariants += variantResult.successfulVariants;
      failedStateVariants += variantResult.failedVariants;
      successfulScreens += variantResult.successfulVariants;
      failedScreens += variantResult.failedVariants;
    }

    for (let index = 0; index < screenPlans.length; index++) {
      const screenPlan = screenPlans[index];
      const reusableScreenId = payload.retryContext?.reuseScreenIdsByName?.[
        screenPlan.name.trim().toLowerCase().replace(/\s+/g, " ")
      ] ?? null;
      const screenId = reusableScreenId ?? randomUUID();
      let rowInserted = false;

      try {
        const attachReferenceImage = shouldAttachReferenceImage({
          engineVersion: generationEngineVersion,
          image: promptImage,
          referenceMode,
        });
        generationJournal.screens = generationJournal.screens?.map((screen) =>
          screen.name === screenPlan.name ? { ...screen, status: "building" } : screen,
        );
        await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

        if (reusableScreenId) {
          const { error: resetError } = await admin
            .from("screens")
            .update({
              generation_run_id: payload.generationRunId,
              parent_screen_id: null,
              state_key: shouldBuildStateVariants && index === 0 ? payload.baseState?.stateKey ?? "base" : null,
              state_label: shouldBuildStateVariants && index === 0 ? payload.baseState?.stateLabel ?? "Base" : null,
              state_role: shouldBuildStateVariants && index === 0 ? "base" : null,
              name: screenPlan.name,
              prompt: screenPlan.description,
              code: buildPlaceholderCode(screenPlan.name, designTokens),
              chrome_policy: (screenPlan.chromePolicy ?? null) as never,
              navigation_item_id: screenPlan.navigationItemId ?? null,
              status: "building",
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

        const handle = await (buildScreenTask as any).trigger(
          {
            generationRunId: payload.generationRunId,
            screenId,
            projectId: payload.projectId,
            screenPlan,
            prompt: payload.prompt,
            designTokens,
            image: attachReferenceImage ? promptImage : null,
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
            assetManifest: projectAssetManifest.assetsByScreen[screenPlan.name] ?? [],
            projectCharter: plan.charter,
            projectContext: buildContext,
          },
          {
            concurrencyKey: `project-${payload.projectId}`,
          },
        );

        const screenRow = {
            id: screenId,
            owner_id: payload.ownerId,
            project_id: payload.projectId,
            generation_run_id: payload.generationRunId,
            parent_screen_id: null,
            state_key: shouldBuildStateVariants && index === 0 ? payload.baseState?.stateKey ?? "base" : null,
            state_label: shouldBuildStateVariants && index === 0 ? payload.baseState?.stateLabel ?? "Base" : null,
            state_role: shouldBuildStateVariants && index === 0 ? "base" : null,
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
          };
        const { error: insertError } = reusableScreenId
          ? await admin
              .from("screens")
              .update({
                trigger_run_id: handle.id,
                stream_public_token: handle.publicAccessToken ?? null,
                updated_at: now(),
              })
              .eq("id", reusableScreenId)
              .eq("project_id", payload.projectId)
              .eq("owner_id", payload.ownerId)
          : await admin.from("screens").insert(screenRow);

        if (insertError) {
          throw new Error(`Failed to insert placeholder for "${screenPlan.name}": ${insertError.message}`);
        }

        rowInserted = true;

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
        const buildOutput = result?.output as { sanitizedMisuseCount?: number } | undefined;
        sanitizerActions += buildOutput?.sanitizedMisuseCount ?? 0;

        if (result?.status === "COMPLETED") {
          const { data: completedScreen } = await admin
            .from("screens")
            .select("status, error")
            .eq("id", screenId)
            .maybeSingle();

          if (completedScreen?.status === "failed") {
            failedScreens += 1;
            generationJournal.screens = generationJournal.screens?.map((screen) =>
              screen.name === screenPlan.name ? { ...screen, status: "failed" } : screen,
            );
            await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

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
            generationJournal.screens = generationJournal.screens?.map((screen) =>
              screen.name === screenPlan.name ? { ...screen, status: "ready" } : screen,
            );
            await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

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
            if (shouldBuildStateVariants && index === 0) {
              const variantResult = await buildStateVariantsForParent({
                admin,
                payload,
                parentScreenId: screenId,
                variants: stateVariantsToBuild,
              });
              successfulStateVariants += variantResult.successfulVariants;
              failedStateVariants += variantResult.failedVariants;
              successfulScreens += variantResult.successfulVariants;
              failedScreens += variantResult.failedVariants;
            }
          }
        } else {
          failedScreens += 1;
          const message = result?.error?.message ?? "Unknown error";
          generationJournal.screens = generationJournal.screens?.map((screen) =>
            screen.name === screenPlan.name ? { ...screen, status: "failed" } : screen,
          );
          await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);
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
        const rawMessage = screenError instanceof Error ? screenError.message : String(screenError);
        const message = cleanErrorMessage(rawMessage);
        logger.error("Failed to build screen", { screenName: screenPlan.name, error: screenError });
        generationJournal.screens = generationJournal.screens?.map((screen) =>
          screen.name === screenPlan.name ? { ...screen, status: "failed" } : screen,
        );
        await postGenerationJournal(admin, payload.projectId, payload.ownerId, generationJournal);

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

    // Deduct credits for successful screens finally saved in Supabase
    if (successfulScreens > 0) {
      const actualCost = successfulScreens * 20;
      const deductionResult = await adminCreditService.deductCredits(
        payload.ownerId,
        actualCost,
        `Generated ${successfulScreens} successful screen${successfulScreens === 1 ? "" : "s"} for project`
      );
      if (!deductionResult.success) {
        logger.error("Failed to deduct credits for successful screens", {
          ownerId: payload.ownerId,
          actualCost,
          error: deductionResult.error,
        });
      } else {
        logger.info("Successfully deducted credits for successful screens", {
          ownerId: payload.ownerId,
          actualCost,
          newBalance: deductionResult.newBalance,
        });
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
      plannedScreenCount: plannedOutputCount,
      baseScreenCount: screenPlans.length,
      stateVariantCount: stateVariantsToBuild.length,
      successfulStateVariants,
      failedStateVariants,
      assetLaunchMetrics: {
        ...assetLaunchMetrics,
        sanitizerActions,
      },
    });

    await updateProject(admin, payload.projectId, {
      status: finishedStatus === "completed" ? "completed" : "failed",
    });

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

    logger.info("UI flow generation completed", {
      generationRunId: payload.generationRunId,
      successfulScreens,
      failedScreens,
      plannedScreenCount: plannedOutputCount,
      baseScreenCount: screenPlans.length,
      stateVariantCount: stateVariantsToBuild.length,
      successfulStateVariants,
      failedStateVariants,
    });

    return {
      generationRunId: payload.generationRunId,
      successfulScreens,
      failedScreens,
      stateVariantCount: stateVariantsToBuild.length,
      successfulStateVariants,
      failedStateVariants,
    };
  },
});
