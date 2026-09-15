import { z } from "zod";
import { journeyCoverageSchema } from "./flow-review";
import { normalizePlanningInput } from "./reference-context";
import { decisionProvenanceSchema, evidenceAssessmentSchema, evidenceAllowsProposal } from "./evidence";
import { designRequirementsKey } from "./design-requirements";
import { experienceSchema } from "./experience";
import { functionalItemSchema, validateFunctionalPlan } from "./functional-plan";

const text = z.string().trim().min(1).max(2400);
const id = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);
export const productSectionSchema = z.enum([
  "identity", "actors", "jobs", "capabilities", "entities", "journeys",
  "surfaces", "constraints", "decisions", "questions", "preferences", "roadmap", "content",
]);
export const productFactSchema = z.object({
  id,
  section: productSectionSchema,
  label: z.string().trim().min(1).max(120),
  detail: text,
  source: z.enum(["user", "assumption"]),
  provenance: decisionProvenanceSchema.optional(),
  evidence: z.string().trim().max(1000).default(""),
  links: z.array(id).max(30).default([]),
  blocking: z.boolean().default(false),
  status: z.enum(["active", "superseded"]).default("active"),
  supersededBy: id.nullable().default(null),
  messageId: z.string().uuid().nullable().default(null),
});
export type ProductFact = z.infer<typeof productFactSchema>;
export const designScopeSchema = z.object({
  outputPolicy: z.literal("manual_states_v1").optional(),
  goal: text,
  surfaceIds: z.array(id).min(1).max(500),
  outputKeys: z.array(z.string()).max(500).optional(),
  manifest: z.array(functionalItemSchema).max(500).optional(),
  existingOutputs: z.array(z.object({ item: functionalItemSchema, screenId: z.string().uuid() })).max(500).optional(),
  boundaries: z.array(z.object({ key: z.string(), name: z.string(), outcome: z.string() })).max(500).optional(),
  journeyCoverage: z.array(journeyCoverageSchema).max(100).optional(),
  requestedScope: z.enum(["whole_product", "focused"]).optional(),
  scopeEvidence: z.string().max(1500).optional(),
  reviewedContentRevision: z.number().int().nonnegative().optional(),
  rationale: text,
  status: z.enum(["draft", "proposed", "approved"]),
  approvedRevision: z.number().int().nullable().default(null),
  generationRunId: z.string().uuid().nullable().default(null),
});
export const productPlanningSchema = z.object({
  version: z.literal(1),
  designerVersion: z.literal(2).optional(),
  contentRevision: z.number().int().nonnegative().optional(),
  evidenceAssessment: evidenceAssessmentSchema.nullable().optional(),
  resolvedDecisionKeys: z.array(z.string().max(100)).max(500).optional(),
  experience: experienceSchema.nullable().optional(),
  revision: z.number().int().nonnegative(),
  phase: z.enum(["discovery", "canvas"]),
  blueprint: z.object({ facts: z.array(productFactSchema).max(500) }),
  scope: designScopeSchema.nullable(),
  initialTurnComplete: z.boolean(),
  input: z.object({
    originalRequest: z.string().max(30000).optional(),
    recreationRequest: z.string().max(10000).optional(),
    recreationChanges: z.array(z.object({ messageId: z.string().uuid(), request: z.string().max(10000) })).max(100).optional(),
    referencePreference: z.object({
      mode: z.enum(["auto", "none"]),
      evidence: z.string().min(1).max(1000),
      messageId: z.string().uuid(),
    }).optional(),
    imagePath: z.string().nullable(),
    referenceSource: z.enum(["none", "user", "curated"]).optional(),
    imageReferenceMode: z.enum(["style", "recreate"]),
    stylePresetSlug: z.string().nullable(),
  }),
  lease: z.object({ id: z.string(), expiresAt: z.string() }).nullable().default(null),
});
export type ProductPlanning = z.infer<typeof productPlanningSchema>;

export function readProductPlanning(value: unknown): ProductPlanning | null {
  if (value == null) return null;
  // Fail closed for malformed planning state instead of routing unfinished projects as canvas edits.
  return productPlanningSchema.parse(value);
}

export function createProductPlanning(input: ProductPlanning["input"]): ProductPlanning {
  return { version: 1, designerVersion: 2, evidenceAssessment: null, revision: 0, phase: "discovery", blueprint: { facts: [] }, scope: null, initialTurnComplete: false, input: normalizePlanningInput({ input }), lease: null };
}

