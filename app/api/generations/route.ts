import { Buffer } from "node:buffer";

import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeDesignTokens } from "@/lib/design-tokens";
import { getDesignStylePack, isDesignStyleId, summarizeDesignStyle } from "@/lib/generation/design-styles";
import { VISUAL_ASSET_SEMANTIC_CATEGORIES } from "@/lib/generation/asset-semantics";
import { parsePromptScreenIntent, preflightGenerationScope } from "@/lib/generation/scope-contract";
import { normalizeReferenceImage } from "@/lib/generation/reference-image";
import { findLatestProjectPromptImagePath } from "@/lib/generation/prompt-reference-storage";
import { isGenerationReferencePolicy, resolveGenerationReferencePolicy } from "@/lib/generation/reference-policy";
import { determineGenerationRetryScope } from "@/lib/generation/retry-scope";
import { resolveRoadmapBuildSelection } from "@/lib/generation/project-roadmap";
import { releaseGenerationCreditRemainder } from "@/lib/generation/credit-reservations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolvePublishedStylePreset } from "@/lib/published-style-presets";
import { getGenerationEngineVersion } from "@/lib/env/server";
import type { Database, ProjectScreenRoadmapRow } from "@/lib/supabase/database.types";
import {
  ACTIVE_GENERATION_STATUSES,
  type DesignTokens,
  type GenerationStatus,
  type GenerationReferencePolicy,
  type GenerationRetryContext,
  type GenerationScopeContract,
  type ImageReferenceMode,
  type NavigationArchitecture,
  type NavigationPlan,
  type ProjectCharter,
  type ProjectRoadmap,
  type ReferenceAnalysis,
  type ScreenPlan,
  type ScreenPlanningSeed,
} from "@/lib/types";
import type { generateUiFlowTask } from "@/trigger/generate-ui-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  clientRequestId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  projectName: z.string().trim().min(1).max(100).optional(),
  prompt: z.string().trim().max(10000),
  sourceGenerationRunId: z.string().uuid().optional(),
  image: z
    .object({
      data: z.string().min(1),
      mimeType: z.string().min(1),
    })
    .nullable()
    .optional(),
  imageReferenceMode: z.enum(["recreate", "style"]).optional().default("recreate"),
  designStyleId: z.string().nullable().optional(),
  stylePresetSlug: z.string().trim().min(1).max(120).nullable().optional(),
  plannedScreens: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        type: z.enum(["root", "detail"]),
        description: z.string().trim().min(1).max(8000),
        roadmapStableKey: z.string().trim().min(1).max(100).nullable().optional(),
        roadmapItemId: z.string().uuid().nullable().optional(),
        roadmapPriority: z.enum(["core", "required", "recommended", "optional"]).optional(),
        explicitlyRequested: z.boolean().optional(),
        stateVariants: z.array(z.object({
          id: z.string().trim().min(1).max(120),
          stateKey: z.string().trim().min(1).max(120),
          stateLabel: z.string().trim().min(1).max(160),
          stateRole: z.string().trim().min(1).max(500),
          triggerLabel: z.string().trim().min(1).max(240),
          description: z.string().trim().min(1).max(2400),
          editInstruction: z.string().trim().min(1).max(4000),
          defaultSelected: z.boolean(),
          explicitlyRequested: z.boolean().optional(),
          roadmapStableKey: z.string().trim().min(1).max(160).nullable().optional(),
          roadmapItemId: z.string().uuid().nullable().optional(),
        })).max(3).optional(),
        assetNeeds: z.array(z.object({
          id: z.string().trim().min(1).max(80),
          screenName: z.string().trim().min(1).max(100),
          role: z.enum([
            "hero_cutout",
            "product_cutout",
            "avatar",
            "section_photo",
            "background_photo",
            "product_photo",
            "decorative_object",
            "map_texture",
          ]),
          subject: z.string().trim().min(3).max(260),
          assetType: z.enum(["transparent_png", "photo", "illustration", "icon_like"]),
          sourcePreference: z.enum(["user_upload", "internal_library", "stock"]),
          desiredAspectRatio: z.enum(["1:1", "4:5", "5:4", "16:9", "free"]),
          transparentBackground: z.boolean(),
          placementHint: z.string().trim().min(1).max(500),
          priority: z.enum(["critical", "supporting", "optional"]),
          reuseKey: z.string().trim().min(1).max(160),
          semanticCategory: z.enum(VISUAL_ASSET_SEMANTIC_CATEGORIES).default("other"),
          semanticTags: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
          slotCount: z.number().int().min(1).max(12).default(1),
          reusePolicy: z.enum(["repeat", "distinct"]).default("repeat"),
          userAssetId: z.string().uuid().optional(),
        })).max(4).optional(),
        chromePolicy: z.object({
          chrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
          showPrimaryNavigation: z.boolean(),
          showsBackButton: z.boolean(),
        }).nullable().optional(),
        navigationItemId: z.string().trim().min(1).max(80).nullable().optional(),
        referenceScreenIndex: z.number().int().min(1).max(12).nullable().optional(),
        referenceScreenCount: z.number().int().min(1).max(12).nullable().optional(),
        layoutContract: z.object({
          viewportPlan: z.string().trim().min(1).max(2400),
          focalHierarchy: z.string().trim().min(1).max(2400),
          sectionRhythm: z.string().trim().min(1).max(2400),
          componentDensity: z.string().trim().min(1).max(2400),
          ctaPolicy: z.string().trim().min(1).max(2400),
          antiPatterns: z.array(z.string().trim().min(1).max(600)).max(12),
        }).nullable().optional(),
      }),
    )
    .min(1)
    .max(5)
    .nullable()
    .optional(),
