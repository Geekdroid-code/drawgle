import { productReferenceExecution } from "@/lib/product-planning/reference-execution";
import { task, tasks } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminCreditService } from "@/lib/credits";
import { insertProjectMessage } from "@/lib/supabase/queries";
import { readProductPlanning } from "@/lib/product-planning/model";
import { nextProductBatch, productExecutionProgress, type ProductFulfillment } from "@/lib/product-planning/execution";
import { saveExecutionProgress } from "@/lib/product-planning/execution-progress";
import { reusableProductOutputs } from "@/lib/product-planning/retry-outputs";
import { functionalBrief, functionalStateVariant, functionalRoadmapItem } from "@/lib/product-planning/functional-plan";
import { scopedGenerationPrompt, productScopeContract } from "@/lib/product-planning/generation-context";
import { SCREEN_GENERATION_CREDIT_COST, STATE_GENERATION_CREDIT_COST } from "@/lib/generation/pricing";
import type { GenerateUiFlowPayload, generateUiFlowTask } from "./generate-ui-flow";

// A durable coordinator; browser presence and manual roadmap recommendations are
// not required to finish an approved scope. Trigger replay reuses database claims.
export const generateProductFlowTask = task({
  id: "generate-product-flow", maxDuration: 7200,
  onFailure: async ({ payload, error }: { payload: GenerateUiFlowPayload; error: unknown }) => {
    const admin = createAdminClient();
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error && typeof (error as any).message === "string"
        ? (error as any).message
        : typeof error === "string"
          ? error
          : "Product generation interrupted";
    try {
      await saveExecutionProgress(admin, payload.generationRunId, payload.ownerId, payload.productAttempt ?? 0, "failed", null, errorMessage);
    } catch (saveError) {
      // Never bypass attempt/cancellation fencing when persistence is unavailable.
      console.error("Could not persist product failure; the approved run remains recoverable", saveError);
    }
  },
  run: async (payload: GenerateUiFlowPayload) => {
    const admin = createAdminClient();
    const state = readProductPlanning(payload.productPlanning);
    if (!state?.scope?.manifest?.length || state.scope.status !== "approved") throw new Error("An approved functional scope is required.");
    const manifest = state.scope.manifest;
    const reference = productReferenceExecution(state);
    const recreate = state.phase !== "canvas" && reference.mode === "user_recreate";
    const rootId = payload.generationRunId;
    const attempt = payload.productAttempt ?? 0;
    const update = async (status: "building" | "completed" | "failed", summary: string) => {
      if (!await saveExecutionProgress(admin, rootId, payload.ownerId, attempt, status, null, status === "failed" ? summary : null)) return;
      await insertProjectMessage(admin, { projectId: payload.projectId, ownerId: payload.ownerId, role: "model", content: summary,
        metadata: { action: "product_generation_progress", generationRunId: rootId } });
    };
    await update("building", `Starting the approved flow: ${manifest.filter(i => i.kind === "screen").length} screens and ${manifest.filter(i => i.kind === "state").length} states.`);
    for (let step = 0; step <= manifest.length; step++) {
      const { data: root, error: rootError } = await admin.from("generation_runs").select("status, metadata").eq("id", rootId).single();
      if (rootError) throw rootError;
      if (root.status === "canceled") return { canceled: true };
      if ((root.metadata?.productAttempt ?? 0) !== attempt) return { superseded: true };
      const { data, error } = await admin.from("product_output_fulfillments").select("*").eq("approval_id", rootId).eq("owner_id", payload.ownerId);
      if (error) throw error;
      const claims = (data ?? []) as ProductFulfillment[];
      if (!await saveExecutionProgress(admin, rootId, payload.ownerId, attempt, null,
        productExecutionProgress(manifest, claims))) return { superseded: true };
      if (claims.length === manifest.length && claims.every(c => c.status === "ready")) {
        await update("completed", `Completed the approved flow: all ${manifest.length} screens and states are on this canvas.`);
        return { completed: true };
      }
      const existingOutputs = state.scope.existingOutputs ?? [];
      const batch = nextProductBatch(manifest, claims, 8, existingOutputs.map(output => output.item.stableKey), recreate);
      if (!batch.length) {
        await update("failed", "The remaining approved work is blocked by a failed prerequisite. Completed screens are preserved; retry the failed work to continue.");
        return { blocked: true };
      }
      const pendingClaim = claims.find(c => c.output_key === batch[0].stableKey);
      if (!pendingClaim) {
        const credits = batch.reduce((sum, item) => sum + (item.kind === "screen" ? SCREEN_GENERATION_CREDIT_COST : STATE_GENERATION_CREDIT_COST), 0);
        if (!(await adminCreditService.hasCredits(payload.ownerId, credits)).hasCredits) {
          await update("failed", "Generation paused because the next approved batch needs more credits. Completed work and the remaining scope are saved.");
          return { paused: true };
        }
      }
      const { data: batchId, error: claimError } = await admin.rpc("claim_product_generation_batch", {
        input_approval_id: rootId, input_owner_id: payload.ownerId, input_keys: batch.map(item => item.stableKey), input_attempt: attempt,
      });
      if (claimError) throw claimError;
      const parent = batch.find(item => item.kind === "screen") ?? [...manifest, ...existingOutputs.map(output => output.item)].find(item => item.stableKey === batch[0].parentStableKey)!;
      if (!parent) throw new Error("State parent is missing from the approved manifest.");
      const stateOnly = !recreate && batch.every(item => item.kind === "state");
      const parentId = claims.find(c => c.output_key === parent.stableKey)?.screen_id ?? existingOutputs.find(output => output.item.stableKey === parent.stableKey)?.screenId;
      if (stateOnly && !parentId) throw new Error("The approved state's parent is not ready.");
      const { data: project, error: projectError } = await admin.from("projects").select("project_charter, design_tokens").eq("id", payload.projectId).eq("owner_id", payload.ownerId).single();
      if (projectError) throw projectError;
      const { data: navigation, error: navigationError } = await admin.from("project_navigation").select("plan").eq("project_id", payload.projectId).maybeSingle();
      if (navigationError) throw navigationError;
      const executionKeys = batch.map(item => item.stableKey);
      const reusableOutputs = await reusableProductOutputs(admin, payload.projectId, payload.ownerId, batch, recreate);
      const child: GenerateUiFlowPayload = {
        ...payload, referenceScope: state.phase === "canvas" ? "screen" : "project", imageReferenceMode: recreate ? "recreate" : "style", imagePath: reference.imagePath, generationRunId: batchId, productPlanning: state, productExecutionKeys: executionKeys,
        productLookaheadKeys: nextProductBatch(manifest, [
          ...claims.filter(claim => !executionKeys.includes(claim.output_key)),
          ...batch.map(item => ({ output_key: item.stableKey, generation_run_id: batchId, status: "ready" as const, screen_id: null })),
        ], 8, existingOutputs.map(output => output.item.stableKey), recreate).filter(item => item.kind === "screen" || recreate).map(item => item.stableKey),
        prompt: scopedGenerationPrompt(state, executionKeys), scopeContract: productScopeContract(state, recreate ? "user_recreate" : "user_style", executionKeys),
        isNewProject: payload.isNewProject === true && claims.length === 0 && !existingOutputs.length, projectCharter: project.project_charter ?? payload.projectCharter,
        designTokens: project.design_tokens ?? payload.designTokens,
        navigationPlan: navigation?.plan ?? payload.navigationPlan,
        projectRoadmap: { version: 1, tranche: 1, requestedParentCount: manifest.filter(i => i.kind === "screen").length,
          plannedParentCount: manifest.filter(i => i.kind === "screen").length, remainingUnplannedCount: 0, items: manifest.map(functionalRoadmapItem) },
        ...(stateOnly ? {
          plannedScreens: [{ name: parent.name, type: "detail", description: functionalBrief(parent), roadmapStableKey: parent.stableKey }],
          stateVariants: batch.map(functionalStateVariant),
          retryContext: { sourceGenerationRunId: rootId, mode: "state_variants", parentScreenId: parentId, ...reusableOutputs },
        } : { plannedScreens: null, screenPlanningSeeds: null, stateVariants: null,
          retryContext: { sourceGenerationRunId: rootId, mode: "missing_screens", ...reusableOutputs } }),
      };
      const result = await tasks.triggerAndWait<typeof generateUiFlowTask>("generate-ui-flow", child, {
        idempotencyKey: `product-batch:${batchId}`, idempotencyKeyTTL: "30d", concurrencyKey: payload.ownerId,
      });
      const { data: screens, error: screensError } = await admin.from("screens").select("id, name, parent_screen_id, state_key, status, roadmap_item_id")
        .eq("generation_run_id", batchId).eq("project_id", payload.projectId);
      if (screensError) throw screensError;
      const { data: roadmapLinks, error: roadmapError } = await admin.from("project_screen_roadmap").select("id, stable_key")
        .eq("project_id", payload.projectId).eq("owner_id", payload.ownerId).in("stable_key", executionKeys);
      if (roadmapError) throw roadmapError;
      for (const item of batch) {
        const roadmapId = roadmapLinks?.find(row => row.stable_key === item.stableKey)?.id;
        const screen = roadmapId ? (screens ?? []).find(row => row.roadmap_item_id === roadmapId) : undefined;
        const { error: settleError } = await admin.from("product_output_fulfillments").update({ status: screen?.status === "ready" ? "ready" : "failed", screen_id: screen?.id ?? null })
          .eq("approval_id", rootId).eq("output_key", item.stableKey).eq("generation_run_id", batchId);
        if (settleError) throw settleError;
      }
      if (!result.ok) await update("building", `A batch encountered an error. Checking which approved outputs completed before continuing.`);
    }
    throw new Error("Product execution did not converge; approved pending outputs remain saved.");
  },
});
