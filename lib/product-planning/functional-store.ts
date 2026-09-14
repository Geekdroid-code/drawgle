import "server-only";
import { functionalDeltaSchema, functionalItemSchema, validateFunctionalPlan, type FunctionalItem } from "./functional-plan";
import { type PlanningStore, PlanningConflict } from "./store";
import { activeFacts, type ProductPlanning } from "./model";

export async function readFunctionalRoadmap(admin: PlanningStore, projectId: string, ownerId: string): Promise<FunctionalItem[]> {
  const { data, error } = await admin.from("project_screen_roadmap").select("metadata")
    .eq("project_id", projectId).eq("owner_id", ownerId).neq("status", "dismissed");
  if (error) throw error;
  return (data ?? []).flatMap((row: { metadata: { functional?: unknown } }) => row.metadata?.functional ? [functionalItemSchema.parse(row.metadata.functional)] : []);
}

export async function updateFunctionalRoadmap(admin: PlanningStore, projectId: string, ownerId: string, state: ProductPlanning, value: unknown) {
  const delta = functionalDeltaSchema.parse(value);
  const current = await readFunctionalRoadmap(admin, projectId, ownerId);
  const byKey = new Map(current.map(item => [item.stableKey, item]));
  for (const id of delta.removeKeys) byKey.delete(id);
  for (const item of delta.items) byKey.set(item.stableKey, item);
  validateFunctionalPlan([...byKey.values()]);
  const surfaces = new Set(activeFacts(state, "surfaces").map(f => f.id));
  const journeys = new Set(activeFacts(state, "journeys").map(f => f.id));
  const facts = new Set(activeFacts(state).map(f => f.id));
  for (const item of delta.items) {
    if (item.surfaceIds.some(id => !surfaces.has(id)) || item.journeyIds.some(id => !journeys.has(id))) throw new Error(`${item.name} must link to active product surfaces and journeys.`);
    if (item.decisionIds.some(id => !facts.has(id))) throw new Error(`${item.name} refers to a superseded product decision. Update the affected behavior.`);
  }
  const next = { ...state, revision: state.revision + 1, contentRevision: (state.contentRevision ?? 0) + 1, scope: state.scope ? { ...state.scope, status: "draft" as const, manifest: undefined, approvedRevision: null } : null };
  const { error } = await admin.rpc("update_product_functional_plan", {
    input_project_id: projectId, input_owner_id: ownerId, input_revision: state.revision,
    input_state: next, input_items: delta.items, input_remove_keys: delta.removeKeys,
  });
  if (error) { if (error.code === "40001") throw new PlanningConflict("The product roadmap changed. Retry with current state."); throw error; }
  return next;
}

export async function snapshotFunctionalScope(admin: PlanningStore, projectId: string, ownerId: string, state: ProductPlanning) {
  const items = await readFunctionalRoadmap(admin, projectId, ownerId);
  const keys = state.scope?.outputKeys;
  if (!keys?.length) throw new Error("Select concrete roadmap outputKeys before proposing.");
  const manifest = keys.map(key => {
    const item = items.find(item => item.stableKey === key);
    if (!item) throw new Error(`The selected output ${key} is not on the active roadmap.`);
    return item;
  });
  const activeIds = new Set(activeFacts(state).map(f => f.id));
  for (const item of manifest) {
    if ([...item.surfaceIds, ...item.journeyIds, ...item.decisionIds].some(id => !activeIds.has(id))) throw new Error(`${item.name} relies on changed product facts. Update the functional roadmap before approval.`);
  }
  const { data: existing, error } = await admin.from("project_screen_roadmap").select("metadata, generated_screen_id, stable_key")
    .eq("project_id", projectId).eq("owner_id", ownerId).eq("status", "ready").not("generated_screen_id", "is", null);
  if (error) throw error;
  const existingOutputs = (existing ?? []).flatMap((row: { metadata: { functional?: unknown }; generated_screen_id: string; stable_key: string }) => {
    if (keys.includes(row.stable_key)) throw new Error(`${row.stable_key} is already built. Use it as context; select only new outputs or a new redesign identity.`);
    return row.metadata?.functional ? [{ item: functionalItemSchema.parse(row.metadata.functional), screenId: row.generated_screen_id }] : [];
  });
  const included = new Set([...keys, ...existingOutputs.map((output: { item: FunctionalItem }) => output.item.stableKey)]);
  const destinations = new Set(manifest.flatMap(item => item.actions.flatMap(action => action.destinationKey && !included.has(action.destinationKey) ? [action.destinationKey] : [])));
  const boundaries = items.filter(item => destinations.has(item.stableKey)).map(item => ({ key: item.stableKey, name: item.name, outcome: item.outcome }));
  validateFunctionalPlan(manifest, existingOutputs.map((output: { item: FunctionalItem }) => output.item), boundaries.map(item => item.key));
  return { ...state, scope: { ...state.scope!, manifest, existingOutputs, boundaries } };
}
