import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeDesignTokens } from "@/lib/design-tokens";
import { GENERATION_V2_BENCHMARK_CASES } from "@/lib/generation/benchmark-cases";
import { DESIGN_STYLE_PACKS } from "@/lib/generation/design-styles";
import { normalizeReferenceAnalysis, parsePromptScreenIntent, resolveGenerationScopeContract } from "@/lib/generation/scope-contract";
import { resolveReferenceImageAttachment, shouldAttachReferenceImage } from "@/lib/generation/reference-image";
import { SCREEN_BUILD_OUTPUT_TOKEN_BUDGET, screenBuildOutputTokenBudget } from "@/lib/generation/screen-budget";
import { getOpenRouterMaxTokens } from "@/lib/env/server";
import { buildApprovedDesignTokens } from "@/lib/generation/service";
import { renderDeterministicNavigationShell } from "@/lib/project-navigation";
import { buildDrawgleTokenCss, tokenizeStaticDrawgleHtml } from "@/lib/token-runtime";
import type { NavigationPlan, PromptImagePayload, ReferenceTransferContract } from "@/lib/types";

const image: PromptImagePayload = { data: "dGVzdA==", mimeType: "image/png" };
const calibrationContract: ReferenceTransferContract = {
  version: 2,
  layoutSource: "screen-purpose",
  preserve: [], adapt: [], reject: [], rationale: "Target layout owns structure.",
  targetCapabilities: [], semanticDecisions: [], premiumQualityTargets: [],
  visualInvariants: [], compositionAdaptations: [], localMotifs: [], forbiddenLiteralTransfers: [],
};
const calibrationRegions = [{ id: "main-content", purpose: "Primary product content", contentKind: "focal" as const }];