screenPlanningSeeds: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(["root", "detail"]),
    summary: z.string().trim().min(1).max(400),
    prompt: z.string().max(10000),
    roadmapStableKey: z.string().trim().min(1).max(100).nullable().optional(),
  })).min(1).max(5).nullable().optional(),
  requiresBottomNav: z.boolean().optional(),
  navigationArchitecture: z.object({
    kind: z.enum(["bottom-tabs-app", "hierarchical", "single-screen"]),
    primaryNavigation: z.enum(["bottom-tabs", "none"]),
    rootChrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
    detailChrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
    consistencyRules: z.array(z.string().trim().min(1).max(500)).min(1).max(10),
    rationale: z.string().trim().min(1).max(2400),
  }).nullable().optional(),
  navigationPlan: z.object({
    enabled: z.boolean(),
    kind: z.enum(["bottom-tabs", "none"]),
    items: z.array(z.object({
      id: z.string().trim().min(1).max(80),
      label: z.string().trim().min(1).max(40),
      icon: z.string().trim().min(1).max(80),
      role: z.string().trim().min(1).max(240),
      linkedScreenName: z.string().trim().min(1).max(100).nullable(),
      availability: z.enum(["generated", "planned"]).optional(),
    }).passthrough()).max(5),
    visualBrief: z.string().trim().min(1).max(1600),
    screenChrome: z.array(z.object({
      screenName: z.string().trim().min(1).max(100),
      chrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
      navigationItemId: z.string().trim().min(1).max(80).nullable().optional(),
    })),
  }).nullable().optional(),
  projectCharter: z
    .object({
      originalPrompt: z.string().trim().min(1).max(10000),
      imageReferenceSummary: z.string().trim().max(6000).nullable().optional(),
      appType: z.string().trim().min(1).max(240),
      targetAudience: z.string().trim().min(1).max(800),
      navigationModel: z.string().trim().min(1).max(800),
      navigationArchitecture: z.object({
        kind: z.enum(["bottom-tabs-app", "hierarchical", "single-screen"]),
        primaryNavigation: z.enum(["bottom-tabs", "none"]),
        rootChrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
        detailChrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
        consistencyRules: z.array(z.string().trim().min(1).max(500)).min(1).max(10),
        rationale: z.string().trim().min(1).max(2400),
      }).nullable().optional(),
      keyFeatures: z.array(z.string().trim().min(1).max(400)).min(1).max(20),
      designRationale: z.string().trim().min(1).max(8000),
      creativeDirection: z.object({
        conceptName: z.string().trim().min(1).max(200),
        styleEssence: z.string().trim().min(1).max(2400),
        colorStory: z.string().trim().min(1).max(2400),
        typographyMood: z.string().trim().min(1).max(2400),
        surfaceLanguage: z.string().trim().min(1).max(2400),
        iconographyStyle: z.string().trim().min(1).max(2400),
        compositionPrinciples: z.array(z.string().trim().min(1).max(600)).min(1).max(10),
        signatureMoments: z.array(z.string().trim().min(1).max(600)).min(1).max(10),
        motionTone: z.string().trim().min(1).max(2400),
        avoid: z.array(z.string().trim().min(1).max(600)).min(1).max(12),
      }).nullable().optional(),
      designStyle: z.object({
        id: z.string(),
        label: z.string(),
        version: z.number(),
      }).nullable().optional(),
    }).passthrough()
    .optional(),
  roadmap: z.unknown().nullable().optional(),
  initialBatchItemKeys: z.array(z.string().trim().min(1).max(100)).max(5).optional(),
  roadmapBuild: z.object({
    kind: z.enum(["parent_batch", "state_batch"]),
    roadmapItemIds: z.array(z.string().uuid()).min(1).max(3),
    parentScreenId: z.string().uuid().nullable().optional(),
  }).optional(),
  designTokens: z.unknown().nullable().optional(),
  scopeContract: z.unknown().nullable().optional(),
  planningMode: z.enum(["project", "single-screen"]).optional(),
  baseState: z.object({
    stateKey: z.string().trim().min(1).max(120),
    stateLabel: z.string().trim().min(1).max(160),
  }).passthrough().nullable().optional(),
  stateVariants: z.array(z.object({
    id: z.string().trim().min(1).max(120),
    stateKey: z.string().trim().min(1).max(120),
    stateLabel: z.string().trim().min(1).max(160),
    stateRole: z.string().trim().min(1).max(500),
    triggerLabel: z.string().trim().min(1).max(240),
    description: z.string().trim().min(1).max(2400),
    editInstruction: z.string().trim().min(1).max(4000),
    defaultSelected: z.boolean(),
    explicitlyRequested: z.boolean().optional(),
    roadmapStableKey: z.string().trim().min(1).max(160).nullable().optional(),
    roadmapItemId: z.string().uuid().nullable().optional(),
  })).max(3).optional(),
}).superRefine((value, ctx) => {
  if (!value.prompt.trim() && !value.image) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide a prompt, a reference image, or both.",
      path: ["prompt"],
    });
  }
});

