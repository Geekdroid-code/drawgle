/**
 * Phase 4: the classification is the single source of truth for what a token
 * *is*. These tests pin the distinctions that were previously implied in three
 * different files and drifted between them.
 */

import { describe, expect, it } from "vitest";

import {
  TOKEN_SCHEMA_V1,
  TOKEN_SCHEMA_V2,
  classifyTokenPath,
  isBuilderVisibleToken,
  isSupportedTokenSchema,
  isUserEditableToken,
} from "@/lib/design-token-classification";
import { normalizeDesignTokens } from "@/lib/design-tokens";
import { buildDrawgleTokenCss, buildTokenPromptContext, getDrawgleTokenReferences } from "@/lib/token-runtime";

describe("classification", () => {
  it("keeps project visual identity global", () => {
    for (const path of [
      "color.background.primary",
      "color.surface.card",
      "color.text.high_emphasis",
      "color.action.primary",
      "typography.heading_font_family",
      "typography.body.size",
      "spacing.md",
      "mobile_layout.screen_margin",
      "radii.app",
      "border_widths.standard",
      "shadows.surface",
      "sizing.standard_button_height",
    ]) {
      expect(classifyTokenPath(path).klass, path).toBe("global");
    }
  });

  it("separates navigation colour from navigation construction", () => {
    // The distinction the old schema collapsed: a floating glass dock and a flat
    // tab rail share a design system while differing completely in anatomy.
    expect(classifyTokenPath("navigation.surface").klass).toBe("global");
    expect(classifyTokenPath("navigation.content").klass).toBe("global");
    expect(classifyTokenPath("navigation.anatomy").klass).toBe("component-recipe");
    expect(classifyTokenPath("navigation.container_height").klass).toBe("component-recipe");
    expect(classifyTokenPath("navigation.active_indicator_width").klass).toBe("component-recipe");
    expect(classifyTokenPath("sizing.bottom_nav_height").klass).toBe("component-recipe");
  });

  it("treats device and engineering constants as runtime invariants", () => {
    for (const path of [
      "mobile_layout.safe_area_top",
      "mobile_layout.safe_area_bottom",
      "sizing.min_touch_target",
      "z_index.modal_dialog",
    ]) {
      expect(classifyTokenPath(path).klass, path).toBe("runtime-invariant");
      expect(isUserEditableToken(path), path).toBe(false);
    }
  });

  it("marks duplicates and legacy aliases deprecated with a reason", () => {
    for (const path of [
      "shadows.none",
      "elevation.md",
      "color.action.on_surface_white_bg",
      "color.action.primary_gradient_start",
      "typography.title_large",
      "gradients.app_background",
      "gradients.surface_highlight",
      "radii.inset_xs",
      "opacities.pressed",
    ]) {
      const result = classifyTokenPath(path);
      expect(result.klass, path).toBe("deprecated");
      expect(result.why, path).toBeTruthy();
    }
  });

  it("keeps the one gradient with a real identity argument", () => {
    expect(classifyTokenPath("gradients.action_primary").klass).toBe("global");
  });

  it("defaults unknown paths to global so new tokens stay visible", () => {
    expect(classifyTokenPath("color.brand.tertiary").klass).toBe("global");
  });
});

