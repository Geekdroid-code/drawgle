import { describe, expect, it } from "vitest";
import { orderDesignerCalls } from "./designer-call-order";

describe("designer tool dependencies", () => {
  it("saves facts and roadmap before scope and review, independent of model call order", () => {
    const calls = ["propose_scope", "set_design_scope", "inspect_reference", "update_functional_plan",
      "update_product", "set_reference_preference"].map(name => ({ name }));
    expect(orderDesignerCalls(calls).map(call => call.name)).toEqual([
      "set_reference_preference", "update_product", "update_functional_plan", "inspect_reference",
      "set_design_scope", "propose_scope",
    ]);
    expect(calls[0].name).toBe("propose_scope");
  });
  it("preserves multiple fact updates in their original order", () => {
    expect(orderDesignerCalls([{ name: "update_product", id: 1 }, { name: "update_product", id: 2 }])
      .map(call => call.id)).toEqual([1, 2]);
  });
});
