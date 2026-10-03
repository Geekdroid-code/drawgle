import { describe, expect, it } from "vitest";

import { buildCleanExportSnapshot, buildCleanScreenOnlyHtmlExport, buildCompiledExportSnapshot } from "@/lib/export-pipeline";
import { KIT_NAV_ITEM_SLOT } from "@/lib/kit-navigation";
import { normalizeNavigationDesignContract, renderDeterministicNavigationShell, withKitNavigation } from "@/lib/project-navigation";
import { buildDrawgleTokenCss } from "@/lib/token-runtime";
import type { DesignTokens, KitNavigation, NavigationPlan, ScreenData } from "@/lib/types";
import { buildHandoffThemeCss, collectMarkupFacts, pickTailwindTheme, trimTokenCss } from "./trim-export";

const designTokens: DesignTokens = {
  system_schema: "mobile_universal_core",
  tokens: {
    color: {
      background: { primary: "#FEFFFE", secondary: "#F7F9F9" },
      surface: { card: "#FFFFFF", modal: "#FFFFFF" },
      text: { high_emphasis: "#0B0809", medium_emphasis: "#646768", low_emphasis: "#8F9293" },
      action: { primary: "#FABE6E", on_primary_text: "#0B0809", secondary: "#B18F58" },
      border: { divider: "#F1F4F5", focused: "#FABE6E" },
    },
    typography: {
      heading_font_family: "Plus Jakarta Sans", body_font_family: "Plus Jakarta Sans",
      caption: { size: "12px", weight: "500", line_height: "16px" },
      section_title: { size: "18px", weight: "600", line_height: "24px" },
    },
    spacing: { xs: "8px", md: "16px", xl: "32px" },
    radii: { app: "28px", inner: "16px", pill: "9999px" },
    gradients: { action_primary: "linear-gradient(135deg, #FABE6E 0%, #F8AD45 100%)" },
    z_index: { modal_dialog: "40" },
  },
};

const screen = (code: string): ScreenData => ({
  id: "wishlist", projectId: "project", userId: "user", name: "Wishlist & Profile", code, prompt: "",
  x: 0, y: 0, createdAt: "2026-10-03", updatedAt: "2026-10-03",
});

const card = `<main class="dg-bg-primary">
  <section class="dg-surface-card p-[var(--dg-spacing-md)] dg-radius-app" data-drawgle-id="card">
    <span class="dg-type-caption dg-text-medium">Wishlist</span>
    <div data-asset-slot="true" data-asset-role="avatar"><img src="a.webp" alt="Portrait" data-asset-provider="pexels" data-asset-license="Pexels License"></div>
    <i data-lucide="heart" class="w-[16px] h-[16px]"></i>
  </section>
</main>`;

const kit: KitNavigation = {
  bar: `<nav class="flex dg-bg-primary">${KIT_NAV_ITEM_SLOT}${KIT_NAV_ITEM_SLOT}</nav>`,
  activeItem: '<div class="flex-1" data-dg-nav-state="active" aria-label="{{label}}"><i data-lucide="{{icon}}" class="dg-text-high"></i><span class="dg-type-caption font-bold">{{label}}</span></div>',
  inactiveItem: '<div class="flex-1" data-dg-nav-state="inactive" aria-label="{{label}}"><i data-lucide="{{icon}}" class="dg-text-medium"></i><span class="dg-type-caption dg-text-medium">{{label}}</span></div>',
};

const plan: NavigationPlan = {
  version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs",
  evidence: { source: "approved-scope", reason: "Approved with the flow" },
  items: [
    { id: "home", label: "Home", icon: "home", role: "Overview", availability: "generated", linkedScreenName: "Home" },
    { id: "wishlist", label: "Wishlist", icon: "heart", role: "Saved", availability: "generated", linkedScreenName: "Wishlist & Profile" },
  ],
  design: normalizeNavigationDesignContract(null, "Floating dock"),
  visualBrief: "Floating dock",
  screenChrome: [],
};

const classTokensOf = (html: string) => collectMarkupFacts(html).classTokens;
const body = (html: string) => html.slice(html.indexOf("<body>"));

