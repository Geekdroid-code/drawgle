import { task, logger } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { readProductPlanning } from "@/lib/product-planning/model";
import { nextProductBatch } from "@/lib/product-planning/execution";
import { productReferenceExecution } from "@/lib/product-planning/reference-execution";
import { scopedGenerationPrompt, productScopeContract } from "@/lib/product-planning/generation-context";
import { scopePreparationKey, saveScopePreparation } from "@/lib/product-planning/scope-preparation";
import { loadPlanningReference } from "@/lib/product-planning/references";
import { compileDesignRequirements } from "@/lib/product-planning/design-requirements";
import { reconcileTokensWithDesignRequirements } from "@/lib/product-planning/reconcile-design";
import { compileProductContent } from "@/lib/product-planning/content-contract";
import { reviewScreenContent } from "@/lib/product-planning/review-screen-content";
import { generateDesignTokens, planUiFlow } from "@/lib/generation/service";
import { planVisualAssets } from "@/lib/generation/visual-assets";
import { analyzeReferenceImageForScope } from "@/lib/generation/scope-contract";
import { getDesignStylePack } from "@/lib/generation/design-styles";
import { resolvePublishedStylePreset } from "@/lib/published-style-presets";
import type { DesignTokens, NavigationPlan, ProjectCharter } from "@/lib/types";

/** Speculative, service-only planning after an approval card; no screen or credit writes. */
export const prepareProductScopeTask = task({
  id: "prepare-product-scope", maxDuration: 900,
  run: async ({ projectId, ownerId, contentRevision }: { projectId: string; ownerId: string; contentRevision: number }) => {
    const admin = createAdminClient();
    const { data: project, error: projectError } = await admin.from("projects")
      .select("product_planning,design_tokens,project_charter").eq("id", projectId).eq("owner_id", ownerId).maybeSingle();
    if (projectError) throw projectError;
    const state = readProductPlanning(project?.product_planning);
    if (!state || state.phase !== "discovery" || state.scope?.status !== "proposed"
      || (state.contentRevision ?? 0) !== contentRevision || !state.scope.manifest?.length) return { skipped: true };
    const { data: navigation, error: navError } = await admin.from("project_navigation")
      .select("plan").eq("project_id", projectId).eq("owner_id", ownerId).maybeSingle();
    if (navError) throw navError;
    const shared = { designTokens: (project?.design_tokens as DesignTokens | null) ?? null,
      navigationPlan: (navigation?.plan as NavigationPlan | null) ?? null,
      charter: (project?.project_charter as ProjectCharter | null) ?? null };
    const reference = productReferenceExecution(state);
    const recreate = reference.mode === "user_recreate";
    const batch = nextProductBatch(state.scope.manifest, [], 8,
      (state.scope.existingOutputs ?? []).map(output => output.item.stableKey), recreate);
    if (!batch.length || batch.every(item => item.kind !== "screen")) return { skipped: true };
    const keys = batch.map(item => item.stableKey);
    const key = scopePreparationKey(state, keys, shared);
    const image = reference.imagePath ? await loadPlanningReference(admin, reference.imagePath, ownerId) : null;
    if (reference.imagePath && !image) return { skipped: true };
    const prompt = scopedGenerationPrompt(state, keys);
    const preset = !image ? await resolvePublishedStylePreset(state.input.stylePresetSlug) : null;
    const designStyle = preset?.stylePack ?? (!image ? getDesignStylePack(shared.charter?.designStyle?.id) : null);
    const analysis = await analyzeReferenceImageForScope({ prompt, image, referenceMode: reference.mode });
    let tokens = shared.designTokens ?? await generateDesignTokens({ prompt, image, referenceMode: reference.mode,
      referenceId: reference.referenceId, designStyle, referenceAnalysis: analysis.analysis,
      designRequirements: compileDesignRequirements(state, reference.mode) });
    if (!shared.designTokens && !recreate) tokens = await reconcileTokensWithDesignRequirements(tokens, state);
    const approved = { ...state, scope: { ...state.scope, status: "approved" as const,
      approvedRevision: state.revision } };
    const plan = await planUiFlow({ productPlanning: approved, productExecutionKeys: keys,
      prompt, image, referenceMode: reference.mode, referenceId: reference.referenceId,
      referenceCatalogHash: reference.catalogHash, designStyle, designTokens: tokens,
      scopeContract: productScopeContract(approved, reference.mode, keys),
      referenceAnalysis: analysis.analysis, existingCharter: shared.charter,
      existingNavigationPlan: shared.navigationPlan, planningMode: "project" });
    if (!recreate) {
      const content = compileProductContent(state);
      if (content) plan.screens = await reviewScreenContent(plan.screens, content);
    }
    const assetRequirements = await planVisualAssets({ prompt, screens: plan.screens, charter: plan.charter,
      designTokens: tokens, referenceMode: reference.mode, intentContract: plan.intentContract ?? null });
    const { data: latest, error: latestError } = await admin.from("projects")
      .select("product_planning,design_tokens,project_charter").eq("id", projectId).eq("owner_id", ownerId).maybeSingle();
    if (latestError) throw latestError;
    const current = readProductPlanning(latest?.product_planning);
    if (!current || current.scope?.status !== "proposed" || (current.contentRevision ?? 0) !== contentRevision) return { stale: true };
    const { data: latestNavigation, error: latestNavError } = await admin.from("project_navigation")
      .select("plan").eq("project_id", projectId).eq("owner_id", ownerId).maybeSingle();
    if (latestNavError) throw latestNavError;
    const currentShared = { designTokens: (latest?.design_tokens as DesignTokens | null) ?? null,
      navigationPlan: (latestNavigation?.plan as NavigationPlan | null) ?? null,
      charter: (latest?.project_charter as ProjectCharter | null) ?? null };
    if (scopePreparationKey(current, keys, currentShared) !== key) return { stale: true };
    await saveScopePreparation(admin, projectId, ownerId, key, tokens, analysis.analysis, plan, assetRequirements);
    logger.info("Prepared approved-scope candidate", { projectId, outputCount: keys.length });
    return { prepared: true, outputCount: keys.length };
  },
});
