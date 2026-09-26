import { createHash } from "node:crypto";
import { z } from "zod";
import { functionalItemSchema, validateFunctionalPlan, type FunctionalItem } from "./functional-plan";
import { activeFacts, productSectionSchema, type ProductPlanning } from "./model";
import { outputRendering } from "./output-policy";

const ref = z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/);
const fact = z.object({
  ref, supersedesId: ref.nullish(), section: productSectionSchema,
  label: z.string().trim().min(1).max(120), detail: z.string().trim().min(1).max(2400),
  source: z.enum(["user", "assumption"]), evidence: z.string().max(1000).default(""),
  links: z.array(ref).max(30).default([]), blocking: z.boolean().default(false),
});
const output = z.object({
  ref, existingKey: z.string().nullish(), name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(5000),
  surfaceRefs: z.array(ref).min(1).max(30), journeyRefs: z.array(ref).min(1).max(30),
  decisionRefs: z.array(ref).max(40).default([]), dependencyRefs: z.array(z.string()).max(50).default([]),
  actions: z.array(z.object({ label: z.string().trim().min(1).max(200), destinationRef: z.string().nullable(),
    outcome: z.string().trim().min(1).max(5000) })).max(30),
  information: z.string().trim().min(1).max(5000), entryCondition: z.string().trim().min(1).max(5000),
  outcome: z.string().trim().min(1).max(5000), inlineStates: z.array(z.string().trim().min(1).max(1000)).max(30).default([]),
  sequence: z.number().int().nonnegative().optional(),
});

/** Model-owned meaning, server-owned identities and persistence. */
export const designFlowCandidateSchema = z.object({
  facts: z.array(fact).max(40), removeFactIds: z.array(ref).max(40).default([]),
  outputs: z.array(output).max(40), removeOutputKeys: z.array(z.string()).max(40).default([]),
  scope: z.object({ goal: z.string().trim().min(1).max(2400), rationale: z.string().trim().min(1).max(2400),
    outputRefs: z.array(z.string()).min(1).max(40), surfaceRefs: z.array(ref).min(1).max(40) }),
});
export type DesignFlowCandidate = z.infer<typeof designFlowCandidateSchema>;

const stableId = (prefix: string, projectId: string, turnId: string, alias: string) =>
  `${prefix}${createHash("sha256").update(`${projectId}:${turnId}:${alias}`).digest("hex").slice(0, 20)}`;
const sameMeaning = (a: { section: string; label: string; detail: string; source: string }, b: { section: string; label: string; detail: string; source: string }) =>
  a.section === b.section && a.label.trim().toLowerCase() === b.label.trim().toLowerCase()
    && a.detail.trim().toLowerCase() === b.detail.trim().toLowerCase() && a.source === b.source;

