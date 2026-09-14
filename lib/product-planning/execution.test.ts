import { describe, expect, it } from "vitest";
import { nextProductBatch, productExecutionProgress, type ProductFulfillment } from "./execution";
import { functionalFixture, designerFixture } from "./test-fixtures";
import { validateFunctionalPlan } from "./functional-plan";
import { executionOutputs, scopeQuote } from "./scope-outputs";
import { productScopeContract, formatProductTruth } from "./generation-context";
import { approveProductScope, proposeProductScope } from "./model";

const stateItem = (index: number, parent = "screen:onboarding") => ({ ...functionalFixture(`state:welcome:${index}`, `Welcome ${index}`, index + 1), kind: "state" as const,
  parentStableKey: parent, stateKey: `variant-${index}`, triggerLabel: "User starts", editInstruction: "Show the next onboarding step" });
describe("approved product output execution", () => {
  it("delivers a scope across batch limits with states immediately following their parent", () => {
    const first = functionalFixture();
    const parents = Array.from({ length: 7 }, (_, i) => functionalFixture(`screen:next-${i}`, `Next ${i}`, i + 20));
    const manifest = [first, ...Array.from({ length: 10 }, (_, i) => stateItem(i)), ...parents];
    validateFunctionalPlan(manifest);
    const claims: ProductFulfillment[] = [];
    const batches: string[][] = [];
    while (claims.length < manifest.length) {
      const batch = nextProductBatch(manifest, claims);
      expect(batch.length).toBeGreaterThan(0);
      expect(batch.length).toBeLessThanOrEqual(8);
      batches.push(batch.map(item => item.stableKey));
      claims.push(...batch.map(item => ({ output_key: item.stableKey, status: "ready" as const, generation_run_id: `batch-${batches.length}`, screen_id: "screen-id" })));
    }
    expect(batches[0]).toHaveLength(8);
    expect(batches[1]).toEqual(["state:welcome:7", "state:welcome:8", "state:welcome:9"]);
    expect(new Set(claims.map(claim => claim.output_key)).size).toBe(manifest.length);
  });
  it("resumes an existing claim instead of selecting duplicate outputs", () => {
    const manifest = [functionalFixture(), stateItem(0)];
    const claims = manifest.map(item => ({ output_key: item.stableKey, generation_run_id: "same", status: "claimed" as const, screen_id: null }));
    expect(nextProductBatch(manifest, claims)).toEqual(manifest);
  });
  it("blocks states after parent failure while allowing independent work", () => {
    const parent = functionalFixture();
    const other = functionalFixture("screen:other", "Other", 5);
    const claims: ProductFulfillment[] = [{ output_key: parent.stableKey, status: "failed", generation_run_id: "failed", screen_id: null }];
    expect(nextProductBatch([parent, stateItem(0), other], claims)).toEqual([other]);
    expect(nextProductBatch([parent, stateItem(0)], claims)).toEqual([]);
    expect(productExecutionProgress([parent, stateItem(0), other], claims)).toEqual({ total: 3, delivered: 0, failed: 1, blocked: 1, pending: 1 });
  });
  it("uses an existing ready parent for new state-only scope", () => {
    expect(nextProductBatch([stateItem(0)], [], 8, ["screen:onboarding"])).toEqual([stateItem(0)]);
  });
  it("quotes seven parents and four states at the existing prices", () => {
    const state = designerFixture();
    state.scope!.manifest = [...Array.from({ length: 7 }, (_, i) => functionalFixture(`screen:${i}`, `Screen ${i}`, i)), ...Array.from({ length: 4 }, (_, i) => stateItem(i, "screen:0"))];
    expect(scopeQuote(state)).toEqual({ parents: 7, states: 4, credits: 180 });
  });
  it("rejects orphaned states, missing action destinations and cyclic prerequisites", () => {
    expect(() => validateFunctionalPlan([stateItem(0)])).toThrow(/parent/);
    expect(() => validateFunctionalPlan([{ ...functionalFixture(), actions: [{ label: "Continue", destinationKey: "missing", outcome: "Next" }] }])).toThrow(/missing/);
    expect(() => validateFunctionalPlan([{ ...functionalFixture(), dependencyKeys: ["screen:onboarding"] }])).toThrow(/cycle/);
  });
  it("lease-only revisions preserve review but substantive changes invalidate approval", () => {
    const state = proposeProductScope(designerFixture());
    expect(approveProductScope({ ...state, revision: 4 }, 4).scope?.status).toBe("approved");
    expect(() => approveProductScope({ ...state, contentRevision: (state.contentRevision ?? 0) + 1 }, state.revision)).toThrow(/decisions changed/);
  });
  it("selects bounded execution without losing the approved global flow", () => {
    const state = designerFixture();
    state.scope!.manifest!.push(functionalFixture("screen:next", "Next", 1));
    expect(productScopeContract(state, "user_style", ["screen:next"]).screens?.map(screen => screen.name)).toEqual(["Next"]);
    expect(formatProductTruth(state, true)).toContain("screen:onboarding");
    expect(() => executionOutputs(state, ["unapproved"])).toThrow(/approved manifest/);
    expect(() => executionOutputs(state, ["screen:next", "screen:next"])).toThrow(/unique/);
  });
  it("accepts already-built prerequisites without requiring their unrelated future destinations", () => {
    const parent = { ...functionalFixture(), actions: [{ label: "Later", destinationKey: "screen:future", outcome: "Later roadmap destination" }] };
    expect(validateFunctionalPlan([stateItem(0)], [parent])).toHaveLength(1);
    expect(() => validateFunctionalPlan([functionalFixture(), stateItem(0), stateItem(0)])).toThrow(/unique/);
  });
  it("keeps future navigation destinations intact when narrowing scope, but never treats them as built prerequisites", () => {
    const parent = { ...functionalFixture(), actions: [{ label: "Shop", destinationKey: "screen:shop", outcome: "Enter the future shopping flow" }] };
    expect(validateFunctionalPlan([parent], [], ["screen:shop"])).toEqual([parent]);
    expect(parent.actions[0].destinationKey).toBe("screen:shop");
    expect(() => validateFunctionalPlan([{ ...parent, dependencyKeys: ["screen:shop"] }], [], ["screen:shop"])).toThrow(/unbuilt/);
  });
});
