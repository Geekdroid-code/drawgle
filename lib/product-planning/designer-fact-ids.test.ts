import { describe, expect, it } from "vitest";
import { createDesignerFactIds } from "./designer-fact-ids";
import { applyProductPatch } from "./model";
import { productFixture } from "./test-fixtures";

describe("designer fact identities", () => {
  it("keeps later calls in the same model response aligned with normalized fact IDs", () => {
    const ids = createDesignerFactIds();
    ids.rememberProductArgs({ facts: [
      { id: "Today Screen" }, { id: "Family Journey" }, { id: "Confirmed Decision" },
    ] });
    expect(ids.scopeArgs({ goal: "Design Today", surfaceIds: ["Today Screen"] })).toMatchObject({ surfaceIds: ["today-screen"] });
    expect(ids.functionalArgs({ items: [{ stableKey: "screen:today", surfaceIds: ["Today Screen"],
      journeyIds: ["Family Journey"], decisionIds: ["Confirmed Decision"] }] })).toMatchObject({ items: [{
        surfaceIds: ["today-screen"], journeyIds: ["family-journey"], decisionIds: ["confirmed-decision"],
      }] });
  });
  it("uses active successors in same-response roadmap and scope calls", () => {
    const state = applyProductPatch(productFixture(), { operations: [{ op: "supersede_fact", id: "shop", replacement: {
      id: "storefront", section: "surfaces", label: "Storefront", detail: "Browse the catalog",
      source: "assumption", evidence: "",
    } }] }, "11111111-1111-4111-8111-111111111111");
    const ids = createDesignerFactIds();
    ids.rememberActiveSuccessors(state);
    expect(ids.scopeArgs({ surfaceIds: ["shop"] })).toMatchObject({ surfaceIds: ["storefront"] });
    expect(ids.functionalArgs({ items: [{ surfaceIds: ["shop"], journeyIds: [], decisionIds: [] }] }))
      .toMatchObject({ items: [{ surfaceIds: ["storefront"] }] });
  });
});
