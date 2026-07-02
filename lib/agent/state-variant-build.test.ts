import { describe, expect, it } from "vitest";

import {
  buildStateVariantEditActivityKey,
  buildStateVariantEditInstruction,
  buildStateVariantFailurePatch,
  stateVariantScreenName,
} from "@/lib/agent/state-variant-build";
import type { ScreenStateVariantPlan } from "@/lib/types";

const variant: ScreenStateVariantPlan = {
  id: "analytics",
  stateKey: "analytics",
  stateLabel: "Analytics",
  stateRole: "tab",
  triggerLabel: "Analytics tab",
  description: "Analytics content",
  editInstruction: "Activate Analytics and show chart content.",
  defaultSelected: true,
};

describe("state variant build helpers", () => {
  it("builds distinct edit activity keys for variants in one approval run", () => {
    expect(buildStateVariantEditActivityKey("run-1", "analytics")).toBe("edit:run-1:analytics");
    expect(buildStateVariantEditActivityKey("run-1", "filters")).toBe("edit:run-1:filters");
    expect(buildStateVariantEditActivityKey("run-1", "analytics")).not.toBe(
      buildStateVariantEditActivityKey("run-1", "filters"),
    );
  });

  it("converts no-op or caught variant edits into unmistakable failed screen output", () => {
    const patch = buildStateVariantFailurePatch("No material change from parent <div>clone</div>");

    expect(patch.status).toBe("failed");
    expect(patch.error).toBe("No material change from parent <div>clone</div>");
    expect(patch.code).toContain("State variant failed");
    expect(patch.code).toContain("&lt;div&gt;clone&lt;/div&gt;");
    expect(patch.code).not.toContain("<div>clone</div>");
    expect(patch.code).not.toContain("drawgle-root");
  });

  it("keeps state edit instructions scoped to same-screen changes", () => {
    const instruction = buildStateVariantEditInstruction("Dashboard", variant);

    expect(instruction).toContain("Create the \"Analytics\" local state");
    expect(instruction).toContain("Preserve the parent screen shell");
    expect(instruction).toContain("Do not create a route, detail page, CTA destination");
    expect(instruction).toContain("Return edits against the current saved HTML source");
  });

  it("uses the parent/state name convention without relying on it for behavior", () => {
    expect(stateVariantScreenName("Dashboard", "Analytics")).toBe("Dashboard / Analytics");
    expect(stateVariantScreenName("", "")).toBe("Screen / State");
    expect(stateVariantScreenName("A".repeat(120), "B".repeat(40))).toHaveLength(100);
  });
});
