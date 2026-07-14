import { describe, expect, it } from "vitest";

import { determineGenerationRetryScope } from "@/lib/generation/retry-scope";
import type { ScreenPlan, ScreenStateVariantPlan } from "@/lib/types";

const plans: ScreenPlan[] = [
  { name: "Dashboard", type: "root", description: "Dashboard" },
  { name: "Task Detail", type: "detail", description: "Task detail" },
];

const variants: ScreenStateVariantPlan[] = [{
  id: "date-modal",
  stateKey: "date-modal",
  stateLabel: "Date Modal",
  stateRole: "modal",
  triggerLabel: "Date",
  description: "Date modal",
  editInstruction: "Open the date modal.",
  defaultSelected: true,
}];

describe("generation retry scope", () => {
  it("replays the full pipeline when planning never completed", () => {
    const scope = determineGenerationRetryScope({
      sourceGenerationRunId: "run-1",
      plannedScreens: null,
      stateVariants: [],
      selectedStateVariantIds: [],
      screens: [],
    });

    expect(scope.context.mode).toBe("full_pipeline");
    expect(scope.plannedScreens).toBeNull();
    expect(scope.hasWork).toBe(true);
  });

  it("retries only missing base screens and reuses failed slots", () => {
    const scope = determineGenerationRetryScope({
      sourceGenerationRunId: "run-2",
      plannedScreens: plans,
      stateVariants: [],
      selectedStateVariantIds: [],
      screens: [
        { id: "ready-dashboard", name: "Dashboard", status: "ready", parent_screen_id: null, state_key: null },
        { id: "failed-detail", name: "Task Detail", status: "failed", parent_screen_id: null, state_key: null },
      ],
    });

    expect(scope.context.mode).toBe("missing_screens");
    expect(scope.plannedScreens?.map((plan) => plan.name)).toEqual(["Task Detail"]);
    expect(scope.context.reuseScreenIdsByName).toEqual({ "task detail": "failed-detail" });
  });

  it("retries only missing variants when the parent is already ready", () => {
    const scope = determineGenerationRetryScope({
      sourceGenerationRunId: "run-3",
      plannedScreens: [plans[1]],
      stateVariants: variants,
      selectedStateVariantIds: ["date-modal"],
      screens: [
        { id: "parent", name: "Task Detail", status: "ready", parent_screen_id: null, state_key: "base" },
        { id: "failed-variant", name: "Task Detail - Date Modal", status: "failed", parent_screen_id: "parent", state_key: "date-modal" },
      ],
    });

    expect(scope.context.mode).toBe("state_variants");
    expect(scope.context.parentScreenId).toBe("parent");
    expect(scope.context.reuseStateVariantIdsByKey).toEqual({ "date-modal": "failed-variant" });
    expect(scope.stateVariants.map((variant) => variant.id)).toEqual(["date-modal"]);
  });

  it("does not duplicate outputs that are already ready", () => {
    const scope = determineGenerationRetryScope({
      sourceGenerationRunId: "run-4",
      plannedScreens: [plans[0]],
      stateVariants: [],
      selectedStateVariantIds: [],
      screens: [{ id: "ready", name: "Dashboard", status: "ready", parent_screen_id: null, state_key: null }],
    });

    expect(scope.hasWork).toBe(false);
  });
});
