import { describe, expect, it } from "vitest";
import { applyProductPatch, createProductPlanning } from "./model";
import { candidateFactPatch, candidateRoadmap, designFlowCandidateSchema } from "./proposal-candidate";
import { flowPreflight } from "./flow-preflight";

const projectId = "11111111-1111-4111-8111-111111111111";
const turnId = "first-turn";
const messageId = "22222222-2222-4222-8222-222222222222";
const base = () => createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null });

function candidate(overrides: Record<string, unknown> = {}) {
  return designFlowCandidateSchema.parse({
    facts: [
      ["identity", "app", "Family planner"], ["actors", "parent", "Parent managing the household"],
      ["jobs", "organize", "See and manage family tasks"], ["journeys", "daily", "Review today's tasks and a child's work"],
      ["surfaces", "home", "Today and child task surfaces"],
    ].map(([section, ref, detail]) => ({ section, ref, label: ref, detail, source: "assumption" })),
    outputs: [
      { ref: "today", name: "Today", description: "Review the family day's work", surfaceRefs: ["home"], journeyRefs: ["daily"],
        actions: [{ label: "Open child tasks", destinationRef: "child", outcome: "See that child's tasks" }],
        information: "Today's family tasks", entryCondition: "Parent opens the app", outcome: "Parent sees the day's plan" },
      { ref: "child", name: "Child Tasks", description: "Review one child's work", surfaceRefs: ["home"], journeyRefs: ["daily"],
        actions: [{ label: "Back to Today", destinationRef: "today", outcome: "Return to the family plan" }],
        information: "Assigned tasks", entryCondition: "Parent opens child tasks from Today",
        outcome: "Parent sees the child's tasks" },
    ],
    scope: { goal: "Design the family task flow", rationale: "The user requested both screens",
      outputRefs: ["today", "child"], surfaceRefs: ["home"] },
    ...overrides,
  });
}

function materialize(value = candidate()) {
  const previous = base();
  const ids = candidateFactPatch(value, previous, projectId, turnId);
  const state = applyProductPatch(previous, { operations: ids.args.facts.map(fact => ({ op: "put_fact", fact })) }, messageId);
  const mapped = candidateRoadmap(value, state, [], ids.aliases, ids.superseded, projectId, turnId);
  return { state: { ...state, scope: mapped.scope }, mapped, ids };
}

describe("single-candidate screen-flow mapping", () => {
  it("assigns stable identities and keeps the child entry path", () => {
    const first = materialize();
    const again = materialize();
    expect(first.mapped.scope.outputKeys).toEqual(again.mapped.scope.outputKeys);
    expect(first.mapped.roadmap[0].actions[0].destinationKey).toBe(first.mapped.roadmap[1].stableKey);
    expect(flowPreflight(first.state, first.mapped.roadmap).issues).toEqual([]);
    expect(first.mapped.itemsToSave).toHaveLength(2);
  });

  it("rejects a missing destination before any database write", () => {
    const value = candidate({ outputs: [{ ...candidate().outputs[0], actions: [
      { label: "Open child tasks", destinationRef: "absent", outcome: "See child tasks" },
    ] }, candidate().outputs[1]] });
    expect(() => materialize(value)).toThrow(/missing output absent/);
  });

  it("treats repeated facts as existing identities and requires explicit changed-fact supersession", () => {
    const first = materialize();
    const repeated = candidateFactPatch(candidate({ outputs: candidate().outputs.map((item, index) =>
      ({ ...item, existingKey: first.mapped.roadmap[index].stableKey })) }), first.state, projectId, "next-turn");
    expect(repeated.args.facts).toEqual([]);
    const changed = candidate({ facts: [{ ref: "home", section: "surfaces", label: "home",
      detail: "A different task surface", source: "assumption" }] });
    expect(() => candidateFactPatch(changed, first.state, projectId, "next-turn")).toThrow(/explicitly supersede/);
  });
});