export function candidateFactPatch(candidate: DesignFlowCandidate, state: ProductPlanning, projectId: string, turnId: string) {
  const aliases = new Map<string, string>();
  const active = activeFacts(state);
  for (const item of candidate.facts) {
    if (aliases.has(item.ref)) throw new Error(`Fact alias ${item.ref} is repeated.`);
    const equal = active.find(existing => sameMeaning(existing, item));
    const sameLabel = active.find(existing => existing.section === item.section
      && existing.label.trim().toLowerCase() === item.label.trim().toLowerCase());
    if (sameLabel && !equal && item.supersedesId !== sameLabel.id) {
      throw new Error(`Changed fact ${item.label} must explicitly supersede ${sameLabel.id}.`);
    }
    if (item.supersedesId && !active.some(existing => existing.id === item.supersedesId)) {
      throw new Error(`Fact ${item.ref} supersedes inactive or missing ${item.supersedesId}.`);
    }
    if (equal && item.supersedesId && equal.id !== item.supersedesId) {
      throw new Error(`Fact ${item.ref} repeats ${equal.id} while superseding a different fact.`);
    }
    aliases.set(item.ref, equal && !item.supersedesId ? equal.id : stableId("f_", projectId, turnId, item.ref));
  }
  const resolve = (value: string) => aliases.get(value) ?? (active.some(item => item.id === value) ? value : null);
  const facts = candidate.facts.flatMap(item => {
    const id = aliases.get(item.ref)!;
    if (active.some(existing => existing.id === id)) return [];
    const links = item.links.map(link => {
      const id = resolve(link);
      if (!id) throw new Error(`Fact ${item.ref} links to unknown ${link}.`);
      return id;
    });
    return [{ id, section: item.section, label: item.label, detail: item.detail, source: item.source,
      evidence: item.evidence, links, blocking: item.blocking,
      provenance: { basis: item.source === "user" ? "direct" : "inferred", recommendationMessageId: null } }];
  });
  const supersessions = candidate.facts.flatMap(item => item.supersedesId && aliases.get(item.ref) !== item.supersedesId
    ? [{ id: item.supersedesId, replacement: facts.find(entry => entry.id === aliases.get(item.ref)) }]
    : []);
  for (const id of candidate.removeFactIds) {
    if (!active.some(item => item.id === id)) throw new Error(`Cannot remove inactive or missing fact ${id}.`);
    supersessions.push({ id, replacement: undefined });
  }
  const superseded = new Map(candidate.facts.flatMap(item => item.supersedesId
    ? [[item.supersedesId, aliases.get(item.ref)!] as const] : []));
  return { args: { facts: facts.filter(item => !supersessions.some(change => change.replacement?.id === item.id)),
    supersessions: supersessions.map(change => ({ id: change.id, replacement: change.replacement ?? null })) },
    aliases, superseded };
}