const retryCoordinatesSchema = z.object({
  projectId: z.string().uuid(),
  sourceGenerationRunId: z.string().uuid(),
  /** Optional subset of screen names to retry (case-insensitive). */
  targetScreenNames: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
  /** Optional subset of existing failed/queued screen IDs to retry. */
  targetScreenIds: z.array(z.string().uuid()).max(20).optional(),
});
type GenerationRequest = z.infer<typeof requestSchema>;

const now = () => new Date().toISOString();

class DuplicateGenerationError extends Error {
  activeGenerationRunId: string | null;
  activeStatus: GenerationStatus | null;

  constructor(message: string, activeGenerationRunId?: string | null, activeStatus?: GenerationStatus | null) {
    super(message);
    this.name = "DuplicateGenerationError";
    this.activeGenerationRunId = activeGenerationRunId ?? null;
    this.activeStatus = activeStatus ?? null;
  }
}

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

  return data;
}

function isActiveGenerationConflict(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code ?? "") : "";
  const message = error instanceof Error ? error.message : String(error);

  return code === "23505" && message.includes("generation_runs_project_single_active_idx");
}

const deriveProjectName = (prompt: string, explicitName?: string) => {
  if (explicitName?.trim()) {
    return explicitName.trim().slice(0, 100);
  }

  return prompt
    .trim()
    .split(/\s+/)
    .slice(0, 7)
    .join(" ")
    .slice(0, 100) || "Untitled project";
};

