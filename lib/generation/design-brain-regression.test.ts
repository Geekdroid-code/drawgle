/**
 * Named regression fixture for the "premium cosmetics" failure.
 *
 * Every value below is copied from production project
 * 6c6ff9da-1973-47d0-a3d3-78f3d1b4a996, which was matched to the curated
 * reference `cosmetics-ecommerce-minimal-light` and then produced a token set
 * and screens that contradicted it in four separate ways.
 *
 * These tests exist so those four contradictions cannot come back.
 */

import { load } from "cheerio";
import { describe, expect, it } from "vitest";

import { validateTokenRelationships } from "@/lib/design-tokens-relationships";
import { normalizeDesignTokens } from "@/lib/design-tokens";
import { scoreDesignBenchmark } from "@/lib/generation/design-benchmark";
import { runDesignCritic } from "@/lib/generation/design-critic";
import { applyGeometryContract } from "@/lib/generation/geometry-contract";
import { buildStyleCharter, diffCharterAgainstAnalysis } from "@/lib/generation/style-charter";
import { getCuratedStyleReferenceById } from "@/lib/generation/curated-style-catalog";
import type { DesignTokenValues, ReferenceAnalysis } from "@/lib/types";

const COSMETICS_REFERENCE_ID = "cosmetics-ecommerce-minimal-light";

/** The exact tokens generation produced for this project. */
const shippedTokens: DesignTokenValues = {
  color: {
    background: { primary: "#F5F2ED", secondary: "#E8D5C4" },
    surface: { card: "#FFFFFF", modal: "#FFFFFF", bottom_sheet: "#FFFFFF" },
    text: { high_emphasis: "#1A1A1A", medium_emphasis: "#6B6B6B", low_emphasis: "#A0A0A0" },
    action: { primary: "#1A1A1A", secondary: "#FFFFFF", disabled: "#D1D1D1", on_primary_text: "#FFFFFF" },
    border: { divider: "rgba(26, 26, 26, 0.08)", focused: "#1A1A1A" },
  },
  typography: {
    heading_font_family: "'Cormorant Garamond', serif",
    body_font_family: "'Inter', sans-serif",
    hero_title: { size: "44px", weight: 300, line_height: "48px" },
    screen_title: { size: "32px", weight: 400, line_height: "38px" },
    section_title: { size: "20px", weight: 500, line_height: "26px" },
    metric_value: { size: "24px", weight: 300, line_height: "30px" },
    body: { size: "16px", weight: 400, line_height: "24px" },
    supporting: { size: "14px", weight: 400, line_height: "20px" },
    caption: { size: "12px", weight: 500, line_height: "16px" },
    button_label: { size: "14px", weight: 600, line_height: "18px" },
    nav_title: { size: "17px", weight: 600, line_height: "22px" },
  },
  spacing: { none: "0px", xxs: "4px", xs: "8px", sm: "12px", md: "24px", lg: "32px", xl: "48px", xxl: "64px" },
  mobile_layout: { screen_margin: "24px", section_gap: "48px", element_gap: "16px", safe_area_top: "16px", safe_area_bottom: "16px" },
  radii: { app: "32px", inner: "16px", pill: "9999px" },
  border_widths: { standard: "0.75px" },
  shadows: {
    none: "none",
    surface: "inset 0 1px 2px rgba(255,255,255,0.8), 0 10px 30px rgba(0,0,0,0.03)",
    overlay: "0 20px 40px rgba(0,0,0,0.12)",
  },
  navigation: { surface: "#1A1A1A", content: "#FFFFFF", surface_material: "glass", backdrop_blur: "20px" },
  sizing: { min_touch_target: "48px", standard_button_height: "56px", standard_input_height: "52px" },
};

/** What the reference analyzer reported for this run — including a font it should not have named. */
const analysis = {
  overallVisualStyle: "Editorial light cosmetics commerce.",
  screenCountEstimate: 1,
  screenReferences: [],
  designSystemSignals: {
    palette: "Warm neutrals with charcoal accents.",
    typography: "High-contrast editorial serif in the Cormorant Garamond family paired with a neutral UI sans.",
    surfaces: "Soft elevated white cards with a gentle drop shadow.",
    iconography: "Thin line icons.",
    density: "Airy.",
    motionTone: "Gentle.",
  },
} as unknown as ReferenceAnalysis;

