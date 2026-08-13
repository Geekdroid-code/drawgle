import { isBuilderVisibleToken } from "@/lib/design-token-classification";
import { normalizeDesignTokens } from "@/lib/design-tokens";
import type { DesignTokens, DesignTokenValues } from "@/lib/types";

type CssVariable = {
  path: string;
  name: string;
  value: string;
};

export type DrawgleTokenReference = CssVariable & {
  label: string;
  group: string;
};

export type TokenPromptMode =
  | "none"
  | "compact_visual"
  | "runtime_css";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const GENERIC_FONT_FAMILIES = new Set([
  "sans-serif",
  "serif",
  "monospace",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "emoji",
  "math",
  "fangsong",
]);

const HEADING_TYPOGRAPHY_TOKEN_KEYS = [
  "nav_title",
  "screen_title",
  "hero_title",
  "section_title",
] as const;

const BODY_TYPOGRAPHY_TOKEN_KEYS = [
  "metric_value",
  "body",
  "supporting",
  "caption",
  "button_label",
] as const;

const TYPOGRAPHY_TOKEN_KEYS = [
  ...HEADING_TYPOGRAPHY_TOKEN_KEYS,
  ...BODY_TYPOGRAPHY_TOKEN_KEYS,
] as const;

const kebab = (value: string) => value.replace(/_/g, "-").replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();

const tokenPathToVariableName = (path: string) => {
  const parts = path.split(".");
  if (parts[0] === "typography" && parts.length >= 3) {
    return `--dg-type-${kebab(parts[1])}-${kebab(parts.slice(2).join("-"))}`;
  }

  return `--dg-${parts.map(kebab).join("-")}`;
};

const humanize = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const escapeCssValue = (value: string) => value.replace(/[\n\r;]/g, " ").trim();

