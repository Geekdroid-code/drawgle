import { describe, expect, it } from "vitest";
import { applyProductPatch } from "./model";
import { deriveJourneyGraph, normalizeJourneyCoverage, validateJourneyCoverage } from "./flow-review";
import { appointmentFlow } from "./flow-test-fixtures";
import { formatProductTruth } from "./generation-context";


describe("product outcomes across screens and states", () => {
  it("accepts a job completed in a parent-linked state without prescribing more screens", () => {
    const { state, roadmap, review, messages } = appointmentFlow();
    expect(validateJourneyCoverage(state, roadmap, review, messages)).toEqual([]);
  });
  it("derives reviewer bookkeeping from saved journey assignments", () => {
    const { state, roadmap, review, messages } = appointmentFlow();
    review.journeys[0].outputKeys = [roadmap[0].stableKey];
    const normalized = normalizeJourneyCoverage(state, roadmap, review);
    expect(normalized.journeys[0].outputKeys).toEqual(roadmap.map(item => item.stableKey));
    expect(validateJourneyCoverage(state, roadmap, review, messages)).toEqual([]);
    expect(deriveJourneyGraph(state, roadmap).journeys[0]).toMatchObject({
      journeyId: "booking", outputKeys: roadmap.map(item => item.stableKey),
      independentEntryCandidates: [roadmap[0].stableKey],
    });
  });
  it("rejects omitted work for a whole-product request but retains the roadmap for a user-selected subset", () => {
    const { state, roadmap, review, messages } = appointmentFlow();
    state.scope!.outputKeys = [roadmap[0].stableKey];
    expect(validateJourneyCoverage(state, roadmap, review, messages).join(" ")).toContain("excluded");
    review.requestedScope = "focused"; review.scopeEvidence = "Only design availability for now";
    review.journeys[0].outputKeys = [roadmap[0].stableKey];
    review.journeys[0].completionKeys = [roadmap[0].stableKey];
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
  it("accepts a real route through a selected shared screen without inventing a direct edge", () => {
    const { state, roadmap, review, messages } = appointmentFlow();
    const bridge = { ...roadmap[0], stableKey: "screen:calendar", name: "Calendar", journeyIds: ["other-journey"],
      actions: [{ label: "Confirm booking", destinationKey: roadmap[1].stableKey, outcome: "See confirmation" }] };
    roadmap[0].actions = [{ label: "Open calendar", destinationKey: bridge.stableKey, outcome: "Choose a date" }];
    roadmap[1] = { ...roadmap[1], kind: "screen", parentStableKey: null, stateKey: null, triggerLabel: "" };
    state.scope!.outputKeys = [roadmap[0].stableKey, bridge.stableKey, roadmap[1].stableKey];
    expect(validateJourneyCoverage(state, [roadmap[0], bridge, roadmap[1]], review, messages)).toEqual([]);
    review.journeys[0].outputKeys.push(bridge.stableKey);
    expect(validateJourneyCoverage(state, [roadmap[0], bridge, roadmap[1]], review, messages)).toEqual([]);
    const unrelated = { ...bridge, stableKey: "screen:unrelated", name: "Unrelated", actions: [] };
    state.scope!.outputKeys.push(unrelated.stableKey);
    review.journeys[0].outputKeys.push(unrelated.stableKey);
    expect(validateJourneyCoverage(state, [roadmap[0], bridge, roadmap[1], unrelated], review, messages).join(" "))
      .toContain("not assigned to the journey or on its saved route");
  });
  it("does not count an unselected future screen as a route through the exported flow", () => {
    const { state, roadmap, review, messages } = appointmentFlow();
    const futureBridge = { ...roadmap[0], stableKey: "screen:future-bridge", name: "Future bridge",
      journeyIds: ["other-journey"], actions: [
        { label: "Continue", destinationKey: roadmap[1].stableKey, outcome: "Open confirmation" },
      ] };
    roadmap[0].actions = [{ label: "Open future bridge", destinationKey: futureBridge.stableKey, outcome: "Continue" }];
    roadmap[1] = { ...roadmap[1], kind: "screen", parentStableKey: null, stateKey: null, triggerLabel: "" };
    expect(validateJourneyCoverage(state, [roadmap[0], futureBridge, roadmap[1]], review, messages).join(" "))
      .toContain(`cannot reach Reserved (${roadmap[1].stableKey})`);
  });
  it("accepts a selected shared Home as a journey entry when its real action opens the flow", () => {
    const { state, roadmap, review, messages } = appointmentFlow();
    const home = { ...roadmap[0], stableKey: "screen:home", name: "Home", journeyIds: ["other-journey"],
      actions: [{ label: "Book care", destinationKey: roadmap[0].stableKey, outcome: "Open appointment availability" }] };
    state.scope!.outputKeys = [home.stableKey, ...state.scope!.outputKeys!];
    review.journeys[0].entryKey = home.stableKey;
    expect(normalizeJourneyCoverage(state, [home, ...roadmap], review).journeys[0].outputKeys).toContain(home.stableKey);
    expect(validateJourneyCoverage(state, [home, ...roadmap], review, messages)).toEqual([]);
  });
  it("uses the real dashboard actions as entries to daily, pet-setup and health journeys", () => {
    const fixture = appointmentFlow();
    const state = applyProductPatch(fixture.state, { operations: [
      { op: "put_fact", fact: { id: "pet-setup", section: "journeys", label: "Pet setup",
        detail: "Create a pet profile", source: "assumption" } },
      { op: "put_fact", fact: { id: "add-pet", section: "jobs", label: "Add pet",
        detail: "Save a pet profile", source: "assumption" } },
      { op: "put_fact", fact: { id: "pet-health", section: "journeys", label: "Pet health",
        detail: "Review the pet's health calendar", source: "assumption" } },
      { op: "put_fact", fact: { id: "review-health", section: "jobs", label: "Review health",
        detail: "See pet appointments", source: "assumption" } },
    ] }, "11111111-1111-4111-8111-111111111111");
    const dashboard = { ...fixture.roadmap[0], stableKey: "screen:dashboard", name: "Care Dashboard",
      journeyIds: ["booking"], actions: [
        { label: "Log Task", destinationKey: "screen:activity", outcome: "Open activity form" },
        { label: "Add Pet", destinationKey: "screen:pet", outcome: "Open pet setup" },
        { label: "View Calendar", destinationKey: "screen:calendar", outcome: "Open health calendar" },
      ] };
    const activity = { ...fixture.roadmap[0], stableKey: "screen:activity", name: "Log Activity",
      journeyIds: ["booking"], actions: [
        { label: "Confirm", destinationKey: dashboard.stableKey, outcome: "Return to dashboard" },
        { label: "Cancel", destinationKey: dashboard.stableKey, outcome: "Return without saving" },
      ] };
    const pet = { ...fixture.roadmap[0], stableKey: "screen:pet", name: "Pet Profile Setup",
      journeyIds: ["pet-setup"], actions: [{ label: "Save Profile", destinationKey: dashboard.stableKey, outcome: "Return to dashboard" }] };
    const calendar = { ...fixture.roadmap[0], stableKey: "screen:calendar", name: "Health Calendar",
      journeyIds: ["pet-health"], actions: [
        { label: "Add Appointment", destinationKey: null, outcome: "Start appointment entry" },
        { label: "Back", destinationKey: dashboard.stableKey, outcome: "Return to dashboard" },
      ] };
    state.scope!.outputKeys = [dashboard.stableKey, activity.stableKey, pet.stableKey, calendar.stableKey];
    const review = { ...fixture.review, journeys: [
      { ...fixture.review.journeys[0], outputKeys: [dashboard.stableKey, activity.stableKey],
        entryKey: dashboard.stableKey, completionKeys: [activity.stableKey] },
      { ...fixture.review.journeys[0], journeyId: "pet-setup", jobId: "add-pet",
        outputKeys: [pet.stableKey], entryKey: dashboard.stableKey, completionKeys: [dashboard.stableKey] },
      { ...fixture.review.journeys[0], journeyId: "pet-health", jobId: "review-health",
        outputKeys: [calendar.stableKey], entryKey: dashboard.stableKey, completionKeys: [calendar.stableKey] },
    ] };
    const roadmap = [dashboard, activity, pet, calendar];
    const normalized = normalizeJourneyCoverage(state, roadmap, review);
    expect(normalized.journeys.map(journey => journey.outputKeys)).toEqual([
      [dashboard.stableKey, activity.stableKey],
      [pet.stableKey, dashboard.stableKey], [calendar.stableKey, dashboard.stableKey],
    ]);
    expect(validateJourneyCoverage(state, roadmap, review, fixture.messages)).toEqual([]);
    const withoutAddPet = { ...dashboard, actions: dashboard.actions.filter(action => action.label !== "Add Pet") };
    expect(validateJourneyCoverage(state, [withoutAddPet, activity, pet, calendar], review, fixture.messages).join(" "))
      .toContain("cannot reach Pet Profile Setup (screen:pet)");
    const withoutCalendar = { ...dashboard, actions: dashboard.actions.filter(action => action.label !== "View Calendar") };
    expect(validateJourneyCoverage(state, [withoutCalendar, activity, pet, calendar], review, fixture.messages).join(" "))
      .toContain("cannot reach Health Calendar (screen:calendar)");
    const petWithoutSave = { ...pet, actions: [] };
    expect(validateJourneyCoverage(state, [dashboard, activity, petWithoutSave, calendar], review, fixture.messages).join(" "))
      .toContain("must include its entry Care Dashboard (screen:dashboard) and completion outputs");
  });
  it("permits separately declared actor entries without pretending they connect", () => {
    const { state, roadmap, review, messages } = appointmentFlow();
    roadmap[0].actions = [];
    roadmap[1] = { ...roadmap[1], kind: "screen", parentStableKey: null, stateKey: null, triggerLabel: "" };
    const second = { ...review.journeys[0], outputKeys: [roadmap[1].stableKey],
      entryKey: roadmap[1].stableKey, completionKeys: [roadmap[1].stableKey] };
    review.journeys = [{ ...review.journeys[0], outputKeys: [roadmap[0].stableKey],
      entryKey: roadmap[0].stableKey, completionKeys: [roadmap[0].stableKey] }, second];
    expect(validateJourneyCoverage(state, roadmap, review, messages)).toEqual([]);
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
