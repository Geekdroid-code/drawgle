import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { functionalFixture, designerFixture } from "./test-fixtures";
import { outputRendering, validateNewOutputPolicy } from "./output-policy";
import { scopeParents, scopeQuote } from "./scope-outputs";
import { validateExecutionProduct, approvedOutputKind } from "./execution-contract";
import { nextProductBatch } from "./execution";
import { compileProductContent } from "./content-contract";
import { applyEvidenceVerdicts } from "./review-fact-evidence";
import { prepareDesignerPatch } from "./designer-patch";
import { applyScreenCopyReview } from "./review-screen-content";
import { preparedPlanKey } from "./prepared-plans";

const parent = () => functionalFixture();
const variant = () => ({ ...functionalFixture("state:select", "Payment options", 1), kind: "state" as const,
  parentStableKey: parent().stableKey, stateKey: "select", triggerLabel: "Choose payment", editInstruction: "Show source frame 2" });

describe("production output contracts", () => {
  it("rejects unsolicited states and style frame indices, accepts inline behavior and real tasks", () => {
    expect(() => validateNewOutputPolicy([variant()], false)).toThrow(/Create state/);
    expect(() => validateNewOutputPolicy([{ ...parent(), referenceScreenIndex: 1 }], false)).toThrow(/only to exact/);
    expect(() => validateNewOutputPolicy([{ ...parent(), inlineStates: ["Increment progress without a new frame"] }, functionalFixture("screen:create", "Add habit", 2)], false)).not.toThrow();
  });
  it("recreates supplied state frames directly while retaining their approved price and relationship", () => {
    const state = designerFixture(); state.input.imageReferenceMode = "recreate";
    state.scope!.status = "approved";
    state.scope!.manifest = [{ ...parent(), referenceScreenIndex: 1 }, { ...variant(), referenceScreenIndex: 2 }];
    expect(outputRendering(state.scope!.manifest[1], true)).toBe("reference_frame");
    expect(scopeParents(state)).toHaveLength(2);
    expect(scopeQuote(state)).toEqual({ parents: 1, states: 1, credits: 30 });
    expect(approvedOutputKind(state, "state:select")).toBe("state");
    expect(nextProductBatch(state.scope!.manifest, [], 8, [], true)).toHaveLength(2);
    expect(() => validateNewOutputPolicy(state.scope!.manifest!, true)).not.toThrow();
  });
  it("verifies immutable pixels, rejects missing or duplicate source frames", () => {
    const state = designerFixture(); state.input.imageReferenceMode = "recreate"; state.scope!.status = "approved";
    state.scope!.outputPolicy = "manual_states_v1";
    state.scope!.manifest = [{ ...parent(), referenceScreenIndex: 1 }, { ...variant(), referenceScreenIndex: 2 }];
    state.experience!.referenceHash = createHash("sha256").update("original").digest("hex");
    expect(() => validateExecutionProduct(state, { data: "original", mimeType: "image/png" })).not.toThrow();
    expect(() => validateExecutionProduct(state, { data: "changed", mimeType: "image/png" })).toThrow(/verified/);
    expect(() => validateNewOutputPolicy([parent(), variant()], true)).toThrow(/source index/);
    expect(() => validateNewOutputPolicy([{ ...parent(), referenceScreenIndex: 1 }, { ...variant(), referenceScreenIndex: 1 }], true)).toThrow(/once/);
  });
  it("grandfathers approved legacy states but enforces the new policy in workers", () => {
    const state = designerFixture(); state.scope!.status = "approved"; state.scope!.manifest = [parent(), variant()];
    expect(() => validateExecutionProduct(state)).not.toThrow();
    state.scope!.outputPolicy = "manual_states_v1";
    expect(() => validateExecutionProduct(state)).toThrow(/Create state/);
  });
  it("admits eight independent screens without making navigation a render dependency", () => {
    const items = Array.from({ length: 13 }, (_, i) => functionalFixture(`screen:${i}`, `Screen ${i}`, i));
    items[0].actions = [{ label: "Next", destinationKey: items[1].stableKey, outcome: "Continue" }];
    expect(nextProductBatch(items, [])).toEqual(items.slice(0, 8));
    const claims = items.slice(0, 8).map(item => ({ output_key: item.stableKey, generation_run_id: "run", status: "ready" as const, screen_id: "id" }));
    expect(nextProductBatch(items, claims)).toEqual(items.slice(8));
  });
});

