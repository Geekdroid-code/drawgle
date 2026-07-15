import { describe, expect, it } from "vitest";

import { normalizeDesignTokens } from "@/lib/design-tokens";
import { GENERATION_V2_BENCHMARK_CASES } from "@/lib/generation/benchmark-cases";
import { DESIGN_STYLE_PACKS } from "@/lib/generation/design-styles";
import { buildRecreateScreenInstruction, buildStyleScreenInstruction } from "@/lib/generation/prompts";
import { normalizeReferenceAnalysis, parsePromptScreenIntent, resolveGenerationScopeContract } from "@/lib/generation/scope-contract";
import { shouldAttachReferenceImage } from "@/lib/generation/reference-image";
import { screenBuildOutputTokenBudget } from "@/lib/generation/screen-budget";
import { renderDeterministicNavigationShell } from "@/lib/project-navigation";
import { buildDrawgleTokenCss } from "@/lib/token-runtime";
import type { NavigationPlan, PromptImagePayload } from "@/lib/types";

const image: PromptImagePayload = { data: "dGVzdA==", mimeType: "image/png" };

describe("production generation V2 contracts", () => {
  it("keeps the offline release corpus at sixty representative cases", () => {
    expect(GENERATION_V2_BENCHMARK_CASES).toHaveLength(60);
    expect(new Set(GENERATION_V2_BENCHMARK_CASES.map((item) => item.id)).size).toBe(60);
  });

  it("uses a 16px content rail across every built-in design style", () => {
    expect(DESIGN_STYLE_PACKS.every((style) => style.tokenSeed.tokens?.mobile_layout?.screen_margin === "16px")).toBe(true);
    expect(buildDrawgleTokenCss(null)).toContain("--screen-margin: var(--dg-mobile-layout-screen-margin, 16px)");
  });

  it("preserves optional craft tokens without materializing them for legacy token sets", () => {
    const legacy = normalizeDesignTokens({ tokens: { radii: { app: "18px", pill: "9999px" } } });
    expect(legacy.tokens?.effects).toBeUndefined();
    expect(legacy.tokens?.radii?.featured).toBeUndefined();

    const crafted = normalizeDesignTokens({
      tokens: {
        radii: { app: "18px", pill: "9999px", featured: "36px" },
        effects: { surface_blur: "blur(18px)" },
        gradients: { atmosphere: "radial-gradient(circle, #745CFF 0%, transparent 70%)" },
      },
    });
    const css = buildDrawgleTokenCss(crafted);
    expect(css).toContain("--dg-radii-featured: 36px");
    expect(css).toContain("--dg-effects-surface-blur: blur(18px)");
    expect(css).toContain("--dg-gradients-atmosphere: radial-gradient");
  });

  it("expands selected craft recipes into a builder-only construction contract", () => {
    const instruction = buildStyleScreenInstruction({
      designTokens: normalizeDesignTokens({ tokens: { radii: { app: "18px", pill: "9999px", featured: "36px" } } }),
      designStyle: null,
      requiresBottomNav: false,
      navigationArchitecture: null,
      navigationPlan: null,
      assetManifest: [],
      screenPlan: {
        name: "Overview",
        type: "root",
        description: "A premium overview screen.",
        spatialContract: {
          version: 1,
          grammarIds: ["layered-feature-card"],
          viewportZones: ["Anchor one focal surface in the upper-middle viewport."],
          layerPlan: ["Base", "Feature surface", "Foreground content"],
          geometryRules: ["Use one asymmetric featured silhouette."],
          positioningRules: ["Keep supporting content on the main rail."],
          tokenBindings: { radius: "radii.featured" },
          dataVisualization: null,
          signatureDetail: "Use a restrained inner edge highlight.",
          antiPatterns: ["Do not repeat the featured geometry for every card."],
        },
      },
    });

    expect(instruction).toContain("SPATIAL CONSTRUCTION CONTRACT");
    expect(instruction).toContain("layered-feature-card");
    expect(instruction).toContain("radius -> radii.featured");
  });

  it("makes reference pixels authoritative over generic tokens in recreate mode", () => {
    const instruction = buildRecreateScreenInstruction({
      designTokens: normalizeDesignTokens({ tokens: { radii: { app: "32px", pill: "9999px" } } }),
      designStyle: null,
      requiresBottomNav: false,
      navigationArchitecture: null,
      navigationPlan: null,
      assetManifest: [],
      screenPlan: {
        name: "Reference Screen",
        type: "root",
        description: "Recreate the attached screen.",
      },
    });

    expect(instruction).toContain("1) attached reference pixels");
    expect(instruction).toContain("If these conflict on an observable visual fact, follow the image");
    expect(instruction).toContain("exact one-off geometry");
    expect(instruction).toContain("do not replace it with the standard app-card recipe");
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

  it("attaches style references only on the V2 path", () => {
    expect(shouldAttachReferenceImage({ engineVersion: "v2", image, referenceMode: "user_style" })).toBe(true);
    expect(shouldAttachReferenceImage({ engineVersion: "v1", image, referenceMode: "user_style" })).toBe(false);
    expect(shouldAttachReferenceImage({ engineVersion: "v1", image, referenceMode: "user_recreate" })).toBe(true);
  });

  it("caps simple screens lower while preserving room for dense screens", () => {
    expect(screenBuildOutputTokenBudget({ name: "Login", type: "detail", description: "Focused email and password form." })).toBe(12000);
    expect(screenBuildOutputTokenBudget({ name: "Analytics Dashboard", type: "root", description: "Dense analytics chart and data visualization." })).toBe(26000);
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
