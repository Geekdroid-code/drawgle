import { normalizeDesignTokens } from "@/lib/design-tokens";
import type { DesignTokens } from "@/lib/types";

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

const compactVisualTokenPrefixes = [
  "color.background",
  "color.surface",
  "color.text",
  "color.action",
  "color.border",
  "typography.font_family",
  "typography.nav_title",
  "typography.screen_title",
  "typography.section_title",
  "typography.metric_value",
  "typography.body",
  "typography.caption",
  "typography.button_label",
  "spacing",
  "mobile_layout",
  "sizing.min_touch_target",
  "sizing.standard_button_height",
  "sizing.standard_input_height",
  "radii",
  "border_widths",
  "shadows",
];

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
    const compactReferences = pickTokenReferences(references, compactVisualTokenPrefixes);

    return [
      "TOKEN CONTEXT MODE: compact_visual",
      "Use Drawgle live tokens for canonical colors, typography, spacing, sizing, radii, borders, and shadows.",
      "Prefer utility classes when the semantic role matches: dg-bg-primary, dg-surface-card, dg-text-high, dg-text-medium, dg-text-low, dg-action-primary, dg-border-divider, dg-radius-app, dg-radius-pill, dg-shadow-surface, dg-type-screen-title, dg-type-section-title, dg-type-metric-value, dg-type-body, dg-type-caption, dg-type-button-label.",
      "For token values without a named utility, use CSS variables in Tailwind arbitrary classes, e.g. bg-[var(--dg-color-action-primary)], p-[var(--dg-spacing-md)], rounded-[var(--dg-radii-app)], shadow-[var(--dg-shadows-surface)].",
      "Use raw hex, raw pixels, and custom gradients only for deliberate one-off visual details such as charts, maps, illustrations, and special effects.",
      compactReferences.length > 0 ? `Relevant token variables:\n${formatTokenReferences(compactReferences, 60)}` : null,
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
