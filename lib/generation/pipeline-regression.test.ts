/**
 * Regression fixtures for the 2026-08-10 Image-to-UI / Style Reference
 * pipeline failures.
 *
 * Every case here reproduces a defect observed in production output before it
 * was fixed. They exist so the specific failure cannot silently return.
 */

import { describe, expect, it } from "vitest";

import { buildBuilderProjectContract } from "@/lib/generation/builder-product-contract";
import { resolveGenerationPromptMode } from "@/lib/generation/prompt-routing";
import { normalizeDesignTokens } from "@/lib/design-tokens";
import {
  referenceShowsNavigationOnScreen,
  resolveScreenChromePolicy,
} from "@/lib/navigation";
import {
  normalizeNavigationPlan,
  renderDeterministicNavigationShell,
  sanitizeScreenCodeForSharedNavigation,
  willRenderSharedNavigationShell,
} from "@/lib/project-navigation";
import type { NavigationPlan, ProjectCharter, ScreenPlan } from "@/lib/types";

const screen = (overrides: Partial<ScreenPlan> = {}): ScreenPlan => ({
  name: "Sneaker Feed",
  type: "root",
  description: "Reference DNA: Industrial sole.\nVisual Goal: Editorial-first shopping surface.\nLayout Anatomy: Hero then grid.",
  ...overrides,
});

describe("A — recreate survives the detailed screen planner", () => {
  it("stays in recreate mode when the project has a structural reference", () => {
    // The detailed planner carries no inline image; the project still does.
    expect(resolveGenerationPromptMode({
      referenceMode: "user_recreate",
      hasImage: true,
      hasDesignStyle: false,
      hasReferenceAnalysis: true,
      hasProjectVisualMemory: true,
    })).toBe("recreate");
  });

  it("reproduces the old demotion when the image flag is falsely reported absent", () => {
    // This is exactly what `hasImage: false` produced: recreate silently
    // became style, which then forbade the anatomy the builder was copying.
    expect(resolveGenerationPromptMode({
      referenceMode: "user_recreate",
      hasImage: false,
      hasDesignStyle: false,
      hasReferenceAnalysis: true,
      hasProjectVisualMemory: true,
    })).toBe("style");
  });
});

describe("C — navigation is never stripped without a replacement", () => {
  const planWith = (items: NavigationPlan["items"]): NavigationPlan => ({
    version: 3,
    decision: "project-native",
    evidence: { source: "product-architecture", reason: "test" },
    design: null,
    appearance: { primary: { anatomy: "fixed-tab-rail" } } as NavigationPlan["appearance"],
    enabled: true,
    kind: "bottom-tabs",
    items,
    visualBrief: "test",
    screenChrome: [],
  });

  const localNavCode = `<div class="w-full"><main>content</main><nav class="fixed bottom-0"><button>Home</button><button>Search</button></nav></div>`;

  it("keeps local navigation when the shared shell would render nothing", () => {
    // Production state: every destination planned, none linked.
    const plan = planWith([
      { id: "nav-home", label: "Home", icon: "house", role: "Discovery", availability: "planned", linkedScreenName: null },
      { id: "nav-search", label: "Search", icon: "search", role: "Search", availability: "planned", linkedScreenName: null },
    ]);

    expect(willRenderSharedNavigationShell(plan)).toBe(false);
    expect(renderDeterministicNavigationShell(plan)).toBe("");

    const saved = sanitizeScreenCodeForSharedNavigation(localNavCode, screen(), {
      projectNavigationEnabled: true,
      navigationPlan: plan,
    });
    expect(saved).toContain("<nav");
  });

  it("still strips local navigation when the shell will replace it", () => {
    const plan = planWith([
      { id: "nav-home", label: "Home", icon: "house", role: "Discovery", availability: "generated", linkedScreenName: "Sneaker Feed" },
      { id: "nav-search", label: "Search", icon: "search", role: "Search", availability: "generated", linkedScreenName: "Sneaker Discovery" },
    ]);

    expect(willRenderSharedNavigationShell(plan)).toBe(true);
    const saved = sanitizeScreenCodeForSharedNavigation(localNavCode, screen(), {
      projectNavigationEnabled: true,
      navigationPlan: plan,
    });
    expect(saved).not.toContain("<nav");
  });

  it("links destinations in order when term matching finds nothing", () => {
    // "Home"/"Search" share no meaningful terms with "Sneaker Feed", which is
    // why every destination previously stayed planned and unlinked.
    const normalized = normalizeNavigationPlan({
      navigationPlan: {
        version: 3,
        decision: "project-native",
        evidence: { source: "product-architecture", reason: "peer root areas" },
        enabled: true,
        kind: "bottom-tabs",
        design: null,
        appearance: { primary: { anatomy: "fixed-tab-rail" } },
        visualBrief: "test",
        screenChrome: [],
        items: [
          { id: "nav-home", label: "Home", icon: "house", role: "Editorial discovery and featured collections", availability: "planned", linkedScreenName: null },
          { id: "nav-search", label: "Search", icon: "search", role: "Catalog search and category browsing", availability: "planned", linkedScreenName: null },
          { id: "nav-profile", label: "Profile", icon: "user", role: "Account orders and settings", availability: "planned", linkedScreenName: null },
        ],
      } as unknown as NavigationPlan,
      screens: [
        screen({ name: "Sneaker Feed" }),
        screen({ name: "Sneaker Discovery" }),
        screen({ name: "User Profile" }),
      ],
    });

    const linked = normalized.items.filter((item) => item.availability === "generated" && item.linkedScreenName);
    expect(linked.length).toBeGreaterThanOrEqual(2);
    expect(willRenderSharedNavigationShell(normalized)).toBe(true);
  });
});

