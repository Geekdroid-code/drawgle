import { describe, expect, it } from "vitest";
import { activeFacts, applyProductPatch, approveProductScope, createProductPlanning, proposeProductScope, readinessIssues, readProductPlanning } from "./model";
import { formatProductTruth, groundCharterInProduct, productScopeContract, scopedGenerationPrompt } from "./generation-context";
import { productFixture, designerFixture } from "./test-fixtures";
import type { ProjectCharter } from "@/lib/types";

const messageId = "11111111-1111-4111-8111-111111111111";

describe("durable product truth and scope", () => {
  it("leaves legacy projects untouched and fails closed on malformed state", () => {
    expect(readProductPlanning(null)).toBeNull();
    expect(() => readProductPlanning({ phase: "canvas" })).toThrow();
  });
  it("narrowing the design scope retains the whole product and roadmap", () => {
    const state = productFixture();
    const changed = applyProductPatch(state, { operations: [{ op: "set_scope", goal: "Purchase flow", surfaceIds: ["shop", "cart"], rationale: "Focus on buying" }] }, messageId);
    expect(changed.blueprint).toEqual(state.blueprint);
    expect(activeFacts(changed, "surfaces").map((fact) => fact.id)).toContain("orders");
    expect(changed.scope?.surfaceIds).toEqual(["shop", "cart"]);
  });
  it("invalidates proposals on product corrections and rejects stale approval revisions", () => {
    const proposal = { ...proposeProductScope(productFixture()), revision: 8 };
    const changed = applyProductPatch(proposal, { operations: [{ op: "put_fact", fact: { id: "guest", section: "decisions", label: "Guest checkout", detail: "No account required to purchase", source: "user", evidence: "No account required" } }] }, messageId);
    expect(changed.scope?.status).toBe("draft");
    expect(() => approveProductScope(changed, 8)).toThrow();
    expect(() => approveProductScope(proposal, 7)).toThrow();
    expect(approveProductScope(proposal, 8).scope?.approvedRevision).toBe(8);
  });
  it("supersedes decisions with provenance and excludes the old truth downstream", () => {
    let state = applyProductPatch(productFixture(), { operations: [{ op: "put_fact", fact: { id: "accounts", section: "decisions", label: "Accounts", detail: "Mechanics create accounts", source: "assumption", evidence: "" } }] }, messageId);
    state = applyProductPatch(state, { operations: [{ op: "supersede_fact", id: "accounts", replacement: { id: "shop-onboarding", section: "decisions", label: "Shop onboarding", detail: "Shops onboard mechanics", source: "user", evidence: "shops onboard them instead" } }] }, messageId);
    expect(state.blueprint.facts.find((fact) => fact.id === "accounts")).toMatchObject({ status: "superseded", source: "assumption", supersededBy: "shop-onboarding" });
    expect(activeFacts(state, "decisions")[0]).toMatchObject({ source: "user", messageId });
    expect(formatProductTruth(state)).not.toContain("Mechanics create accounts");
    expect(formatProductTruth(state)).toContain("Shops onboard mechanics");
  });
  it("treats repeated supersessions as one decision and protects a newer meaning", () => {
    const original = productFixture();
    const first = { op: "supersede_fact", id: "shop", replacement: {
      id: "storefront", section: "surfaces", label: "Storefront", detail: "Browse the T-shirt catalog",
      source: "assumption", evidence: "",
    } };
    const updated = applyProductPatch(original, { operations: [first, first] }, messageId);
    expect(activeFacts(updated, "surfaces").filter(fact => fact.id === "storefront")).toHaveLength(1);
    expect(applyProductPatch(updated, { operations: [first] }, messageId)).toBe(updated);
    expect(applyProductPatch(updated, { operations: [{ ...first, replacement: {
      ...first.replacement, id: "same-storefront", provenance: { basis: "inferred" },
    } }] }, messageId)).toBe(updated);
    expect(() => applyProductPatch(updated, { operations: [{ ...first, replacement: {
      ...first.replacement, id: "different-storefront", detail: "An unrelated product",
    } }] }, messageId)).toThrow(/current active decision/);
    const latest = applyProductPatch(updated, { operations: [{ op: "supersede_fact", id: "storefront",
      replacement: { ...first.replacement, id: "storefront-v2", detail: "Browse family T-shirts" } }] }, messageId);
    expect(applyProductPatch(latest, { operations: [{ ...first, replacement: {
      ...first.replacement, id: "stale-alias", detail: "Browse family T-shirts",
    } }] }, messageId)).toBe(latest);
  });
  it("rejects overwritten IDs, dangling scopes and unsubstantiated user facts atomically", () => {
    const state = productFixture();
    const before = structuredClone(state);
    expect(() => applyProductPatch(state, { operations: [{ op: "set_scope", goal: "Missing surface", surfaceIds: ["missing"], rationale: "Invalid" }] }, messageId)).toThrow(/scope/i);
    expect(() => applyProductPatch(state, { operations: [{ op: "put_fact", fact: { ...state.blueprint.facts[0], source: "user", evidence: "" } }] }, messageId)).toThrow();
    expect(state).toEqual(before);
  });
  it("treats identical retried facts and scope as no-ops, but identifies changed facts and broken links", () => {
    const state = productFixture();
    const existing = state.blueprint.facts[0];
    expect(applyProductPatch(state, { operations: [{ op: "put_fact", fact: existing }] }, messageId)).toBe(state);
    expect(applyProductPatch(state, { operations: [{ op: "set_scope", goal: state.scope!.goal,
      surfaceIds: state.scope!.surfaceIds, outputKeys: state.scope!.outputKeys, rationale: state.scope!.rationale }] }, messageId)).toBe(state);
    expect(() => applyProductPatch(state, { operations: [{ op: "put_fact", fact: { ...existing, detail: "Changed meaning" } }] }, messageId))
      .toThrow(/already exists/);
    expect(() => applyProductPatch(state, { operations: [{ op: "put_fact", fact: {
      id: "broken", section: "decisions", label: "Broken", detail: "A linked decision", source: "assumption", evidence: "", links: ["missing"],
    } }] }, messageId)).toThrow(/links to inactive or missing facts/);
  });
  it("blocks only unresolved questions marked material to the current scope", () => {
    const state = applyProductPatch(productFixture(), { operations: [{ op: "put_fact", fact: { id: "personalization", section: "questions", label: "Onboarding screen", detail: "Which onboarding screen should be shown?", source: "assumption", evidence: "", blocking: true, designDecisionType: "screen_scope" } }] }, messageId);
    expect(() => proposeProductScope(state)).toThrow(/onboarding screen/);
    const resolved = applyProductPatch(state, { operations: [{ op: "supersede_fact", id: "personalization", replacement: null }] }, messageId);
    expect(readinessIssues(resolved)).toEqual([]);
  });
  it("does not block screen design on legacy implementation questions", () => {
    const state = applyProductPatch(productFixture(), { operations: [{ op: "put_fact", fact: { id: "file_format", section: "questions", label: "File output", detail: "Should animations be MP4 or GIF?", source: "assumption", evidence: "", blocking: true } }] }, messageId);
    expect(readinessIssues(state)).toEqual([]);
    expect(proposeProductScope(state).scope?.status).toBe("proposed");
  });
  it("ignores an implementation question mislabeled as a screen choice", () => {
    const state = applyProductPatch(productFixture(), { operations: [{ op: "put_fact", fact: { id: "cloud_choice", section: "questions", label: "Cloud gallery", detail: "Should the gallery screen use cloud sync or local storage?", source: "assumption", evidence: "", blocking: true, designDecisionType: "screen_scope" } }] }, messageId);
    expect(readinessIssues(state)).toEqual([]);
  });
  it("lets narrow image recreation propose immediately without inventing a full product", () => {
    const state = designerFixture();
    state.input.imageReferenceMode = "recreate";
    state.evidenceAssessment!.mode = "recreate";
    state.scope!.manifest![0].referenceScreenIndex = 1;
    state.blueprint.facts = productFixture().blueprint.facts.filter((fact) => ["identity", "surfaces"].includes(fact.section));
    expect(proposeProductScope(state).scope?.status).toBe("proposed");
    expect(readinessIssues({ ...state, input: { ...state.input, imageReferenceMode: "style" } })).toContain("Clarify the product's actors.");
  });
  it("feeds the existing concrete scope contract without shrinking product truth", () => {
    const state = approveProductScope(proposeProductScope(productFixture()), 0);
    const contract = productScopeContract(state, "curated_style");
    expect(contract.finalScreenCount).toBe(1);
    expect(contract.screens?.map((screen) => screen.name)).toEqual(["Onboarding"]);
    expect(scopedGenerationPrompt(state)).toContain("Sophisticated and minimal");
    expect(scopedGenerationPrompt(state)).not.toContain("Orders");
    expect(formatProductTruth(state, true)).toContain("Orders");
  });
  it("grounds charter product fields without replacing downstream reference/navigation design", () => {
    const charter = { appType: "Wrong product", targetAudience: "Everyone", keyFeatures: ["Manifesto"], navigationModel: "Tabs", designRationale: "Editorial" } as ProjectCharter;
    const grounded = groundCharterInProduct(charter, productFixture());
    expect(grounded.appType).toBe("Sell T-shirts");
    expect(grounded.keyFeatures).toEqual(["Purchase: Select sizes and place an order"]);
    expect(grounded.designRationale).toBe("Editorial");
    expect(grounded.navigationModel).toBe("Tabs");
  });
});