export async function POST(request: Request) {
  const requestAcceptedAt = now();
  const supabase = await createClient();
  const admin = createAdminClient();

  let generationRunId: string | undefined;
  let projectId: string | undefined;
  let retryContext: GenerationRetryContext | null = null;
  let retrySourceRun: Database["public"]["Tables"]["generation_runs"]["Row"] | null = null;
  let authenticatedOwnerId: string | null = null;
  let requestClientId: string | null = null;

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerId = authData.user.id;
    authenticatedOwnerId = ownerId;
    const rawRequestBody = await request.json();
    requestClientId = rawRequestBody && typeof rawRequestBody === "object" && !Array.isArray(rawRequestBody)
      && typeof (rawRequestBody as Record<string, unknown>).clientRequestId === "string"
      ? (rawRequestBody as Record<string, unknown>).clientRequestId as string
      : null;
    let requestBody = rawRequestBody;
    const retryCoordinates = retryCoordinatesSchema.safeParse(rawRequestBody);
    const requestedSourceRunId = rawRequestBody && typeof rawRequestBody === "object" && !Array.isArray(rawRequestBody)
      ? (rawRequestBody as Record<string, unknown>).sourceGenerationRunId
      : null;

    if (requestedSourceRunId) {
      if (!retryCoordinates.success) {
        throw new z.ZodError(retryCoordinates.error.issues);
      }

      const [sourceRunResult, projectResult, navigationResult, screensResult] = await Promise.all([
        admin
          .from("generation_runs")
          .select("*")
          .eq("id", retryCoordinates.data.sourceGenerationRunId)
          .eq("project_id", retryCoordinates.data.projectId)
          .eq("owner_id", ownerId)
          .maybeSingle(),
        admin
          .from("projects")
          .select("id, owner_id, design_tokens")
          .eq("id", retryCoordinates.data.projectId)
          .eq("owner_id", ownerId)
          .maybeSingle(),
        admin
          .from("project_navigation")
          .select("plan")
          .eq("project_id", retryCoordinates.data.projectId)
          .maybeSingle(),
        admin
          .from("screens")
          .select("id, name, status, parent_screen_id, state_key")
          .eq("generation_run_id", retryCoordinates.data.sourceGenerationRunId),
      ]);

      if (sourceRunResult.error || !sourceRunResult.data || projectResult.error || !projectResult.data) {
        return NextResponse.json({ error: "The failed generation could not be found." }, { status: 404 });
      }
      if (navigationResult.error) throw navigationResult.error;
      if (screensResult.error) throw screensResult.error;

      const sourceScreens = screensResult.data ?? [];
      const baseScreens = sourceScreens.filter((screen) => !screen.parent_screen_id);
      const failedBaseCount = baseScreens.filter((screen) => screen.status === "failed").length;
      const readyBaseCount = baseScreens.filter((screen) => screen.status === "ready").length;
      const activeBaseCount = baseScreens.filter((screen) => screen.status === "building" || screen.status === "queued").length;
      const runStatus = sourceRunResult.data.status;
      const isTerminalFailure = runStatus === "failed" || runStatus === "canceled";
      const isPartialCompletion = runStatus === "completed" && failedBaseCount > 0;
      const isIncompleteCompletion =
        runStatus === "completed" &&
        typeof sourceRunResult.data.requested_screen_count === "number" &&
        sourceRunResult.data.requested_screen_count > readyBaseCount;

      if (activeBaseCount > 0 || runStatus === "queued" || runStatus === "planning" || runStatus === "building") {
        return NextResponse.json({
          error: "This generation is still running. Wait for it to finish before retrying.",
          code: "retry_run_active",
        }, { status: 409 });
      }

      if (!isTerminalFailure && !isPartialCompletion && !isIncompleteCompletion) {
        return NextResponse.json({
          error: "Only failed, canceled, or partially completed generations can be retried.",
          code: "retry_run_not_retryable",
        }, { status: 409 });
      }

      await releaseGenerationCreditRemainder({
        admin,
        ownerId,
        generationRunId: sourceRunResult.data.id,
        reason: "Retry released unfinished outputs from the previous run.",
      });

      const sourceRun = sourceRunResult.data;
      retrySourceRun = sourceRun;
      const sourceMetadata = sourceRun.metadata && typeof sourceRun.metadata === "object" && !Array.isArray(sourceRun.metadata)
        ? sourceRun.metadata as Record<string, unknown>
        : {};
      const sourcePlanningSeeds = Array.isArray(sourceMetadata.screenPlanningSeeds)
        ? sourceMetadata.screenPlanningSeeds as unknown as ScreenPlanningSeed[]
        : [];
      const sourcePlannedScreens = Array.isArray(sourceMetadata.plannedScreens)
        ? sourceMetadata.plannedScreens as unknown as ScreenPlan[]
        : sourcePlanningSeeds.map((seed) => ({
            name: seed.name,
            type: seed.type,
            description: seed.summary,
            roadmapStableKey: seed.roadmapStableKey ?? null,
            stateVariants: [],
            assetNeeds: [],
          }));

      const requestedTargetNames = new Set(
        (retryCoordinates.data.targetScreenNames ?? [])
          .map((name) => name.trim().toLowerCase().replace(/\s+/g, " "))
          .filter(Boolean),
      );
      for (const screenId of retryCoordinates.data.targetScreenIds ?? []) {
        const matched = sourceScreens.find((screen) => screen.id === screenId);
        if (matched?.name) {
          requestedTargetNames.add(matched.name.trim().toLowerCase().replace(/\s+/g, " "));
        }
      }
      const targetScreenNames = requestedTargetNames.size > 0
        ? Array.from(requestedTargetNames)
        : null;

      const retryScope = determineGenerationRetryScope({
        sourceGenerationRunId: sourceRun.id,
        plannedScreens: sourcePlannedScreens.length > 0 ? sourcePlannedScreens : null,
        stateVariants: Array.isArray(sourceMetadata.stateVariants) ? sourceMetadata.stateVariants as never : [],
        selectedStateVariantIds: Array.isArray(sourceMetadata.selectedStateVariantIds)
          ? sourceMetadata.selectedStateVariantIds.filter((value): value is string => typeof value === "string")
          : [],
        screens: sourceScreens,
        targetScreenNames,
      });

      if (!retryScope.hasWork) {
        return NextResponse.json({
          error: "This generation has no failed or missing outputs left to retry.",
          code: "retry_scope_complete",
        }, { status: 409 });
      }

      retryContext = retryScope.context;
      const retryPlanCount = retryScope.plannedScreens?.length ?? sourceRun.requested_screen_count ?? null;
      const retryReferenceMode = sourceMetadata.requestedImageReferenceMode === "recreate" && Boolean(sourceRun.image_path)
        ? "user_recreate"
        : "user_style";
      const retryScopeContract = sourceMetadata.scopeContract ?? ({
        version: 2,
        referenceMode: retryReferenceMode,
        promptScreenCount: retryPlanCount,
        namedScreenCount: retryPlanCount,
        imageScreenCount: null,
        finalScreenCount: retryPlanCount,
        countSource: "planning_mode",
        confidence: "high",
        conflictResolution: null,
        allScreensRequested: false,
        reason: "Retry uses the server-persisted approved screen scope.",
        diagnostics: [`Recovered retry scope from ${sourceRun.id}.`],
        screens: retryScope.plannedScreens?.map((screen, index) => ({
          index: index + 1,
          name: screen.name,
          kind: screen.type,
        })),
        ambiguities: [],
        requiresConfirmation: false,
      } satisfies GenerationScopeContract);
      requestBody = {
        clientRequestId: typeof (rawRequestBody as Record<string, unknown>).clientRequestId === "string"
          ? (rawRequestBody as Record<string, unknown>).clientRequestId
          : undefined,
        projectId: retryCoordinates.data.projectId,
        sourceGenerationRunId: sourceRun.id,
        prompt: sourceRun.prompt,
        imageReferenceMode: sourceMetadata.requestedImageReferenceMode === "style" ? "style" : "recreate",
        designStyleId: typeof sourceMetadata.requestedDesignStyleId === "string" ? sourceMetadata.requestedDesignStyleId : null,
        stylePresetSlug: typeof sourceMetadata.requestedStylePresetSlug === "string" ? sourceMetadata.requestedStylePresetSlug : null,
        designTokens: projectResult.data.design_tokens,
        plannedScreens: retryScope.plannedScreens?.length ? retryScope.plannedScreens : undefined,
        requiresBottomNav: sourceRun.requires_bottom_nav ?? undefined,
        navigationArchitecture: sourceMetadata.navigationArchitecture ?? undefined,
        navigationPlan: sourceMetadata.navigationPlan ?? navigationResult.data?.plan ?? undefined,
        scopeContract: retryScopeContract,
        planningMode: typeof sourceMetadata.planningMode === "string" ? sourceMetadata.planningMode : undefined,
        baseState: sourceMetadata.baseState ?? undefined,
        stateVariants: retryScope.stateVariants,
        roadmap: sourceMetadata.roadmap ?? undefined,
        initialBatchItemKeys: Array.isArray(sourceMetadata.initialBatchItemKeys)
          ? sourceMetadata.initialBatchItemKeys
          : undefined,
      };
    }

    const payload = retryContext
      ? requestBody as GenerationRequest
      : requestSchema.parse(requestBody);
    if (payload.clientRequestId) {
      const { data: idempotentRun, error: idempotentError } = await admin
        .from("generation_runs")
        .select("id, project_id, trigger_run_id, status")
        .eq("owner_id", ownerId)
        .eq("client_request_id", payload.clientRequestId)
        .maybeSingle();
      if (idempotentError) throw idempotentError;
      if (idempotentRun) {
        return NextResponse.json({
          projectId: idempotentRun.project_id,
          generationRunId: idempotentRun.id,
          triggerRunId: idempotentRun.trigger_run_id,
          status: idempotentRun.status,
          idempotent: true,
        }, { status: 202 });
      }
    }
    const isExistingProjectRequest = Boolean(payload.projectId);
    const generationEngineVersion = getGenerationEngineVersion();
    const normalizedReference = payload.image ? await normalizeReferenceImage(payload.image) : null;
    const promptImage = normalizedReference?.image ?? null;
    const deterministicPromptIntent = parsePromptScreenIntent(payload.prompt);
    const canDeferImagePreflight = Boolean(promptImage) && (
      payload.imageReferenceMode === "recreate"
      || deterministicPromptIntent.promptScreenCount !== null
      || deterministicPromptIntent.namedScreenCount !== null
    );
    const stylePreset = !promptImage ? await resolvePublishedStylePreset(payload.stylePresetSlug) : null;
    const designStyle = stylePreset?.stylePack ?? (isDesignStyleId(payload.designStyleId) && !promptImage
      ? getDesignStylePack(payload.designStyleId)
      : null);
    let scopeContract = (payload.scopeContract ?? null) as GenerationScopeContract | null;
    let referenceAnalysis: ReferenceAnalysis | null = null;
    if (!scopeContract && generationEngineVersion === "v2" && !canDeferImagePreflight) {
      const preflight = await preflightGenerationScope({
        prompt: payload.prompt,
        image: promptImage,
        referenceMode: promptImage
          ? payload.imageReferenceMode === "style" ? "user_style" : "user_recreate"
          : isExistingProjectRequest ? "user_style" : "internal_style",
        planningMode: "project",
      });
      scopeContract = preflight.scopeContract;
      referenceAnalysis = preflight.referenceAnalysis;
      if (scopeContract.requiresConfirmation) {
        return NextResponse.json({
          error: "Please confirm the interpreted screen scope before generation.",
          code: "scope_confirmation_required",
          scopeContract,
        }, { status: 409 });
      }
    }
    const requestedDesignTokens = payload.designTokens
      ? normalizeDesignTokens(payload.designTokens as DesignTokens)
      : null;
    let plannedScreens = (payload.plannedScreens ?? null) as ScreenPlan[] | null;
    let screenPlanningSeeds = (payload.screenPlanningSeeds ?? null) as ScreenPlanningSeed[] | null;
    const projectRoadmap = (payload.roadmap ?? null) as ProjectRoadmap | null;
    const initialReferenceImagePath = !isExistingProjectRequest && promptImage && normalizedReference
      ? `${ownerId}/prompt-images/${normalizedReference.sha256}.webp`
      : null;
    const projectCharter = payload.projectCharter
      ? ({
          ...(payload.projectCharter as ProjectCharter),
          designStyle: (payload.projectCharter as ProjectCharter).designStyle ?? summarizeDesignStyle(designStyle),
          referenceDna: (payload.projectCharter as ProjectCharter).referenceDna
            ? {
                ...(payload.projectCharter as ProjectCharter).referenceDna!,
                sourceImagePath: (payload.projectCharter as ProjectCharter).referenceDna?.sourceImagePath
                  ?? initialReferenceImagePath,
              }
            : null,
        } satisfies ProjectCharter)
      : null;
    const navigationArchitecture = (payload.navigationArchitecture ?? projectCharter?.navigationArchitecture ?? null) as NavigationArchitecture | null;
    const navigationPlan = (payload.navigationPlan ?? null) as NavigationPlan | null;
    let designTokens = requestedDesignTokens ?? (stylePreset?.tokenSeed ? normalizeDesignTokens(stylePreset.tokenSeed as DesignTokens) : null);

    projectId = payload.projectId;

    if (payload.sourceGenerationRunId && !projectId) {
      return NextResponse.json({ error: "Retries require an existing project." }, { status: 400 });
    }

    if (projectId) {
      const { data: project, error: projectError } = await admin
        .from("projects")
        .select("id, owner_id, design_tokens")
        .eq("id", projectId)
        .single();

      if (projectError || !project || project.owner_id !== ownerId) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      if (!designTokens && project.design_tokens) {
        designTokens = normalizeDesignTokens(project.design_tokens as DesignTokens);
      }

      const activeGenerationRun = await findActiveGenerationRun(admin, projectId);
      if (activeGenerationRun) {
        throw new DuplicateGenerationError(
          "A generation is already queued or building for this project.",
          activeGenerationRun.id,
          activeGenerationRun.status,
        );
      }

      if (payload.roadmapBuild) {
        const uniqueItemIds = Array.from(new Set(payload.roadmapBuild.roadmapItemIds));
        const { data: roadmapItems, error: roadmapError } = await admin
          .from("project_screen_roadmap")
          .select("*")
          .eq("project_id", projectId)
          .eq("owner_id", ownerId);
        if (roadmapError) throw roadmapError;
        try {
          const selection = resolveRoadmapBuildSelection({
            rows: (roadmapItems ?? []) as ProjectScreenRoadmapRow[],
            kind: payload.roadmapBuild.kind,
            roadmapItemIds: uniqueItemIds,
          });
          plannedScreens = selection.plannedScreens;
          if (payload.roadmapBuild.kind === "state_batch" && selection.parentScreenId) {
          retryContext = {
              sourceGenerationRunId: selection.parentScreenId,
            mode: "state_variants",
              parentScreenId: selection.parentScreenId,
          };
          }
        } catch (error) {
          return NextResponse.json({
            error: error instanceof Error ? error.message : "The selected suggestions are no longer available.",
          }, { status: 409 });
        }
      }

      const projectUpdate: Database["public"]["Tables"]["projects"]["Update"] = {
        status: "queued",
        updated_at: now(),
      };

      if (payload.designTokens !== undefined || !project.design_tokens) {
        projectUpdate.design_tokens = designTokens as never;
      }

      if (payload.projectCharter !== undefined) {
        projectUpdate.project_charter = projectCharter as never;
      }

      const { error: updateError } = await admin.from("projects").update(projectUpdate).eq("id", projectId);
      if (updateError) {
        throw updateError;
      }
    } else {
      const { data: project, error: projectInsertError } = await admin
        .from("projects")
        .insert({
          owner_id: ownerId,
          name: deriveProjectName(payload.prompt, payload.projectName),
          prompt: payload.prompt,
          status: "queued",
          project_charter: projectCharter as never,
          design_tokens: designTokens as never,
          created_at: now(),
          updated_at: now(),
        })
        .select("id")
        .single();

      if (projectInsertError || !project) {
        throw projectInsertError ?? new Error("Failed to create project.");
      }

      projectId = project.id;
    }

    let imagePath: string | null = null;
    let effectiveImageReferenceMode: ImageReferenceMode = payload.imageReferenceMode;
    let referencePolicy: GenerationReferencePolicy | null = null;
    if (payload.sourceGenerationRunId) {
      const sourceRun = retrySourceRun;
      if (!sourceRun) {
        return NextResponse.json({ error: "Source generation run not found." }, { status: 404 });
      }

      imagePath = sourceRun.image_path;
      const sourceMetadata = sourceRun.metadata && typeof sourceRun.metadata === "object" && !Array.isArray(sourceRun.metadata)
        ? sourceRun.metadata as Record<string, unknown>
        : {};
      const sourcePolicy = sourceMetadata.referencePolicy;
      referencePolicy = isGenerationReferencePolicy(sourcePolicy)
        ? sourcePolicy
        : imagePath ? "user_upload" : null;
      const sourceMode = sourceMetadata.requestedImageReferenceMode;
      if (sourceMode === "style" || sourceMode === "recreate") {
        effectiveImageReferenceMode = sourceMode;
      }
    } else if (promptImage && normalizedReference) {
      imagePath = initialReferenceImagePath
        ?? `${ownerId}/prompt-images/${normalizedReference.sha256}.webp`;

      const { error: uploadError } = await admin.storage
        .from("generation-assets")
        .upload(imagePath, Buffer.from(promptImage.data, "base64"), {
          contentType: promptImage.mimeType,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }
      referencePolicy = "user_upload";
    }

    if (!imagePath && isExistingProjectRequest && payload.roadmapBuild?.kind === "state_batch") {
      referencePolicy = "project_memory";
      effectiveImageReferenceMode = "style";
    } else if (!imagePath && isExistingProjectRequest) {
      imagePath = await findLatestProjectPromptImagePath({
        admin,
        projectId: projectId!,
        ownerId,
        excludeGenerationRunId: payload.sourceGenerationRunId,
      });
      if (imagePath) {
        referencePolicy = "project_reference";
        effectiveImageReferenceMode = "style";
      }
    }

    referencePolicy = resolveGenerationReferencePolicy({
      hasCurrentUserImage: Boolean(promptImage),
      hasProjectReferenceImage: referencePolicy === "project_reference" && Boolean(imagePath),
      hasExplicitStyle: Boolean(designStyle),
      isExistingProject: isExistingProjectRequest,
      requestedPolicy: referencePolicy,
    });

    const { data: generationRun, error: generationRunError } = await admin
      .from("generation_runs")
      .insert({
        project_id: projectId,
        owner_id: ownerId,
        prompt: payload.prompt,
        image_path: imagePath,
        requested_screen_count: scopeContract?.finalScreenCount ?? null,
        client_request_id: payload.clientRequestId ?? null,
        status: "queued",
        metadata: {
          generationEngineVersion,
          requestedFrom: payload.sourceGenerationRunId ? "retry" : "nextjs-route",
          sourceGenerationRunId: payload.sourceGenerationRunId ?? null,
          isNewProject: !isExistingProjectRequest,
          performanceV1: {
            version: 1,
            requestAcceptedAt,
          },
          requestedImageReferenceMode: effectiveImageReferenceMode,
          referencePolicy,
          requestedDesignStyleId: designStyle?.id ?? null,
          requestedStylePresetSlug: stylePreset?.slug ?? null,
          requestedStylePresetVersion: stylePreset?.version ?? null,
          designStyle: summarizeDesignStyle(designStyle),
          scopeContract,
          navigationArchitecture,
          navigationPlan,
          plannedScreens,
          screenPlanningSeeds,
          planningMode: payload.planningMode ?? null,
          baseState: payload.baseState ?? null,
          stateVariants: payload.stateVariants ?? [],
          selectedStateVariantIds: (payload.stateVariants ?? []).map((variant) => variant.id),
          retryContext,
          roadmapBuild: payload.roadmapBuild ?? null,
          roadmap: projectRoadmap,
          initialBatchItemKeys: payload.initialBatchItemKeys ?? [],
        } as never,
        created_at: now(),
        updated_at: now(),
      })
      .select("id")
      .single();

    if (generationRunError || !generationRun) {
      throw generationRunError ?? new Error("Failed to create generation run.");
    }

    generationRunId = generationRun.id;

    if (!payload.projectId) {
      // Only insert the initial user message for a newly created project
      const userMessageInsert = await admin
        .from("project_messages")
        .insert({
          project_id: projectId,
          owner_id: ownerId,
          screen_id: null,
          role: "user",
          content: payload.prompt || "[image]",
          message_type: "chat",
          metadata: {
            action: "agent_turn_user",
            clientTurnId: crypto.randomUUID(),
            image: promptImage,
          },
          created_at: now(),
        });
      if (userMessageInsert.error) {
        console.error("Failed to insert initial user message:", userMessageInsert.error);
      }
    }

    const handle = await tasks.trigger<typeof generateUiFlowTask>(
      "generate-ui-flow",
      {
        generationRunId: generationRunId!,
        projectId: projectId!,
        ownerId,
        prompt: payload.prompt,
        imagePath,
        imageReferenceMode: effectiveImageReferenceMode,
        referencePolicy,
        designStyleId: designStyle?.id ?? null,
        stylePresetSlug: stylePreset?.slug ?? null,
        designTokens,
        plannedScreens,
        screenPlanningSeeds,
        scopeContract,
        referenceAnalysis,
        requiresBottomNav: payload.requiresBottomNav,
        navigationArchitecture,
        navigationPlan,
        projectCharter,
        planningMode: payload.planningMode,
        baseState: payload.baseState ?? null,
        stateVariants: payload.stateVariants ?? [],
        retryContext,
        projectRoadmap,
        initialBatchItemKeys: payload.initialBatchItemKeys ?? [],
        isNewProject: !isExistingProjectRequest,
      },
      {
        concurrencyKey: ownerId,
        ttl: "30m",
      },
    );

    const { error: triggerUpdateError } = await admin
      .from("generation_runs")
      .update({
        trigger_run_id: handle.id,
        updated_at: now(),
      })
      .eq("id", generationRunId);

    if (triggerUpdateError) {
      throw triggerUpdateError;
    }

    return NextResponse.json(
      {
        projectId,
        generationRunId,
        triggerRunId: handle.id,
        retry: retryContext ? {
          sourceGenerationRunId: retryContext.sourceGenerationRunId,
          mode: retryContext.mode,
        } : null,
      },
      { status: 202 },
    );
  } catch (error: any) {
    console.error("Generation queue route error", error);

    if (error instanceof DuplicateGenerationError) {
      return NextResponse.json(
        {
          error: error.message,
          activeGenerationRunId: error.activeGenerationRunId,
          activeStatus: error.activeStatus,
        },
        { status: 409 },
      );
    }

    if (projectId && isActiveGenerationConflict(error)) {
      const activeGenerationRun = await findActiveGenerationRun(admin, projectId).catch((lookupError) => {
        console.error("Failed to load active run after conflict", lookupError);
        return null;
      });

      if (
        activeGenerationRun &&
        requestClientId &&
        authenticatedOwnerId
      ) {
        const { data: idempotentRun } = await admin
          .from("generation_runs")
          .select("id, project_id, trigger_run_id, status")
          .eq("id", activeGenerationRun.id)
          .eq("owner_id", authenticatedOwnerId)
          .eq("client_request_id", requestClientId)
          .maybeSingle();
        if (idempotentRun) {
          return NextResponse.json({
            projectId: idempotentRun.project_id,
            generationRunId: idempotentRun.id,
            triggerRunId: idempotentRun.trigger_run_id,
            status: idempotentRun.status,
            idempotent: true,
          }, { status: 202 });
        }
      }

      return NextResponse.json(
        {
          error: "A generation is already queued or building for this project.",
          activeGenerationRunId: activeGenerationRun?.id ?? null,
          activeStatus: activeGenerationRun?.status ?? null,
        },
        { status: 409 },
      );
    }

    if (generationRunId) {
      await admin
        .from("generation_runs")
        .update({
          status: "failed",
          error: error?.message ?? String(error),
          completed_at: now(),
          updated_at: now(),
        })
        .eq("id", generationRunId);
    }

    if (projectId) {
      const { count: readyScreenCount } = await admin
        .from("screens")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "ready");
      await admin
        .from("projects")
        .update({
          status: (readyScreenCount ?? 0) > 0 ? "completed" : "failed",
          updated_at: now(),
        })
        .eq("id", projectId);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid generation request.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error?.message ?? "Failed to enqueue the generation run.",
      },
      { status: 500 },
    );
  }
}