export const productOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("put_fact"), fact: productFactSchema.omit({ status: true, supersededBy: true, messageId: true }) }),
  z.object({ op: z.literal("supersede_fact"), id, replacement: productFactSchema.omit({ status: true, supersededBy: true, messageId: true }).nullable() }),
  z.object({ op: z.literal("set_scope"), goal: text, surfaceIds: z.array(id).min(1).max(500), rationale: text,
    outputKeys: z.array(z.string()).max(500).optional() }),
  z.object({ op: z.literal("set_reference_preference"), mode: z.enum(["auto", "none"]), evidence: z.string().min(1).max(1000) }),
]);
export const productPatchSchema = z.object({ operations: z.array(productOperationSchema).min(1).max(40) });

export const activeFacts = (state: ProductPlanning, section?: ProductFact["section"]) =>
  state.blueprint.facts.filter((fact) => fact.status === "active" && (!section || fact.section === section));

export function applyProductPatch(state: ProductPlanning, value: unknown, messageId: string): ProductPlanning {
  const { operations } = productPatchSchema.parse(value);
  const next = structuredClone(state);
  next.contentRevision = (state.contentRevision ?? 0) + 1;
  for (const operation of operations) {
    if (operation.op === "set_reference_preference") {
      next.input = {
        ...next.input,
        referencePreference: {
          mode: operation.mode,
          evidence: operation.evidence,
          messageId,
        },
        ...(operation.mode === "none" ? { imagePath: null, referenceSource: "none" as const, imageReferenceMode: "style" as const, stylePresetSlug: null } : {}),
      };
      next.experience = null;
      continue;
    }
    if (operation.op === "set_scope") {
      next.scope = { ...operation, surfaceIds: [...new Set(operation.surfaceIds)], status: "draft", approvedRevision: null, generationRunId: null };
      continue;
    }
    if (operation.op === "supersede_fact") {
      const previous = next.blueprint.facts.find((fact) => fact.id === operation.id && fact.status === "active");
      if (!previous) throw new Error(`Active fact ${operation.id} does not exist.`);
      previous.status = "superseded";
      previous.supersededBy = operation.replacement?.id ?? null;
      for (const linked of activeFacts(next)) {
        linked.links = linked.links.flatMap((link) => link !== previous.id ? [link] : operation.replacement ? [operation.replacement.id] : []);
      }
      if (next.scope?.surfaceIds.includes(previous.id)) {
        const surfaceIds = next.scope.surfaceIds.flatMap((surfaceId) => surfaceId !== previous.id ? [surfaceId] : operation.replacement ? [operation.replacement.id] : []);
        next.scope = surfaceIds.length ? { ...next.scope, surfaceIds } : null;
      }
    }
    const fact = operation.op === "put_fact" ? operation.fact : operation.replacement;
    if (!fact) continue;
    if (next.blueprint.facts.some((existing) => existing.id === fact.id)) {
      throw new Error(`Fact ${fact.id} already exists. Supersede it with a new ID to preserve decision history.`);
    }
    if (fact.source === "user" && !fact.evidence.trim()) throw new Error("User-confirmed facts need evidence from the conversation.");
    next.blueprint.facts.push({ ...fact, status: "active", supersededBy: null, messageId });
  }
  const ids = new Set(activeFacts(next).map((fact) => fact.id));
  for (const fact of activeFacts(next)) {
    if (fact.links.some((link) => !ids.has(link))) throw new Error(`Update links on ${fact.id} when superseding linked facts.`);
  }
  if (next.scope) {
    const surfaces = new Set(activeFacts(next, "surfaces").map((fact) => fact.id));
    if (next.scope.surfaceIds.some((surfaceId) => !surfaces.has(surfaceId))) throw new Error("Scope must reference active product surfaces. Update the scope in the same patch when removing a surface.");
    next.scope.journeyCoverage = undefined;
    next.scope.requestedScope = undefined;
    next.scope.scopeEvidence = undefined;
    next.scope.status = "draft";
    next.scope.approvedRevision = null;
    next.scope.generationRunId = null;
  }
  // Keep source provenance for re-selection, but never approve stale visual evidence.
  if (designRequirementsKey(state) !== designRequirementsKey(next) && next.experience) {
    next.experience = { ...next.experience, requirementsKey: state.experience?.requirementsKey ?? designRequirementsKey(state) };
  }
  return productPlanningSchema.parse(next);
}