const charter = buildStyleCharter({
  prompt: "Create a Premium cosmetics ios mobile app. Plan all required screens.",
  curatedReference: getCuratedStyleReferenceById(COSMETICS_REFERENCE_ID),
  referenceAnalysis: analysis,
});

describe("style charter carries the catalog's judgment forward", () => {
  it("derives constraints from the curated selection profile", () => {
    expect(charter.source).toBe("curated-catalog");
    expect(charter.referenceId).toBe(COSMETICS_REFERENCE_ID);
    expect(charter.headingClass).toBe("sans");
    expect(charter.allowGlass).toBe(false);
    expect(charter.elevation).toBe("flat");
    expect(charter.baseColor?.label).toContain("clean");
  });

  it("outranks a reference analysis that contradicts it", () => {
    const conflicts = diffCharterAgainstAnalysis(charter, analysis);
    expect(conflicts.join(" ")).toMatch(/serif/i);
    expect(conflicts.join(" ")).toMatch(/flat|matte/i);
  });

  it("yields to an explicit user request", () => {
    const relaxed = buildStyleCharter({
      prompt: "Premium cosmetics app with a frosted glass navigation dock and serif headlines",
      curatedReference: getCuratedStyleReferenceById(COSMETICS_REFERENCE_ID),
    });
    expect(relaxed.allowGlass).toBe(true);
    expect(relaxed.headingClass).not.toBe("sans");
    expect(relaxed.userOverrides).toEqual(expect.arrayContaining(["glass surfaces", "serif typography"]));
  });
});

describe("token relationship validator repairs the shipped token set", () => {
  const { tokens: repaired, report } = validateTokenRelationships({
    tokens: shippedTokens,
    charter,
    repairEnabled: true,
  });
  const codes = report.diagnostics.map((diagnostic) => diagnostic.code);

  it("rejects the serif heading the catalog excludes", () => {
    expect(codes).toContain("heading_family_rejected");
    expect(repaired.typography?.heading_font_family).not.toMatch(/Cormorant/i);
  });

  it("clamps elevation and removes glass for a flat, matte reference", () => {
    expect(codes).toContain("elevation_clamped");
    expect(codes).toContain("glass_removed");
    expect(repaired.shadows?.surface).not.toMatch(/inset/);
    expect(repaired.navigation?.surface_material).toBe("solid");
    expect(repaired.navigation?.backdrop_blur).toBe("0px");
  });

  it("rebuilds a spacing scale whose steps jumped 2x and lost 16px", () => {
    expect(codes).toContain("spacing_scale_rebuilt");
    const scale = Object.values(repaired.spacing ?? {});
    expect(scale).toContain("16px");
  });

  it("pulls the 3x macro/micro section gap back into band", () => {
    const sectionGap = Number.parseFloat(String(repaired.mobile_layout?.section_gap));
    const elementGap = Number.parseFloat(String(repaired.mobile_layout?.element_gap));
    expect(sectionGap).toBeLessThanOrEqual(elementGap * 2);
    expect(sectionGap).toBeLessThanOrEqual(32);
  });

  it("preserves an approved airy macro gap and raises its micro gap instead", () => {
    const airyCharter = {
      ...charter,
      density: "airy" as const,
      sectionGapRangePx: [28, 40] as [number, number],
    };
    const airy = validateTokenRelationships({
      tokens: {
        ...shippedTokens,
        spacing: { none: "0px", xxs: "4px", xs: "8px", sm: "12px", md: "16px", lg: "24px", xl: "32px", xxl: "48px" },
        mobile_layout: { ...shippedTokens.mobile_layout, section_gap: "32px", element_gap: "12px" },
      },
      charter: airyCharter,
      repairEnabled: true,
    }).tokens;

    expect(airy.mobile_layout?.section_gap).toBe("32px");
    expect(airy.mobile_layout?.element_gap).toBe("16px");
  });

  it("snaps the sub-pixel border and makes the divider visible", () => {
    expect(repaired.border_widths?.standard).toBe("1px");
    expect(codes).toContain("divider_alpha_raised");
  });

  it("separates a pure white card from a warm page", () => {
    expect(codes.some((code) => code === "surface_hue_retinted" || code === "surface_separation_widened")).toBe(true);
  });

  it("lifts low-emphasis text off the 2.6:1 floor", () => {
    expect(codes).toContain("text_contrast_repaired");
    expect(repaired.color?.text?.low_emphasis).not.toBe("#A0A0A0");
  });

  it("reports without mutating when repair is disabled", () => {
    const diagnosticsOnly = validateTokenRelationships({
      tokens: shippedTokens,
      charter,
      repairEnabled: false,
    });
    expect(diagnosticsOnly.tokens).toBe(shippedTokens);
    expect(diagnosticsOnly.report.diagnostics.every((entry) => entry.severity === "warning")).toBe(true);
  });
});

