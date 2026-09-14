import { z } from "zod";
import type { ProjectRoadmapItem, ScreenStateVariantPlan } from "@/lib/types";

const key = z.string().regex(/^[a-z0-9][a-z0-9:_-]{0,99}$/);
const detail = z.string().trim().min(1).max(5000);
export const functionalItemSchema = z.object({
  stableKey: key, kind: z.enum(["screen", "state"]), name: z.string().trim().min(1).max(100),
  description: detail, parentStableKey: key.nullable().default(null),
  surfaceIds: z.array(z.string()).min(1).max(30), journeyIds: z.array(z.string()).min(1).max(30),
  decisionIds: z.array(z.string()).max(40).default([]),
  dependencyKeys: z.array(key).max(50).default([]),
  actions: z.array(z.object({ label: z.string().min(1).max(200), destinationKey: key.nullable(), outcome: detail })).max(30),
  information: detail, entryCondition: detail, outcome: detail,
  inlineStates: z.array(z.string().min(1).max(1000)).max(30).default([]),
  stateKey: z.string().regex(/^[a-z0-9_-]+$/).nullable().default(null),
  triggerLabel: z.string().max(500).default(""),
  editInstruction: z.string().max(5000).default(""),
  sequence: z.number().int().nonnegative(),
  referenceScreenIndex: z.number().int().positive().nullable().default(null),
});
export type FunctionalItem = z.infer<typeof functionalItemSchema>;
export const functionalDeltaSchema = z.object({ items: z.array(functionalItemSchema).max(40), removeKeys: z.array(key).max(40).default([]) });

export function validateFunctionalPlan(items: FunctionalItem[], existing: FunctionalItem[] = [], boundaryKeys: string[] = []) {
  const byKey = new Map([...items, ...existing].map(item => [item.stableKey, item]));
  if (byKey.size !== items.length + existing.length) throw new Error("Functional items need unique stable keys.");
  const names = items.filter(item => item.kind === "screen").map(item => item.name.toLowerCase());
  if (new Set(names).size !== names.length) throw new Error("Screen names must be distinct.");
  const states = items.filter(item => item.kind === "state").map(item => `${item.parentStableKey}:${item.stateKey}`);
  if (new Set(states).size !== states.length) throw new Error("State keys must be distinct within each parent.");
  for (const item of items) {
    if (item.kind === "state" && (!item.parentStableKey || byKey.get(item.parentStableKey)?.kind !== "screen" || !item.stateKey || !item.triggerLabel || !item.editInstruction)) throw new Error(`State ${item.name} needs a parent, trigger, state key and specific design changes.`);
    if (item.kind === "screen" && item.parentStableKey) throw new Error("Only states have parent screens.");
    for (const dep of item.dependencyKeys) {
      if (!byKey.has(dep)) throw new Error(`${item.name} requires unbuilt output ${dep}. Include its prerequisite in this scope.`);
    }
    for (const destination of item.actions.flatMap(action => action.destinationKey ? [action.destinationKey] : [])) {
      if (!byKey.has(destination) && !boundaryKeys.includes(destination)) throw new Error(`${item.name} references missing output ${destination}. Map it in the same delta or describe an intentional external outcome.`);
    }
  }
  // Existing outputs are already fulfilled prerequisites. Their historical
  // navigation may point into other roadmap work outside this new approval.
  const visiting = new Set<string>(); const visited = new Set(existing.map(item => item.stableKey));
  function visit(id: string) {
    if (visiting.has(id)) throw new Error("Generation dependencies contain a cycle. Navigation loops belong in actions, not dependencies.");
    if (visited.has(id)) return;
    visiting.add(id);
    const item = byKey.get(id)!;
    for (const dep of [...item.dependencyKeys, ...(item.parentStableKey ? [item.parentStableKey] : [])]) visit(dep);
    visiting.delete(id); visited.add(id);
  }
  items.forEach(item => visit(item.stableKey));
  return items;
}

export function functionalRoadmapItem(item: FunctionalItem): ProjectRoadmapItem {
  return { stableKey: item.stableKey, parentStableKey: item.parentStableKey, kind: item.kind,
    name: item.name, description: item.description, screenType: "detail", priority: "required", status: "planned",
    source: "planner", explicitlyRequested: true, sequence: item.sequence, tranche: 1,
    dependencyKeys: [...new Set([...item.dependencyKeys, ...(item.parentStableKey ? [item.parentStableKey] : [])])],
    stateKey: item.stateKey, stateLabel: item.kind === "state" ? item.name : null,
    stateRole: item.kind === "state" ? "functional" : null, triggerLabel: item.triggerLabel,
    metadata: { functional: item as never },
  };
}

export function functionalStateVariant(item: FunctionalItem): ScreenStateVariantPlan {
  return { id: item.stableKey, roadmapStableKey: item.stableKey, stateKey: item.stateKey!, stateLabel: item.name,
    stateRole: "functional", triggerLabel: item.triggerLabel, description: item.description,
    editInstruction: item.editInstruction, defaultSelected: true, explicitlyRequested: true };
}

export const functionalBrief = (item: FunctionalItem) => [item.description, `Information: ${item.information}`, `Entry: ${item.entryCondition}`,
  `Outcome: ${item.outcome}`, `Actions: ${JSON.stringify(item.actions)}`, `Inline states: ${item.inlineStates.join("; ")}`,
  item.referenceScreenIndex == null ? "" : `Recreate source frame ${item.referenceScreenIndex} from the supplied image; preserve that frame's composition.`].filter(Boolean).join("\n");
