import { describe, expect, it } from "vitest";

import {
  CONTENT_JUSTIFICATION_HEIGHT_PX,
  formatLayoutBudgetContract,
  resolveRegionContracts,
  resolveViewportBudget,
  type LayoutBudgetDiagnostic,
} from "@/lib/generation/layout-budget";
import type { ScreenLayoutRegion } from "@/lib/types";

const regions: ScreenLayoutRegion[] = [
  { id: "header", purpose: "Screen title and controls", contentKind: "header" },
  { id: "hero", purpose: "Editorial focal moment", contentKind: "focal" },
  { id: "collection-grid", purpose: "Curated collection pair", contentKind: "media" },
  { id: "footnote", purpose: "Secondary supporting copy", contentKind: "supporting" },
];

const diagnose = () => [] as LayoutBudgetDiagnostic[];

describe("resolveViewportBudget", () => {
  it("derives heights and an above-fold selection when the planner supplies none", () => {
    const diagnostics = diagnose();
    const budget = resolveViewportBudget({ supplied: null, regions, navigationEnabled: false, diagnostics });

    expect(budget.frameHeightPx).toBe(844);
    expect(budget.regions).toHaveLength(4);
    expect(budget.aboveFoldRegionIds).toEqual(["header", "hero"]);
    expect(diagnostics.map((entry) => entry.code)).toContain("budget_derived");
  });

  it("demotes the lowest-priority region when the fold is over budget", () => {
    const diagnostics = diagnose();
    const budget = resolveViewportBudget({
      supplied: {
        aboveFoldRegionIds: ["header", "hero", "collection-grid", "footnote"],
        regions: [
          { id: "header", minHPx: 96, maxHPx: 120, priority: "primary" },
          { id: "hero", minHPx: 360, maxHPx: 400, priority: "focal" },
          { id: "collection-grid", minHPx: 300, maxHPx: 340, priority: "primary" },
          { id: "footnote", minHPx: 160, maxHPx: 200, priority: "secondary" },
        ],
      },
      regions,
      navigationEnabled: true,
      diagnostics,
    });

    // 96 + 360 + 300 + 160 = 916 against 844 - 44 - 96 = 704 available.
    const total = budget.aboveFoldRegionIds
      .map((id) => budget.regions.find((region) => region.id === id)!.minHPx)
      .reduce((sum, value) => sum + value, 0);
    expect(total).toBeLessThanOrEqual(704);
    expect(budget.aboveFoldRegionIds).toContain("hero");
    expect(budget.aboveFoldRegionIds).not.toContain("footnote");
    expect(diagnostics.filter((entry) => entry.code === "region_demoted_below_fold").length).toBeGreaterThan(0);
  });

  it("clamps a tall region that no content carries", () => {
    const diagnostics = diagnose();
    const budget = resolveViewportBudget({
      supplied: { regions: [{ id: "footnote", minHPx: 260, maxHPx: 300, priority: "secondary" }] },
      regions,
      navigationEnabled: false,
      diagnostics,
    });

    expect(budget.regions.find((region) => region.id === "footnote")?.minHPx)
      .toBe(CONTENT_JUSTIFICATION_HEIGHT_PX);
    expect(diagnostics.map((entry) => entry.code)).toContain("contentless_region_clamped");
  });

  it("lets media and chart regions keep their height", () => {
    const diagnostics = diagnose();
    const budget = resolveViewportBudget({
      supplied: { regions: [{ id: "collection-grid", minHPx: 280, maxHPx: 320, priority: "primary" }] },
      regions,
      navigationEnabled: false,
      diagnostics,
    });

    expect(budget.regions.find((region) => region.id === "collection-grid")?.minHPx).toBe(280);
    expect(diagnostics.map((entry) => entry.code)).not.toContain("contentless_region_clamped");
  });

  it("drops budget entries for regions that do not exist", () => {
    const diagnostics = diagnose();
    resolveViewportBudget({
      supplied: { regions: [{ id: "ghost-region", minHPx: 100, maxHPx: 120, priority: "primary" }] },
      regions,
      navigationEnabled: false,
      diagnostics,
    });
    expect(diagnostics.map((entry) => entry.code)).toContain("unknown_region_dropped");
  });
});

describe("resolveRegionContracts", () => {
  it("forces equal-height siblings and a copy budget on a two-column region", () => {
    const diagnostics = diagnose();
    const contracts = resolveRegionContracts({
      supplied: [{ id: "collection-grid", arrangement: "two-column", siblingBalance: "independent", itemCount: 2 }],
      regions,
      diagnostics,
    });

    const grid = contracts.find((contract) => contract.id === "collection-grid")!;
    expect(grid.siblingBalance).toBe("equal-height");
    expect(grid.copyBudget).toEqual({ titleMaxChars: 22, bodyMaxLines: 2 });
    expect(diagnostics.map((entry) => entry.code)).toContain("sibling_balance_defaulted");
    expect(diagnostics.map((entry) => entry.code)).toContain("copy_budget_defaulted");
  });

  it("allows independent heights on a horizontal scroll rail", () => {
    const contracts = resolveRegionContracts({
      supplied: [{ id: "collection-grid", arrangement: "horizontal-scroll", siblingBalance: "independent" }],
      regions,
      diagnostics: diagnose(),
    });
    expect(contracts.find((contract) => contract.id === "collection-grid")?.siblingBalance).toBe("independent");
  });

  it("derives an arrangement for every declared region", () => {
    const contracts = resolveRegionContracts({ supplied: null, regions, diagnostics: diagnose() });
    expect(contracts.map((contract) => contract.id)).toEqual(regions.map((region) => region.id));
    expect(contracts.every((contract) => contract.arrangement.length > 0)).toBe(true);
  });
});

describe("formatLayoutBudgetContract", () => {
  it("renders the equal-height rule the builder must follow", () => {
    const diagnostics = diagnose();
    const budget = resolveViewportBudget({ supplied: null, regions, navigationEnabled: false, diagnostics });
    const contracts = resolveRegionContracts({
      supplied: [{
        id: "collection-grid",
        arrangement: "two-column",
        itemCount: 2,
        itemAnatomy: ["media 4:5", "eyebrow", "title", "body"],
      }],
      regions,
      diagnostics,
    });

    const text = formatLayoutBudgetContract({ budget, regionContracts: contracts }) ?? "";
    expect(text).toContain("Vertical budget");
    expect(text).toContain("equal height, identical internal anatomy");
    expect(text).toMatch(/never give siblings different media heights/i);
    expect(text).toContain("title <= 22 chars");
  });

  it("returns null when there is nothing to say", () => {
    expect(formatLayoutBudgetContract({ budget: null, regionContracts: [] })).toBeNull();
  });
});
