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
  | "router_summary"
  | "compact_visual"
  | "full_generation"
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

const TYPOGRAPHY_TOKEN_KEYS = [
  "nav_title",
  "screen_title",
  "hero_title",
  "section_title",
  "metric_value",
  "body",
  "supporting",
  "caption",
  "button_label",
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

export const getPrimaryGoogleFontFamily = (designTokens?: DesignTokens | null) => {
  const normalized = normalizeDesignTokens(designTokens ?? {});
  const family = parseFontFamilyList(normalized.tokens?.typography?.font_family)[0];
  if (!family) {
    return null;
  }

  const lowerFamily = family.toLowerCase();
  if (GENERIC_FONT_FAMILIES.has(lowerFamily) || lowerFamily.startsWith("var(")) {
    return null;
  }

  if (!/^[\p{L}\p{N} ._-]+$/u.test(family)) {
    return null;
  }

  return family;
};

export const buildGoogleFontHref = (designTokens?: DesignTokens | null) => {
  const normalized = normalizeDesignTokens(designTokens ?? {});
  const family = getPrimaryGoogleFontFamily(normalized);
  if (!family) {
    return null;
  }

  const weights = new Set<string>();
  for (const key of TYPOGRAPHY_TOKEN_KEYS) {
    const weight = normalized.tokens?.typography?.[key]?.weight;
    const numericWeight = Number.parseInt(String(weight ?? ""), 10);
    if (Number.isFinite(numericWeight)) {
      weights.add(String(Math.min(1000, Math.max(1, numericWeight))));
    }
  }

  const weightList = Array.from(weights).sort((first, second) => Number(first) - Number(second));
  const encodedFamily = family.trim().replace(/\s+/g, "+");
  const axis = weightList.length ? `:wght@${weightList.join(";")}` : "";

  return `https://fonts.googleapis.com/css2?family=${encodedFamily}${axis}&display=swap`;
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

const typographyClass = (name: string, tokenKey: string) => `
.dg-type-${name} {
  font-family: var(--dg-typography-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: var(--dg-type-${tokenKey}-size);
  font-weight: var(--dg-type-${tokenKey}-weight);
  line-height: var(--dg-type-${tokenKey}-line-height);
}`;

export function buildDrawgleTokenCss(designTokens?: DesignTokens | null) {
  const variables = flattenDesignTokensToCssVariables(designTokens);
  const variableCss = variables
    .map((variable) => `  ${variable.name}: ${escapeCssValue(variable.value)};`)
    .join("\n");

  return `
:root {
${variableCss}
}

#root {
  --dg-preview-background: var(--dg-color-background-primary, #ffffff);
  background: var(--dg-preview-background);
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
.dg-border-divider { border-color: var(--dg-color-border-divider); }
.dg-border-focused { border-color: var(--dg-color-border-focused); }
.dg-radius-app { border-radius: var(--dg-radii-app); }
.dg-radius-pill { border-radius: var(--dg-radii-pill); }
.dg-shadow-surface { box-shadow: var(--dg-shadows-surface); }
.dg-shadow-overlay { box-shadow: var(--dg-shadows-overlay); }
.dg-screen-padding { padding-left: var(--dg-mobile-layout-screen-margin); padding-right: var(--dg-mobile-layout-screen-margin); }
.dg-section-gap { gap: var(--dg-mobile-layout-section-gap); }
.dg-element-gap { gap: var(--dg-mobile-layout-element-gap); }
${typographyClass("nav-title", "nav-title")}
${typographyClass("screen-title", "screen-title")}
${typographyClass("hero-title", "hero-title")}
${typographyClass("section-title", "section-title")}
${typographyClass("metric-value", "metric-value")}
${typographyClass("body", "body")}
${typographyClass("supporting", "supporting")}
${typographyClass("caption", "caption")}
${typographyClass("button-label", "button-label")}
`.trim();
}

export function buildTokenUsageGuide(designTokens?: DesignTokens | null) {
  const references = getDrawgleTokenReferences(designTokens);
  const variableList = references
    .slice(0, 80)
    .map((reference) => `${reference.path}: var(${reference.name}) = ${reference.value}`)
    .join("\n");

  return [
    "Use Drawgle's live project tokens for canonical styling.",
    "Prefer these utility classes when they match the intended role: dg-bg-primary, dg-bg-secondary, dg-surface-card, dg-surface-bottom-sheet, dg-text-high, dg-text-medium, dg-text-low, dg-action-primary, dg-border-divider, dg-radius-app, dg-radius-pill, dg-shadow-surface, dg-type-screen-title, dg-type-hero-title, dg-type-section-title, dg-type-metric-value, dg-type-body, dg-type-caption, dg-type-button-label.",
    "For token values without a named utility, use Tailwind arbitrary values with CSS variables, for example bg-[var(--dg-color-action-primary)], text-[var(--dg-color-text-high-emphasis)], rounded-[var(--dg-radii-app)], shadow-[var(--dg-shadows-surface)].",
    "Use raw hex, raw pixels, and custom gradients only for deliberate one-off visual details such as charts, maps, illustrations, or non-system accent marks.",
    variableList ? `Available token variables:\n${variableList}` : null,
  ].filter(Boolean).join("\n");
}

const formatTokenReferences = (references: DrawgleTokenReference[], limit: number) =>
  references
    .slice(0, limit)
    .map((reference) => `${reference.path}: var(${reference.name}) = ${reference.value}`)
    .join("\n");

const pickTokenReferences = (
  references: DrawgleTokenReference[],
  prefixes: string[],
) => references.filter((reference) => prefixes.some((prefix) => reference.path === prefix || reference.path.startsWith(`${prefix}.`)));

// Raw groups sent verbatim — each value is unique and semantically meaningful by name.
// spacing, opacities, z_index are intentionally excluded; the semantic map replaces them.
// typography.font_family is excluded — it is already emitted in buildVisualSystemConstraints.
const compactVisualTokenPrefixes = [
  "color.background",
  "color.surface",
  "color.text",
  "color.action",
  "color.border",
  "typography.nav_title",
  "typography.screen_title",
  "typography.section_title",
  "typography.metric_value",
  "typography.body",
  "typography.supporting",
  "typography.caption",
  "typography.button_label",
  "mobile_layout",
  "sizing.standard_button_height",
  "sizing.standard_input_height",
  "sizing.icon_small",
  "sizing.icon_standard",
  "sizing.bottom_nav_height",
  "radii",
  "border_widths",
  "shadows",
];

/**
 * Resolves spacing/opacities into a compact semantic map for the LLM prompt.
 * Each entry has a self-describing role name + resolved pixel value so the LLM
 * can make visual hierarchy judgements without seeing the full raw scale.
 * z_index is omitted entirely — the LLM should use utility classes, not pick values.
 */
function resolveSemanticMap(tokens: DesignTokenValues | undefined): string {
  const sp = tokens?.spacing ?? {};
  const ml = tokens?.mobile_layout ?? {};
  const op = tokens?.opacities ?? {};

  const spacingEntries: Array<[string, string, string]> = [
    ["screen_edge_padding (outer horizontal padding of every screen)", "--dg-mobile-layout-screen-margin", ml.screen_margin ?? sp.lg ?? "24px"],
    ["between_sections (gap between major content blocks)", "--dg-mobile-layout-section-gap", ml.section_gap ?? sp.lg ?? "24px"],
    ["between_elements (gap between items within a section)", "--dg-mobile-layout-element-gap", ml.element_gap ?? sp.md ?? "16px"],
    ["component_inner (card padding, form field insets)", "--dg-spacing-md", sp.md ?? "16px"],
    ["tight_inline (icon-to-label, chip padding, badge insets)", "--dg-spacing-xs", sp.xs ?? "8px"],
    ["micro (dot separators, tiny icon offsets)", "--dg-spacing-xxs", sp.xxs ?? "4px"],
    ["spacious (hero sections, large visual breathing room)", "--dg-spacing-xl", sp.xl ?? "32px"],
  ];

  const opacityEntries: Array<[string, string, string]> = [
    ["opacity_disabled", "--dg-opacities-disabled", op.disabled ?? "0.38"],
    ["opacity_scrim_overlay", "--dg-opacities-scrim-overlay", op.scrim_overlay ?? "0.50"],
    ["opacity_pressed_state", "--dg-opacities-pressed", op.pressed ?? "0.12"],
  ];

  const lines = [
    "SPACING ROLES (use these — do not invent arbitrary pixel values):",
    ...spacingEntries.map(([role, variable, value]) => `  ${role}: var(${variable}) = ${value}`),
    "OPACITY ROLES:",
    ...opacityEntries.map(([role, variable, value]) => `  ${role}: var(${variable}) = ${value}`),
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

  if (mode === "router_summary") {
    const keyReferences = pickTokenReferences(references, [
      "color.background.primary",
      "color.surface.card",
      "color.action.primary",
      "color.action.secondary",
      "color.text.high_emphasis",
      "radii.app",
      "shadows.surface",
    ]);

    return [
      "Project design tokens are approved and should be used for visual UI changes.",
      keyReferences.length > 0 ? `Key token handles:\n${formatTokenReferences(keyReferences, 12)}` : null,
    ].filter(Boolean).join("\n");
  }

  if (mode === "compact_visual") {
    const filteredReferences = pickTokenReferences(references, compactVisualTokenPrefixes);
    const semanticMap = resolveSemanticMap(normalized.tokens);

    return [
      "TOKEN CONTEXT: Approved project design tokens — use these for every visual decision.",
      "Prefer utility classes when the semantic role matches: dg-bg-primary, dg-bg-secondary, dg-surface-card, dg-surface-bottom-sheet, dg-surface-modal, dg-text-high, dg-text-medium, dg-text-low, dg-action-primary, dg-action-secondary, dg-border-divider, dg-border-focused, dg-radius-app, dg-radius-pill, dg-shadow-surface, dg-shadow-overlay, dg-type-nav-title, dg-type-screen-title, dg-type-hero-title, dg-type-section-title, dg-type-metric-value, dg-type-body, dg-type-supporting, dg-type-caption, dg-type-button-label.",
      "For token values without a named utility, use CSS variables in Tailwind arbitrary classes, e.g. bg-[var(--dg-color-action-primary)], p-[var(--dg-spacing-md)], rounded-[var(--dg-radii-app)], shadow-[var(--dg-shadows-surface)], opacity-[var(--dg-opacities-disabled)].",
      "Use raw hex, raw pixels, and custom gradients only for deliberate one-off visual details such as charts, maps, illustrations, and special effects.",
      filteredReferences.length > 0 ? `Project token variables:\n${formatTokenReferences(filteredReferences, 200)}` : null,
      semanticMap,
    ].filter(Boolean).join("\n");
  }

  return [
    "TOKEN CONTEXT MODE: full_generation",
    "Approved design tokens are the source of truth for the generated UI. Use Drawgle token utility classes and CSS variables for canonical styling.",
    `APPROVED DESIGN TOKENS:\n${JSON.stringify(normalized.tokens, null, 2)}`,
    "LIVE TOKEN USAGE GUIDE:",
    buildTokenUsageGuide(normalized),
  ].join("\n\n");
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

const arbitraryValueRegex = /\b(bg|text|border|ring|from|via|to|stroke|fill)-\[#([0-9a-fA-F]{3,8})\]/g;
const roundedValueRegex = /\brounded-\[([^\]]+)\]/g;
const spacingValueRegex = /\b(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y)-\[([^\]]+)\]/g;

export function tokenizeStaticDrawgleHtml(code: string, designTokens?: DesignTokens | null) {
  if (!code.trim() || !designTokens?.tokens) {
    return { code, changed: false };
  }

  const valueToVariable = buildValueToVariableMap(designTokens);
  let nextCode = code;

  nextCode = nextCode.replace(arbitraryValueRegex, (match, prefix: string, hex: string) => {
    const variableName = valueToVariable.get(normalizeComparableValue(`#${hex}`));
    return variableName ? `${prefix}-[var(${variableName})]` : match;
  });

  nextCode = nextCode.replace(roundedValueRegex, (match, value: string) => {
    const variableName = valueToVariable.get(normalizeComparableValue(value));
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
