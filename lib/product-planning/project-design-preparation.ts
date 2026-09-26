import "server-only";
import { createHash } from "node:crypto";
import type { DesignTokens, ReferenceAnalysis } from "@/lib/types";
import { compileDesignRequirements, designRequirementsKey } from "./design-requirements";
import { activeFacts, type ProductPlanning } from "./model";
import { productReferenceExecution } from "./reference-execution";
import type { PlanningStore } from "./store";

const version = 1;
const ttlMs = 24 * 60 * 60 * 1000;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  return value;
}

export type EarlyDesignMode = "off" | "shadow" | "on";
export function earlyDesignMode(): EarlyDesignMode {
  const value = process.env.DRAWGLE_EARLY_PROJECT_DESIGN_MODE;
  return value === "shadow" || value === "on" ? value : "off";
}

export function mayPrepareProjectDesign(state: ProductPlanning | null | undefined) {
  return Boolean(state?.experience && state.experience.compatibility?.compatible !== false
    && !(state.input.imageReferenceMode === "recreate" && state.input.imagePath)
    && !state.screenReference);
}

/** The token model's product context deliberately has no selected output list. */
export function projectDesignPrompt(state: ProductPlanning) {
  return [
    state.input.originalRequest?.trim(),
    activeFacts(state).filter(fact => fact.section === "identity" || fact.section === "actors")
      .map(fact => `${fact.section}: ${fact.detail}`).join("\n"),
    state.experience ? `Visual direction: ${state.experience.direction}\nVisual observations: ${state.experience.observations}\nAdaptations: ${state.experience.adaptations}` : null,
    compileDesignRequirements(state),
    "Create a reusable project-wide visual system. Individual screen layouts and output order are planned separately.",
  ].filter(Boolean).join("\n\n");
}

export function projectDesignPreparationKey(state: ProductPlanning, presetVersion: number | null) {
  const reference = productReferenceExecution(state);
  return createHash("sha256").update(JSON.stringify(canonical({
    version, prompt: projectDesignPrompt(state), requirements: designRequirementsKey(state),
    experience: state.experience, reference: {
    mode: reference.mode, path: reference.imagePath,
      hash: state.experience?.referenceHash, id: reference.referenceId, catalogHash: reference.catalogHash,
    }, preset: { slug: state.input.stylePresetSlug, version: presetVersion },
  }))).digest("hex");
}

export async function readProjectDesignPreparation(admin: PlanningStore, projectId: string, ownerId: string,
  key: string): Promise<{ designTokens: DesignTokens; referenceAnalysis: ReferenceAnalysis | null;
    requirementsKey: string; preparedAt: string; queuedAt: string | null } | null> {
  const { data, error } = await admin.from("product_design_preparations")
    .select("design_tokens,reference_analysis,requirements_key,queued_at,created_at,expires_at")
    .eq("project_id", projectId).eq("owner_id", ownerId).eq("preparation_key", key).maybeSingle();
  if (error) throw error;
  if (!data?.design_tokens || Date.parse(data.expires_at) <= Date.now()) return null;
  return { designTokens: data.design_tokens as DesignTokens,
    referenceAnalysis: (data.reference_analysis as ReferenceAnalysis | null) ?? null,
    requirementsKey: data.requirements_key as string, preparedAt: data.created_at as string,
    queuedAt: (data.queued_at as string | null) ?? null };
}

export async function saveProjectDesignPreparation(admin: PlanningStore, projectId: string, ownerId: string,
  key: string, designTokens: DesignTokens, referenceAnalysis: ReferenceAnalysis | null, requirementsKey: string,
  queuedAt: string | null = null) {
  const { data: owner, error: ownerError } = await admin.from("projects").select("id")
    .eq("id", projectId).eq("owner_id", ownerId).maybeSingle();
  if (ownerError) throw ownerError;
  if (!owner) return false;
  const { error } = await admin.from("product_design_preparations").upsert({
    project_id: projectId, owner_id: ownerId, preparation_key: key,
    design_tokens: designTokens, reference_analysis: referenceAnalysis, requirements_key: requirementsKey,
    queued_at: queuedAt,
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
  }, { onConflict: "project_id,preparation_key" });
  if (error) throw error;
  return true;
}