describe("concentric radius law on the shipped markup", () => {
  const tokens = normalizeDesignTokens({ tokens: shippedTokens });

  it("repairs a 16px well inset 8px inside a 32px card", () => {
    // Verbatim from the Discover Feed build.
    const $ = load(
      `<article class="dg-surface-card dg-shadow-surface dg-radius-app overflow-hidden min-w-0">
         <div class="relative h-[212px] dg-radius-inner m-[var(--dg-spacing-xs)] overflow-hidden bg-[var(--dg-color-background-secondary)]"></div>
       </article>`,
      {},
      false,
    );
    const diagnostics = applyGeometryContract({ $, designTokens: tokens, repairEnabled: true });

    expect(diagnostics.map((entry) => entry.code)).toContain("concentric_radius_repaired");
    // radii.app 32px minus an 8px gap is 24px, which is radii.inset_xs.
    expect($("div").attr("class")).toContain("dg-radius-inset-xs");
    expect($("div").attr("class")).not.toContain("dg-radius-inner");
  });

  it("repairs list rows inset inside a padded card", () => {
    // Verbatim from the User Profile build.
    const $ = load(
      `<div class="dg-surface-card dg-radius-app p-[var(--dg-spacing-xs)]">
         <div class="flex flex-col gap-[var(--dg-mobile-layout-element-gap)]">
           <button class="w-full dg-radius-inner px-[var(--dg-spacing-md)] bg-[var(--dg-color-background-primary)]">Order history</button>
         </div>
       </div>`,
      {},
      false,
    );
    const diagnostics = applyGeometryContract({ $, designTokens: tokens, repairEnabled: true });
    const codes = diagnostics.map((entry) => entry.code);

    expect(codes).toContain("concentric_radius_repaired");
    expect($("button").attr("class")).toContain("dg-radius-inset-xs");
    // 16px of child gap inside 8px of padding is a rhythm inversion.
    expect(codes).toContain("nested_gap_exceeds_padding");
  });

  it("leaves a correct concentric pair alone", () => {
    const $ = load(
      `<div class="dg-surface-card dg-radius-app p-[var(--dg-spacing-xs)]">
         <div class="dg-radius-inset-xs bg-[var(--dg-color-background-primary)]">ok</div>
       </div>`,
      {},
      false,
    );
    expect(applyGeometryContract({ $, designTokens: tokens, repairEnabled: true })).toHaveLength(0);
  });

  it("does not reshape a primary CTA from its container", () => {
    const $ = load(
      `<div class="dg-surface-card dg-radius-app p-[var(--dg-spacing-md)]">
         <button type="submit" class="dg-action-primary dg-radius-inner">Checkout</button>
       </div>`,
      {},
      false,
    );
    expect(applyGeometryContract({ $, designTokens: tokens, repairEnabled: true })).toHaveLength(0);
  });
});

