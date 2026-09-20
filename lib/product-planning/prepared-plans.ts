import "server-only";
import { createHash } from "node:crypto";
import { designRequirementsKey } from "./design-requirements";
import type { PlannedUiFlow } from "@/lib/types";
import type { ProductPlanning } from "./model";
import type { PlanningStore } from "./store";

// Full validated planner result, including family, intent and navigation contracts.
// This is generation state; it is never a replacement Product Blueprint.
export function preparedPlanKey(state: ProductPlanning, keys: string[], shared: unknown) {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value;
  return createHash("sha256").update(JSON.stringify(canonical({ version: 4, screenReference: state.screenReference, phase: state.phase, approval: state.scope?.approvedRevision,
    contentRevision: state.contentRevision, manifest: state.scope?.manifest, reference: state.experience?.referenceHash,
    requirementsKey: designRequirementsKey(state), sourceFrames: state.experience?.sourceFrames,
    input: state.input, keys, shared }))).digest("hex");
}

export async function readPreparedPlan(admin: PlanningStore, rootId: string, ownerId: string, key: string): Promise<PlannedUiFlow | null> {
  const { data, error } = await admin.from("generation_runs").select("metadata, status").eq("id", rootId).eq("owner_id", ownerId).maybeSingle();
  if (error) throw error;
  if (!data || data.status === "canceled") return null;
  const value = data.metadata?.preparedPlans?.[key];
  if (value?.version !== 1 || !Array.isArray(value.plan?.screens) || !value.plan?.charter || !value.plan?.navigationPlan) return null;
  return value.plan as PlannedUiFlow;
}

export async function savePreparedPlan(admin: PlanningStore, rootId: string, ownerId: string, attempt: number, key: string, plan: PlannedUiFlow) {
  const { data, error } = await admin.rpc("save_product_prepared_plan", {
    input_approval_id: rootId, input_owner_id: ownerId, input_attempt: attempt, input_key: key, input_plan: plan,
  });
  if (error) throw error;
  return data === true;
}