describe("D — the design brain prompt layer is gone", () => {
  it("exports no charter, spatial or layout-budget prompt builder", async () => {
    // Removed 2026-08-12. Measured 62% worse on rendered fault score, with the
    // entire gap in content_overflows_container — fixed-height containers whose
    // content does not fit, the predicted failure of its own spatial rules.
    //
    // The charter OBJECT survives and still constrains token generation, which
    // measured better. Only its screen-shaping prompt text was removed.
    const prompts = await import("@/lib/generation/prompts");
    const layoutBudget = await import("@/lib/generation/layout-budget");

    expect("buildStyleCharterSection" in prompts).toBe(false);
    expect("buildSpatialArithmeticContract" in prompts).toBe(false);
    expect("formatLayoutBudgetContract" in layoutBudget).toBe(false);

    // The resolvers stay: stored v3 plans must keep normalizing.
    expect(typeof layoutBudget.resolveViewportBudget).toBe("function");
    expect(typeof layoutBudget.resolveRegionContracts).toBe("function");
  });

  it("no longer reads the design-brain flag anywhere", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["lib/generation/prompts.ts", "lib/generation/layout-budget.ts", "lib/token-runtime.ts"]) {
      expect(readFileSync(file, "utf8")).not.toContain("DRAWGLE_DESIGN_BRAIN_PROMPTS_ENABLED");
    }
  });
});

describe("E — the screen brief is sent once", () => {
  it("carries a one-line purpose, not the whole brief", () => {
    const description = [
      "Reference DNA: High-contrast editorial commerce with large-scale product photography.",
      "Visual Goal: Create an immersive, photography-first product experience.",
      "Layout Anatomy: A vertically scrolling canvas starting with a full-width media hero.",
      "Key Components: Top-bar, gallery, price header, size chips, action bar.",
    ].join("\n");

    const contract = buildBuilderProjectContract({
      charter: {
        appType: "Premium E-commerce",
        targetAudience: "Sneaker enthusiasts",
        keyFeatures: ["Editorial hero"],
      } as ProjectCharter,
      screenPlan: screen({ name: "Product Detail", type: "detail", description }),
    });

    expect(contract.screen.purpose).not.toBe(description);
    expect(contract.screen.purpose.length).toBeLessThanOrEqual(220);
    expect(contract.screen.purpose).toContain("immersive, photography-first");
  });
});

describe("#4 — visible reference navigation owns chrome in recreate", () => {
  const chargingScreen = screen({
    name: "Charging Session",
    type: "detail",
    description: "Active charging session with live battery progress.",
    referenceScreenIndex: 2,
  });

  const analysis = { primaryNavigation: { present: true, visibleOnScreenIndexes: [1, 2] } };

  it("detects navigation visible on the mapped reference screen", () => {
    expect(referenceShowsNavigationOnScreen({
      screenPlan: chargingScreen,
      referenceAnalysis: analysis,
      promptMode: "recreate",
    })).toBe(true);
  });

  it("does not apply outside recreate mode", () => {
    expect(referenceShowsNavigationOnScreen({
      screenPlan: chargingScreen,
      referenceAnalysis: analysis,
      promptMode: "style",
    })).toBe(false);
  });

  it("keeps navigation on a screen the immersive heuristic would suppress", () => {
    const suppressed = resolveScreenChromePolicy({ screenPlan: chargingScreen });
    expect(suppressed.showPrimaryNavigation).toBe(false);

    const evidenceLed = resolveScreenChromePolicy({
      screenPlan: chargingScreen,
      referenceNavigationVisible: true,
    });
    expect(evidenceLed.chrome).toBe("bottom-tabs");
    expect(evidenceLed.showPrimaryNavigation).toBe(true);
  });
});
