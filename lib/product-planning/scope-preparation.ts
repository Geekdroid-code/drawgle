import "server-only";
import { createHash } from "node:crypto";
import type { AssetRequirement, DesignTokens, NavigationPlan, PlannedUiFlow, ProjectCharter, ReferenceAnalysis } from "@/lib/types";
import { designRequirementsKey } from "./design-requirements";
import type { ProductPlanning } from "./model";
import type { PlanningStore } from "./store";

const version = 1;

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
    version, contentRevision: state.contentRevision ?? 0, phase: state.phase,
    manifest: state.scope?.manifest, keys, experience: state.experience,
    reference: { provenance: state.experience?.provenance, hash: state.experience?.referenceHash,
      screenReference: state.screenReference },
    requirements: designRequirementsKey(state), input: state.input, shared,
  }))).digest("hex");
}

export async function readScopePreparation(admin: PlanningStore, projectId: string, ownerId: string, key: string): Promise<{
  designTokens: DesignTokens; referenceAnalysis: ReferenceAnalysis | null; plan: PlannedUiFlow; assetRequirements: AssetRequirement[];
} | null> {
  const { data, error } = await admin.from("product_scope_preparations")
    .select("design_tokens,reference_analysis,plan,asset_requirements,expires_at").eq("project_id", projectId).eq("owner_id", ownerId)
    .eq("preparation_key", key).maybeSingle();
  if (error) throw error;
  if (!data || Date.parse(data.expires_at) <= Date.now()) return null;
  const plan = data.plan as PlannedUiFlow;
  if (!plan || !Array.isArray(plan.screens) || !plan.charter || !plan.navigationPlan || !data.design_tokens) return null;
  if (!Array.isArray(data.asset_requirements)) return null;
  return { designTokens: data.design_tokens as DesignTokens,
    referenceAnalysis: (data.reference_analysis as ReferenceAnalysis | null) ?? null,
    plan, assetRequirements: data.asset_requirements as AssetRequirement[] };
}

export async function saveScopePreparation(admin: PlanningStore, projectId: string, ownerId: string, key: string,
  designTokens: DesignTokens, referenceAnalysis: ReferenceAnalysis | null, plan: PlannedUiFlow, assetRequirements: AssetRequirement[]) {
  const { data: project, error: ownerError } = await admin.from("projects").select("id")
    .eq("id", projectId).eq("owner_id", ownerId).maybeSingle();
  if (ownerError) throw ownerError;
  if (!project) return false;
  const { error } = await admin.from("product_scope_preparations").upsert({ project_id: projectId, owner_id: ownerId,
    preparation_key: key, design_tokens: designTokens, reference_analysis: referenceAnalysis,
    plan, asset_requirements: assetRequirements,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
  { onConflict: "project_id,preparation_key" });
  if (error) throw error;
  return true;
}
