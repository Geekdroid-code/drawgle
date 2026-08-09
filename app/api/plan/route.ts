import { NextResponse } from "next/server";
import { z } from "zod";

import { assembleProjectContext } from "@/lib/generation/context";
import { loadCuratedStyleReferenceImage, matchCuratedStyleReference } from "@/lib/generation/curated-style-references";
import { getDesignStylePack, isDesignStyleId } from "@/lib/generation/design-styles";
import { planUiFlow } from "@/lib/generation/service";
import { analyzeReferenceImageForScope, deferNewProjectScopeConfirmation, preflightGenerationScope } from "@/lib/generation/scope-contract";
import { normalizeReferenceImage } from "@/lib/generation/reference-image";
import { resolveProjectReferenceDna } from "@/lib/generation/reference-dna";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolvePublishedStylePreset } from "@/lib/published-style-presets";

import type { DesignTokens, GenerationScopeContract, NavigationPlan, PlanningMode, ProjectCharter, PromptImagePayload, ReferenceMode } from "@/lib/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  projectId: z.string().uuid().optional(),
  prompt: z.string().trim().max(10000).default(""),
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
  designTokens: z.unknown().nullable().optional(),
  planningMode: z.enum(["project", "single-screen"]).optional().default("project"),
  scopeContract: z.unknown().nullable().optional(),
}).superRefine((value, ctx) => {
  if (!value.prompt.trim() && !value.image) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide a prompt, a reference image, or both.",
      path: ["prompt"],
    });
  }
});

export async function POST(req: Request) {
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

    const payload = requestSchema.parse(await req.json());
    const stylePreset = await resolvePublishedStylePreset(payload.stylePresetSlug);
    const designStyle = stylePreset?.stylePack ?? (isDesignStyleId(payload.designStyleId) ? getDesignStylePack(payload.designStyleId) : null);

    let projectContext: string | null = null;
    let existingCharter: ProjectCharter | null = null;
    let existingNavigationPlan: NavigationPlan | null = null;
    let cachedReferenceDna: ReturnType<typeof resolveProjectReferenceDna> = null;

    if (payload.projectId) {
      const { data: project, error: projectError } = await admin
        .from("projects")
        .select("id, owner_id, project_charter")
        .eq("id", payload.projectId)
        .maybeSingle();

      if (projectError || !project || project.owner_id !== user.id) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      existingCharter = (project.project_charter as ProjectCharter | null) ?? null;
      if (!payload.image) {
        cachedReferenceDna = resolveProjectReferenceDna(existingCharter);
        if (cachedReferenceDna?.cacheSource === "legacy_reconstruction" && existingCharter) {
          existingCharter = {
            ...existingCharter,
            referenceDna: cachedReferenceDna.dna,
          };
          const { error: dnaUpdateError } = await admin
            .from("projects")
            .update({ project_charter: existingCharter as never })
            .eq("id", payload.projectId)
            .eq("owner_id", user.id);
          if (dnaUpdateError) {
            console.warn("Failed to persist reconstructed project reference DNA", {
              projectId: payload.projectId,
              error: dnaUpdateError,
            });
          }
        }
      }
      const { data: projectNavigation } = await admin
        .from("project_navigation")
        .select("plan")
        .eq("project_id", payload.projectId)
        .maybeSingle();
      existingNavigationPlan = (projectNavigation?.plan as NavigationPlan | null) ?? null;

      projectContext = await assembleProjectContext({
        admin,
        projectId: payload.projectId,
        userPrompt: payload.prompt,
      });
    }

    let referenceImage = payload.image
      ? (await normalizeReferenceImage(payload.image as PromptImagePayload)).image
      : null;
    let referenceMode: ReferenceMode | null = referenceImage
      ? payload.imageReferenceMode === "style"
        ? "user_style"
        : "user_recreate"
      : null;
    let referenceId: string | null = null;
    let referenceCatalogHash: string | null = null;

    const hasExistingProjectVisualMemory = Boolean(
      payload.projectId
      && (
        payload.designTokens
        || existingCharter
        || existingNavigationPlan?.items?.length
        || projectContext?.includes("RELEVANT EXISTING SCREENS")
      ),
    );

    if (!referenceImage && designStyle) {
      referenceMode = "curated_style";
      referenceId = designStyle.id;
    } else if (!referenceImage && hasExistingProjectVisualMemory) {
      referenceMode = "user_style";
    } else if (!referenceImage && !payload.projectId && payload.planningMode === "project") {
      const match = await matchCuratedStyleReference({
        prompt: payload.prompt,
        planningMode: payload.planningMode as PlanningMode,
        existingCharter,
        llmLog: (label, data) => console.info(label, data),
      });

      if (match) {
        const curatedImage = await loadCuratedStyleReferenceImage(match.reference);
        referenceImage = curatedImage;
        referenceMode = curatedImage ? "curated_style" : "internal_style";
        referenceId = curatedImage ? match.reference.id : null;
        referenceCatalogHash = curatedImage ? match.catalogHash : null;
      } else {
        referenceMode = "internal_style";
      }
    } else if (!referenceImage) {
      referenceMode = "internal_style";
    }

    const providedScopeContract = (payload.scopeContract ?? null) as GenerationScopeContract | null;
    const scopePreflight = providedScopeContract
      ? cachedReferenceDna
        ? {
            scopeContract: providedScopeContract,
            referenceAnalysis: cachedReferenceDna.dna.analysis,
            referenceAnalysisResult: null,
          }
        : await analyzeReferenceImageForScope({
            prompt: payload.prompt,
            image: referenceImage,
            referenceMode,
          }).then((referenceAnalysisResult) => ({
          scopeContract: providedScopeContract,
          referenceAnalysis: referenceAnalysisResult.analysis,
          referenceAnalysisResult,
          }))
      : await preflightGenerationScope({
          prompt: payload.prompt,
          image: referenceImage,
          referenceMode,
          planningMode: payload.planningMode as PlanningMode,
          cachedReferenceAnalysis: cachedReferenceDna?.dna.analysis,
        });

    const resolvedScopeContract = providedScopeContract
      ? scopePreflight.scopeContract
      : deferNewProjectScopeConfirmation(scopePreflight.scopeContract, Boolean(payload.projectId));

    if (!providedScopeContract && resolvedScopeContract.requiresConfirmation) {
      return NextResponse.json({
        error: "Please confirm the interpreted screen scope before planning.",
        code: "scope_confirmation_required",
        scopeContract: resolvedScopeContract,
      }, { status: 409 });
    }

    const plan = await planUiFlow({
      prompt: payload.prompt,
      image: referenceImage,
      referenceMode,
      referenceId,
      referenceCatalogHash,
      designStyle,
      designTokens: (payload.designTokens ?? stylePreset?.tokenSeed ?? null) as DesignTokens | null,
      scopeContract: resolvedScopeContract,
      referenceAnalysis: scopePreflight.referenceAnalysis,
      referenceDna: cachedReferenceDna?.dna,
      screenFamilyContract: cachedReferenceDna?.dna.screenFamilyContract,
      projectContext,
      existingCharter,
      existingNavigationPlan,
      planningMode: payload.planningMode as PlanningMode,
    });

    return NextResponse.json(plan);
  } catch (error: any) {
    console.error("Planner API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
