import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  compileProjectRoadmap,
  reconcileScreensWithScope,
} from "@/lib/generation/service";
import { normalizeNavigationPlan } from "@/lib/project-navigation";
import type {
  GenerationScopeContract,
  NavigationPlan,
  ScreenPlan,
} from "@/lib/types";

const scopeContract: GenerationScopeContract = {
  version: 2,
  referenceMode: "internal_style",
  promptScreenCount: 2,
  namedScreenCount: null,
  imageScreenCount: null,
  finalScreenCount: 2,
  countSource: "prompt_count",
  confidence: "high",
  conflictResolution: null,
  allScreensRequested: false,
  reason: "The user explicitly requested two screens.",
  diagnostics: [],
  screens: [
    { index: 1, name: "Screen 1", kind: "skincare_routine_screens" },
    { index: 2, name: "Screen 2", kind: "skincare_routine_screens" },
  ],
};

const plannedScreens: ScreenPlan[] = [
  {
    name: "Daily Protocol",
    type: "root",
    description: "Editorial daily skincare routine with a photographic hero.",
  },
  {
    name: "Product Library",
    type: "root",
    description: "A curated shelf of skincare products.",
  },
];

const navigationPlan: NavigationPlan = {
  version: 2,
  decision: "project-native",
  evidence: { source: "explicit-prompt", reason: "Product navigation." },
  enabled: true,
  kind: "bottom-tabs",
  items: [
    {
      id: "routine",
      label: "Routine",
      icon: "sparkles",
      role: "Daily skincare steps",
      linkedScreenName: null,
      availability: "planned",
    },
    {
      id: "shelf",
      label: "The Shelf",
      icon: "package",
      role: "Product inventory",
      linkedScreenName: null,
      availability: "planned",
    },
    {
      id: "analysis",
      label: "Analysis",
      icon: "chart",
      role: "Future analytics",
      linkedScreenName: null,
      availability: "planned",
    },
  ],
  visualBrief: "Editorial navigation.",
  screenChrome: [],
};

describe("project roadmap reconciliation", () => {
  it("keeps meaningful planner names when count-only scope names are generic", () => {
    const reconciled = reconcileScreensWithScope({
      prompt: "Create two luxury skincare screens.",
      screens: plannedScreens,
      planningMode: "project",
      scopeContract,
    });

    expect(reconciled.map((screen) => screen.name))
      .toEqual(["Daily Protocol", "Product Library"]);
    expect(reconciled.map((screen) => screen.roadmapStableKey))
      .toEqual(["screen:daily-protocol", "screen:product-library"]);
  });

  it("produces exactly one roadmap parent per final screen", () => {
    const reconciled = reconcileScreensWithScope({
      prompt: "Create two luxury skincare screens.",
      screens: plannedScreens,
      planningMode: "project",
      scopeContract,
    });
    const result = compileProjectRoadmap({
      rawRoadmap: {
        requested_parent_count: 2,
        items: [
          {
            stable_key: "screen:daily-protocol",
            name: "Daily Protocol",
            type: "root",
            summary: "The primary routine dashboard with editorial photography.",
            priority: "core",
            explicitly_requested: true,
            dependency_keys: [],
          },
          {
            stable_key: "screen:product-library",
            name: "Product Library",
            type: "root",
            summary: "The product inventory with edge-to-edge photography.",
            priority: "core",
            explicitly_requested: true,
            dependency_keys: [],
          },
        ],
        initial_batch_keys: ["screen:daily-protocol", "screen:product-library"],
      },
      screens: reconciled,
      navigationPlan,
      scopeContract,
    });

    expect(result.roadmap.plannedParentCount).toBe(2);
    expect(result.roadmap.items.filter((item) => item.kind === "screen").map((item) => item.name))
      .toEqual(["Daily Protocol", "Product Library"]);
    expect(result.initialBatchItemKeys)
      .toEqual(["screen:daily-protocol", "screen:product-library"]);
  });

  it("links navigation destinations to the reconciled generated screens", () => {
    const normalized = normalizeNavigationPlan({
      navigationPlan,
      screens: plannedScreens,
      strictScreenLinks: true,
    });

    expect(normalized.items.find((item) => item.id === "routine")).toMatchObject({
      availability: "generated",
      linkedScreenName: "Daily Protocol",
    });
    expect(normalized.items.find((item) => item.id === "shelf")).toMatchObject({
      availability: "generated",
      linkedScreenName: "Product Library",
    });
    expect(normalized.items.find((item) => item.id === "analysis")).toMatchObject({
      availability: "planned",
      linkedScreenName: null,
    });
  });
});
