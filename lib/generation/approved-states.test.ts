import { describe, expect, it } from "vitest";
import { retainApprovedStates } from "./approved-states";
import type { ScreenStateVariantPlan } from "@/lib/types";
const variant: ScreenStateVariantPlan = { id: "selected", stateKey: "selected", stateLabel: "Selected", stateRole: "selection", triggerLabel: "Select plan", description: "Change border", editInstruction: "Highlight plan", defaultSelected: true, explicitlyRequested: true };
describe("worker approved state boundary", () => {
  it.each([undefined, null, []])("does not trust model flags with an empty or missing approval (%s)", approval => {
    expect(retainApprovedStates([{ name: "Paywall", type: "detail", description: "One screen", stateVariants: [variant] }], approval)[0].stateVariants).toEqual([]);
  });
  it("retains the approved instructions and rejects model extras", () => {
    const approved = { ...variant, editInstruction: "Show the explicitly requested sheet" };
    expect(retainApprovedStates([{ name: "Paywall", type: "detail", description: "", stateVariants: [variant, { ...variant, id: "invented" }] }], [approved])[0].stateVariants).toEqual([approved]);
  });
  it("keeps separately approved supplied frames as screens", () => {
    expect(retainApprovedStates([{ name: "Source one", type: "detail", description: "" }, { name: "Source two", type: "detail", description: "" }])).toHaveLength(2);
  });
});
