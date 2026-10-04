import "server-only";
import { createHash } from "node:crypto";
import { resolveCuratedStylePreset } from "@/lib/generation/curated-style-presets";
import { describesEveryScreen } from "@/lib/generation/scope-contract";
import type { DesignTokens, ReferenceAnalysis, ReferenceMode } from "@/lib/types";
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
  const value = process.env.DRAWGLE_EARLY_PROJECT_DESIGN_MODE?.trim().toLowerCase();
  return value === "off" || value === "shadow" ? value : "on";
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
    // Labelled as Drawgle's reading: the token model records which colours the person's own words name, and once took
    // this reading's "the required navy blue" as theirs, for the page background.
    state.experience ? `Drawgle's reading of the style reference (not the person's words; their own words are the request above and the requirements below):\nVisual direction: ${state.experience.direction}\nVisual observations: ${state.experience.observations}\nAdaptations: ${state.experience.adaptations}` : null,
    compileDesignRequirements(state),
    "Create a reusable project-wide visual system. Individual screen layouts and output order are planned separately.",
  ].filter(Boolean).join("\n\n");
}

export function projectDesignPreparationKey(state: ProductPlanning, presetVersion: number | null) {
  const reference = productReferenceExecution(state);
  // A curated reference with an approved preset is designed from the preset, so a preparation made before
  // it was approved, or before it was rebuilt, must not be reused.
  const curatedPreset = reference.mode === "curated_style" ? resolveCuratedStylePreset(reference.referenceId) : null;
  return createHash("sha256").update(JSON.stringify(canonical({
    curatedPreset: curatedPreset ? createHash("sha256").update(JSON.stringify(canonical(curatedPreset))).digest("hex") : null,
    version, prompt: projectDesignPrompt(state), requirements: designRequirementsKey(state),
    experience: state.experience, reference: {
    mode: reference.mode, path: reference.imagePath,
      hash: state.experience?.referenceHash, id: reference.referenceId, catalogHash: reference.catalogHash,
    }, preset: { slug: state.input.stylePresetSlug, version: presetVersion },
  }))).digest("hex");
}

export type ProjectDesignPreparation = {
  designTokens: DesignTokens; referenceAnalysis: ReferenceAnalysis | null;
  requirementsKey: string; preparedAt: string; queuedAt: string | null;
};

/** The reference a build resolved, to check a preparation's analysis against. */
export type BuildReference = {
  referenceMode: ReferenceMode; referenceId: string | null; imagePath: string | null; hasImage: boolean;
};

/** Whether a preparation's analysis could be of the reference this build resolved; checked before waiting for one. */
export function preparedAnalysisMayApply(state: ProductPlanning, build: BuildReference) {
  const reference = productReferenceExecution(state);
  return (build.referenceMode === "curated_style" || build.referenceMode === "user_style") && build.hasImage
    && reference.mode === build.referenceMode && reference.referenceId === build.referenceId
    && reference.imagePath === build.imagePath;
}

const sameTokens = (left: DesignTokens, right: DesignTokens) =>
  JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

/**
 * The preparation's reference analysis, when a build can plan from it instead of analysing the image again. It read
 * the same image with the project-wide prompt and the tokens were made from it, so planning from it keeps the tokens,
 * the plan and the charter's reference DNA on one reading of the image. It is used only with the tokens of the same
 * preparation (`projectTokens`: the project's tokens, when they were already saved from it), for the reference the
 * build resolved, and only when it describes every screen it counts.
 */
export function reusablePreparedAnalysis(prepared: ProjectDesignPreparation | null, state: ProductPlanning,
  build: BuildReference & { projectTokens?: DesignTokens | null }): ReferenceAnalysis | null {
  const analysis = prepared?.referenceAnalysis;
  if (!prepared || !analysis || prepared.requirementsKey !== designRequirementsKey(state)) return null;
  if (!preparedAnalysisMayApply(state, build)) return null;
  if (build.projectTokens && !sameTokens(build.projectTokens, prepared.designTokens)) return null;
  return describesEveryScreen(analysis) ? analysis : null;
}

/**
 * The reading a project's first batch plans from when its design preparation made one: instead of analysing the
 * image again, so the tokens, the plan and the charter's reference DNA rest on one reading. Only a batch that would
 * otherwise analyse (`analyses`) the reference it was prepared for looks; it waits for a preparation still being made
 * (`awaitPrepared`) only when it will take its tokens from it, and a retry whose tokens were already saved from it
 * reads the saved one (`readPrepared`).
 */
export async function preparedReadingForFirstBatch({ state, build, analyses, designTokens, projectTokens,
  awaitPrepared, readPrepared }: {
  state: ProductPlanning | null; build: BuildReference; analyses: boolean;
  designTokens: DesignTokens | null; projectTokens: DesignTokens | null;
  awaitPrepared: () => Promise<ProjectDesignPreparation | null>;
  readPrepared: () => Promise<ProjectDesignPreparation | null>;
}): Promise<ReferenceAnalysis | null> {
  if (!analyses || !state || !preparedAnalysisMayApply(state, build)) return null;
  if (!designTokens) return reusablePreparedAnalysis(await awaitPrepared(), state, build);
  if (projectTokens && designTokens === projectTokens) {
    return reusablePreparedAnalysis(await readPrepared(), state, { ...build, projectTokens });
  }
  return null;
}

export async function readProjectDesignPreparation(admin: PlanningStore, projectId: string, ownerId: string,
  key: string): Promise<ProjectDesignPreparation | null> {
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
