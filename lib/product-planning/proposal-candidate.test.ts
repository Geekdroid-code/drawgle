import { describe, expect, it } from "vitest";
import { applyProductPatch, createProductPlanning, productPatchSchema } from "./model";
import { candidateFactPatch, candidateRoadmap, designFlowCandidateSchema, ensureStructuralFacts, normalizeDesignFlowCandidate,
  reconcileCandidateFactEvidence } from "./proposal-candidate";
import { validateFunctionalPlan } from "./functional-plan";

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

function materialize(value = candidate(), previous = base()) {
  const structured = ensureStructuralFacts(value, previous, "Design a family planner");
  const ids = candidateFactPatch(structured, previous, projectId, turnId);
  const state = ids.args.facts.length
    ? applyProductPatch(previous, { operations: ids.args.facts.map(fact => ({ op: "put_fact", fact })) }, messageId) : previous;
  const mapped = candidateRoadmap(structured, state, [], ids.aliases, ids.superseded, projectId, turnId);
  return { state: { ...state, scope: mapped.scope }, mapped, ids };
}

describe("single-candidate screen-flow mapping", () => {
  it("assigns stable identities and keeps the child entry path", () => {
    const first = materialize();
    const again = materialize();
    expect(first.mapped.scope.outputKeys).toEqual(again.mapped.scope.outputKeys);
    expect(first.mapped.roadmap[0].actions[0].destinationKey).toBe(first.mapped.roadmap[1].stableKey);
    expect(first.mapped.itemsToSave).toHaveLength(2);
  });

  it("keeps an action to an unknown screen inline instead of rejecting the whole plan", () => {
    const value = candidate({ outputs: [{ ...candidate().outputs[0], actions: [
      { label: "Open child tasks", destinationRef: "absent", outcome: "See child tasks" },
    ] }, candidate().outputs[1]] });
    const { mapped } = materialize(value);
    expect(mapped.roadmap[0].actions).toEqual([{ label: "Open child tasks", destinationKey: null, outcome: "See child tasks" }]);
    expect(mapped.scope.outputKeys).toHaveLength(2);
  });

  it("resolves destinations written as screen names and drops self-links", () => {
    const value = candidate({ outputs: [
      { ...candidate().outputs[0], actions: [{ label: "Open child", destinationRef: "Child Tasks", outcome: "See the child" },
        { label: "Mark done", destinationRef: "today", outcome: "Checks the task inline" }] },
      candidate().outputs[1],
    ] });
    const { mapped } = materialize(value);
    expect(mapped.roadmap[0].actions.map(action => action.destinationKey)).toEqual([mapped.roadmap[1].stableKey, null]);
  });

  it("derives the missing structure the reported projects failed on instead of rejecting the plan", () => {
    // 8968251e/2f7c810c: no jobs fact. Here also no identity, surface or journey facts, and bad refs.
    const value = candidate({ facts: [{ ref: "actor", section: "actors", label: "Parent", detail: "A busy parent", source: "assumption" }],
      outputs: candidate().outputs.map(item => ({ ...item, surfaceRefs: ["nowhere"], journeyRefs: [], decisionRefs: ["actor"] })),
      scope: { ...candidate().scope, surfaceRefs: ["nowhere"] } });
    const { state, mapped } = materialize(value);
    const facts = (section: string) => state.blueprint.facts.filter(fact => fact.section === section);
    expect(facts("identity")[0]).toMatchObject({ source: "assumption", detail: "Design a family planner" });
    expect(facts("jobs")).toHaveLength(0);
    expect(mapped.roadmap.every(item => item.surfaceIds[0] === facts("surfaces")[0].id)).toBe(true);
    expect(mapped.roadmap.every(item => item.journeyIds[0] === facts("journeys")[0].id)).toBe(true);
    expect(mapped.roadmap.every(item => item.decisionIds.length === 0)).toBe(true);
    expect(mapped.scope.surfaceIds).toEqual([facts("surfaces")[0].id]);
  });

  it("normalizes invalid refs, duplicate names, empty fields and a missing selection", () => {
    const value = normalizeDesignFlowCandidate({
      facts: [{ ref: "Main App", section: "identity", label: "Family planner", detail: "", source: "assumption", evidence: "", links: [] },
        { ref: "1st-surface", section: "surfaces", label: "Home", detail: "Home area", source: "assumption", evidence: "", links: ["Main App"] }],
      outputs: [
        { ref: "Today Screen", name: "Today", description: "", surfaceRefs: ["1st-surface"], journeyRefs: [], actions: [
          { label: "Open", destinationRef: "Today Screen 2", outcome: "" }, { label: "", destinationRef: null, outcome: "x" }],
          information: "", entryCondition: "", outcome: "Family sees today", inlineStates: ["", "Loading"] },
        { ref: "Today Screen", name: "today", description: "The second today", surfaceRefs: [], journeyRefs: [], actions: [],
          information: "Details", entryCondition: "From Today", outcome: "Done", inlineStates: [] },
      ],
      scope: { goal: "", rationale: "", outputRefs: ["missing"], surfaceRefs: [] },
    })!;
    expect(value.outputs.map(item => [item.ref, item.name])).toEqual([["today-screen", "Today"], ["today-screen-2", "today 2"]]);
    expect(value.outputs[0].actions).toEqual([{ label: "Open", destinationRef: "today-screen-2", outcome: "Open" }]);
    expect(value.outputs[0]).toMatchObject({ description: "Family sees today", information: "Family sees today", inlineStates: ["Loading"] });
    expect(value.facts[1]).toMatchObject({ ref: "st-surface", links: ["main-app"] });
    const { mapped } = materialize(value);
    expect(mapped.scope.outputKeys).toHaveLength(2);
    expect(() => validateFunctionalPlan(mapped.scope.manifest)).not.toThrow();
    expect(normalizeDesignFlowCandidate({ facts: [], outputs: [], scope: {} })).toBeNull();
    expect(normalizeDesignFlowCandidate("not an object")).toBeNull();
  });

  it("edits a planned screen with the same name and treats a built screen as context", () => {
    const first = materialize();
    const [today, child] = first.mapped.roadmap;
    const rows = [{ item: today, status: "planned", screenId: null },
      { item: child, status: "ready", screenId: "33333333-3333-4333-8333-333333333333" }];
    const next = candidate({ outputs: [
      { ...candidate().outputs[0], ref: "new-today", description: "Today, now with a streak", actions: [
        { label: "Open child tasks", destinationRef: "Child Tasks", outcome: "See that child's tasks" }] },
      { ...candidate().outputs[1], ref: "child-again" },
    ], scope: { ...candidate().scope, outputRefs: ["new-today", "child-again"] } });
    const ids = candidateFactPatch(next, first.state, projectId, "second-turn");
    const mapped = candidateRoadmap(next, first.state, rows, ids.aliases, ids.superseded, projectId, "second-turn");
    expect(mapped.scope.outputKeys).toEqual([today.stableKey]);
    expect(mapped.itemsToSave.map(item => [item.stableKey, item.description])).toEqual([[today.stableKey, "Today, now with a streak"]]);
    expect(mapped.scope.existingOutputs?.map(output => output.item.stableKey)).toEqual([child.stableKey]);
    expect(mapped.scope.manifest?.[0].actions[0].destinationKey).toBe(child.stableKey);
  });

  it("breaks generation dependency cycles and drops prerequisites outside the build", () => {
    const value = candidate({ outputs: [
      { ...candidate().outputs[0], dependencyRefs: ["child", "ghost"] },
      { ...candidate().outputs[1], dependencyRefs: ["today"] },
    ] });
    const { mapped } = materialize(value);
    expect(() => validateFunctionalPlan(mapped.scope.manifest)).not.toThrow();
    expect(mapped.scope.manifest?.flatMap(item => item.dependencyKeys)).toHaveLength(1);
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

  describe("the navigation the person approves with the flow", () => {
    const decided = (destinations: Array<{ label: string; outputRef: string | null }>, persistent = true) =>
      ({ persistent, destinations, rationale: "People move between these areas." });
    /** The smallest response the reader accepts, with the navigation the test gives it. */
    const response = (navigation: unknown) => normalizeDesignFlowCandidate({
      facts: [], outputs: [{ ref: "Today Screen", name: "Today", description: "d", actions: [], information: "i",
        entryCondition: "e", outcome: "o" }],
      scope: { goal: "g", rationale: "r", outputRefs: ["Today Screen"] }, navigation })!;

    it("resolves each destination to the screen it opens when that screen is in this flow", () => {
      const { mapped } = materialize(candidate({ navigation: decided([
        { label: "Today", outputRef: "today" }, { label: "Kids", outputRef: "Child Tasks" }, { label: "Routines", outputRef: "nowhere" }]) }));
      expect(mapped.scope.navigation).toEqual({ persistent: true, rationale: "People move between these areas.", destinations: [
        { label: "Today", screenKey: mapped.roadmap[0].stableKey }, { label: "Kids", screenKey: mapped.roadmap[1].stableKey },
        { label: "Routines", screenKey: null }] });
    });

    it("plans a destination whose screen is described but not selected for this build", () => {
      const { mapped } = materialize(candidate({ navigation: decided([{ label: "Today", outputRef: "today" }, { label: "Kids", outputRef: "child" }]),
        scope: { ...candidate().scope, outputRefs: ["today"] } }));
      expect(mapped.scope.outputKeys).toHaveLength(1);
      expect(mapped.scope.navigation?.destinations).toEqual([
        { label: "Today", screenKey: mapped.roadmap[0].stableKey }, { label: "Kids", screenKey: null }]);
    });

    it("counts a screen that is already built as part of the flow", () => {
      const first = materialize();
      const [today, child] = first.mapped.roadmap;
      const rows = [{ item: today, status: "planned", screenId: null },
        { item: child, status: "ready", screenId: "33333333-3333-4333-8333-333333333333" }];
      const next = candidate({ navigation: decided([{ label: "Today", outputRef: today.stableKey }, { label: "Kids", outputRef: child.stableKey }]),
        outputs: [{ ...candidate().outputs[0], existingKey: today.stableKey }, { ...candidate().outputs[1], existingKey: child.stableKey }],
        scope: { ...candidate().scope, outputRefs: [today.stableKey] } });
      const ids = candidateFactPatch(next, first.state, projectId, "second-turn");
      const mapped = candidateRoadmap(next, first.state, rows, ids.aliases, ids.superseded, projectId, "second-turn");
      expect(mapped.scope.navigation?.destinations.map(destination => destination.screenKey)).toEqual([today.stableKey, child.stableKey]);
    });

    it("gives a screen to one destination only", () => {
      const { mapped } = materialize(candidate({ navigation: decided([{ label: "Today", outputRef: "today" }, { label: "Home", outputRef: "today" }]) }));
      expect(mapped.scope.navigation?.destinations.map(destination => destination.screenKey)).toEqual([mapped.roadmap[0].stableKey, null]);
    });

    it("leaves a flow without a decision undecided, so the older heuristics still apply to it", () => {
      const { mapped } = materialize();
      expect("navigation" in mapped.scope).toBe(false);
      expect(response(undefined).navigation).toBeUndefined();
      expect(response({ destinations: [{ label: "Today", outputRef: null }] }).navigation).toBeUndefined();
      expect(response("tabs").navigation).toBeUndefined();
    });

    it("draws a bar only from two or more distinct, named destinations", () => {
      expect(response(decided([{ label: "Today", outputRef: "today screen" }])).navigation).toMatchObject({ persistent: false, destinations: [] });
      const two = response(decided([{ label: "Today", outputRef: "Today Screen" }, { label: "  pets ", outputRef: "" }]));
      expect(two.navigation).toEqual({ persistent: true, rationale: "People move between these areas.",
        destinations: [{ label: "Today", outputRef: "today-screen" }, { label: "pets", outputRef: null }] });
      // filler labels and repeats do not count toward the two
      expect(response(decided([{ label: "Tab 1", outputRef: null }, { label: "Today", outputRef: null }, { label: "TODAY", outputRef: null }])).navigation)
        .toMatchObject({ persistent: false, destinations: [] });
      expect(response(decided(["A", "B", "C", "D", "E", "F", "G"].map(label => ({ label, outputRef: null })))).navigation?.destinations).toHaveLength(5);
    });

    it("keeps no destinations for an app without persistent navigation, and gives its reason", () => {
      const none = response({ persistent: false, destinations: [{ label: "Today", outputRef: null }, { label: "Pets", outputRef: null }], rationale: "" });
      expect(none.navigation).toMatchObject({ persistent: false, destinations: [] });
      expect(none.navigation?.rationale).toMatch(/no persistent navigation/);
    });
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