describe("consumers agree with the classification", () => {
  const tokens = normalizeDesignTokens({
    tokens: {
      color: { background: { primary: "#FFFFFF" }, surface: { card: "#FEFEFE" }, text: { high_emphasis: "#111111" } },
      spacing: { md: "16px" },
      mobile_layout: { screen_margin: "16px", element_gap: "12px" },
      radii: { app: "20px", inner: "12px", pill: "9999px" },
      sizing: { standard_button_height: "52px" },
      navigation: { surface: "#111111", content: "#FFFFFF", anatomy: "floating-dock", container_height: "64px" },
      z_index: { modal_dialog: "40" },
    },
  });

  it("sends only global tokens to the builder", () => {
    const context = buildTokenPromptContext(tokens, "compact_visual");

    expect(context).toContain("--dg-color-surface-card");
    expect(context).toContain("--dg-radii-app");
    expect(context).toContain("--dg-navigation-surface");

    // Component recipe, runtime invariants and deprecated duplicates are noise
    // for a builder that neither chooses the safe area nor themes z-index.
    expect(context).not.toContain("--dg-navigation-anatomy");
    expect(context).not.toContain("--dg-navigation-container-height");
    expect(context).not.toContain("--dg-z-index-modal-dialog");
    expect(context).not.toContain("--dg-mobile-layout-safe-area-top");
    expect(context).not.toContain("--dg-sizing-min-touch-target");
  });

  it("still emits every variable at runtime, whatever its class", () => {
    // Compatibility is a runtime concern; classification is an authoring one.
    // A v1 screen referencing any of these must keep rendering.
    const css = buildDrawgleTokenCss(tokens);
    for (const variable of [
      "--dg-navigation-anatomy",
      "--dg-navigation-container-height",
      "--dg-z-index-modal-dialog",
      "--dg-mobile-layout-safe-area-top",
      "--dg-sizing-min-touch-target",
    ]) {
      expect(css, variable).toContain(variable);
    }
  });

  it("leaks no non-global variable into the builder prompt, for any token set", () => {
    // Exhaustive rather than a hand-listed sample: whatever the classification
    // calls non-global must be absent from the prompt, including the prose. The
    // previous drift was exactly this — the variable list was filtered while the
    // hardcoded utility sentence still named demoted gradients.
    const full = normalizeDesignTokens({
      tokens: {
        color: {
          background: { primary: "#FFFFFF", secondary: "#F6F6F4" },
          surface: { card: "#FFFFFF", bottom_sheet: "#FFFFFF", modal: "#FFFFFF" },
          text: { high_emphasis: "#111111", medium_emphasis: "#555555", low_emphasis: "#8A8A8A" },
          action: {
            primary: "#111111",
            secondary: "#3A3A3A",
            on_primary_text: "#FFFFFF",
            disabled: "#E4E4E4",
            on_surface_white_bg: "#111111",
            primary_gradient_start: "#111111",
            primary_gradient_end: "#3A3A3A",
          },
          border: { divider: "#E7E7E7", focused: "#111111" },
        },
        typography: {
          heading_font_family: "Inter",
          body_font_family: "Inter",
          title_large: { size: "28px", weight: "700", line_height: "34px" },
          body_primary: { size: "15px", weight: "400", line_height: "22px" },
        },
        spacing: { none: "0px", xxs: "4px", xs: "8px", sm: "12px", md: "16px", lg: "24px", xl: "32px" },
        mobile_layout: { screen_margin: "16px", section_gap: "24px", element_gap: "12px", safe_area_top: "16px", safe_area_bottom: "16px" },
        sizing: { standard_button_height: "52px", standard_input_height: "52px", icon_small: "16px", icon_standard: "24px", bottom_nav_height: "68px", min_touch_target: "48px" },
        radii: { app: "20px", inner: "12px", pill: "9999px", inset_md: "8px" },
        border_widths: { standard: "1px" },
        shadows: { none: "none", surface: "0 1px 2px rgba(0,0,0,.05)", overlay: "0 12px 32px rgba(0,0,0,.18)" },
        elevation: { md: "0 2px 4px rgba(0,0,0,.1)" },
        gradients: {
          action_primary: "linear-gradient(135deg, #111 0%, #3A3A3A 100%)",
          app_background: "linear-gradient(180deg, #FFF 0%, #F6F6F4 100%)",
          surface_highlight: "linear-gradient(145deg, #FFF 0%, #F6F6F4 100%)",
          accent_ring: "linear-gradient(135deg, #111 0%, #3A3A3A 100%)",
        },
        navigation: { surface: "#111111", content: "#FFFFFF", anatomy: "floating-dock", container_height: "64px", icon_size: "22px" },
        opacities: { disabled: "0.38", pressed: "0.12", scrim_overlay: "0.50" },
        z_index: { base: "0", sticky_header: "10", bottom_nav: "20", modal_dialog: "40" },
      },
    });

    const context = buildTokenPromptContext(full, "compact_visual");
    const leaked = getDrawgleTokenReferences(full)
      .filter((reference) => !isBuilderVisibleToken(reference.path))
      .filter((reference) => context.includes(reference.name))
      .map((reference) => reference.path);

    expect(leaked).toEqual([]);

    // ...and the global ones are all still there, so this is a filter and not a mute button.
    const missing = getDrawgleTokenReferences(full)
      .filter((reference) => isBuilderVisibleToken(reference.path))
      .filter((reference) => !context.includes(reference.name))
      .map((reference) => reference.path);

    expect(missing).toEqual([]);
  });

  it("does not offer non-global tokens for editing", () => {
    expect(isUserEditableToken("navigation.surface")).toBe(true);
    expect(isUserEditableToken("navigation.anatomy")).toBe(false);
    expect(isUserEditableToken("sizing.bottom_nav_height")).toBe(false);
    expect(isUserEditableToken("shadows.none")).toBe(false);
    expect(isBuilderVisibleToken("opacities.pressed")).toBe(false);
  });
});

describe("schema versioning", () => {
  it("stamps newly authored token sets v2", () => {
    expect(normalizeDesignTokens({ tokens: { spacing: { md: "16px" } } }).system_schema).toBe(TOKEN_SCHEMA_V2);
  });

  it("preserves a stored v1 identifier rather than silently upgrading it", () => {
    const v1 = normalizeDesignTokens({ system_schema: TOKEN_SCHEMA_V1, tokens: { spacing: { md: "16px" } } });
    expect(v1.system_schema).toBe(TOKEN_SCHEMA_V1);
  });

  it("supports both versions", () => {
    expect(isSupportedTokenSchema(TOKEN_SCHEMA_V1)).toBe(true);
    expect(isSupportedTokenSchema(TOKEN_SCHEMA_V2)).toBe(true);
    expect(isSupportedTokenSchema(undefined)).toBe(true);
  });

  it("never drops a stored key, whatever its class", () => {
    // Deleting keys from stored JSON is how a migration unexpectedly redesigns
    // existing projects. Read-tolerate, never delete.
    const stored = normalizeDesignTokens({
      tokens: {
        z_index: { modal_dialog: "40" },
        opacities: { pressed: "0.08" },
        shadows: { none: "none", surface: "0 1px 2px rgba(0,0,0,.04)" },
        elevation: { md: "0 2px 4px rgba(0,0,0,.1)" },
      },
    });
    expect(stored.tokens?.z_index).toBeDefined();
    expect(stored.tokens?.opacities).toBeDefined();
    expect(stored.tokens?.shadows?.none).toBeDefined();
    expect(stored.tokens?.elevation).toBeDefined();
  });
});