describe("design critic catches the composition failures", () => {
  const tokens = normalizeDesignTokens({ tokens: shippedTokens });

  it("flags the ragged two-card row", () => {
    // Verbatim shape from the Discover Feed "Curated collections" grid.
    const $ = load(
      `<div class="grid grid-cols-[1.12fr_.88fr] gap-[var(--dg-mobile-layout-element-gap)] items-start">
         <article class="dg-surface-card"><div class="h-[212px]"></div><p>Barrier and balance</p></article>
         <article class="dg-surface-card mt-[var(--dg-spacing-md)]"><div class="h-[158px]"></div><p>Sunlit skin</p></article>
       </div>`,
      {},
      false,
    );
    const report = runDesignCritic({ $, designTokens: tokens });
    const finding = report.findings.find((entry) => entry.code === "sibling_imbalance");

    expect(finding).toBeDefined();
    expect(finding?.detail).toMatch(/top offset/);
    expect(finding?.detail).toMatch(/media heights/);
    expect(report.highSeverityCount).toBeGreaterThan(0);
  });

  it("flags a tall in-flow block holding nothing", () => {
    const $ = load(`<div class="h-[212px] dg-radius-inner bg-[var(--dg-color-background-secondary)]"></div>`, {}, false);
    const report = runDesignCritic({ $, designTokens: tokens });
    expect(report.findings.map((entry) => entry.code)).toContain("decorative_dead_space");
  });

  it("flags a CSS-drawn product shape but not an ambient glow", () => {
    // Both are verbatim from the Discover Feed build. The first is a fake
    // bottle drawn out of a div; the second is atmospheric lighting.
    const $ = load(
      `<div class="relative h-[212px]">
         <div class="absolute left-[18%] bottom-[15px] w-[86px] h-[152px] dg-radius-inner bg-[var(--dg-color-surface-card)] rotate-[-5deg]"></div>
         <div class="absolute right-[12%] top-[24px] w-[62px] h-[62px] dg-radius-pill bg-[var(--dg-color-surface-card)]/45 blur-xl"></div>
       </div>`,
      {},
      false,
    );
    const report = runDesignCritic({ $, designTokens: tokens });
    const fabricated = report.findings.filter((entry) => entry.code === "fabricated_object_art");

    // Only the solid bottle-shaped div is fabricated art; the blurred layer is
    // ambient lighting and is governed by the style charter, not by this rule.
    expect(fabricated).toHaveLength(1);
    expect(fabricated[0].detail).toContain("86x152px");

    // Out-of-flow layers consume no vertical budget, so neither is dead space.
    // The 212px well that holds nothing but decoration is, and correctly so.
    const deadSpace = report.findings.filter((entry) => entry.code === "decorative_dead_space");
    expect(deadSpace).toHaveLength(1);
    expect(deadSpace[0].detail).toContain("212px");
  });

  it("does not treat correct concentric radii as vocabulary drift", () => {
    const $ = load(
      `<div class="dg-radius-app bg-white">
         <div class="dg-radius-inset-xs bg-white"></div>
         <div class="dg-radius-inset-sm bg-white"></div>
         <div class="dg-radius-inset-md bg-white"></div>
         <div class="dg-radius-inner bg-white"></div>
       </div>`,
      {},
      false,
    );
    const report = runDesignCritic({ $, designTokens: tokens });
    expect(report.findings.map((entry) => entry.code)).not.toContain("radius_vocabulary_drift");
  });

  it("reports raw palette surfaces without replacing them", () => {
    // Phase 1 removed this rewrite. A color value carries no semantic meaning,
    // so the same rule that "fixed" a white card also inverted black CTAs.
    const $ = load(`<div class="bg-white p-4"><span class="text-gray-900">Hi</span></div>`, {}, false);
    const report = runDesignCritic({ $, designTokens: tokens });

    expect(report.findings.map((entry) => entry.code)).toContain("raw_surface_color");
    expect($("div").attr("class")).toBe("bg-white p-4");
    expect($("span").attr("class")).toBe("text-gray-900");
  });

  it("accepts a balanced row", () => {
    const $ = load(
      `<div class="grid grid-cols-2 gap-[var(--dg-spacing-sm)] items-stretch">
         <article class="dg-surface-card h-full"><div class="h-[180px]"></div><p>One</p></article>
         <article class="dg-surface-card h-full"><div class="h-[180px]"></div><p>Two</p></article>
       </div>`,
      {},
      false,
    );
    const report = runDesignCritic({ $, designTokens: tokens });
    expect(report.findings.map((entry) => entry.code)).not.toContain("sibling_imbalance");
  });
});

describe("benchmark scoring", () => {
  it("reports a per-rule pass rate over a screen set", () => {
    const result = scoreDesignBenchmark({
      screens: [
        {
          id: "discover-feed",
          name: "Discover Feed",
          code: `<div class="grid grid-cols-2 items-start">
                   <article class="dg-surface-card"><div class="h-[212px]"></div></article>
                   <article class="dg-surface-card mt-[var(--dg-spacing-md)]"><div class="h-[158px]"></div></article>
                 </div>`,
        },
        { id: "clean", name: "Clean", code: `<div class="dg-surface-card"><p>Balanced content</p></div>` },
      ],
      designTokens: normalizeDesignTokens({ tokens: shippedTokens }),
      charter,
    });

    expect(result.screenCount).toBe(2);
    expect(result.overallPassRate).toBeLessThan(1);
    expect(result.rules.find((rule) => rule.rule === "sibling_imbalance")?.failingScreens).toEqual(["discover-feed"]);
    expect(result.tokenDiagnostics.length).toBeGreaterThan(0);
  });
});
