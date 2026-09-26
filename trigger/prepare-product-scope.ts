import { task, logger } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { readProductPlanning } from "@/lib/product-planning/model";
import { nextProductBatch } from "@/lib/product-planning/execution";
import { productReferenceExecution } from "@/lib/product-planning/reference-execution";
import { scopedGenerationPrompt, productScopeContract } from "@/lib/product-planning/generation-context";
import { scopePreparationKey, scopePreparationPlanningState, saveScopePreparation } from "@/lib/product-planning/scope-preparation";
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
import { earlyDesignMode, projectDesignPreparationKey,
  readProjectDesignPreparation, saveProjectDesignPreparation } from "@/lib/product-planning/project-design-preparation";
import { generateProjectDesign } from "@/lib/product-planning/generate-project-design";
import type { DesignTokens, NavigationPlan, ProjectCharter } from "@/lib/types";

/** Speculative, service-only planning after an approval card; no screen or credit writes. */
export const prepareProductScopeTask = task({
  id: "prepare-product-scope", maxDuration: 900,
  run: async ({ projectId, ownerId, contentRevision, queuedAt }: {
    projectId: string; ownerId: string; contentRevision: number; queuedAt: string;
  }) => {
    const admin = createAdminClient();
    const { data: project, error: projectError } = await admin.from("projects")
      .select("product_planning,design_tokens,project_charter").eq("id", projectId).eq("owner_id", ownerId).maybeSingle();
    if (projectError) throw projectError;
    const state = readProductPlanning(project?.product_planning);
    const approved = scopePreparationPlanningState(state, contentRevision);
    if (!state || !approved || !state.scope?.manifest?.length) return { skipped: true };
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
    const earlyDesign = earlyDesignMode() === "on" && !recreate && !shared.designTokens;
    const designKey = earlyDesign ? projectDesignPreparationKey(state, preset?.version ?? null) : null;
    const preparedDesign = designKey
      ? await readProjectDesignPreparation(admin, projectId, ownerId, designKey) : null;
    let tokens = shared.designTokens ?? preparedDesign?.designTokens ?? null;
    if (!tokens && earlyDesign) {
      const generated = await generateProjectDesign(state, { image, referenceMode: reference.mode,
        referenceId: reference.referenceId, designStyle });
      tokens = generated.designTokens;
      const { data: currentProject } = await admin.from("projects").select("product_planning,design_tokens")
        .eq("id", projectId).eq("owner_id", ownerId).maybeSingle();
      const current = readProductPlanning(currentProject?.product_planning);
      if (current && !currentProject?.design_tokens
        && projectDesignPreparationKey(current, preset?.version ?? null) === designKey) {
        await saveProjectDesignPreparation(admin, projectId, ownerId, designKey!, tokens,
          generated.referenceAnalysis, generated.requirementsKey, queuedAt);
      }
    }
    if (!tokens) {
      tokens = await generateDesignTokens({ prompt, image, referenceMode: reference.mode,
        referenceId: reference.referenceId, designStyle, referenceAnalysis: analysis.analysis,
        designRequirements: compileDesignRequirements(state, reference.mode) });
      if (!recreate) tokens = await reconcileTokensWithDesignRequirements(tokens, state);
    }
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
    const stillCurrent = async () => {
      const { data: latest, error: latestError } = await admin.from("projects")
        .select("product_planning,design_tokens,project_charter").eq("id", projectId).eq("owner_id", ownerId).maybeSingle();
      if (latestError) throw latestError;
      const current = readProductPlanning(latest?.product_planning);
      if (!current || !["proposed", "approved"].includes(current.scope?.status ?? "")
        || (current.contentRevision ?? 0) !== contentRevision) return false;
      const { data: latestNavigation, error: latestNavError } = await admin.from("project_navigation")
        .select("plan").eq("project_id", projectId).eq("owner_id", ownerId).maybeSingle();
      if (latestNavError) throw latestNavError;
      return scopePreparationKey(current, keys, {
        designTokens: (latest?.design_tokens as DesignTokens | null) ?? null,
        navigationPlan: (latestNavigation?.plan as NavigationPlan | null) ?? null,
        charter: (latest?.project_charter as ProjectCharter | null) ?? null,
      }) === key;
    };
    if (!await stillCurrent()) return { stale: true };
    await saveScopePreparation(admin, projectId, ownerId, key, tokens, analysis.analysis, plan, null, queuedAt);
    const assetRequirements = await planVisualAssets({ prompt, screens: plan.screens, charter: plan.charter,
      designTokens: tokens, referenceMode: reference.mode, intentContract: plan.intentContract ?? null });
    if (!await stillCurrent()) return { planPrepared: true, assetsStale: true };
    await saveScopePreparation(admin, projectId, ownerId, key, tokens, analysis.analysis, plan, assetRequirements, queuedAt);
    logger.info("Prepared approved-scope candidate", { projectId, outputCount: keys.length });
    return { prepared: true, outputCount: keys.length };
  },
});
