import { z } from "zod";

const text = z.string().trim().min(1).max(2400);
const id = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);
export const productSectionSchema = z.enum([
  "identity", "actors", "jobs", "capabilities", "entities", "journeys",
  "surfaces", "constraints", "decisions", "questions", "preferences", "roadmap",
]);
export const productFactSchema = z.object({
  id,
  section: productSectionSchema,
  label: z.string().trim().min(1).max(120),
  detail: text,
  source: z.enum(["user", "assumption"]),
  evidence: z.string().trim().max(1000).default(""),
  links: z.array(id).max(30).default([]),
  blocking: z.boolean().default(false),
  status: z.enum(["active", "superseded"]).default("active"),
  supersededBy: id.nullable().default(null),
  messageId: z.string().uuid().nullable().default(null),
});
export type ProductFact = z.infer<typeof productFactSchema>;
export const designScopeSchema = z.object({
  goal: text,
  surfaceIds: z.array(id).min(1).max(24),
  rationale: text,
  status: z.enum(["draft", "proposed", "approved"]),
  approvedRevision: z.number().int().nullable().default(null),
  generationRunId: z.string().uuid().nullable().default(null),
});
export const productPlanningSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  phase: z.enum(["discovery", "canvas"]),
  blueprint: z.object({ facts: z.array(productFactSchema).max(500) }),
  scope: designScopeSchema.nullable(),
  initialTurnComplete: z.boolean(),
  input: z.object({
    imagePath: z.string().nullable(),
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
  return { version: 1, revision: 0, phase: "discovery", blueprint: { facts: [] }, scope: null, initialTurnComplete: false, input, lease: null };
}

export const productOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("put_fact"), fact: productFactSchema.omit({ status: true, supersededBy: true, messageId: true }) }),
  z.object({ op: z.literal("supersede_fact"), id, replacement: productFactSchema.omit({ status: true, supersededBy: true, messageId: true }).nullable() }),
  z.object({ op: z.literal("set_scope"), goal: text, surfaceIds: z.array(id).min(1).max(24), rationale: text }),
]);
export const productPatchSchema = z.object({ operations: z.array(productOperationSchema).min(1).max(40) });

export const activeFacts = (state: ProductPlanning, section?: ProductFact["section"]) =>
  state.blueprint.facts.filter((fact) => fact.status === "active" && (!section || fact.section === section));

export function applyProductPatch(state: ProductPlanning, value: unknown, messageId: string): ProductPlanning {
  const { operations } = productPatchSchema.parse(value);
  const next = structuredClone(state);
  for (const operation of operations) {
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
    next.scope.status = "draft";
    next.scope.approvedRevision = null;
    next.scope.generationRunId = null;
  }
  return productPlanningSchema.parse(next);
}

export function readinessIssues(state: ProductPlanning): string[] {
  const issues: string[] = [];
  const recreation = Boolean(state.input.imagePath && state.input.imageReferenceMode === "recreate");
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

export function proposeProductScope(state: ProductPlanning): ProductPlanning {
  const issues = readinessIssues(state);
  if (issues.length) throw new Error(issues.join(" "));
  return { ...state, scope: { ...state.scope!, status: "proposed", approvedRevision: null, generationRunId: null } };
}

export function approveProductScope(state: ProductPlanning, revision: number): ProductPlanning {
  if (state.revision !== revision || state.scope?.status !== "proposed" || (state.lease && Date.parse(state.lease.expiresAt) > Date.now())) {
    throw new Error("This plan changed or is already being processed. Review the current scope before approving.");
  }
  const issues = readinessIssues(state);
  if (issues.length) throw new Error(issues.join(" "));
  return { ...state, scope: { ...state.scope!, status: "approved", approvedRevision: revision } };
}
