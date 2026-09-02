import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  normalizePlannerBlueprintResponse,
  plannerBlueprintResponseJsonSchema,
  plannerScreenBriefsResponseJsonSchema,
} from "@/lib/generation/planner-response-contracts";
import { canonicalizePlannerBlueprintForScreenPlanning } from "@/lib/generation/service";

const baseBlueprint = () => ({
  requires_bottom_nav: true,
  navigation_architecture: {
    kind: "bottom-tabs-app",
    primary_navigation: "bottom-tabs",
    root_chrome: "bottom-tabs",
    detail_chrome: "top-bar-back",
    consistency_rules: ["Keep destination order stable."],
    rationale: "Three peer product areas need persistent navigation.",
  },
  navigation_plan: {
    version: 2,
    decision: "project-native",
    evidence: {
      source: "product-architecture",
      reason: "The product has three peer root areas.",
    },
    items: [
      { id: "portfolio", label: "Portfolio", icon: "WalletCards", availability: "generated", linked_screen_name: "Portfolio" },
      { id: "markets", label: "Markets", icon: "ChartCandlestick", availability: "generated", linked_screen_name: "Markets" },
      { id: "activity", label: "Activity", icon: "History", availability: "generated", linked_screen_name: "Activity" },
    ],
    design: {
      anatomy: "compact-icon-rail",
      width: "inset",
      labels: "always",
      active_treatment: "tint",
      surface: "solid",
      radius_px: 16,
      safe_area_offset_px: 8,
      item_gap_px: 4,
      icon_size_px: 20,
      border: true,
      elevation: "low",
      center_action_item_id: null,
    },
    visual_brief: "A compact destination rail suited to frequent switching.",
    screen_chrome: [
      { screenName: "Portfolio", chrome: "bottom-tabs", navigationItemId: "portfolio" },
      { screenName: "Markets", chrome: "bottom-tabs", navigationItemId: "markets" },
      { screenName: "Activity", chrome: "bottom-tabs", navigationItemId: "activity" },
    ],
  },
  roadmap: {
    requested_parent_count: 3,
    items: [
      { stable_key: "screen:portfolio", name: "Portfolio", type: "root", summary: "Review balances and portfolio allocation.", priority: "core", explicitly_requested: true, dependency_keys: [] },
      { stable_key: "screen:markets", name: "Markets", type: "root", summary: "Explore market movement and instruments.", priority: "required", explicitly_requested: true, dependency_keys: [] },
      { stable_key: "screen:activity", name: "Activity", type: "root", summary: "Review completed account transactions.", priority: "required", explicitly_requested: true, dependency_keys: [] },
    ],
    initial_batch_keys: ["screen:portfolio", "screen:markets", "screen:activity"],
  },
  charter: {
    originalPrompt: "Create a brokerage app.",
    imageReferenceSummary: null,
    appType: "Brokerage application",
    targetAudience: "Retail investors",
    navigationModel: "Three peer root destinations",
    keyFeatures: ["Portfolio overview", "Market discovery", "Transaction history"],
    designRationale: "Use a clear mobile hierarchy with compact financial information.",
    creativeDirection: null,
  },
});

describe("planner response production contracts", () => {
  it("normalizes the exact missing role and camelCase screen chrome failure", () => {
    const canonical = canonicalizePlannerBlueprintForScreenPlanning(baseBlueprint());

    expect(canonical.blueprint).not.toBeNull();
    expect(canonical.navigationRecovered).toBe(false);
    expect(canonical.blueprint?.roadmap?.initial_batch_keys).toEqual([
      "screen:portfolio",
      "screen:markets",
      "screen:activity",
    ]);
    expect(canonical.blueprint?.navigation_plan?.items.map((item) => item.role)).toEqual([
      "Portfolio destination and primary product area.",
      "Markets destination and primary product area.",
      "Activity destination and primary product area.",
    ]);
    expect(canonical.blueprint?.navigation_plan?.screen_chrome.map((entry) => entry.screen_name)).toEqual([
      "Portfolio",
      "Markets",
      "Activity",
    ]);
  });

  it("isolates an unrecoverable navigation design without discarding the roadmap", () => {
    const raw = baseBlueprint();
    raw.navigation_plan.design = null as never;
    const canonical = canonicalizePlannerBlueprintForScreenPlanning(raw);

    expect(canonical.blueprint).not.toBeNull();
    expect(canonical.navigationRecovered).toBe(true);
    expect(canonical.blueprint?.navigation_plan?.decision).toBe("none");
    expect(canonical.blueprint?.navigation_plan?.items).toEqual([]);
    expect(canonical.blueprint?.roadmap?.items).toHaveLength(3);
    expect(canonical.blueprint?.roadmap?.initial_batch_keys).toHaveLength(3);
  });

  it("does not disguise a broken core roadmap as a usable blueprint", () => {
    const raw = baseBlueprint();
    raw.roadmap.items = [];
    const canonical = canonicalizePlannerBlueprintForScreenPlanning(raw);

    expect(canonical.blueprint).toBeNull();
    expect(canonical.issues.some((issue) => issue.startsWith("roadmap.items"))).toBe(true);
  });

  it("normalizes navigation aliases without changing unrelated blueprint content", () => {
    const raw = baseBlueprint();
    const normalized = normalizePlannerBlueprintResponse({
      ...raw,
      requiresBottomNav: true,
      requires_bottom_nav: undefined,
      navigationPlan: raw.navigation_plan,
      navigation_plan: undefined,
    }) as typeof raw;

    expect(normalized.requires_bottom_nav).toBe(true);
    expect(normalized.navigation_plan.items[0]).toMatchObject({
      id: "portfolio",
      label: "Portfolio",
      role: "Portfolio destination and primary product area.",
    });
  });

  it("declares required structured-output fields for both planning stages", () => {
    const blueprintRequired = plannerBlueprintResponseJsonSchema.required;
    const screenRequired = plannerScreenBriefsResponseJsonSchema
      .properties.screens.items.required;

    expect(blueprintRequired).toContain("navigation_plan");
    expect(blueprintRequired).toContain("roadmap");
    expect(screenRequired).toContain("layout_contract");
    expect(screenRequired).toContain("reference_transfer");
    expect(screenRequired).toContain("asset_needs");
  });
});
