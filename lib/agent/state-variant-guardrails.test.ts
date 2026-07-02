import { describe, expect, it } from "vitest";

import { filterMeaningfulStateVariants, isMeaningfulStateVariant } from "@/lib/agent/state-variant-guardrails";
import type { ScreenStateVariantPlan } from "@/lib/types";

const variant = (overrides: Partial<ScreenStateVariantPlan>): ScreenStateVariantPlan => ({
  id: "variant",
  stateKey: "variant",
  stateLabel: "Variant",
  stateRole: "same-screen state",
  triggerLabel: "Variant",
  description: "A meaningful same-screen state with changed content.",
  editInstruction: "Preserve the shell and change only the relevant content body.",
  defaultSelected: true,
  ...overrides,
});

describe("state variant guardrails", () => {
  it("rejects dark/light/theme and compact-mode visual preference variants", () => {
    expect(isMeaningfulStateVariant(variant({
      id: "light-theme",
      stateKey: "light-theme",
      stateLabel: "Light",
      stateRole: "Theme segmented control state",
      triggerLabel: "Light",
      description: "Same settings screen with the Light theme option selected.",
      editInstruction: "Activate Light in the Interface Theme control and update the theme selection.",
    }))).toBe(false);

    expect(isMeaningfulStateVariant(variant({
      id: "compact-mode",
      stateKey: "compact-mode",
      stateLabel: "Compact",
      stateRole: "Display density toggle state",
      triggerLabel: "Compact Mode",
      description: "Same settings screen with compact density turned on.",
      editInstruction: "Turn on Compact Mode and make spacing denser.",
    }))).toBe(false);
  });

  it("keeps paid-worthy modal and tab body variants", () => {
    expect(isMeaningfulStateVariant(variant({
      id: "add-wallet-modal",
      stateKey: "add-wallet-modal",
      stateLabel: "Add Wallet",
      stateRole: "Modal open state for the plus button",
      triggerLabel: "Plus button",
      description: "Same wallet screen with the add-wallet modal open and form fields visible.",
      editInstruction: "Open the add-wallet modal, preserve the screen shell, and add only the modal form overlay.",
    }))).toBe(true);

    expect(isMeaningfulStateVariant(variant({
      id: "analytics",
      stateKey: "analytics",
      stateLabel: "Analytics",
      stateRole: "Alternate tab with distinct analytics content body",
      triggerLabel: "Analytics tab",
      description: "Same dashboard shell with the Analytics tab active and chart/table content in the tab body.",
      editInstruction: "Activate Analytics and replace only the tab body with analytics cards, charts, and table content.",
    }))).toBe(true);
  });

  it("filters mixed planner output before it reaches proposal UI", () => {
    const variants = filterMeaningfulStateVariants([
      variant({
        id: "light-theme",
        stateKey: "light-theme",
        stateLabel: "Light",
        stateRole: "Theme selection",
        triggerLabel: "Light",
        description: "Same screen with Light selected.",
        editInstruction: "Select Light theme.",
      }),
      variant({
        id: "create-item-modal",
        stateKey: "create-item-modal",
        stateLabel: "Create Item",
        stateRole: "Modal open state",
        triggerLabel: "Add",
        description: "Same screen with the create-item modal open and form content visible.",
        editInstruction: "Open the create item modal and show the form overlay.",
      }),
    ]);

    expect(variants.map((item) => item.id)).toEqual(["create-item-modal"]);
  });
});
