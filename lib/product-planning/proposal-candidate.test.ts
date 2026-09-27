import { describe, expect, it } from "vitest";
import { applyProductPatch, createProductPlanning, productPatchSchema } from "./model";
import { candidateFactPatch, candidateRoadmap, designFlowCandidateSchema, reconcileCandidateFactEvidence } from "./proposal-candidate";
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

  it("keeps saved fact identities when a failed review's repair redescribes them", () => {
    const first = materialize();
    const repeated = candidateFactPatch(candidate({ outputs: candidate().outputs.map((item, index) =>
      ({ ...item, existingKey: first.mapped.roadmap[index].stableKey })) }), first.state, projectId, "next-turn");
    expect(repeated.args.facts).toEqual([]);
    const saved = { ...first.state, scope: { ...first.state.scope!, reviewIssues: ["Add a child entry path"] } };
    const changed = candidate({ facts: [{ ref: "home", section: "surfaces", label: "home",
      detail: "A different task surface", source: "assumption" }] });
    const reconciled = candidateFactPatch(changed, saved, projectId, "next-turn");
    expect(reconciled.args).toEqual({ facts: [], supersessions: [] });
    expect(reconciled.aliases.get("home")).toBe(first.ids.aliases.get("home"));
  });

  it("preserves a user-confirmed fact against tentative rewrites or unsupported removal", () => {
    const confirmed = applyProductPatch(base(), { operations: [{ op: "put_fact", fact: {
      id: "family-chores", section: "jobs", label: "Family chores", detail: "Parents track chores",
      source: "user", evidence: "Parents track chores", links: [], blocking: false,
    } }] }, messageId);
    const revised = candidate({ facts: [{ ref: "chores", supersedesId: "family-chores", section: "jobs",
      label: "Family chores", detail: "Children use cloud automation", source: "assumption" }],
      removeFactIds: ["family-chores"] });
    const patch = candidateFactPatch(revised, confirmed, projectId, "repair-turn");
    expect(patch.args).toEqual({ facts: [], supersessions: [] });
    expect(patch.aliases.get("chores")).toBe("family-chores");
    expect(patch.superseded.size).toBe(0);
  });

  it("supersedes a confirmed fact with an explicit supported correction and rewires planned screens", () => {
    const first = materialize();
    const original = first.ids.aliases.get("home")!;
    const confirmed = applyProductPatch(first.state, { operations: [{ op: "supersede_fact", id: original,
      replacement: { id: "confirmed-home", section: "surfaces", label: "home",
        detail: "Parents see family tasks", source: "user", evidence: "Parents see family tasks", links: [], blocking: false },
    }] }, messageId);
    const correction = candidate({ facts: [{ ref: "home", supersedesId: "confirmed-home", section: "surfaces",
      label: "home", detail: "Parents see family tasks and pet care", source: "user",
      evidence: "Parents see family tasks and pet care" }],
      outputs: candidate().outputs.map((item, index) => ({ ...item,
        existingKey: first.mapped.roadmap[index].stableKey,
        surfaceRefs: ["confirmed-home"], journeyRefs: [first.ids.aliases.get("daily")!] })) });
    const patch = candidateFactPatch(correction, confirmed, projectId, "correction-turn");
    expect(patch.args.facts).toEqual([]);
    expect(patch.args.supersessions).toHaveLength(1);
    expect(patch.args.supersessions[0].id).toBe("confirmed-home");
    expect(patch.args.supersessions[0].replacement?.source).toBe("user");
    const next = applyProductPatch(confirmed, { operations: patch.args.supersessions.map(entry => ({
      op: "supersede_fact", id: entry.id, replacement: entry.replacement,
    })) }, messageId);
    const newId = patch.aliases.get("home")!;
    const rows = first.mapped.roadmap.map(item => ({ item: { ...item, surfaceIds: ["confirmed-home"] },
      status: "planned", screenId: null }));
    const mapped = candidateRoadmap(correction, next, rows, patch.aliases, patch.superseded, projectId, "correction-turn");
    expect(newId).not.toBe("confirmed-home");
    expect(mapped.scope.surfaceIds).toEqual([newId]);
    expect(mapped.roadmap.map(item => item.surfaceIds)).toEqual([[newId], [newId]]);
  });

  it("retains confirmed truth and redirects links when evidence review demotes its replacement", () => {
    const saved = applyProductPatch(base(), { operations: [
      { op: "put_fact", fact: { id: "confirmed-home", section: "surfaces", label: "home",
        detail: "Parents see family tasks", source: "user", evidence: "Parents see family tasks", links: [], blocking: false } },
      { op: "put_fact", fact: { id: "saved-journey", section: "journeys", label: "daily",
        detail: "Review today's tasks and a child's work", source: "assumption", links: [], blocking: false } },
    ] }, messageId);
    const revised = candidate({ facts: [
      { ref: "home", supersedesId: "confirmed-home", section: "surfaces", label: "home",
        detail: "Parents see cloud AI automation", source: "user", evidence: "Parents see cloud AI automation" },
      { ref: "daily", section: "journeys", label: "daily",
        detail: "Review today's tasks and a child's work", source: "assumption" },
      { ref: "related", section: "capabilities", label: "Related feature",
        detail: "A related screen capability", source: "assumption", links: ["home"] },
    ] });
    const ids = candidateFactPatch(revised, saved, projectId, "repair-turn");
    const proposedId = ids.aliases.get("home")!;
    const patch = productPatchSchema.parse({ operations: [
      ...ids.args.facts.map(fact => ({ op: "put_fact", fact })),
      ...ids.args.supersessions.map(entry => ({ op: "supersede_fact", ...entry })),
    ] });
    const correction = patch.operations.find(operation => operation.op === "supersede_fact");
    if (!correction?.replacement) throw new Error("Expected a proposed correction");
    correction.replacement.source = "assumption";
    correction.replacement.evidence = "";
    const safe = reconcileCandidateFactEvidence(saved, patch, ids);
    expect(safe.patch.operations.map(operation => operation.op)).toEqual(["put_fact"]);
    expect(safe.patch.operations[0].op === "put_fact" && safe.patch.operations[0].fact.links).toEqual(["confirmed-home"]);
    expect(safe.aliases.get("home")).toBe("confirmed-home");
    expect(safe.aliases.get(proposedId)).toBe("confirmed-home");
    expect(safe.superseded.size).toBe(0);
    const next = applyProductPatch(saved, safe.patch, messageId);
    expect(next.blueprint.facts.find(fact => fact.id === "confirmed-home")?.status).toBe("active");
    const mapped = candidateRoadmap(revised, next, [], safe.aliases, safe.superseded, projectId, "repair-turn");
    expect(mapped.roadmap.map(item => item.surfaceIds)).toEqual([["confirmed-home"], ["confirmed-home"]]);
  });
});
