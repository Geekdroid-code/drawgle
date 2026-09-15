import { describe, expect, it } from "vitest";
import { applyProductPatch } from "./model";
import { validateJourneyCoverage } from "./flow-review";
import { appointmentFlow } from "./flow-test-fixtures";
import { formatProductTruth } from "./generation-context";


describe("product outcomes across screens and states", () => {
  it("accepts a job completed in a parent-linked state without prescribing more screens", () => {
    const { state, roadmap, review, messages } = appointmentFlow();
    expect(validateJourneyCoverage(state, roadmap, review, messages)).toEqual([]);
  });
  it("rejects omitted work for a whole-product request but retains the roadmap for a user-selected subset", () => {
    const { state, roadmap, review, messages } = appointmentFlow();
    state.scope!.outputKeys = [roadmap[0].stableKey];
    expect(validateJourneyCoverage(state, roadmap, review, messages).join(" ")).toContain("excluded");
    review.requestedScope = "focused"; review.scopeEvidence = "Only design availability for now";
    expect(validateJourneyCoverage(state, roadmap, review, [...messages, review.scopeEvidence])).toEqual([]);
    expect(roadmap).toHaveLength(2);
    expect(state.blueprint.facts.find(fact => fact.id === "book")?.detail).toContain("confirmed appointment");
  });
  it("rejects a disconnected completion even if generation dependencies are valid", () => {
    const { state, roadmap, review, messages } = appointmentFlow();
    roadmap[0].actions = [];
    roadmap[1] = { ...roadmap[1], kind: "screen", parentStableKey: null, stateKey: null, triggerLabel: "", dependencyKeys: [roadmap[0].stableKey] };
    expect(validateJourneyCoverage(state, roadmap, review, messages).join(" ")).toContain("cannot reach");
  });
  it("rejects invented states, superseded facts, missing jobs and fabricated scope evidence", () => {
    const { state, roadmap, review } = appointmentFlow();
    review.journeys[0].jobId = "retired-job";
    const issues = validateJourneyCoverage(state, roadmap.slice(0, 1), review, ["Make it elegant"]);
    expect(issues.join(" ")).toMatch(/exact user quote/);
    expect(issues.join(" ")).toMatch(/no mapped outcome/);
    expect(issues.join(" ")).toMatch(/active actors/);
    expect(issues.join(" ")).toMatch(/unplanned output/);
  });
  it("counts already-built context toward the complete app", () => {
    const { state, roadmap, review, messages } = appointmentFlow();
    state.scope!.outputKeys = [roadmap[1].stableKey];
    state.scope!.existingOutputs = [{ item: roadmap[0], screenId: "11111111-1111-4111-8111-111111111111" }];
    expect(validateJourneyCoverage(state, roadmap, review, messages)).toEqual([]);
  });
  it("does not demand concrete plans for unrelated deferred jobs in an explicitly focused scope", () => {
    const { state, roadmap, review } = appointmentFlow();
    state.blueprint.facts.push({ ...state.blueprint.facts.find(fact => fact.id === "book")!, id: "manage-records", detail: "Maintain care records later" });
    review.requestedScope = "focused"; review.scopeEvidence = "Only design booking for now";
    expect(validateJourneyCoverage(state, roadmap, review, [review.scopeEvidence])).toEqual([]);
    review.requestedScope = "whole_product";
    expect(validateJourneyCoverage(state, roadmap, review, [review.scopeEvidence]).join(" ")).toContain("manage-records has no mapped outcome");
  });
  it("carries reviewed outcomes downstream and invalidates coverage when decisions change", () => {
    const { state, review } = appointmentFlow();
    state.scope!.journeyCoverage = review.journeys;
    expect(formatProductTruth(state, true)).toContain("Patient has a confirmed appointment");
    const changed = applyProductPatch(state, { operations: [{ op: "put_fact", fact: {
      id: "approval", section: "constraints", label: "Approval", detail: "The clinic must approve requests", source: "assumption",
    } }] }, "11111111-1111-4111-8111-111111111111");
    expect(changed.scope?.journeyCoverage).toBeUndefined();
    expect(changed.scope?.status).toBe("draft");
  });
});