describe("the export a person downloads, copies or reads", () => {
  it("keeps every class and variable name as generated, and only what the screen uses", () => {
    const tokenCss = buildDrawgleTokenCss(designTokens);
    const snapshot = buildCleanExportSnapshot({ screen: screen(card), designTokens });
    const html = snapshot.standaloneHtml;

    // nothing is renamed: the page's classes are the generated ones
    expect(classTokensOf(body(html))).toEqual(classTokensOf(card));
    // the dg rules its elements carry, and not the rest
    expect(html).toContain(".dg-surface-card { background-color: var(--dg-color-surface-card); }");
    expect(html).toContain(".dg-type-caption {");
    expect(html).not.toContain(".dg-action-primary");
    expect(html).not.toContain(".dg-type-hero-title");
    // the tokens they and the page read, directly or through other tokens
    expect(html).toContain("--dg-spacing-md: 16px;");
    expect(html).toContain("--dg-color-text-medium-emphasis: #646768;");
    expect(html).toContain("--dg-color-background-primary: #FEFFFE;");
    expect(html).not.toContain("--dg-z-index-modal-dialog");
    expect(html).not.toContain("--dg-spacing-xl");
    // no alias layer, no config, no canvas frame rule: nothing here reads them
    expect(html).not.toContain("--background:");
    expect(html).not.toContain("tailwind.config");
    expect(html).not.toContain("#root {");
    expect(tokenCss.length).toBeGreaterThan(snapshot.tokenCss.length * 2);
    // a title (no language: the export does not know the screen's), and Lucide still draws the icons
    expect(html).toContain("<title>Wishlist &amp; Profile</title>");
    expect(html).toContain('data-lucide="heart"');
    expect(html.indexOf("drawgleRepairLucideNames();")).toBeLessThan(html.indexOf("window.lucide.createIcons();"));
  });

  it("drops the bookkeeping attributes nothing reads and keeps the ones a rule or a class reads", () => {
    const code = `<style>[data-mood="calm"] .note{color:var(--dg-color-text-low-emphasis)}</style>
<div data-mood="calm" data-linked-screen-name="Home"><p class="note data-[state=open]:font-bold" data-state="open" data-asset-id="x">Calm</p></div>`;
    const html = buildCleanExportSnapshot({ screen: screen(code), designTokens }).standaloneHtml;
    expect(html).toContain('data-mood="calm"');
    expect(html).toContain('data-state="open"');
    expect(html).not.toContain("data-linked-screen-name");
    expect(html).not.toContain("data-asset-id");
    expect(html).not.toContain("data-drawgle-id");
    // the screen's own style block is text and stays as written, with the token it reads
    expect(html).toContain('<style>[data-mood="calm"] .note{color:var(--dg-color-text-low-emphasis)}</style>');
    expect(html).toContain("--dg-color-text-low-emphasis: #8F9293;");
    expect(buildCleanExportSnapshot({ screen: screen(card), designTokens }).standaloneHtml).not.toMatch(/data-asset-/);
  });

  it("keeps the Tailwind names a screen uses, with the tokens behind them, and none it does not", () => {
    const code = '<div class="bg-card rounded-lg text-screen-title md:hover:text-muted-foreground/80">Card</div>';
    const html = buildCleanExportSnapshot({ screen: screen(code), designTokens }).standaloneHtml;
    expect(html).toContain("tailwind.config");
    expect(html).toContain('card: {\n');
    expect(html).toContain('lg: "var(--radius, var(--dg-radii-app))"');
    expect(html).toContain('"screen-title": ["var(--screen-title-size, var(--dg-type-screen-title-size))"');
    expect(html).toContain('foreground: "var(--muted-foreground, var(--dg-color-text-medium-emphasis))"');
    expect(html).not.toContain('"nav-title"');
    expect(html).not.toContain("tint:");
    // the config's values read the alias variables, so they stay, with the tokens they point at
    expect(html).toContain("--card: var(--dg-color-surface-card, #ffffff);");
    expect(html).toContain("--dg-color-surface-card: #FFFFFF;");
    expect(html).toContain("--radius: var(--dg-radii-app, 16px);");
    expect(html.indexOf("tailwind.config")).toBeLessThan(html.indexOf("https://cdn.tailwindcss.com"));
  });

  it("writes each kit tab once, as this screen shows it, without the script that chose it", () => {
    const navigationCode = renderDeterministicNavigationShell(withKitNavigation(plan, kit));
    const faithful = buildCompiledExportSnapshot({ screen: screen(card), navigationCode, activeNavigationItemId: "wishlist", designTokens });
    const clean = buildCleanExportSnapshot({ screen: screen(card), navigationCode, activeNavigationItemId: "wishlist", designTokens });

    expect(faithful.standaloneHtml.match(/data-dg-nav-state=/g)?.length).toBeGreaterThanOrEqual(4);
    const navigation = clean.standaloneHtml.slice(clean.standaloneHtml.indexOf('<div id="drawgle-export-navigation">'));
    expect(navigation.match(/aria-label="Home"/g)).toHaveLength(1);
    expect(navigation.match(/aria-label="Wishlist"/g)).toHaveLength(1);
    // the current tab is drawn as current, the other as not
    expect(navigation).toMatch(/aria-current="page"[^>]*>\s*<div class="flex-1" aria-label="Wishlist"><i data-lucide="heart" class="dg-text-high">/);
    expect(navigation).toContain('<span class="dg-type-caption dg-text-medium">Home</span>');
    expect(clean.standaloneHtml).not.toContain('=== "wishlist"');
    expect(clean.standaloneHtml).not.toContain("data-dg-nav-state");
    expect(clean.standaloneHtml).not.toContain("display:none !important");
    // the bar still leaves the screen its room, and the handoff still describes both drawings of a tab
    expect(clean.standaloneHtml).toContain("--dg-navigation-clearance:");
    expect(clean.cleanNavigationHtml).toBe(faithful.cleanNavigationHtml);
  });

  it("settles a built-in bar's tabs in place, keeping the state its rules read", () => {
    const navigationCode = renderDeterministicNavigationShell(plan);
    const html = buildCleanExportSnapshot({ screen: screen(card), navigationCode, activeNavigationItemId: "home", designTokens }).standaloneHtml;
    expect(html).toMatch(/data-nav-item-id="home"[^>]*data-active="true" aria-current="page"|data-active="true" aria-current="page"[^>]*>/);
    expect(html).toContain('data-active="false" aria-current="false"');
    expect(html).toContain('.dg-nav-item[data-active="true"]');
    expect(html).not.toContain("document.querySelectorAll(\"[data-nav-item-id]\")");
  });

  it("leaves the shared navigation out of an Agent Pack screen and settles nothing", () => {
    const navigationCode = renderDeterministicNavigationShell(withKitNavigation(plan, kit));
    const html = buildCleanScreenOnlyHtmlExport({ screen: screen(card), navigationCode, activeNavigationItemId: "wishlist", designTokens });
    expect(html).toContain("Wishlist</span>");
    expect(html).not.toContain("drawgle-export-navigation");
    expect(html).not.toContain("dg-nav-kit");
    expect(html).not.toContain("--dg-navigation-clearance:");
  });
});

