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
  validateNavigationShell,
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

describe("L — a failed first brief must not shrink the project", () => {
  /**
   * Observed 2026-08-11/12 across four production runs. The scope contract, the
   * intent contract and the screen-count contract were all correct down to the
   * screen names, and the run still delivered one fewer screen than requested:
   *
   *   ["Home Overview", "Climate Control", "Energy Usage"] -> 2 screens
   *   ["Home Dashboard", "Doctor Detail"]                  -> 1 screen
   *   ["Social Feed", "Map Discovery"]                      -> 1 screen
   *
   * In every case exactly the first screen vanished. When the progressive
   * first-screen brief failed strict validation, the recovery path re-briefed
   * `seedPlans.slice(1)` and replaced the whole slate with the result, so the
   * failed screen lost its place in the project rather than just its turn at
   * being built first. Every downstream counter then agreed with the reduced
   * number and the run reported success.
   */
  it("re-briefs the whole slate rather than the tail", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("trigger/generate-ui-flow.ts", "utf8");

    expect(source).not.toContain("screens: seedPlans.slice(1),");
    expect(source).toContain("screens: seedPlans,");
  });

  it("records screens the re-brief could not save", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("trigger/generate-ui-flow.ts", "utf8");

    // A screen that still cannot be briefed is a reportable loss. The tail-only
    // path recorded nothing, which is why the shortfall was invisible in run
    // metadata for four runs.
    expect(source).toContain("promotedDroppedScreenNames");
  });
});

describe("M — the dock is the app's IA, not a count of built screens", () => {
  /**
   * Reported 2026-08-12 on project 8dcc913a. The reference image shows a
   * four-tab dock; the recreated screen showed none. Nothing was stripped and
   * nothing failed: the plan held four destinations with one generated and
   * three planned, V3 filtered every planned destination out before rendering,
   * one item is below the two-item minimum, and so the shell declined. The
   * builder had already been told the renderer would supply navigation, so it
   * drew none either.
   *
   * Gating a design decision on how many screens happen to exist yet is the
   * wrong axis. The renderer could always draw a not-yet-built destination as
   * an inert tab; that path was simply unreachable for V3.
   */
  const planWithItems = (items: NavigationPlan["items"]): NavigationPlan => ({
    version: 3,
    decision: "project-native",
    evidence: { source: "product-architecture", reason: "test" },
    design: null,
    appearance: { primary: { anatomy: "floating-dock" } } as NavigationPlan["appearance"],
    enabled: true,
    kind: "bottom-tabs",
    items,
    visualBrief: "test",
    screenChrome: [],
  });

  const healthAppPlan = planWithItems([
    { id: "nav-home", label: "Home", icon: "home", role: "Dashboard", availability: "generated", linkedScreenName: "Home Dashboard" },
    { id: "nav-schedule", label: "Schedule", icon: "calendar", role: "Appointments", availability: "planned", linkedScreenName: null },
    { id: "nav-messages", label: "Messages", icon: "mail", role: "Communication", availability: "planned", linkedScreenName: null },
    { id: "nav-settings", label: "Settings", icon: "settings", role: "Profile", availability: "planned", linkedScreenName: null },
  ]);

  it("renders the full declared dock when only one destination exists", () => {
    expect(willRenderSharedNavigationShell(healthAppPlan)).toBe(true);

    const shell = renderDeterministicNavigationShell(healthAppPlan);
    for (const id of ["nav-home", "nav-schedule", "nav-messages", "nav-settings"]) {
      expect(shell).toContain(`data-nav-item-id="${id}"`);
    }
  });

  it("marks not-yet-built destinations inert rather than interactive", () => {
    const shell = renderDeterministicNavigationShell(healthAppPlan);

    expect(shell).toContain('data-nav-availability="generated"');
    expect(shell).toContain('data-nav-availability="planned"');
    expect(shell).toContain('aria-disabled="true"');
    // Only the real destination carries a screen link.
    expect((shell.match(/data-linked-screen-name=/g) ?? []).length).toBe(1);
  });

  it("still declines when no destination is real at all", () => {
    // A dock of entirely dead tabs replacing a screen's own working navigation
    // is worse than leaving that navigation alone.
    const nothingBuilt = planWithItems([
      { id: "nav-home", label: "Home", icon: "home", role: "Dashboard", availability: "planned", linkedScreenName: null },
      { id: "nav-search", label: "Search", icon: "search", role: "Search", availability: "planned", linkedScreenName: null },
    ]);

    expect(willRenderSharedNavigationShell(nothingBuilt)).toBe(false);
    expect(renderDeterministicNavigationShell(nothingBuilt)).toBe("");
  });

  it("keeps the validator agreeing with what the shell emits", () => {
    expect(validateNavigationShell(renderDeterministicNavigationShell(healthAppPlan), healthAppPlan)).toBe(true);
  });
});