export function candidateRoadmap(candidate: DesignFlowCandidate, state: ProductPlanning,
  current: Array<{ item: FunctionalItem; status: string; screenId: string | null }>,
  factAliases: Map<string, string>, superseded: Map<string, string>, projectId: string, turnId: string) {
  const aliases = new Map<string, string>();
  const currentByKey = new Map(current.map(row => [row.item.stableKey, row]));
  for (const item of candidate.outputs) {
    if (aliases.has(item.ref)) throw new Error(`Screen alias ${item.ref} is repeated.`);
    if (item.existingKey && !currentByKey.has(item.existingKey)) throw new Error(`Screen ${item.existingKey} is missing.`);
    if (item.existingKey && currentByKey.get(item.existingKey)?.status !== "planned") {
      throw new Error(`Screen ${item.existingKey} is already being built or accepted. Create a new screen identity.`);
    }
    aliases.set(item.ref, item.existingKey ?? stableId("screen:", projectId, turnId, item.ref));
  }
  const resolveOutput = (value: string) => aliases.get(value) ?? (currentByKey.has(value) ? value : null);
  const active = new Map(activeFacts(state).map(item => [item.id, item]));
  const resolveFact = (value: string, section: "surfaces" | "journeys" | "decisions") => {
    const id = factAliases.get(value) ?? superseded.get(value) ?? value;
    if (active.get(id)?.section !== section) throw new Error(`${value} is not an active ${section} fact.`);
    return id;
  };
  const replacements = candidate.outputs.map((item, index) => functionalItemSchema.parse({
    stableKey: aliases.get(item.ref), kind: "screen", name: item.name, description: item.description,
    parentStableKey: null, surfaceIds: item.surfaceRefs.map(value => resolveFact(value, "surfaces")),
    journeyIds: item.journeyRefs.map(value => resolveFact(value, "journeys")),
    decisionIds: item.decisionRefs.map(value => resolveFact(value, "decisions")),
    dependencyKeys: item.dependencyRefs.map(value => {
      const key = resolveOutput(value); if (!key) throw new Error(`${item.ref} has missing dependency ${value}.`); return key;
    }),
    actions: item.actions.map(action => ({ label: action.label, outcome: action.outcome,
      destinationKey: action.destinationRef === null ? null : resolveOutput(action.destinationRef) ?? action.destinationRef })),
    information: item.information, entryCondition: item.entryCondition, outcome: item.outcome,
    inlineStates: item.inlineStates, sequence: item.sequence ?? currentByKey.get(item.existingKey ?? "")?.item.sequence ?? index,
    referenceScreenIndex: null, rendering: "product_screen",
  }));
  const removeKeys = new Set(candidate.removeOutputKeys);
  for (const key of removeKeys) {
    if (currentByKey.get(key)?.status !== "planned") throw new Error(`Cannot remove built or missing screen ${key}.`);
  }
  const updated = new Map(replacements.map(item => [item.stableKey, item]));
  for (const item of replacements) {
    const collision = current.find(row => row.item.kind === "screen"
      && row.item.stableKey !== item.stableKey && !removeKeys.has(row.item.stableKey)
      && row.item.name.trim().toLowerCase() === item.name.trim().toLowerCase());
    if (collision) throw new Error(`Screen ${item.name} already exists as ${collision.item.stableKey}. Edit it by existingKey or choose a distinct screen.`);
  }
  const roadmap = current.filter(row => !removeKeys.has(row.item.stableKey)).map(row => {
    const replacement = updated.get(row.item.stableKey);
    if (replacement) return { ...row, item: replacement };
    if (row.status !== "planned") return row;
    const item = structuredClone(row.item);
    const remap = (ids: string[], section: "surfaces" | "journeys" | "decisions") => ids.map(id => resolveFact(id, section));
    item.surfaceIds = remap(item.surfaceIds, "surfaces");
    item.journeyIds = remap(item.journeyIds, "journeys");
    item.decisionIds = remap(item.decisionIds, "decisions");
    return { ...row, item };
  });
  for (const item of replacements) if (!currentByKey.has(item.stableKey)) roadmap.push({ item, status: "planned", screenId: null });
  const selectedKeys = candidate.scope.outputRefs.map(value => {
    const key = resolveOutput(value); if (!key || removeKeys.has(key)) throw new Error(`Scope references missing screen ${value}.`); return key;
  });
  const existingOutputs = roadmap.filter(row => row.status === "ready" && row.screenId)
    .map(row => ({ item: row.item, screenId: row.screenId! }));
  const selected = selectedKeys.map(key => {
    const row = roadmap.find(row => row.item.stableKey === key);
    if (!row || row.status !== "planned") throw new Error(`Scope output ${key} is not an unbuilt screen.`);
    return row.item;
  });
  const included = new Set([...selectedKeys, ...existingOutputs.map(row => row.item.stableKey)]);
  const destinations = new Set(selected.flatMap(item => item.actions.flatMap(action =>
    action.destinationKey && !included.has(action.destinationKey) ? [action.destinationKey] : [])));
  const boundaries = roadmap.filter(row => destinations.has(row.item.stableKey))
    .map(row => ({ key: row.item.stableKey, name: row.item.name, outcome: row.item.outcome }));
  validateFunctionalPlan(selected, existingOutputs.map(row => row.item), boundaries.map(item => item.key));
  const surfaceIds = candidate.scope.surfaceRefs.map(value => resolveFact(value, "surfaces"));
  if (selected.some(item => item.surfaceIds.some(id => !surfaceIds.includes(id)))) {
    throw new Error("Scope must include the surface facts used by every selected screen.");
  }
  const itemsToSave = roadmap.filter(row => row.status === "planned" &&
    JSON.stringify(row.item) !== JSON.stringify(currentByKey.get(row.item.stableKey)?.item)).map(row => row.item);
  return { roadmap: roadmap.map(row => row.item), itemsToSave, removeKeys: [...removeKeys],
    scope: { outputPolicy: "manual_states_v1" as const, goal: candidate.scope.goal,
      rationale: candidate.scope.rationale, surfaceIds, outputKeys: selectedKeys,
      manifest: selected.map(item => ({ ...item, rendering: outputRendering(item, false) })),
      existingOutputs, boundaries, status: "draft" as const, approvedRevision: null, generationRunId: null } };
}
