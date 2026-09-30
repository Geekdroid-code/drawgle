import "server-only";
import { createHash } from "node:crypto";
import type { AssetRequirement, DesignTokens, NavigationPlan, PlannedUiFlow, ProjectCharter, ReferenceAnalysis, ReferenceSpecimen } from "@/lib/types";
import { designRequirementsKey } from "./design-requirements";
import { earlyDesignMode } from "./project-design-preparation";
import { productScopeContract } from "./generation-context";
import { bindApprovedScreenPlans } from "./screen-plan-contract";
import { scopeParents } from "./scope-outputs";
import type { ReferenceMode } from "@/lib/types";
import type { ProductPlanning } from "./model";
import type { PlanningStore } from "./store";

const version = 2;

/** Keep planner inputs identical if a queued task starts after the user approves. */
export function scopePreparationPlanningState(state: ProductPlanning | null, contentRevision: number): ProductPlanning | null {
  if (!state?.scope || !["proposed", "approved"].includes(state.scope.status)
    || (state.scope.status === "proposed" && state.phase !== "discovery")
    || (state.phase === "canvas" && (state.input.recreationRequest || state.experience?.sourceFrames?.length))
    || (state.contentRevision ?? 0) !== contentRevision || !state.scope.manifest?.length) return null;
  return state.scope.status === "approved"
    ? { ...state, phase: "discovery", scope: { ...state.scope, generationRunId: null } }
    : { ...state, scope: { ...state.scope, status: "approved", approvedRevision: state.revision } };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  return value;
}

export function scopePreparationKey(state: ProductPlanning, keys: string[], shared: {
  designTokens: DesignTokens | null; navigationPlan: NavigationPlan | null; charter: ProjectCharter | null;
}) {
  return createHash("sha256").update(JSON.stringify(canonical({
    // Approval changes discovery to canvas without changing this design.
    version, tokenPolicy: earlyDesignMode() === "on" ? "project-wide-v1" : "screen-scoped-v1",
    contentRevision: state.contentRevision ?? 0,
    // Absent for a scope approved before navigation was decided in it, so those keys are unchanged.
    manifest: state.scope?.manifest, navigation: state.scope?.navigation, keys, experience: state.experience,
    reference: { provenance: state.experience?.provenance, hash: state.experience?.referenceHash,
      screenReference: state.screenReference },
    requirements: designRequirementsKey(state), input: state.input, shared,
  }))).digest("hex");
}

/** Reuse a reviewed full-batch brief for the first screen without changing shared navigation. */
export function projectScopePlanForKeys(plan: PlannedUiFlow, state: ProductPlanning,
  preparedKeys: string[], executionKeys: string[], referenceMode: ReferenceMode): PlannedUiFlow | null {
  if (preparedKeys.length === executionKeys.length && preparedKeys.every((key, index) => key === executionKeys[index])) return plan;
  if (!executionKeys.length || executionKeys.some(key => !preparedKeys.includes(key))) return null;
  try {
    const prepared = bindApprovedScreenPlans(state, preparedKeys, plan.screens);
    const selected = scopeParents(state, executionKeys);
    const screens = selected.map(item => prepared.find(screen => screen.roadmapStableKey === item.stableKey));
    if (screens.some(screen => !screen)) return null;
    const names = selected.map(item => item.name);
    return { ...plan, screens: screens as PlannedUiFlow["screens"],
      scopeContract: productScopeContract(state, referenceMode, executionKeys),
      screenCountContract: plan.screenCountContract ? { ...plan.screenCountContract,
        exactCount: screens.length, namedScreens: names, maxScreens: screens.length } : undefined,
      intentContract: plan.intentContract ? { ...plan.intentContract,
        exactScreenCount: screens.length, maxInitialScreens: screens.length } : undefined,
      initialBatchItemKeys: executionKeys,
    };
  } catch { return null; }
}