describe("audience and evidence boundaries", () => {
  it("downgrades an entire unsupported claim despite a matching user quotation", () => {
    const state = designerFixture();
    const prepared = prepareDesignerPatch("update_product", { facts: [{ id: "technical", section: "identity", label: "Premium technical tracker",
      detail: "A technical biometric tracker for high-performance users", source: "user", evidence: "Build me a premium habit tracker app" }] },
    ["Build me a premium habit tracker app"], [], state.evidenceAssessment!);
    expect(prepared.patch.operations[0]).toHaveProperty("fact.source", "user");
    applyEvidenceVerdicts(prepared, { verdicts: [{ id: "technical", supported: false, reason: "Audience and biometrics were invented" }] });
    expect(prepared.patch.operations[0]).toHaveProperty("fact.source", "assumption");
    expect(() => applyEvidenceVerdicts(prepareDesignerPatch("update_product", { facts: [{ id: "habit", section: "identity", label: "Habit app", detail: "Habit tracker", source: "user", evidence: "Habit tracker" }] }, ["Habit tracker"], [], state.evidenceAssessment!), { verdicts: [] })).toThrow(/every new/);
  });
  it("derives optional fact bookkeeping before validating the saved design fact", () => {
    const state = designerFixture();
    const prepared = prepareDesignerPatch("update_product", { facts: [{
      id: "Today Screen", section: "surfaces", label: "Today", detail: "Shows today's tasks",
      source: "user", evidence: "Shows today's tasks", provenance: { basis: "direct", recommendationMessageId: "" },
      links: ["KIDS", "KIDS", "not a valid id!"], decisionKey: "bad key", designDecisionType: "backend",
    }] }, ["Shows today's tasks"], [], state.evidenceAssessment!);
    expect(prepared.patch.operations[0]).toMatchObject({ op: "put_fact", fact: {
      id: "today-screen", source: "user", provenance: { basis: "direct", recommendationMessageId: null }, links: ["kids", "not-a-valid-id"],
    } });
    expect(prepared.patch.operations[0]).not.toHaveProperty("fact.decisionKey");
    expect(prepared.patch.operations[0]).not.toHaveProperty("fact.designDecisionType");
  });
  it("keeps product content independent of unrelated reference observations", () => {
    const state = designerFixture(); state.experience!.observations = "Password vault terminal";
    const content = compileProductContent(state)!;
    expect(content).toContain("actual audience"); expect(content).not.toContain("Password vault terminal");
    const screens = [{ name: "Today", type: "root" as const, description: "CONTENT: COMMIT PROTOCOL. LAYOUT: glass cards." }];
    expect(applyScreenCopyReview(screens, { edits: [{ screenName: "Today", from: "COMMIT PROTOCOL", to: "Add habit" }] })[0].description).toBe("CONTENT: Add habit. LAYOUT: glass cards.");
    expect(applyScreenCopyReview(screens, { edits: [{ screenName: "Missing", from: "x", to: "y" }] })).toEqual(screens);
    expect(applyScreenCopyReview(screens, { edits: [{ screenName: "Missing", from: "x", to: "y" }] }, false)).toEqual(screens);
    expect(applyScreenCopyReview(screens, { edits: [{ screenName: "Today", from: "NONEXISTENT", to: "y" }] }, false)).toEqual(screens);
    expect(applyScreenCopyReview(screens, { edits: [{ screenName: "today ", from: "COMMIT PROTOCOL", to: "Add habit" }] }, false)[0].description).toBe("CONTENT: Add habit. LAYOUT: glass cards.");
  });
  it("invalidates prepared briefs when approval, pixels, content or shared context changes", () => {
    const state = designerFixture(); const key = preparedPlanKey(state, ["screen:onboarding"], { tokens: 1, nav: 2 });
    expect(preparedPlanKey(state, ["screen:onboarding"], { nav: 2, tokens: 1 })).toBe(key);
    expect(preparedPlanKey(state, ["screen:onboarding"], { nav: 2, tokens: 3 })).not.toBe(key);
    state.experience!.referenceHash = "different";
    expect(preparedPlanKey(state, ["screen:onboarding"], { tokens: 1, nav: 2 })).not.toBe(key);
  });
});
