import { describe, expect, it } from "vitest";
import { flowPreflight } from "./flow-preflight";
import { validateJourneyCoverage } from "./flow-review";
import { designerFixture, functionalFixture } from "./test-fixtures";

describe("saved flow graph preflight", () => {
  it("permits a separately entered child screen but rejects a claimed unreachable parent journey", () => {
    const state = designerFixture();
    const parent = functionalFixture("screen:today", "Today", 0);
    const child = { ...functionalFixture("screen:tablet-chores", "Child chores", 1), entryCondition: "Child opens the tablet app" };
    state.scope!.outputKeys = [parent.stableKey, child.stableKey];
    state.scope!.manifest = [parent, child];
    expect(flowPreflight(state, [parent, child])).toMatchObject({ issues: [],
      independentEntryCandidates: [parent.stableKey, child.stableKey] });
    const coverage = { ready: true, issues: [], requestedScope: "focused" as const, scopeEvidence: "Design only onboarding.", journeys: [{
      journeyId: "purchase", actorId: "shoppers", jobId: "buy", outcome: "Complete task",
      outputKeys: [parent.stableKey, child.stableKey], entryKey: parent.stableKey, completionKeys: [child.stableKey],
    }] };
    expect(validateJourneyCoverage(state, [parent, child], coverage, ["Design only onboarding."]))
      .toContain("Journey purchase cannot reach screen:tablet-chores through its planned actions or state transitions.");
    coverage.journeys[0].entryKey = child.stableKey;
    coverage.journeys[0].outputKeys = [child.stableKey];
    expect(validateJourneyCoverage(state, [parent, child], coverage, ["Design only onboarding."]))
      .not.toContain("Journey purchase cannot reach screen:tablet-chores through its planned actions or state transitions.");
  });
  it("reports an action pointing outside the roadmap before model review", () => {
    const state = designerFixture();
    const parent = { ...functionalFixture(), actions: [{ label: "Open chores", destinationKey: "screen:missing", outcome: "See chores" }] };
    const graph = flowPreflight(state, [parent]);
    expect(graph.issues).toContain("screen:onboarding points to missing destination screen:missing.");
    expect(graph.issueDetails).toContainEqual({ id: "destination:missing:screen:onboarding:screen:missing",
      code: "MISSING_DESTINATION", detail: "screen:onboarding points to missing destination screen:missing." });
  });
});
