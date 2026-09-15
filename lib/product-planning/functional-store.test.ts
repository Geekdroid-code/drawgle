import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { snapshotFunctionalScope, updateFunctionalRoadmap } from "./functional-store";
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
  it("commits a small delta with the substantive revision and discards a stale proposal", async () => {
    const { state, tables, admin } = fixture();
    state.scope!.status = "proposed";
    const next = await updateFunctionalRoadmap(admin, "project", "owner", state, { items: [{ ...functionalFixture("screen:shop", "Shop", 1), information: "Product grid with sizes and availability" }], removeKeys: [] });
    expect(next.contentRevision).toBe((state.contentRevision ?? 0) + 1);
    expect(next.scope?.status).toBe("draft");
    expect(tables.project_screen_roadmap).toHaveLength(2);
    expect((tables.projects[0].product_planning as { revision: number }).revision).toBe(next.revision);
  });
});
