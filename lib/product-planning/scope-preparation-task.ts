import "server-only";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import type { DesignTokens, NavigationPlan, ProjectCharter } from "@/lib/types";
import { nextProductBatch } from "./execution";
import { productReferenceExecution } from "./reference-execution";
import { scopePreparationKey } from "./scope-preparation";
import type { ProductPlanning } from "./model";
import type { PlanningStore } from "./store";

/** Queue the exact speculative scope once; shared-design edits get a new key. */
export async function enqueueScopePreparation(admin: PlanningStore, projectId: string, ownerId: string,
  state: ProductPlanning) {
  if (state.scope?.status !== "proposed" || !state.scope.manifest?.length
    || process.env.DRAWGLE_PROGRESSIVE_GENERATION_ENABLED !== "true") return;
  const { data: project, error: projectError } = await admin.from("projects")
    .select("design_tokens,project_charter").eq("id", projectId).eq("owner_id", ownerId).maybeSingle();
  if (projectError) throw projectError;
  if (!project) return;
  const { data: navigation, error: navigationError } = await admin.from("project_navigation")
    .select("plan").eq("project_id", projectId).eq("owner_id", ownerId).maybeSingle();
  if (navigationError) throw navigationError;
  const recreate = productReferenceExecution(state).mode === "user_recreate";
  const batch = nextProductBatch(state.scope.manifest, [], 8,
    (state.scope.existingOutputs ?? []).map(output => output.item.stableKey), recreate);
  if (!batch.length || batch.every(item => item.kind !== "screen")) return;
  const key = scopePreparationKey(state, batch.map(item => item.stableKey), {
    designTokens: (project.design_tokens as DesignTokens | null) ?? null,
    navigationPlan: (navigation?.plan as NavigationPlan | null) ?? null,
    charter: (project.project_charter as ProjectCharter | null) ?? null,
  });
  const idempotencyKey = await idempotencyKeys.create(`scope-preparation:${projectId}:${key}`, { scope: "global" });
  await tasks.trigger("prepare-product-scope", { projectId, ownerId,
    contentRevision: state.contentRevision ?? 0, queuedAt: new Date().toISOString() }, {
    idempotencyKey, idempotencyKeyTTL: "1d",
  });
}
