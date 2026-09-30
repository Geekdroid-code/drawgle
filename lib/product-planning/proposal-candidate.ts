import { createHash } from "node:crypto";
import { z } from "zod";
import { functionalItemSchema, validateFunctionalPlan, type FunctionalItem } from "./functional-plan";
import { MAX_SCOPE_NAVIGATION_DESTINATIONS, activeFacts, productPatchSchema, productSectionSchema,
  type ProductFact, type ProductPlanning, type ScopeNavigation } from "./model";
import { outputRendering } from "./output-policy";
import { quotedByUser, userFactWording } from "./designer-patch";

const ref = z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/);
const factId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);
const fact = z.object({
  ref, supersedesId: factId.nullish(), section: productSectionSchema,
  label: z.string().trim().min(1).max(120), detail: z.string().trim().min(1).max(2400),
  source: z.enum(["user", "assumption"]), evidence: z.string().max(1000).default(""),
  links: z.array(z.string()).max(30).default([]), blocking: z.boolean().default(false),
});
const output = z.object({
  ref, existingKey: z.string().nullish(), name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(5000),
  surfaceRefs: z.array(z.string()).max(30).default([]), journeyRefs: z.array(z.string()).max(30).default([]),
  decisionRefs: z.array(z.string()).max(40).default([]), dependencyRefs: z.array(z.string()).max(50).default([]),
  actions: z.array(z.object({ label: z.string().trim().min(1).max(200), destinationRef: z.string().nullable(),
    outcome: z.string().trim().min(1).max(5000) })).max(30),
  information: z.string().trim().min(1).max(5000), entryCondition: z.string().trim().min(1).max(5000),
  outcome: z.string().trim().min(1).max(5000), inlineStates: z.array(z.string().trim().min(1).max(1000)).max(30).default([]),
  sequence: z.number().int().nonnegative().optional(),
});

const navigation = z.object({
  persistent: z.boolean(),
  destinations: z.array(z.object({ label: z.string().trim().min(1).max(40), outputRef: z.string().nullable() }))
    .max(MAX_SCOPE_NAVIGATION_DESTINATIONS),
  rationale: z.string().trim().max(600),
});

