import { describe, expect, it } from "vitest";
import { createDesignerFactIds } from "./designer-fact-ids";

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
});
