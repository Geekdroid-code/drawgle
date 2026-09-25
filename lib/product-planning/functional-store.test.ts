import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { saveProductPatchWithRoadmap, snapshotFunctionalScope, updateFunctionalRoadmap } from "./functional-store";
import { designerFixture, functionalFixture } from "./test-fixtures";
import { productDesignerMemoryStore } from "@/scripts/lib/product-designer-memory-store";
import { applyProductPatch } from "./model";

function fixture() {
  const state = designerFixture();
  const intro = { ...functionalFixture(), actions: [{ label: "Shop", destinationKey: "screen:shop", outcome: "Enter shopping" }] };
  const shop = functionalFixture("screen:shop", "Shop", 1);
  const tables: Record<string, Array<Record<string, unknown>>> = {
    projects: [{ id: "project", owner_id: "owner", product_planning: state }],
    project_screen_roadmap: [intro, shop].map(item => ({ id: item.stableKey, project_id: "project", owner_id: "owner", stable_key: item.stableKey,
      status: "planned", metadata: { functional: item }, generated_screen_id: null })),
  };
  return { state, tables, admin: productDesignerMemoryStore(tables) };
}
describe("functional roadmap scope snapshots", () => {
  it("reports exact missing state identities without mutating the saved scope", async () => {
    const { state, tables, admin } = fixture();
    const before = structuredClone(tables);
    const prospective = { ...state, scope: { ...state.scope!, outputKeys: ["screen:onboarding", "state:onboarding:complete"] } };
    await expect(snapshotFunctionalScope(admin, "project", "owner", prospective)).rejects.toMatchObject({
      code: "SCOPE_OUTPUTS_MISSING", repair: { missingKeys: ["state:onboarding:complete"], availableKeys: ["screen:onboarding", "screen:shop"] },
    });
    expect(tables).toEqual(before);
  });
  it("narrows approval while preserving a navigation link to an unbuilt future screen", async () => {
    const { state, tables, admin } = fixture();
    const before = structuredClone(tables.project_screen_roadmap);
    const snapshot = await snapshotFunctionalScope(admin, "project", "owner", state);
    expect(snapshot.scope.manifest).toHaveLength(1);
    expect(snapshot.scope.boundaries).toEqual([{ key: "screen:shop", name: "Shop", outcome: "Enter the shop" }]);
    expect(snapshot.scope.manifest[0].actions[0].destinationKey).toBe("screen:shop");
    expect(tables.project_screen_roadmap).toEqual(before);
  });
  it("rejects a selected functional output whose decision was superseded", async () => {
    const { state, admin } = fixture();
    const updated = applyProductPatch(state, { operations: [{ op: "supersede_fact", id: "purchase", replacement: {
      id: "new-purchase", section: "journeys", label: "Purchase", detail: "Shops buy on behalf of shoppers", source: "assumption", evidence: "" } }] }, "11111111-1111-4111-8111-111111111111");
    await expect(snapshotFunctionalScope(admin, "project", "owner", updated)).rejects.toThrow(/changed product facts/);
  });
  it("remaps planned roadmap fact IDs in the same save as a supersession", async () => {
    const { state, tables, admin } = fixture();
    const next = applyProductPatch(state, { operations: [{ op: "supersede_fact", id: "purchase", replacement: {
      id: "purchase-v2", section: "journeys", label: "Purchase", detail: "Browse through checkout", source: "assumption", evidence: "",
    } }] }, "11111111-1111-4111-8111-111111111111");
    const saved = await saveProductPatchWithRoadmap(admin, "project", "owner", state, next);
    expect(saved.revision).toBe(state.revision + 1);
    expect(tables.project_screen_roadmap.every(row => (row.metadata as { functional: { journeyIds: string[] } }).functional.journeyIds.includes("purchase-v2"))).toBe(true);
    expect((tables.projects[0].product_planning as { revision: number }).revision).toBe(saved.revision);
  });
  it("commits a small delta with the substantive revision and discards a stale proposal", async () => {
    const { state, tables, admin } = fixture();
    state.scope!.status = "proposed";
    const next = await updateFunctionalRoadmap(admin, "project", "owner", state, { items: [{ ...functionalFixture("screen:shop", "Shop", 1), information: "Product grid with sizes and availability" }], removeKeys: [] });
    expect(next.contentRevision).toBe((state.contentRevision ?? 0) + 1);
    expect(next.scope?.status).toBe("draft");
    expect(tables.project_screen_roadmap).toHaveLength(2);
    expect((tables.projects[0].product_planning as { revision: number }).revision).toBe(next.revision);
  });
  it("auto-provisions missing surfaces and journeys when updating roadmap", async () => {
    const { state, tables, admin } = fixture();
    // Clear existing surfaces to simulate project 6fcd43ee-7f80-4e94-9d64-64c9a4a1605e
    state.blueprint.facts = state.blueprint.facts.filter(f => f.section !== "surfaces");
    const item = {
      ...functionalFixture("screen:passenger-home", "Passenger Home", 1),
      surfaceIds: ["surface-passenger-booking"],
      journeyIds: ["journey-priority-passenger-v1"],
      decisionIds: ["nonexistent-or-superseded-decision-id"],
      actions: [{ label: "Profile", destinationKey: "screen:profile-external", outcome: "View profile" }],
    };
    await expect(updateFunctionalRoadmap(admin, "project", "owner", state, { items: [item], removeKeys: [] }))
      .rejects.toThrow(/missing output screen:profile-external/);
    expect(tables.project_screen_roadmap.some(r => r.stable_key === "screen:passenger-home")).toBe(false);
    const next = await updateFunctionalRoadmap(admin, "project", "owner", state,
      { items: [{ ...item, actions: [{ ...item.actions[0], destinationKey: null }] }], removeKeys: [] });
    expect(next.blueprint.facts.some(f => f.id === "surface-passenger-booking" && f.section === "surfaces")).toBe(true);
    expect(next.blueprint.facts.some(f => f.id === "journey-priority-passenger-v1" && f.section === "journeys")).toBe(true);
    expect(tables.project_screen_roadmap.some(r => r.stable_key === "screen:passenger-home")).toBe(true);
  });
  it("normalizes kind state to screen in non-recreation mode without crashing", async () => {
    const { state, tables, admin } = fixture();
    state.input.imageReferenceMode = "style";
    const stateItem = {
      ...functionalFixture("screen:results", "Search Results", 2),
      kind: "state" as const,
      parentStableKey: "screen:onboarding",
      stateKey: "results",
      triggerLabel: "Search",
      editInstruction: "Show results",
    };
    const next = await updateFunctionalRoadmap(admin, "project", "owner", state, { items: [stateItem], removeKeys: [] });
    const saved = tables.project_screen_roadmap.find(r => r.stable_key === "screen:results");
    expect((saved?.metadata as any)?.functional?.kind).toBe("screen");
  });
});