/** Model-owned meaning, server-owned identities and persistence. */
export const designFlowCandidateSchema = z.object({
  facts: z.array(fact).max(40), removeFactIds: z.array(z.string()).max(40).default([]),
  outputs: z.array(output).max(40), removeOutputKeys: z.array(z.string()).max(40).default([]),
  scope: z.object({ goal: z.string().trim().min(1).max(2400), rationale: z.string().trim().min(1).max(2400),
    outputRefs: z.array(z.string()).max(40), surfaceRefs: z.array(z.string()).max(40).default([]) }),
  // Absent when the response did not decide it; the plan then keeps no decision rather than an invented one.
  navigation: navigation.optional(),
});
export type DesignFlowCandidate = z.infer<typeof designFlowCandidateSchema>;

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown) => Array.isArray(value) ? value : [];
const clip = (value: unknown, max: number) => typeof value === "string" ? value.replace(/[ \t]+/g, " ").trim().slice(0, max).trim() : "";
const strings = (value: unknown, max: number, length = 200) => [...new Set(list(value).map(item => clip(item, length)).filter(Boolean))].slice(0, max);
const nameKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const normalizeRef = (value: unknown) => {
  const slug = (typeof value === "string" ? value : "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^[^a-z]+/, "").replace(/-+$/, "").slice(0, 80);
  return slug || "";
};
const uniqueRef = (value: string, used: Set<string>, fallback: string) => {
  const base = (normalizeRef(value) || normalizeRef(fallback) || "item").slice(0, 72);
  let candidate = base;
  for (let suffix = 2; used.has(candidate); suffix += 1) candidate = `${base}-${suffix}`;
  used.add(candidate);
  return candidate;
};

const GENERIC_DESTINATION_LABEL = /^(?:tab|item|menu|page|section|destination)(?:\s*\d+)?$/i;

/**
 * The response's navigation decision as a shape the plan can hold. A bar needs at
 * least two distinct, named destinations; fewer is no bar. A response that does
 * not decide it at all leaves the plan undecided (undefined), never invented.
 */
function normalizeCandidateNavigation(value: unknown, outputRef: (value: string) => string): DesignFlowCandidate["navigation"] {
  const raw = record(value);
  if (typeof raw.persistent !== "boolean") return undefined;
  const seen = new Set<string>();
  const destinations = list(raw.destinations).flatMap(entry => {
    const item = record(entry);
    const label = clip(item.label, 40);
    if (!label || GENERIC_DESTINATION_LABEL.test(label) || seen.has(nameKey(label))) return [];
    seen.add(nameKey(label));
    const target = clip(item.outputRef, 200);
    return [{ label, outputRef: target ? outputRef(target) : null }];
  }).slice(0, MAX_SCOPE_NAVIGATION_DESTINATIONS);
  const persistent = raw.persistent && destinations.length >= 2;
  return { persistent, destinations: persistent ? destinations : [],
    rationale: clip(raw.rationale, 600) || (persistent
      ? "People move between these areas of the product."
      : "The product is not organised as peer areas, so no persistent navigation is drawn.") };
}

/**
 * Resolve the navigation's screen refs to roadmap keys. A destination keeps a key
 * only when that screen is part of this flow (selected now or already built) and
 * no earlier destination has it; every other destination is planned, without a screen.
 */
function scopeNavigation(navigation: DesignFlowCandidate["navigation"], resolve: (ref: string) => string | null,
  inFlow: Set<string>): ScopeNavigation | undefined {
  if (!navigation) return undefined;
  const claimed = new Set<string>();
  return { persistent: navigation.persistent, rationale: navigation.rationale,
    destinations: navigation.destinations.map(destination => {
      const key = destination.outputRef ? resolve(destination.outputRef) : null;
      const screenKey = key && inFlow.has(key) && !claimed.has(key) ? key : null;
      if (screenKey) claimed.add(screenKey);
      return { label: destination.label, screenKey };
    }) };
}

/**
 * Read a proposal response leniently. Refs, lengths, missing optional fields and
 * duplicate names are normalized so a sensible plan is always representable.
 * Returns null only when the response contains no screens and selects nothing.
 */
export function normalizeDesignFlowCandidate(value: unknown): DesignFlowCandidate | null {
  const raw = record(value);
  const factRefs = new Set<string>();
  const factRefMap = new Map<string, string>();
  // Accept both a flat fact list and the retired grouped shape.
  const groupedFacts = record(raw.facts);
  const factEntries = Array.isArray(raw.facts) ? raw.facts
    : [...["identity", "actors", "jobs", "journeys"].flatMap(section => list(groupedFacts[section]).map(item => ({ ...record(item), section }))),
      ...list(groupedFacts.other)];
  const facts = factEntries.flatMap(entry => {
    const item = record(entry);
    const section = productSectionSchema.safeParse(item.section);
    const label = clip(item.label, 120) || clip(item.detail, 120);
    const detail = clip(item.detail, 2400) || label;
    if (!section.success || !label) return [];
    const rawRef = clip(item.ref, 200) || label;
    const normalized = uniqueRef(rawRef, factRefs, label);
    if (!factRefMap.has(rawRef)) factRefMap.set(rawRef, normalized);
    const supersedesId = clip(item.supersedesId, 200);
    return [{ ref: normalized, supersedesId: factId.safeParse(supersedesId).success ? supersedesId : null,
      section: section.data, label, detail, source: item.source === "user" ? "user" as const : "assumption" as const,
      evidence: clip(item.evidence, 1000), links: strings(item.links, 30), blocking: false }];
  }).slice(0, 30);
  const factRef = (value: string) => factRefMap.get(value) ?? (factRefs.has(normalizeRef(value)) ? normalizeRef(value) : value);
  for (const item of facts) item.links = item.links.map(factRef);

  const outputRefs = new Set<string>();
  const outputRefMap = new Map<string, string>();
  const names = new Set<string>();
  const outputs = list(raw.outputs).flatMap((entry, index) => {
    const item = record(entry);
    let name = clip(item.name, 100);
    if (!name) return [];
    for (let suffix = 2; names.has(nameKey(name)); suffix += 1) name = `${clip(item.name, 96)} ${suffix}`;
    names.add(nameKey(name));
    const rawRef = clip(item.ref, 200) || name;
    const normalized = uniqueRef(rawRef, outputRefs, name);
    if (!outputRefMap.has(rawRef)) outputRefMap.set(rawRef, normalized);
    const description = clip(item.description, 5000) || clip(item.information, 5000) || clip(item.outcome, 5000) || name;
    const sequence = typeof item.sequence === "number" && Number.isInteger(item.sequence) && item.sequence >= 0 ? item.sequence : undefined;
    return [{ ref: normalized, existingKey: clip(item.existingKey, 120) || null, name, description,
      surfaceRefs: strings(item.surfaceRefs, 30), journeyRefs: strings(item.journeyRefs, 30),
      decisionRefs: strings(item.decisionRefs, 40), dependencyRefs: strings(item.dependencyRefs, 50),
      actions: list(item.actions).flatMap(actionEntry => {
        const action = record(actionEntry);
        const label = clip(action.label, 200);
        if (!label) return [];
        const destination = clip(action.destinationRef, 200);
        return [{ label, destinationRef: destination || null, outcome: clip(action.outcome, 5000) || label }];
      }).slice(0, 30),
      information: clip(item.information, 5000) || description,
      entryCondition: clip(item.entryCondition, 5000) || (index === 0 ? "Opens when the person starts the app." : "Opened from another screen in this flow."),
      outcome: clip(item.outcome, 5000) || description,
      inlineStates: strings(item.inlineStates, 30, 1000),
      ...(sequence === undefined ? {} : { sequence }) }];
  }).slice(0, 40);
  // Remap raw destination/dependency refs to the normalized refs they named.
  const outputRef = (value: string) => outputRefMap.get(value) ?? (outputRefs.has(normalizeRef(value)) ? normalizeRef(value) : value);
  for (const item of outputs) {
    item.actions = item.actions.map(action => ({ ...action,
      destinationRef: action.destinationRef ? outputRef(action.destinationRef) : null }));
    item.dependencyRefs = item.dependencyRefs.map(outputRef);
    item.surfaceRefs = item.surfaceRefs.map(factRef);
    item.journeyRefs = item.journeyRefs.map(factRef);
    item.decisionRefs = item.decisionRefs.map(factRef);
  }
  const scope = record(raw.scope);
  const selected = strings(scope.outputRefs, 40).map(outputRef);
  if (!outputs.length && !selected.length) return null;
  const goal = clip(scope.goal, 2400) || "Design the requested app screens.";
  return designFlowCandidateSchema.parse({
    facts, removeFactIds: strings(raw.removeFactIds, 10), outputs,
    removeOutputKeys: strings(raw.removeOutputKeys, 40),
    scope: { goal, rationale: clip(scope.rationale, 2400) || goal, outputRefs: selected,
      surfaceRefs: strings(scope.surfaceRefs, 40).map(factRef) },
    navigation: normalizeCandidateNavigation(raw.navigation, outputRef),
  });
}

const headline = (text: string) => {
  const words = text.replace(/\s+/g, " ").trim().split(" ").slice(0, 10).join(" ");
  return (words.length > 110 ? `${words.slice(0, 110).trim()}…` : words) || "The app";
};

/**
 * Every screen belongs to a product surface and a journey, and the product has
 * an identity. When the model omitted one of these, derive it from the request
 * and the plan as a labelled assumption, so the saved plan is complete by
 * construction instead of failing a later check.
 */
export function ensureStructuralFacts(candidate: DesignFlowCandidate, state: ProductPlanning, originalRequest: string): DesignFlowCandidate {
  const has = (section: ProductFact["section"]) => activeFacts(state, section).length > 0
    || candidate.facts.some(item => item.section === section);
  const used = new Set(candidate.facts.map(item => item.ref));
  const extra: DesignFlowCandidate["facts"] = [];
  const add = (section: ProductFact["section"], label: string, detail: string) => extra.push({
    ref: uniqueRef(`derived-${section}`, used, section), supersedesId: null, section, label: label.slice(0, 120),
    detail: detail.slice(0, 2400) || label, source: "assumption", evidence: "", links: [], blocking: false });
  const request = originalRequest.replace(/\s+/g, " ").trim();
  if (!has("identity") && request) add("identity", headline(request), request);
  if (!has("surfaces")) add("surfaces", "App", "The user-facing app screens in this plan.");
  if (!has("journeys")) add("journeys", "Main flow", candidate.scope.goal);
  return extra.length ? { ...candidate, facts: [...candidate.facts, ...extra] } : candidate;
}

const stableId = (prefix: string, projectId: string, turnId: string, alias: string) =>
  `${prefix}${createHash("sha256").update(`${projectId}:${turnId}:${alias}`).digest("hex").slice(0, 20)}`;
const sameMeaning = (a: { section: string; label: string; detail: string; source: string }, b: { section: string; label: string; detail: string; source: string }) =>
  a.section === b.section && a.label.trim().toLowerCase() === b.label.trim().toLowerCase()
    && a.detail.trim().toLowerCase() === b.detail.trim().toLowerCase() && a.source === b.source;

/** Assign server identities. A restated fact reuses its saved identity; a
 * reference to an unknown or retired fact is treated as a new statement. */
export function candidateFactPatch(candidate: DesignFlowCandidate, state: ProductPlanning, projectId: string, turnId: string,
  userEvidence: string[] = []) {
  const aliases = new Map<string, string>();
  const active = activeFacts(state);
  const replacements = new Map<string, string>();
  // Canonical wording first, so identity matching compares what will be saved.
  const items = candidate.facts.map(item => item.source === "user" && quotedByUser(item.evidence, userEvidence)
    ? userFactWording(item, userEvidence) : item);
  for (const item of items) {
    const equal = active.find(existing => sameMeaning(existing, item));
    const sameLabel = active.find(existing => existing.section === item.section
      && existing.label.trim().toLowerCase() === item.label.trim().toLowerCase());
    let previous = item.supersedesId ? active.find(existing => existing.id === item.supersedesId) ?? null : null;
    if (previous && previous.section !== item.section) previous = null;
    if (previous && replacements.has(previous.id)) previous = null;
    // A repair candidate can redescribe the same saved decision after review.
    // Reuse its identity and meaning unless it explicitly and safely changes it.
    // In particular, a model assumption must never replace a user-confirmed fact.
    if (equal || (previous?.source === "user" && (item.source !== "user" || !item.evidence.trim()))
      || (!previous && sameLabel)) {
      aliases.set(item.ref, equal?.id ?? previous?.id ?? sameLabel!.id);
      continue;
    }
    const id = stableId("f_", projectId, turnId, item.ref);
    aliases.set(item.ref, id);
    if (previous) replacements.set(previous.id, id);
  }
  const resolve = (value: string) => aliases.get(value) ?? (active.some(item => item.id === value) ? value : null);
  const facts = items.flatMap(item => {
    const id = aliases.get(item.ref)!;
    if (active.some(existing => existing.id === id)) return [];
    const links = [...new Set(item.links.flatMap(link => {
      const linked = resolve(link);
      return linked && linked !== id ? [linked] : [];
    }))];
    return [{ id, section: item.section, label: item.label, detail: item.detail, source: item.source,
      evidence: item.evidence, links, blocking: false,
      provenance: { basis: item.source === "user" ? "direct" : "inferred", recommendationMessageId: null } }];
  });
  const supersessions = items.flatMap(item => item.supersedesId && replacements.get(item.supersedesId) === aliases.get(item.ref)
    ? [{ id: item.supersedesId, replacement: facts.find(entry => entry.id === aliases.get(item.ref)) }]
    : []);
  for (const id of candidate.removeFactIds) {
    const previous = active.find(item => item.id === id);
    // Removal has no evidence field. Preserve confirmed user truth until an
    // explicit replacement can be checked against the user's words.
    if (!previous || previous.source === "user" || replacements.has(id) || supersessions.some(change => change.id === id)) continue;
    supersessions.push({ id, replacement: undefined });
  }
  const superseded = replacements;
  return { args: { facts: facts.filter(item => !supersessions.some(change => change.replacement?.id === item.id)),
    supersessions: supersessions.map(change => ({ id: change.id, replacement: change.replacement ?? null })) },
    aliases, superseded };
}

/** Evidence can demote a proposed correction after IDs were assigned. Keep confirmed truth and its references intact. */
export function reconcileCandidateFactEvidence(state: ProductPlanning, patch: z.infer<typeof productPatchSchema>,
  identities: Pick<ReturnType<typeof candidateFactPatch>, "aliases" | "superseded">) {
  const active = new Map(activeFacts(state).map(fact => [fact.id, fact]));
  const redirects = new Map<string, string>();
  const retained = new Set<string>();
  const operations = patch.operations.filter(operation => {
    if (operation.op !== "supersede_fact" || active.get(operation.id)?.source !== "user") return true;
    if (operation.replacement?.source === "user" && operation.replacement.evidence.trim()) return true;
    retained.add(operation.id);
    if (operation.replacement) redirects.set(operation.replacement.id, operation.id);
    return false;
  });
  if (!retained.size) return { patch, ...identities };
  const resolve = (id: string) => {
    let current = id;
    const seen = new Set<string>();
    while (redirects.has(current) && !seen.has(current)) {
      seen.add(current);
      current = redirects.get(current)!;
    }
    return current;
  };
  const safePatch = { operations: operations.map(operation => {
    if (operation.op === "put_fact") return { ...operation, fact: { ...operation.fact,
      links: operation.fact.links.map(resolve) } };
    if (operation.op === "supersede_fact") return { ...operation, replacement: operation.replacement
      ? { ...operation.replacement, links: operation.replacement.links.map(resolve) } : null };
    if (operation.op === "set_scope") return { ...operation, surfaceIds: operation.surfaceIds.map(resolve) };
    return operation;
  }) };
  const aliases = new Map([...identities.aliases].map(([alias, id]) => [alias, resolve(id)]));
  for (const [replacementId, originalId] of redirects) aliases.set(replacementId, originalId);
  const superseded = new Map([...identities.superseded]
    .filter(([id]) => !retained.has(id))
    .map(([id, replacementId]) => [id, resolve(replacementId)] as const)
    .filter(([id, replacementId]) => id !== replacementId));
  return { patch: safePatch, aliases, superseded };
}

type RoadmapRow = { item: FunctionalItem; status: string; screenId: string | null };

/** Break dependency cycles among a set of items; dependencies are build hints, not navigation. */
function withoutDependencyCycles(items: FunctionalItem[]) {
  const byKey = new Map(items.map(item => [item.stableKey, item]));
  const state = new Map<string, "visiting" | "done">();
  const visit = (item: FunctionalItem) => {
    state.set(item.stableKey, "visiting");
    item.dependencyKeys = item.dependencyKeys.filter(key => {
      const next = byKey.get(key);
      if (!next) return true;
      if (state.get(key) === "visiting") return false;
      if (!state.has(key)) visit(next);
      return true;
    });
    state.set(item.stableKey, "done");
  };
  for (const item of items) if (!state.has(item.stableKey)) visit(item);
}

/**
 * Map a normalized candidate onto the saved roadmap. Model references are
 * resolved by ref, saved key or screen name. A reference that still resolves to
 * nothing is dropped (an action keeps its label and outcome and stays inline),
 * so the saved plan is valid by construction rather than rejected afterwards.
 */
export function candidateRoadmap(candidate: DesignFlowCandidate, state: ProductPlanning,
  current: RoadmapRow[], factAliases: Map<string, string>, superseded: Map<string, string>, projectId: string, turnId: string) {
  const currentByKey = new Map(current.map(row => [row.item.stableKey, row]));
  const currentByName = new Map(current.filter(row => row.item.kind === "screen").map(row => [nameKey(row.item.name), row]));
  const outputAliases = new Map<string, string>();
  const claimed = new Set<string>();
  const kept: Array<{ item: DesignFlowCandidate["outputs"][number]; key: string; name: string }> = [];
  for (const item of candidate.outputs) {
    const byKey = item.existingKey ? currentByKey.get(item.existingKey) : undefined;
    const byName = currentByName.get(nameKey(item.name));
    const match = byKey ?? (byName && !claimed.has(byName.item.stableKey) ? byName : undefined);
    if (match && match.status !== "planned") {
      // Built or running screens are historical context; a restatement names that screen.
      outputAliases.set(item.ref, match.item.stableKey);
      continue;
    }
    let key = match && !claimed.has(match.item.stableKey) ? match.item.stableKey : stableId("screen:", projectId, turnId, item.ref);
    if (claimed.has(key)) key = stableId("screen:", projectId, turnId, `${item.ref}:${kept.length}`);
    claimed.add(key);
    outputAliases.set(item.ref, key);
    kept.push({ item, key, name: item.name });
  }
  const removeKeys = new Set(candidate.removeOutputKeys.filter(key =>
    currentByKey.get(key)?.status === "planned" && !claimed.has(key)));
  // Screen names stay distinct across the roadmap. A row edited here releases
  // its old name, so renames and swaps within one plan do not collide.
  const nameOwners = new Map<string, string>();
  for (const row of current) {
    if (row.item.kind === "screen" && !removeKeys.has(row.item.stableKey) && !claimed.has(row.item.stableKey)) {
      nameOwners.set(nameKey(row.item.name), row.item.stableKey);
    }
  }
  for (const entry of kept) {
    let name = entry.name;
    for (let suffix = 2; nameOwners.has(nameKey(name)) && nameOwners.get(nameKey(name)) !== entry.key; suffix += 1) {
      name = `${entry.name.slice(0, 96)} ${suffix}`;
    }
    nameOwners.set(nameKey(name), entry.key);
    entry.name = name;
  }
  const keptNames = new Map(kept.flatMap(entry => [[nameKey(entry.item.name), entry.key], [nameKey(entry.name), entry.key]] as const));
  const resolveOutput = (value: string | null | undefined) => {
    if (!value) return null;
    const key = outputAliases.get(value) ?? outputAliases.get(normalizeRef(value))
      ?? (currentByKey.has(value) ? value : null)
      ?? keptNames.get(nameKey(value)) ?? currentByName.get(nameKey(value))?.item.stableKey ?? null;
    return key && !removeKeys.has(key) ? key : null;
  };
  const active = new Map(activeFacts(state).map(item => [item.id, item]));
  const retired = new Map(state.blueprint.facts.map(item => [item.id, item]));
  const resolveFact = (value: string, section: "surfaces" | "journeys" | "decisions") => {
    let id = factAliases.get(value) ?? factAliases.get(normalizeRef(value)) ?? superseded.get(value) ?? value;
    const seen = new Set<string>();
    while (!active.has(id) && retired.get(id)?.supersededBy && !seen.has(id)) {
      seen.add(id);
      id = retired.get(id)!.supersededBy!;
    }
    if (active.get(id)?.section === section) return id;
    return activeFacts(state, section).find(item => nameKey(item.label) === nameKey(value))?.id ?? null;
  };
  const firstCandidate = (section: "surfaces" | "journeys") => candidate.facts.filter(item => item.section === section)
    .map(item => resolveFact(item.ref, section)).find(Boolean) ?? activeFacts(state, section)[0]?.id ?? null;
  const defaultSurface = firstCandidate("surfaces");
  const defaultJourney = firstCandidate("journeys");
  const factList = (values: string[], section: "surfaces" | "journeys" | "decisions", fallback: string | null, max: number) => {
    const ids = [...new Set(values.flatMap(value => resolveFact(value, section) ?? []))].slice(0, max);
    return ids.length || !fallback ? ids : [fallback];
  };
  const replacements = kept.map(({ item, key, name }, index) => functionalItemSchema.parse({
    stableKey: key, kind: "screen", name, description: item.description,
    parentStableKey: null,
    surfaceIds: factList(item.surfaceRefs, "surfaces", defaultSurface, 30),
    journeyIds: factList(item.journeyRefs, "journeys", defaultJourney, 30),
    decisionIds: factList(item.decisionRefs, "decisions", null, 40),
    dependencyKeys: [...new Set(item.dependencyRefs.flatMap(value => {
      const dependency = resolveOutput(value);
      return dependency && dependency !== key ? [dependency] : [];
    }))],
    actions: item.actions.map(action => {
      const destination = resolveOutput(action.destinationRef);
      return { label: action.label, outcome: action.outcome, destinationKey: destination && destination !== key ? destination : null };
    }),
    information: item.information, entryCondition: item.entryCondition, outcome: item.outcome,
    inlineStates: item.inlineStates, sequence: item.sequence ?? currentByKey.get(key)?.item.sequence ?? index,
    referenceScreenIndex: null, rendering: "product_screen",
  }));
  const updated = new Map(replacements.map(item => [item.stableKey, item]));
  const roadmap: RoadmapRow[] = current.filter(row => !removeKeys.has(row.item.stableKey)).map(row => {
    const replacement = updated.get(row.item.stableKey);
    if (replacement) return { ...row, item: replacement };
    if (row.status !== "planned") return row;
    const item = structuredClone(row.item);
    item.surfaceIds = factList(item.surfaceIds, "surfaces", defaultSurface, 30);
    item.journeyIds = factList(item.journeyIds, "journeys", defaultJourney, 30);
    item.decisionIds = factList(item.decisionIds, "decisions", null, 40);
    item.actions = item.actions.map(action => ({ ...action,
      destinationKey: action.destinationKey && !removeKeys.has(action.destinationKey) ? action.destinationKey : null }));
    item.dependencyKeys = item.dependencyKeys.filter(dependency => !removeKeys.has(dependency));
    return { ...row, item };
  });
  for (const item of replacements) if (!currentByKey.has(item.stableKey)) roadmap.push({ item, status: "planned", screenId: null });
  // Additional state frames are created from the canvas; a plan selects screens.
  const plannedKeys = new Set(roadmap.filter(row => row.status === "planned" && row.item.kind === "screen").map(row => row.item.stableKey));
  let selectedKeys = [...new Set(candidate.scope.outputRefs.flatMap(value => {
    const key = resolveOutput(value);
    return key && plannedKeys.has(key) ? [key] : [];
  }))];
  // Selection falls back to the screens this plan describes, then to the saved selection.
  if (!selectedKeys.length) selectedKeys = replacements.map(item => item.stableKey);
  if (!selectedKeys.length) selectedKeys = (state.scope?.outputKeys ?? []).filter(key => plannedKeys.has(key));
  if (!selectedKeys.length) throw new Error("The screen-flow plan selected no screens.");
  const existingOutputs = roadmap.filter(row => row.status === "ready" && row.screenId)
    .map(row => ({ item: row.item, screenId: row.screenId! }));
  const included = new Set([...selectedKeys, ...existingOutputs.map(row => row.item.stableKey)]);
  // A selected screen's generation prerequisites must be part of this build.
  const selected = selectedKeys.map(key => {
    const row = roadmap.find(entry => entry.item.stableKey === key)!;
    row.item = { ...row.item, dependencyKeys: row.item.dependencyKeys.filter(dependency => included.has(dependency)) };
    return row.item;
  });
  withoutDependencyCycles(selected);
  const selectedNames = new Set<string>();
  for (const item of selected) {
    const base = item.name.slice(0, 96);
    for (let suffix = 2; selectedNames.has(nameKey(item.name)); suffix += 1) item.name = `${base} ${suffix}`;
    selectedNames.add(nameKey(item.name));
  }
  const onRoadmap = new Set(roadmap.map(row => row.item.stableKey));
  const destinations = new Set(selected.flatMap(item => item.actions.flatMap(action =>
    action.destinationKey && !included.has(action.destinationKey) && onRoadmap.has(action.destinationKey) ? [action.destinationKey] : [])));
  for (const item of selected) item.actions = item.actions.map(action => action.destinationKey && !onRoadmap.has(action.destinationKey)
    ? { ...action, destinationKey: null } : action);
  const boundaries = roadmap.filter(row => destinations.has(row.item.stableKey))
    .map(row => ({ key: row.item.stableKey, name: row.item.name, outcome: row.item.outcome }));
  validateFunctionalPlan(selected, existingOutputs.map(row => row.item), boundaries.map(item => item.key));
  const scopeSurfaces = [...new Set([
    ...candidate.scope.surfaceRefs.flatMap(value => resolveFact(value, "surfaces") ?? []),
    ...selected.flatMap(item => item.surfaceIds),
  ])].filter(id => selected.some(item => item.surfaceIds.includes(id)));
  const itemsToSave = roadmap.filter(row => row.status === "planned" &&
    JSON.stringify(row.item) !== JSON.stringify(currentByKey.get(row.item.stableKey)?.item)).map(row => row.item);
  const navigation = scopeNavigation(candidate.navigation, resolveOutput, included);
  return { roadmap: roadmap.map(row => row.item), itemsToSave, removeKeys: [...removeKeys],
    scope: { outputPolicy: "manual_states_v1" as const, goal: candidate.scope.goal,
      rationale: candidate.scope.rationale, surfaceIds: scopeSurfaces, outputKeys: selectedKeys,
      manifest: selected.map(item => ({ ...item, rendering: outputRendering(item, false) })),
      existingOutputs, boundaries, ...(navigation ? { navigation } : {}),
      status: "draft" as const, approvedRevision: null, generationRunId: null } };
}