export function readinessIssues(state: ProductPlanning): string[] {
  const issues: string[] = [];
  const recreation = Boolean(state.input.imagePath && state.input.imageReferenceMode === "recreate");
  if (recreation && state.designerVersion === 2 && state.scope?.manifest?.length) {
    const frames = state.scope.manifest.map(item => item.referenceScreenIndex);
    if (frames.some(index => index == null) || new Set(frames).size !== frames.length) issues.push("Map each requested recreation screen to its distinct source frame before proposing.");
  }
  for (const section of recreation ? ["identity"] as const : ["identity", "actors", "jobs", "journeys"] as const) {
    if (!activeFacts(state, section).length) issues.push(`Clarify the product's ${section}.`);
  }
  issues.push(...activeFacts(state, "questions").filter((fact) => fact.blocking).map((fact) => fact.detail));
  if (!state.scope) issues.push("Choose what to design first.");
  else {
    const surfaces = new Set(activeFacts(state, "surfaces").map((fact) => fact.id));
    if (state.scope.surfaceIds.some((surfaceId) => !surfaces.has(surfaceId))) issues.push("The scope contains a removed surface.");
  }
  return issues;
}

export function assertExperienceReady(state: ProductPlanning) {
  const experience = state.experience;
  if (!experience) throw new Error("Establish an experience direction before proposing designs.");
  if (!state.input.imagePath && state.input.referencePreference?.mode !== "none") throw new Error("Inspect visual evidence or record the explicit no-reference choice before approval.");
  if (experience.referencePath !== state.input.imagePath) throw new Error("Reference changed. Inspect the current evidence before approval.");
  if (state.input.imageReferenceMode === "recreate" && state.input.imagePath) return;
  const key = designRequirementsKey(state);
  if ((experience.requirementsKey !== undefined && experience.requirementsKey !== key)
    || (experience.requirementsKey === undefined && key !== "[]")) {
    throw new Error("Design requirements changed. Reinspect the reference against the current requirements.");
  }
  if (experience.compatibility?.compatible === false
    || (experience.requirementsKey !== undefined && !experience.compatibility)) {
    throw new Error("The visual direction has not passed compatibility review. Choose compatible evidence or explicitly continue without references.");
  }
}

export function proposeProductScope(state: ProductPlanning): ProductPlanning {
  if (state.designerVersion === 2 && !evidenceAllowsProposal(state.evidenceAssessment)) throw new Error("Discuss the unresolved product or experience decisions with the user before proposing a scope.");
  if (state.designerVersion === 2) {
    assertExperienceReady(state);
    if (!state.scope?.manifest?.length) throw new Error("Map concrete screens and states on the roadmap, then select their output keys.");
    validateFunctionalPlan(state.scope.manifest, (state.scope.existingOutputs ?? []).map(output => output.item), state.scope.boundaries?.map(item => item.key));
  }
  const issues = readinessIssues(state);
  if (issues.length) throw new Error(issues.join(" "));
  return { ...state, scope: { ...state.scope!, status: "proposed", reviewedContentRevision: state.contentRevision ?? 0, approvedRevision: null, generationRunId: null } };
}

export function approveProductScope(state: ProductPlanning, revision: number): ProductPlanning {
  if (state.designerVersion === 2 && !evidenceAllowsProposal(state.evidenceAssessment)) throw new Error("Product understanding requires another conversation before approval.");
  if (state.designerVersion === 2) {
    assertExperienceReady(state);
    if (state.scope?.reviewedContentRevision !== (state.contentRevision ?? 0)) throw new Error("Product decisions changed after review.");
    const isNoRef = state.input.referencePreference?.mode === "none";
    const refPathMatch = isNoRef
      ? state.experience?.referencePath === null
      : state.experience?.referencePath === state.input.imagePath;
    if (!state.experience || !refPathMatch || !state.scope?.manifest?.length) throw new Error("Reference or functional scope changed. Review the updated plan.");
    validateFunctionalPlan(state.scope.manifest, (state.scope.existingOutputs ?? []).map(output => output.item), state.scope.boundaries?.map(item => item.key));
  }
  if (state.revision !== revision || state.scope?.status !== "proposed" || (state.lease && Date.parse(state.lease.expiresAt) > Date.now())) {
    throw new Error("This plan changed or is already being processed. Review the current scope before approving.");
  }
  const issues = readinessIssues(state);
  if (issues.length) throw new Error(issues.join(" "));
  return { ...state, scope: { ...state.scope!, status: "approved", approvedRevision: revision } };
}
