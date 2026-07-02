import { describe, expect, it } from "vitest";

import { selectStateVariantsForApproval } from "@/lib/agent/state-variant-selection";
import type { ScreenStateVariantPlan } from "@/lib/types";

const variant = (id: string, defaultSelected = true): ScreenStateVariantPlan => ({
  id,
  stateKey: id,
  stateLabel: id,
  stateRole: "tab",
  triggerLabel: `${id} tab`,
  description: `${id} content`,
  editInstruction: `Activate ${id}.`,
  defaultSelected,
});

describe("state variant approval selection", () => {
  it("respects an explicit empty selection as parent only", () => {
    const result = selectStateVariantsForApproval(
      { stateVariants: [variant("analytics")] },
      [],
    );

    expect(result.selectedIds).toEqual([]);
    expect(result.selectedVariants).toEqual([]);
    expect(result.invalidIds).toEqual([]);
  });

  it("uses stored selected ids when the request omits selection", () => {
    const result = selectStateVariantsForApproval({
      stateVariants: [variant("analytics"), variant("filters")],
      selectedStateVariantIds: ["filters"],
    });

    expect(result.selectedIds).toEqual(["filters"]);
    expect(result.selectedVariants.map((selected) => selected.id)).toEqual(["filters"]);
  });

  it("falls back to default selected variants when no stored selection exists", () => {
    const result = selectStateVariantsForApproval({
      stateVariants: [variant("analytics", false), variant("filters", true)],
    });

    expect(result.selectedIds).toEqual(["filters"]);
    expect(result.selectedVariants.map((selected) => selected.id)).toEqual(["filters"]);
  });

  it("reports ids that are not in the proposal", () => {
    const result = selectStateVariantsForApproval(
      { stateVariants: [variant("analytics")] },
      ["analytics", "missing"],
    );

    expect(result.selectedVariants).toEqual([]);
    expect(result.invalidIds).toEqual(["missing"]);
  });
});