/** Asset planning can finish after a child starts. A repeated screen name is ambiguous. */
export function assetsForScopePlan(selected: PlannedUiFlow, full: PlannedUiFlow,
  requirements: AssetRequirement[]): AssetRequirement[] | null {
  const allNames = full.screens.map(screen => screen.name);
  if (new Set(allNames).size !== allNames.length) return null;
  const names = new Set(selected.screens.map(screen => screen.name));
  return requirements.filter(requirement => names.has(requirement.screenName));
}

export async function readScopePreparation(admin: PlanningStore, projectId: string, ownerId: string, key: string): Promise<{
  designTokens: DesignTokens; referenceAnalysis: ReferenceAnalysis | null; plan: PlannedUiFlow;
  assetRequirements: AssetRequirement[] | null; assetsReady: boolean;
  planReadyAt: string; assetsReadyAt: string | null; queuedAt: string | null;
} | null> {
  const { data, error } = await admin.from("product_scope_preparations")
    .select("design_tokens,reference_analysis,plan,asset_requirements,assets_ready,created_at,assets_ready_at,queued_at,expires_at").eq("project_id", projectId).eq("owner_id", ownerId)
    .eq("preparation_key", key).maybeSingle();
  if (error) throw error;
  if (!data || Date.parse(data.expires_at) <= Date.now()) return null;
  const plan = data.plan as PlannedUiFlow;
  if (!plan || !Array.isArray(plan.screens) || !plan.charter || !plan.navigationPlan || !data.design_tokens) return null;
  if (!Array.isArray(data.asset_requirements)) return null;
  const assetsReady = data.assets_ready !== false;
  return { designTokens: data.design_tokens as DesignTokens,
    referenceAnalysis: (data.reference_analysis as ReferenceAnalysis | null) ?? null,
    plan, assetRequirements: assetsReady ? data.asset_requirements as AssetRequirement[] : null, assetsReady,
    planReadyAt: data.created_at as string, assetsReadyAt: (data.assets_ready_at as string | null) ?? null,
    queuedAt: (data.queued_at as string | null) ?? null };
}

/**
 * The component kit an earlier preparation of this project made from the same basis (screens, tokens and reference),
 * if one is still stored. Each revision of the approval card prepares the plan again under a new key, and a build
 * that missed its preparation plans again; neither needs a second kit when nothing it is made from has changed.
 */
export async function readPreparedComponentKit(admin: PlanningStore, projectId: string, ownerId: string,
  basis: string): Promise<ReferenceSpecimen | null> {
  const { data, error } = await admin.from("product_scope_preparations").select("plan")
    .eq("project_id", projectId).eq("owner_id", ownerId).gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(5);
  if (error) throw error;
  for (const row of data ?? []) {
    const kit = (row.plan as PlannedUiFlow | null)?.charter?.componentKit;
    if (kit?.basis === basis && kit.components?.length) return kit;
  }
  return null;
}

export async function saveScopePreparation(admin: PlanningStore, projectId: string, ownerId: string, key: string,
  designTokens: DesignTokens, referenceAnalysis: ReferenceAnalysis | null, plan: PlannedUiFlow,
  assetRequirements: AssetRequirement[] | null, queuedAt: string | null = null) {
  const { data: project, error: ownerError } = await admin.from("projects").select("id")
    .eq("id", projectId).eq("owner_id", ownerId).maybeSingle();
  if (ownerError) throw ownerError;
  if (!project) return false;
  const { error } = await admin.from("product_scope_preparations").upsert({ project_id: projectId, owner_id: ownerId,
    preparation_key: key, design_tokens: designTokens, reference_analysis: referenceAnalysis,
    plan, asset_requirements: assetRequirements ?? [], assets_ready: assetRequirements !== null,
    assets_ready_at: assetRequirements !== null ? new Date().toISOString() : null,
    queued_at: queuedAt,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
  { onConflict: "project_id,preparation_key" });
  if (error) throw error;
  return true;
}
