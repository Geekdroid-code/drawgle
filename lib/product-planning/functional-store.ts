import "server-only";
import { functionalDeltaSchema, functionalItemSchema, healFunctionalPlan, validateFunctionalPlan, type FunctionalItem } from "./functional-plan";
import { type PlanningStore, PlanningConflict } from "./store";
import { activeFacts, type ProductPlanning } from "./model";
import { ProductToolError } from "./tool-failure";
import { outputRendering, validateNewOutputPolicy } from "./output-policy";

export async function readFunctionalRoadmap(admin: PlanningStore, projectId: string, ownerId: string): Promise<FunctionalItem[]> {
  const { data, error } = await admin.from("project_screen_roadmap").select("metadata")
    .eq("project_id", projectId).eq("owner_id", ownerId).neq("status", "dismissed");
  if (error) throw error;
  return (data ?? []).flatMap((row: { metadata: { functional?: unknown } }) => row.metadata?.functional ? [functionalItemSchema.parse(row.metadata.functional)] : []);
}

export async function updateFunctionalRoadmap(admin: PlanningStore, projectId: string, ownerId: string, state: ProductPlanning, value: unknown) {
  const delta = functionalDeltaSchema.parse(value);
  const recreate = Boolean(state.input.imagePath && state.input.imageReferenceMode === "recreate");

  // Normalize outputs before policy check to prevent unnecessary planning failures
  if (!recreate) {
    for (const item of delta.items) {
      if (item.kind === "state") {
        item.kind = "screen";
        item.parentStableKey = null;
        item.stateKey = null;
      }
      if (item.referenceScreenIndex != null) item.referenceScreenIndex = null;
    }
  } else {
    const seenIndices = new Set<number>();
    let nextIndex = 1;
    for (const item of delta.items) {
      if (item.referenceScreenIndex == null || seenIndices.has(item.referenceScreenIndex)) {
        while (seenIndices.has(nextIndex)) nextIndex++;
        item.referenceScreenIndex = nextIndex;
      }
      seenIndices.add(item.referenceScreenIndex);
    }
  }

  validateNewOutputPolicy(delta.items, recreate);
  delta.items.forEach(item => { item.rendering = outputRendering(item, recreate); });

  const humanizeLabel = (id: string) =>
    id.replace(/^surface[-_:]?|^journey[-_:]?|^screen[-_:]?/i, "")
      .replace(/[-_:]+/g, " ")
      .replace(/\b\w/g, char => char.toUpperCase()).trim() || "Main";

  const surfaces = new Set(activeFacts(state, "surfaces").map(f => f.id));
  const journeys = new Set(activeFacts(state, "journeys").map(f => f.id));
  const facts = new Set(activeFacts(state).map(f => f.id));

  // Auto-provision missing surfaces and journeys so planning never deadlocks
  for (const item of delta.items) {
    if (!item.surfaceIds?.length) {
      item.surfaceIds = surfaces.size ? [[...surfaces][0]] : ["surface-main"];
    }
    for (const surfaceId of item.surfaceIds) {
      if (!surfaces.has(surfaceId)) {
        const label = humanizeLabel(surfaceId);
        state.blueprint.facts.push({
          id: surfaceId,
          section: "surfaces",
          label,
          detail: `${label} application surface`,
          source: "assumption",
          evidence: "",
          provenance: { basis: "inferred", recommendationMessageId: null },
          links: [],
          blocking: false,
          status: "active",
          supersededBy: null,
          messageId: null,
        });
        surfaces.add(surfaceId);
        facts.add(surfaceId);
      }
    }

    if (!item.journeyIds?.length) {
      item.journeyIds = journeys.size ? [[...journeys][0]] : ["journey-main"];
    }
    for (const journeyId of item.journeyIds) {
      if (!journeys.has(journeyId)) {
        const label = humanizeLabel(journeyId);
        state.blueprint.facts.push({
          id: journeyId,
          section: "journeys",
          label,
          detail: `User journey for ${label}`,
          source: "assumption",
          evidence: "",
          provenance: { basis: "inferred", recommendationMessageId: null },
          links: [],
          blocking: false,
          status: "active",
          supersededBy: null,
          messageId: null,
        });
        journeys.add(journeyId);
        facts.add(journeyId);
      }
    }

    item.decisionIds = (item.decisionIds ?? []).filter(id => facts.has(id));
  }

  const current = await readFunctionalRoadmap(admin, projectId, ownerId);
  const byKey = new Map(current.map(item => [item.stableKey, item]));
  for (const id of delta.removeKeys) byKey.delete(id);
  for (const item of delta.items) byKey.set(item.stableKey, item);
  const healedAll = healFunctionalPlan([...byKey.values()]);
  validateFunctionalPlan(healedAll);
  const healedMap = new Map(healedAll.map(item => [item.stableKey, item]));
  const itemsToSave = delta.items.map(item => healedMap.get(item.stableKey) ?? item);

  const next = { ...state, revision: state.revision + 1, contentRevision: (state.contentRevision ?? 0) + 1, scope: state.scope ? { ...state.scope, status: "draft" as const, manifest: undefined, journeyCoverage: undefined, requestedScope: undefined, scopeEvidence: undefined, approvedRevision: null } : null };
  const { error } = await admin.rpc("update_product_functional_plan", {
    input_project_id: projectId, input_owner_id: ownerId, input_revision: state.revision,
    input_state: next, input_items: itemsToSave, input_remove_keys: delta.removeKeys,
  });
  if (error) { if (error.code === "40001") throw new PlanningConflict("The product roadmap changed. Retry with current state."); throw error; }
  return next;
}

export async function snapshotFunctionalScope(admin: PlanningStore, projectId: string, ownerId: string, state: ProductPlanning) {
  const items = await readFunctionalRoadmap(admin, projectId, ownerId);
  const keys = state.scope?.outputKeys;
  const missingKeys = keys?.filter(key => !items.some(item => item.stableKey === key)) ?? [];
  if (!keys?.length || missingKeys.length) throw new ProductToolError("Save the required screens and states before selecting their exact roadmap keys. The scope was not saved.", "SCOPE_OUTPUTS_MISSING", {
    missingKeys, availableKeys: items.map(item => item.stableKey),
    hint: "Read the roadmap and save missing outputs with update_functional_plan, then select scope. Do not drop required outputs to pass validation.",
  });
  const manifest = keys.map(key => {
    const item = items.find(item => item.stableKey === key);
    if (!item) throw new Error(`The selected output ${key} is not on the active roadmap.`);
    return item;
  });
  const activeIds = new Set(activeFacts(state).map(f => f.id));
  const recreate = Boolean(state.input.imagePath && state.input.imageReferenceMode === "recreate");
  validateNewOutputPolicy(manifest, recreate);
  manifest.forEach(item => { item.rendering = outputRendering(item, recreate); });
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
  return { ...state, scope: { ...state.scope!, outputPolicy: "manual_states_v1" as const, manifest, existingOutputs, boundaries } };
}