const escapeHtmlAttribute = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const parseFontFamilyList = (fontFamily?: string | null) => {
  const value = fontFamily?.trim();
  if (!value) {
    return [];
  }

  const families: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (const character of value) {
    if ((character === "'" || character === "\"") && !quote) {
      quote = character;
      continue;
    }

    if (quote === character) {
      quote = null;
      continue;
    }

    if (character === "," && !quote) {
      if (current.trim()) {
        families.push(current.trim());
      }
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim()) {
    families.push(current.trim());
  }

  return families
    .map((family) => family.replace(/^['"]|['"]$/g, "").trim())
    .filter(Boolean);
};

const validGoogleFontFamily = (fontFamily?: string | null) => {
  const family = parseFontFamilyList(fontFamily)[0];
  if (!family) return null;

  const lowerFamily = family.toLowerCase();
  if (GENERIC_FONT_FAMILIES.has(lowerFamily) || lowerFamily.startsWith("var(")) return null;
  return /^[\p{L}\p{N} ._-]+$/u.test(family) ? family : null;
};

export const getPrimaryGoogleFontFamilies = (designTokens?: DesignTokens | null) => {
  const normalized = normalizeDesignTokens(designTokens ?? {});
  return {
    heading: validGoogleFontFamily(normalized.tokens?.typography?.heading_font_family),
    body: validGoogleFontFamily(normalized.tokens?.typography?.body_font_family),
  };
};

const typographyWeights = (
  designTokens: DesignTokens,
  keys: readonly (typeof TYPOGRAPHY_TOKEN_KEYS)[number][],
) => {
  const weights = new Set<string>();
  for (const key of keys) {
    const weight = designTokens.tokens?.typography?.[key]?.weight;
    const numericWeight = Number.parseInt(String(weight ?? ""), 10);
    if (Number.isFinite(numericWeight)) {
      weights.add(String(Math.min(1000, Math.max(1, numericWeight))));
    }
  }
  return weights;
};

export const buildGoogleFontHref = (designTokens?: DesignTokens | null) => {
  const normalized = normalizeDesignTokens(designTokens ?? {});
  const families = getPrimaryGoogleFontFamilies(normalized);
  const familyWeights = new Map<string, Set<string>>();

  const addFamily = (family: string | null, weights: Set<string>) => {
    if (!family) return;
    const existing = familyWeights.get(family) ?? new Set<string>();
    weights.forEach((weight) => existing.add(weight));
    familyWeights.set(family, existing);
  };

  addFamily(families.heading, typographyWeights(normalized, HEADING_TYPOGRAPHY_TOKEN_KEYS));
  addFamily(families.body, typographyWeights(normalized, BODY_TYPOGRAPHY_TOKEN_KEYS));
  if (familyWeights.size === 0) return null;

  const familyQueries = Array.from(familyWeights.entries()).map(([family, weights]) => {
    const weightList = Array.from(weights).sort((first, second) => Number(first) - Number(second));
    const encodedFamily = family.trim().replace(/\s+/g, "+");
    return `family=${encodedFamily}${weightList.length ? `:wght@${weightList.join(";")}` : ""}`;
  });

  return `https://fonts.googleapis.com/css2?${familyQueries.join("&")}&display=swap`;
};
export const buildGoogleFontAssetLinks = (designTokens?: DesignTokens | null) => {
  const href = buildGoogleFontHref(designTokens);
  if (!href) {
    return "";
  }

  const escapedHref = escapeHtmlAttribute(href);
  return [
    '<link rel="preconnect" href="https://fonts.googleapis.com" data-drawgle-font-preconnect="googleapis">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin data-drawgle-font-preconnect="gstatic">',
    `<link id="drawgle-google-font" rel="stylesheet" href="${escapedHref}">`,
  ].join("\n");
};

export function flattenDesignTokensToCssVariables(designTokens?: DesignTokens | null): CssVariable[] {
  const normalized = normalizeDesignTokens(designTokens ?? {});
  const tokens = normalized.tokens;
  const variables: CssVariable[] = [];

  const visit = (value: unknown, path: string[]) => {
    if (typeof value === "string" || typeof value === "number") {
      const nextValue = String(value).trim();
      if (nextValue) {
        const joinedPath = path.join(".");
        variables.push({
          path: joinedPath,
          name: tokenPathToVariableName(joinedPath),
          value: nextValue,
        });
      }
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      visit(child, [...path, key]);
    }
  };

  visit(tokens ?? {}, []);

  return variables;
}

export function getDrawgleTokenReferences(designTokens?: DesignTokens | null): DrawgleTokenReference[] {
  return flattenDesignTokensToCssVariables(designTokens).map((variable) => {
    const parts = variable.path.split(".");
    return {
      ...variable,
      group: humanize(parts[0] ?? "Token"),
      label: parts.slice(1).map(humanize).join(" / ") || humanize(variable.path),
    };
  });
}

const typographyClass = (name: string, tokenKey: string, role: "heading" | "body") => `
.dg-type-${name} {
  font-family: var(--dg-typography-${role}-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: var(--dg-type-${tokenKey}-size);
  font-weight: var(--dg-type-${tokenKey}-weight);
  line-height: var(--dg-type-${tokenKey}-line-height);
}`;

const buildCompatibilityAliasVariables = () => `
  --background: var(--dg-color-background-primary, #ffffff);
  --muted: var(--dg-color-background-secondary, #f5f5f5);
  --card: var(--dg-color-surface-card, #ffffff);
  --popover: var(--dg-color-surface-modal, #ffffff);
  --foreground: var(--dg-color-text-high-emphasis, #111827);
  --muted-foreground: var(--dg-color-text-medium-emphasis, #6b7280);
  --low-foreground: var(--dg-color-text-low-emphasis, #9ca3af);
  --primary: var(--dg-color-action-primary, #2563eb);
  --primary-foreground: var(--dg-color-action-on-primary-text, #ffffff);
  --secondary: var(--dg-color-action-secondary, #e5e7eb);
  --border: var(--dg-color-border-divider, #e5e7eb);
  --ring: var(--dg-color-border-focused, #2563eb);
  --action-disabled: var(--dg-color-action-disabled, #d1d5db);
  --tint-blue: var(--dg-color-functional-tints-blue-base, #F0F7FF);
  --tint-orange: var(--dg-color-functional-tints-orange-base, #FFF7F0);
  --tint-cyan: var(--dg-color-functional-tints-cyan-base, #F0FBFF);
  --tint-purple: var(--dg-color-functional-tints-purple-base, #F9F5FF);
  --surface-muted: var(--dg-color-background-secondary, #F5F5F5);
  --radius: var(--dg-radii-app, 16px);
  --radius-inner: var(--dg-radii-inner, 12px);
  --radius-pill: var(--dg-radii-pill, 9999px);
  --screen-margin: var(--dg-mobile-layout-screen-margin, 16px);
  --section-gap: var(--dg-mobile-layout-section-gap, 24px);
  --element-gap: var(--dg-mobile-layout-element-gap, 12px);
  --dg-spacing-section-gap: var(--dg-mobile-layout-section-gap, 24px);
  --dg-spacing-element-gap: var(--dg-mobile-layout-element-gap, 12px);
  --safe-area-top: var(--dg-mobile-layout-safe-area-top, 0px);
  --safe-area-bottom: var(--dg-mobile-layout-safe-area-bottom, 0px);
  --icon-small: var(--dg-sizing-icon-small, 20px);
  --icon-standard: var(--dg-sizing-icon-standard, 24px);
  --bottom-nav-height: var(--dg-sizing-bottom-nav-height, 80px);
  --standard-input-height: var(--dg-sizing-standard-input-height, 52px);
  --standard-button-height: var(--dg-sizing-standard-button-height, 56px);
  --min-touch-target: var(--dg-sizing-min-touch-target, 44px);
  --shadow-surface: var(--dg-shadows-surface, none);
  --shadow-overlay: var(--dg-shadows-overlay, none);
  --shadow-none: var(--dg-shadows-none, none);
  --dg-gradient-action-primary: var(--dg-gradients-action-primary, linear-gradient(135deg, var(--dg-color-action-primary, #2563eb) 0%, var(--dg-color-action-secondary, #0f172a) 100%));
  --dg-gradient-app-background: var(--dg-gradients-app-background, linear-gradient(180deg, var(--dg-color-background-primary, #ffffff) 0%, var(--dg-color-background-secondary, #f5f5f5) 100%));
  --dg-gradient-surface-highlight: var(--dg-gradients-surface-highlight, linear-gradient(145deg, var(--dg-color-surface-card, #ffffff) 0%, var(--dg-color-background-surface-elevated, #f5f5f5) 100%));
  --dg-gradient-accent-ring: var(--dg-gradients-accent-ring, linear-gradient(135deg, var(--dg-color-action-primary, #2563eb) 0%, var(--dg-color-action-secondary, #0f172a) 100%));
  --font-heading: var(--dg-typography-heading-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  --font-body: var(--dg-typography-body-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  --dg-typography-font-family: var(--dg-typography-body-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  --dg-typography-title-font-family: var(--dg-typography-heading-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  --dg-color-status-error: var(--dg-color-status-danger-foreground, #991B1B);
  --dg-color-status-success: var(--dg-color-status-success-foreground, #166534);
  --dg-color-status-warning: var(--dg-color-status-warning-foreground, #92400E);
  --dg-color-status-info: var(--dg-color-status-info-foreground, #1E40AF);
${TYPOGRAPHY_TOKEN_KEYS.map((key) => {
  const name = key.replace(/_/g, "-");
  return `  --${name}-size: var(--dg-type-${name}-size);
  --${name}-weight: var(--dg-type-${name}-weight);
  --${name}-line-height: var(--dg-type-${name}-line-height);`;
}).join("\n")}
`.trimEnd();
export function buildDrawgleTokenCss(designTokens?: DesignTokens | null) {
  const variables = flattenDesignTokensToCssVariables(designTokens);
  const variableCss = variables
    .map((variable) => `  ${variable.name}: ${escapeCssValue(variable.value)};`)
    .join("\n");

  return `
:root {
${variableCss}
${buildCompatibilityAliasVariables()}
}

#root {
  --dg-preview-background: var(--dg-color-background-primary, #ffffff);
  background: var(--dg-preview-background);
  font-family: var(--dg-typography-body-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
}

:where(#root, #drawgle-export-root) h1,
:where(#root, #drawgle-export-root) h2,
:where(#root, #drawgle-export-root) h3,
:where(#root, #drawgle-export-root) h4,
:where(#root, #drawgle-export-root) h5,
:where(#root, #drawgle-export-root) h6 {
  font-family: var(--dg-typography-heading-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
}

:where(#root, #drawgle-export-root) button,
:where(#root, #drawgle-export-root) input,
:where(#root, #drawgle-export-root) textarea,
:where(#root, #drawgle-export-root) select {
  font-family: var(--dg-typography-body-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
}

.dg-bg-primary { background-color: var(--dg-color-background-primary); }
.dg-bg-secondary { background-color: var(--dg-color-background-secondary); }
.dg-surface-card { background-color: var(--dg-color-surface-card); }
.dg-surface-bottom-sheet { background-color: var(--dg-color-surface-bottom-sheet); }
.dg-surface-modal { background-color: var(--dg-color-surface-modal); }
.dg-text-high { color: var(--dg-color-text-high-emphasis); }
.dg-text-medium { color: var(--dg-color-text-medium-emphasis); }
.dg-text-low { color: var(--dg-color-text-low-emphasis); }
.dg-action-primary {
  background-color: var(--dg-color-action-primary);
  color: var(--dg-color-action-on-primary-text);
}
.dg-action-secondary { background-color: var(--dg-color-action-secondary); }
.dg-gradient-app-background { background-image: var(--dg-gradient-app-background); }
.dg-gradient-action-primary {
  background-image: var(--dg-gradient-action-primary);
  color: var(--dg-color-action-on-primary-text);
}
.dg-gradient-surface-highlight { background-image: var(--dg-gradient-surface-highlight); }
.dg-gradient-accent-ring { background-image: var(--dg-gradient-accent-ring); }
.dg-border-divider { border-color: var(--dg-color-border-divider); }
.dg-border-focused { border-color: var(--dg-color-border-focused); }
.dg-status-success { color: var(--dg-color-status-success-foreground); background-color: var(--dg-color-status-success-surface); border-color: var(--dg-color-status-success-border); }
.dg-status-warning { color: var(--dg-color-status-warning-foreground); background-color: var(--dg-color-status-warning-surface); border-color: var(--dg-color-status-warning-border); }
.dg-status-danger { color: var(--dg-color-status-danger-foreground); background-color: var(--dg-color-status-danger-surface); border-color: var(--dg-color-status-danger-border); }
.dg-status-info { color: var(--dg-color-status-info-foreground); background-color: var(--dg-color-status-info-surface); border-color: var(--dg-color-status-info-border); }
.dg-radius-app { border-radius: var(--dg-radii-app); }
.dg-radius-inner { border-radius: var(--dg-radii-inner); }
.dg-radius-pill { border-radius: var(--dg-radii-pill); }
.dg-radius-inset-xxs { border-radius: var(--dg-radii-inset-xxs, var(--dg-radii-inner)); }
.dg-radius-inset-xs { border-radius: var(--dg-radii-inset-xs, var(--dg-radii-inner)); }
.dg-radius-inset-sm { border-radius: var(--dg-radii-inset-sm, var(--dg-radii-inner)); }
.dg-radius-inset-md { border-radius: var(--dg-radii-inset-md, var(--dg-radii-inner)); }
.dg-radius-inset-lg { border-radius: var(--dg-radii-inset-lg, var(--dg-radii-inner)); }
.dg-shared-nav-clearance {
  padding-bottom: var(--dg-navigation-clearance, 0px) !important;
}
.dg-asset-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: var(--dg-color-background-secondary, #f5f5f5);
  color: var(--dg-color-text-medium-emphasis, #6b7280);
  box-shadow: inset 0 0 0 1px var(--dg-color-border-divider, #e5e7eb);
  font-weight: 600;
}
.dg-shadow-surface { box-shadow: var(--dg-shadows-surface); }
.dg-shadow-overlay { box-shadow: var(--dg-shadows-overlay); }
.dg-screen-padding { padding-left: var(--dg-mobile-layout-screen-margin); padding-right: var(--dg-mobile-layout-screen-margin); }
/* A screen rail may own the outer inset only once. This compatibility rule
   also repairs already-saved screens produced by the repeatable-hook bug. */
.dg-screen-padding .dg-screen-padding,
[class~="px-[var(--dg-mobile-layout-screen-margin)]"] .dg-screen-padding {
  padding-left: 0;
  padding-right: 0;
}
.dg-section-gap { gap: var(--dg-mobile-layout-section-gap); }
.dg-element-gap { gap: var(--dg-mobile-layout-element-gap); }
${typographyClass("nav-title", "nav-title", "heading")}
${typographyClass("screen-title", "screen-title", "heading")}
${typographyClass("hero-title", "hero-title", "heading")}
${typographyClass("section-title", "section-title", "heading")}
${typographyClass("metric-value", "metric-value", "body")}
${typographyClass("body", "body", "body")}
${typographyClass("supporting", "supporting", "body")}
${typographyClass("caption", "caption", "body")}
${typographyClass("button-label", "button-label", "body")}
`.trim();
}

const formatTokenReferences = (references: DrawgleTokenReference[], limit: number) =>
  references
    .slice(0, limit)
    .map((reference) => `${reference.path}: var(${reference.name}) = ${reference.value}`)
    .join("\n");

/**
 * The builder sees global tokens only.
 *
 * This used to be a hand-maintained prefix list that drifted from what the
 * tokens actually meant — it sent `sizing.bottom_nav_height` (component
 * recipe), all of `mobile_layout` including device safe areas, every gradient,
 * and every legacy typography alias. `design-token-classification.ts` is now
 * the single source of truth, so the prompt cannot drift from the editor's view
 * of the same schema.
 */
const isBuilderVisibleReference = (reference: DrawgleTokenReference) =>
  isBuilderVisibleToken(reference.path) && !isPresentedAsRoles(reference.path);

/**
 * Groups the raw variable list must not repeat.
 *
 * This is not a classification question — `spacing` is global, user-editable
 * project identity and belongs in the editor. It is a *presentation* question:
 * `resolveSemanticMap` already sends these values with role names and stated
 * intent ("screen_edge_padding (outer horizontal padding of every screen)"),
 * which is strictly better guidance than a bare ladder of interchangeable
 * pixel values.
 *
 * Sending both is what broke project 8dcc913a on 2026-08-12: the builder used
 * `--dg-spacing-*` 33 times on that screen and the screen-margin role zero
 * times, so content ran edge to edge. The screen before the regression used the
 * role twice and the raw ladder not at all. A menu of eight numbers displaces a
 * named role every time.
 *
 * Phase 4 lost this by replacing "which prefixes does the builder need" with
 * "which tokens are global". Those are different questions.
 */
const ROLE_PRESENTED_GROUPS = new Set(["spacing"]);

const isPresentedAsRoles = (path: string) => ROLE_PRESENTED_GROUPS.has(path.split(".")[0]);

/**
 * Resolves the spacing rhythm into a compact semantic map for the LLM prompt.
 * Each entry has a self-describing role name + resolved pixel value so the LLM
 * can make visual hierarchy judgements without seeing the full raw scale.
 *
 * z_index and the opacity states are omitted: both are runtime/component
 * concerns rather than project identity, and the editor no longer offers them.
 */
function resolveSemanticMap(tokens: DesignTokenValues | undefined): string {
  const sp = tokens?.spacing ?? {};
  const ml = tokens?.mobile_layout ?? {};

  const spacingEntries: Array<[string, string, string]> = [
    ["screen_edge_padding (outer horizontal padding of every screen)", "--dg-mobile-layout-screen-margin", ml.screen_margin ?? "16px"],
    ["between_sections (gap between major content blocks)", "--dg-mobile-layout-section-gap", ml.section_gap ?? sp.lg ?? "24px"],
    ["between_elements (gap between items within a section)", "--dg-mobile-layout-element-gap", ml.element_gap ?? sp.md ?? "16px"],
    ["component_inner (card padding, form field insets)", "--dg-spacing-md", sp.md ?? "16px"],
    ["tight_inline (icon-to-label, chip padding, badge insets)", "--dg-spacing-xs", sp.xs ?? "8px"],
    ["micro (dot separators, tiny icon offsets)", "--dg-spacing-xxs", sp.xxs ?? "4px"],
    ["spacious (hero sections, large visual breathing room)", "--dg-spacing-xl", sp.xl ?? "32px"],
  ];

  const lines = [
    "SPACING ROLES (use these — do not invent arbitrary pixel values):",
    ...spacingEntries.map(([role, variable, value]) => `  ${role}: var(${variable}) = ${value}`),
  ];

  return lines.join("\n");
}

export function buildTokenPromptContext(
  designTokens?: DesignTokens | null,
  mode: TokenPromptMode = "compact_visual",
) {
  if (mode === "none") {
    return "";
  }

  if (mode === "runtime_css") {
    return buildDrawgleTokenCss(designTokens);
  }

  const normalized = normalizeDesignTokens(designTokens ?? {});
  const references = getDrawgleTokenReferences(normalized);

  if (!normalized.tokens || references.length === 0) {
    return "No approved project design tokens are available. Use refined neutral defaults and standard Tailwind CSS.";
  }

  const filteredReferences = references.filter(isBuilderVisibleReference);

  return [
    "TOKEN CONTEXT: Approved project design tokens.",
    "Use them for SYSTEM UI so the project's live design system controls it: page backgrounds, system card/sheet/modal surfaces, the text hierarchy, standard actions and fields, navigation surfaces, standard borders, the radius vocabulary, spacing rhythm, and standard surface shadows.",
    "You are free to design LOCAL ART with any CSS you want: hero treatments, charts, one-off gradients, decorative geometry, illustrations, maps, media compositions, intentional high-contrast sections, and deliberate asymmetry. These do not have to be token-derived.",
    // Deliberately lists only global-class utilities. The demoted gradients
    // (app_background, surface_highlight, accent_ring) used to be named here,
    // which is how every screen ended up wearing the same glossed recipe. They
    // remain available as local art; they are no longer recommended as identity.
    "Prefer utility classes when the semantic role matches: dg-bg-primary, dg-bg-secondary, dg-surface-card, dg-surface-bottom-sheet, dg-surface-modal, dg-text-high, dg-text-medium, dg-text-low, dg-action-primary, dg-action-secondary, dg-gradient-action-primary, dg-border-divider, dg-border-focused, dg-radius-app, dg-radius-inner, dg-radius-pill, dg-shadow-surface, dg-shadow-overlay, dg-type-nav-title, dg-type-screen-title, dg-type-hero-title, dg-type-section-title, dg-type-metric-value, dg-type-body, dg-type-supporting, dg-type-caption, dg-type-button-label.",
    "Radius vocabulary: app is the outer surface radius, inner is the smaller nested/inset radius, and pill is for capsules and circles. The project supplies the vocabulary; you choose which word fits each component. A capsule CTA is a legitimate choice.",
    "Concentric guidance (not a law): a nested surface usually reads best at its parent's radius minus the gap between their edges. Depart from it when the composition is better for it.",
    "For token values without a named utility, use CSS variables in Tailwind arbitrary classes, e.g. bg-[var(--dg-color-action-primary)], [background-image:var(--dg-gradient-action-primary)], p-[var(--dg-spacing-md)], rounded-[var(--dg-radii-inner)], shadow-[var(--dg-shadows-surface)].",
    "Token gradients are available for expressive actions. Custom gradients are fully allowed for local art.",
    filteredReferences.length > 0 ? `Project token variables:\n${formatTokenReferences(filteredReferences, 200)}` : null,
    resolveSemanticMap(normalized.tokens),
  ].filter(Boolean).join("\n");
}

const normalizeComparableValue = (value: string) => value.trim().toLowerCase();

const buildValueToVariableMap = (designTokens?: DesignTokens | null) => {
  const map = new Map<string, string>();
  for (const variable of flattenDesignTokensToCssVariables(designTokens)) {
    const comparable = normalizeComparableValue(variable.value);
    if (!comparable || map.has(comparable)) {
      continue;
    }
    map.set(comparable, variable.name);
  }
  return map;
};

const buildRadiusValueToVariableMap = (designTokens?: DesignTokens | null) => {
  const map = new Map<string, string>();
  for (const variable of flattenDesignTokensToCssVariables(designTokens)) {
    if (!variable.name.startsWith("--dg-radii-")) continue;
    const comparable = normalizeComparableValue(variable.value);
    if (!comparable || map.has(comparable)) continue;
    map.set(comparable, variable.name);
  }
  return map;
};

export const normalizeLegacyTypographyFontMarkup = (code: string) =>
  code.replace(/--dg-typography-font-family\b/g, "--dg-typography-body-font-family");
const arbitraryValueRegex = /\b(bg|text|border|ring|from|via|to|stroke|fill)-\[#([0-9a-fA-F]{3,8})\]/g;
const roundedValueRegex = /\brounded-\[([^\]]+)\]/g;
const spacingValueRegex = /\b(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y)-\[([^\]]+)\]/g;

export function tokenizeStaticDrawgleHtml(code: string, designTokens?: DesignTokens | null) {
  const normalizedLegacyCode = normalizeLegacyTypographyFontMarkup(code);
  if (!normalizedLegacyCode.trim() || !designTokens?.tokens) {
    return { code: normalizedLegacyCode, changed: normalizedLegacyCode !== code };
  }

  const valueToVariable = buildValueToVariableMap(designTokens);
  const radiusValueToVariable = buildRadiusValueToVariableMap(designTokens);
  let nextCode = normalizedLegacyCode;
  nextCode = nextCode.replace(arbitraryValueRegex, (match, prefix: string, hex: string) => {
    const variableName = valueToVariable.get(normalizeComparableValue(`#${hex}`));
    return variableName ? `${prefix}-[var(${variableName})]` : match;
  });

  nextCode = nextCode.replace(roundedValueRegex, (match, value: string) => {
    const variableName = radiusValueToVariable.get(normalizeComparableValue(value));
    return variableName?.startsWith("--dg-radii-") ? `rounded-[var(${variableName})]` : match;
  });

  nextCode = nextCode.replace(spacingValueRegex, (match, prefix: string, value: string) => {
    const variableName = valueToVariable.get(normalizeComparableValue(value));
    return variableName?.startsWith("--dg-spacing-") || variableName?.startsWith("--dg-mobile-layout-")
      ? `${prefix}-[var(${variableName})]`
      : match;
  });

  nextCode = nextCode.replace(/style=(["'])([\s\S]*?)\1/gi, (match, quote: string, style: string) => {
    const nextStyle = style.replace(/(:\s*)(#[0-9a-fA-F]{3,8}|-?\d+(?:\.\d+)?px|[^;"]*rgba?\([^)]+\)[^;"]*)/g, (styleMatch, prefix: string, value: string) => {
      const variableName = valueToVariable.get(normalizeComparableValue(value));
      return variableName ? `${prefix}var(${variableName})` : styleMatch;
    });
    return nextStyle === style ? match : `style=${quote}${nextStyle}${quote}`;
  });

  return {
    code: nextCode,
    changed: nextCode !== code,
  };
}