describe("production generation V2 contracts", () => {
  it("keeps the offline release corpus at sixty representative cases", () => {
    expect(GENERATION_V2_BENCHMARK_CASES).toHaveLength(60);
    expect(new Set(GENERATION_V2_BENCHMARK_CASES.map((item) => item.id)).size).toBe(60);
  });

  it("uses a 16px content rail across every built-in design style", () => {
    expect(DESIGN_STYLE_PACKS.every((style) => style.tokenSeed.tokens?.mobile_layout?.screen_margin === "16px")).toBe(true);
    expect(buildDrawgleTokenCss(null)).toContain("--screen-margin: var(--dg-mobile-layout-screen-margin, 16px)");
    expect(buildDrawgleTokenCss(null)).toContain("--dg-spacing-element-gap: var(--dg-mobile-layout-element-gap, 12px)");
    expect(buildDrawgleTokenCss(null)).toContain('[class~="px-[var(--dg-mobile-layout-screen-margin)]"] .dg-screen-padding');
  });
  it("derives and validates a backward-compatible inner radius hierarchy", () => {
    const legacy = normalizeDesignTokens({
      tokens: { radii: { app: "24px", pill: "9999px" } },
    });
    expect(legacy.tokens?.radii).toMatchObject({ app: "24px", inner: "16px", pill: "9999px" });

    const invalid = normalizeDesignTokens({
      tokens: { radii: { app: "18px", inner: "18px", pill: "9999px" } },
    });
    expect(invalid.tokens?.radii?.inner).toBe("12px");

    const sharp = normalizeDesignTokens({
      tokens: { radii: { app: "0px", inner: "0px", pill: "9999px" } },
    });
    expect(sharp.tokens?.radii).toMatchObject({ app: "0px", inner: "0px" });
  });
  it("derives the standard inner radius from component inset rather than sibling element gap", () => {
    const tokens = normalizeDesignTokens({
      tokens: {
        radii: { app: "16px", inner: "4px", pill: "9999px" },
        spacing: { xxs: "4px", xs: "8px", sm: "12px" },
        mobile_layout: { element_gap: "16px" },
      },
    });

    expect(tokens.tokens?.radii).toMatchObject({
      app: "16px",
      inner: "8px",
      inset_xxs: "12px",
      inset_xs: "8px",
      inset_sm: "4px",
    });
  });
  it("enforces the exact standard inset instead of preserving a near miss", () => {
    const tokens = normalizeDesignTokens({
      tokens: {
        radii: { app: "26px", inner: "16px", pill: "9999px" },
        spacing: { xs: "8px" },
      },
    });

    expect(tokens.tokens?.radii?.inner).toBe("18px");
  });
  it("tokenizes equal numeric spacing and radius values by CSS property role", () => {
    const tokens = normalizeDesignTokens({
      tokens: {
        spacing: { md: "16px" },
        radii: { app: "24px", inner: "16px", pill: "9999px" },
      },
    });
    const result = tokenizeStaticDrawgleHtml(
      '<div class="rounded-[16px] p-[16px]"></div>',
      tokens,
    ).code;
    expect(result).toContain("rounded-[var(--dg-radii-inner)]");
    expect(result).toContain("p-[var(--dg-spacing-md)]");
  });
  it("adds enumerated screen groups instead of trusting the first number", () => {
    const scope = parsePromptScreenIntent("Must have 2 step thoughtfully planned onboarding screen, one login/signup screen and 1 home screen.");
    expect(scope.promptScreenCount).toBe(4);
    expect(scope.screens?.map((screen) => screen.name)).toEqual([
      "Onboarding Step 1",
      "Onboarding Step 2",
      "Login / Signup",
      "Home",
    ]);
  });

  it("does not treat card quantities as screen quantities", () => {
    const scope = parsePromptScreenIntent("Create one home screen with 8 product cards and 3 quick actions.");
    expect(scope.promptScreenCount).toBe(1);
    expect(scope.screens?.map((screen) => screen.name)).toEqual(["Home"]);
  });

  it("preserves the explicit identity of a single screen requested by the agent router", () => {
    const scope = parsePromptScreenIntent([
      "Create a cart and checkout experience for this existing project.",
      "Screen name: Cart / Checkout.",
      "Screen role: checkout.",
    ].join("\n"));
    expect(scope.promptScreenCount).toBe(1);
    expect(scope.screens).toEqual([{ index: 1, name: "Cart / Checkout", kind: "checkout" }]);
  });

  it("auto-accepts all visible Image to UI screens while capping the initial build at five", () => {
    const reference = normalizeReferenceAnalysis({
      overallVisualStyle: "Multi-screen mobile reference",
      screenCountEstimate: 7,
      screenReferences: Array.from({ length: 7 }, (_, index) => ({
        index: index + 1,
        suggestedRole: `Reference ${index + 1}`,
      })),
      designSystemSignals: {},
    });
    const scope = resolveGenerationScopeContract({
      prompt: "Build the screens visible in this image",
      image,
      referenceMode: "user_recreate",
      planningMode: "project",
      referenceAnalysisResult: reference,
    });
    expect(scope.imageScreenCount).toBe(7);
    expect(scope.finalScreenCount).toBe(5);
    expect(scope.screens).toHaveLength(5);
    expect(scope.requiresConfirmation).toBe(false);
  });

  it("downgrades incomplete multi-frame reference analysis", () => {
    const result = normalizeReferenceAnalysis({
      overallVisualStyle: "Playful layered mobile UI",
      screenCountEstimate: 3,
      screenReferences: [{ index: 1, suggestedRole: "Dashboard" }],
      designSystemSignals: {},
    });
    expect(result.confidence).toBe("medium");
    expect(result.validationIssues).toContain("screenCountEstimate must equal the number of screenReferences entries.");
  });

  it("excludes device geometry and projects trusted app measurements into token roles", () => {
    const result = normalizeReferenceAnalysis({
      overallVisualStyle: "Compact restrained mobile UI",
      screenCountEstimate: 1,
      screenReferences: [{ index: 1, suggestedRole: "Root" }],
      designSystemSignals: { typography: "System sans-serif; exact family is not identifiable." },
      geometryProfile: { measurements: [
        { role: "outer-surface-radius", minPx: 38, maxPx: 42, confidence: "high", sourceScreenIndexes: [1], scope: "screen-local", sourceLayer: "device-mockup", note: "phone shell corner" },
        { role: "outer-surface-radius", minPx: 15, maxPx: 17, confidence: "high", sourceScreenIndexes: [1], scope: "component-family", sourceLayer: "app-ui", note: "group surface" },
        { role: "inner-surface-radius", minPx: 9, maxPx: 11, confidence: "high", sourceScreenIndexes: [1], scope: "component-family", sourceLayer: "app-ui", note: "nested row" },
        { role: "screen-rail", minPx: 19, maxPx: 21, confidence: "high", sourceScreenIndexes: [1], scope: "project-global", sourceLayer: "app-ui", note: "content rail" },
      ] },
    });
    expect(result.analysis?.geometryProfile?.measurements).toHaveLength(3);
    expect(result.diagnostics.join(" ")).toContain("Excluded device/mockup geometry");

    const tokens = buildApprovedDesignTokens({
      tokens: {
        mobile_layout: { screen_margin: "16px" },
        radii: { app: "28px", inner: "20px", pill: "9999px" },
        typography: { heading_font_family: '"Gilroy", sans-serif', body_font_family: '"Gilroy", sans-serif' },
      },
    }, null, result.analysis);
    expect(tokens.tokens?.mobile_layout?.screen_margin).toBe("20px");
    expect(tokens.tokens?.radii).toMatchObject({ app: "16px", inner: "10px" });
    expect(tokens.tokens?.typography?.heading_font_family).toContain("-apple-system");
    expect(tokens.tokens?.typography?.heading_font_family).not.toContain("Gilroy");
  });

  it("attaches style images only behind a valid calibration contract", () => {
    for (const referenceMode of ["user_style", "curated_style", "internal_style"] as const) {
      const decision = resolveReferenceImageAttachment({ image, referenceMode, referenceTransfer: calibrationContract, screenLayoutRegions: calibrationRegions, featureEnabled: true });
      expect(decision).toMatchObject({ attach: true, role: "style-calibration", calibrationContractVersion: 2 });
    }
    expect(shouldAttachReferenceImage({ engineVersion: "v2", image, referenceMode: "user_style" })).toBe(false);
    expect(resolveReferenceImageAttachment({ image, referenceMode: "user_style", referenceTransfer: calibrationContract, screenLayoutRegions: calibrationRegions, featureEnabled: false })).toMatchObject({ attach: false, role: null, featureEnabled: false });
    expect(resolveReferenceImageAttachment({ image, referenceMode: "user_style", referenceTransfer: calibrationContract, featureEnabled: true })).toMatchObject({ attach: false, role: null });
    expect(resolveReferenceImageAttachment({ image, referenceMode: "user_recreate" })).toMatchObject({ attach: true, role: "structural-reference" });
  });

  it("gives every screen the same output ceiling, well above observed output", () => {
    // The old tiering guessed length from keywords in the description and put
    // most screens on a 12,000 ceiling — inside the builder's observed 8,000 to
    // 12,000+ range, so ordinary screens were truncated and discarded.
    const simple = screenBuildOutputTokenBudget({ name: "Login", type: "detail", description: "Focused email and password form." });
    const dense = screenBuildOutputTokenBudget({ name: "Analytics Dashboard", type: "root", description: "Dense analytics chart and data visualization." });

    expect(simple).toBe(SCREEN_BUILD_OUTPUT_TOKEN_BUDGET);
    expect(dense).toBe(SCREEN_BUILD_OUTPUT_TOKEN_BUDGET);
    expect(simple).toBeGreaterThan(12000);
  });

  it("does not let the global ceiling clamp the per-screen budget", () => {
    // A deployed DRAWGLE_OPENROUTER_MAX_TOKENS below the screen budget silently
    // cancels it, which is exactly how the 12,000 truncations happened.
    const previous = process.env.DRAWGLE_OPENROUTER_MAX_TOKENS;
    delete process.env.DRAWGLE_OPENROUTER_MAX_TOKENS;
    try {
      expect(getOpenRouterMaxTokens()).toBeGreaterThanOrEqual(SCREEN_BUILD_OUTPUT_TOKEN_BUDGET);
    } finally {
      if (previous === undefined) delete process.env.DRAWGLE_OPENROUTER_MAX_TOKENS;
      else process.env.DRAWGLE_OPENROUTER_MAX_TOKENS = previous;
    }
  });

  it("preserves explicit navigation tokens through runtime CSS and shell rendering", () => {
    const tokens = normalizeDesignTokens({
      tokens: {
        color: { background: { primary: "#F9F5F0" }, text: { high_emphasis: "#1A1A1A" } },
        navigation: {
          surface: "#1A1A1A",
          content: "#FFFFFF",
          muted_content: "#AAA6A1",
          active_surface: "#8E8CDE",
          active_content: "#FFFFFF",
          border: "#2D2D2D",
          shadow: "0 10px 24px rgba(0,0,0,.18)",
        },
      },
    });
    expect(buildDrawgleTokenCss(tokens)).toContain("--dg-navigation-surface: #1A1A1A");

    const plan: NavigationPlan = {
      version: 2,
      decision: "reference-derived",
      evidence: { source: "reference", reason: "Visible dock" },
      enabled: true,
      kind: "bottom-tabs",
      visualBrief: "Dark floating dock",
      design: {
        anatomy: "floating-dock", width: "content", labels: "always", activeTreatment: "icon-fill",
        surface: "solid", radiusPx: 30, safeAreaOffsetPx: 12, itemGapPx: 6, iconSizePx: 22,
        border: true, elevation: "low", centerActionItemId: null,
      },
      items: [
        { id: "home", label: "Home", icon: "home", role: "Home", linkedScreenName: "Home", availability: "generated" },
        { id: "work", label: "Work", icon: "briefcase", role: "Work", linkedScreenName: "Work", availability: "generated" },
      ],
      screenChrome: [{ screenName: "Home", chrome: "bottom-tabs", navigationItemId: "home" }],
    };
    expect(renderDeterministicNavigationShell(plan)).toContain("var(--dg-navigation-surface");
  });
});
