import { describe, expect, it } from "vitest";

import {
  compileHtmlForProduction,
  compileStylesheetForProduction,
  buildTailwindConfigScript,
} from "@/lib/html-compiler";
import type { DesignTokens } from "@/lib/types";

const designTokens: DesignTokens = {
  system_schema: "mobile_universal_core",
  tokens: {
    color: {
      background: { primary: "#101010", secondary: "#181818" },
      surface: { card: "#202020" },
      text: { high_emphasis: "#FFFFFF", medium_emphasis: "#B0B0B0", low_emphasis: "#777777" },
      action: { primary: "#5EE1A2", on_primary_text: "#08110C", secondary: "#303030" },
      border: { divider: "#333333", focused: "#5EE1A2" },
      functional_tints: {
        blue_base: "#EBF2FF",
        orange_base: "#FFF4EB",
        cyan_base: "#F0FBFF",
        purple_base: "#F9F5FF",
      },
    },
    typography: {
      font_family: "Plus Jakarta Sans",
      screen_title: { size: "24px", weight: 700, line_height: "30px" },
    },
    mobile_layout: { screen_margin: "20px", section_gap: "24px", element_gap: "12px" },
    radii: { app: "22px", pill: "9999px" },
    opacities: { disabled: "0.38" },
  },
};

describe("HTML production compiler", () => {
  it("resolves custom dg- helper classes to their resolved variables", () => {
    const rawHtml = `<div class="dg-bg-primary dg-text-high dg-radius-app dg-element-gap"></div>`;
    const compiled = compileHtmlForProduction(rawHtml, designTokens);

    expect(compiled).toContain("bg-background");
    expect(compiled).toContain("text-foreground");
    expect(compiled).toContain("rounded-lg");
    expect(compiled).toContain("gap-[var(--element-gap)]");
  });

  it("resolves arbitrary Tailwind variable classes", () => {
    const rawHtml = `<div class="bg-[var(--dg-color-background-primary)] px-[var(--dg-mobile-layout-screen-margin)] pb-[calc(var(--dg-mobile-layout-screen-margin)+96px)]"></div>`;
    const compiled = compileHtmlForProduction(rawHtml, designTokens);

    expect(compiled).toContain("bg-background");
    expect(compiled).toContain("px-[var(--screen-margin)]");
    expect(compiled).toContain("pb-[calc(var(--screen-margin)+96px)]");
  });

  it("resolves typography classes", () => {
    const rawHtml = `<h1 class="dg-type-screen-title text-[var(--dg-color-text-low-emphasis)]">Activity</h1>`;
    const compiled = compileHtmlForProduction(rawHtml, designTokens);

    expect(compiled).toContain("text-screen-title");
    expect(compiled).toContain("font-screen-title");
    expect(compiled).toContain("text-low-foreground");
  });

  it("compiles inline style properties to Tailwind classes and cleans the style attribute", () => {
    const rawHtml = `<div style="font-size: var(--dg-type-screen-title-size); font-weight: var(--dg-type-screen-title-weight); line-height: var(--dg-type-screen-title-line-height); margin-top: 12px; color: #FFFFFF;"></div>`;
    const compiled = compileHtmlForProduction(rawHtml, designTokens);

    expect(compiled).toContain("text-screen-title");
    expect(compiled).toContain("font-screen-title");
    expect(compiled).toContain("leading-[var(--screen-title-line-height)]");
    expect(compiled).toContain("mt-[var(--element-gap)]");
    expect(compiled).toContain("text-foreground");
    expect(compiled).not.toContain("style=");
  });

  it("preserves uncompilable inline style properties", () => {
    const rawHtml = `<div style="color: #FFFFFF; display: block; border-left: 2px dashed #000;"></div>`;
    const compiled = compileHtmlForProduction(rawHtml, designTokens);

    expect(compiled).toContain("text-foreground");
    expect(compiled).toContain("block");
    expect(compiled).toContain("style=");
    expect(compiled).not.toContain("display: block");
    expect(compiled).toContain("border-left: 2px dashed #000");
  });

  it("compiles Visual Editor V2 production properties to classes", () => {
    const rawHtml = `<div class="block justify-start p-[8px]" style="display: flex; position: absolute; top: 12px; overflow: hidden; flex-direction: column; justify-content: center; align-items: stretch; width: 100%; aspect-ratio: 16 / 9; text-align: center; letter-spacing: 0.02em; border-top-width: 2px; border-style: dashed; transform: translateX(4px);"></div>`;
    const compiled = compileHtmlForProduction(rawHtml, designTokens);

    expect(compiled).toContain("flex");
    expect(compiled).toContain("absolute");
    expect(compiled).toContain("top-[var(--element-gap)]");
    expect(compiled).toContain("overflow-hidden");
    expect(compiled).toContain("flex-col");
    expect(compiled).toContain("justify-center");
    expect(compiled).toContain("items-stretch");
    expect(compiled).toContain("w-full");
    expect(compiled).toContain("aspect-video");
    expect(compiled).toContain("text-center");
    expect(compiled).toContain("tracking-[0.02em]");
    expect(compiled).toContain("border-t-[2px]");
    expect(compiled).toContain("border-dashed");
    expect(compiled).toContain("[transform:translateX(4px)]");
    expect(compiled).not.toContain("justify-start");
    expect(compiled).not.toContain("style=");
  });

  it("resolves variables in other element attributes like stroke or fill in SVGs", () => {
    const rawHtml = `<svg><path stroke="var(--dg-color-action-primary)" fill="var(--dg-color-border-divider)" /></svg>`;
    const compiled = compileHtmlForProduction(rawHtml, designTokens);

    expect(compiled).toContain('stroke="var(--primary)"');
    expect(compiled).toContain('fill="var(--border)"');
  });

  it("maps hardcoded background hexes to semantic functional tints", () => {
    const rawHtml = `<div class="bg-[#EBF2FF] bg-[#FFF4EB] bg-[#F5F5F5]"></div>`;
    const compiled = compileHtmlForProduction(rawHtml, designTokens);

    expect(compiled).toContain("bg-tint-blue");
    expect(compiled).toContain("bg-tint-orange");
    expect(compiled).toContain("bg-tint-gray");
  });

  it("compiles the production stylesheet correctly with normalized variable mappings", () => {
    const varMap = new Map([
      ["--dg-color-background-primary", "#101010"],
      ["--dg-radii-app", "22px"],
      ["--dg-mobile-layout-safe-area-top", "16px"],
    ]);

    const stylesheet = compileStylesheetForProduction(varMap);
    expect(stylesheet).toContain("--background: #101010;");
    expect(stylesheet).toContain("--radius: 22px;");
    expect(stylesheet).toContain("--safe-area-top: 16px;");
    expect(stylesheet).toContain("--tint-blue: #F0F7FF;");
    expect(stylesheet).toContain("--surface-muted: #F5F5F5;");
    expect(stylesheet).not.toContain("--dg-radii-app");
  });

  it("builds the tailwind configuration script containing font family and functional tints", () => {
    const configScript = buildTailwindConfigScript();
    expect(configScript).toContain("fontFamily:");
    expect(configScript).toContain('sans: ["var(--font-body)"');
    expect(configScript).toContain("tint:");
    expect(configScript).toContain('blue: "var(--tint-blue)"');
    expect(configScript).toContain('gray: "var(--surface-muted)"');
  });
});