describe("token CSS trimming", () => {
  it("keeps CSS it cannot read whole", () => {
    expect(trimTokenCss(":root { --a: 1px;", { keepRule: () => false, references: "" })).toBe(":root { --a: 1px;");
  });

  it("gives a developer handoff every token and dg class without the canvas-only aliases and frame rule", () => {
    const theme = buildHandoffThemeCss(buildDrawgleTokenCss(designTokens));
    expect(theme).toContain("--dg-z-index-modal-dialog: 40;");
    expect(theme).toContain("--dg-gradient-action-primary:");
    expect(theme).toContain(".dg-type-hero-title {");
    expect(theme).not.toContain("--background:");
    expect(theme).not.toContain("--nav-title-size:");
    expect(theme).not.toContain("#root {");
  });

  it("finds Tailwind names behind variants, signs and opacity, and none in dg classes", () => {
    expect(pickTailwindTheme(["dg-surface-card", "flex", "p-[var(--dg-spacing-md)]"])).toBeNull();
    expect(pickTailwindTheme(["group-hover:!-mt-section-gap"])).toEqual({ spacing: { "section-gap": "var(--section-gap, var(--dg-mobile-layout-section-gap))" } });
    expect(Object.keys(pickTailwindTheme(["bg-tint-2/40"])?.colors ?? {})).toEqual(["tint"]);
  });

  it("reads a radius, font size, weight or shadow entry only from the utility that uses it", () => {
    // shadow-sm and text-sm are Tailwind's own; only a rounded class reads the theme's radii
    expect(pickTailwindTheme(["shadow-sm", "text-sm", "max-w-md", "text-lg"])).toBeNull();
    expect(pickTailwindTheme(["md:rounded-tl-lg"])).toEqual({ borderRadius: { lg: "var(--radius, var(--dg-radii-app))" } });
    expect(Object.keys(pickTailwindTheme(["text-body", "font-heading"]) ?? {})).toEqual(["fontFamily", "fontSize"]);
  });
});
