export type DrawgleStyleGroup = "Type" | "Surface" | "Layout" | "Size" | "Effects";

export type DrawgleStyleValueKind =
  | "color"
  | "font-family"
  | "font-weight"
  | "length"
  | "line-height"
  | "number"
  | "shadow";

export const DRAWGLE_STYLE_PROPERTY_CONFIGS = [
  { property: "color", label: "Text", group: "Type", valueKind: "color" },
  { property: "font-size", label: "Size", group: "Type", valueKind: "length" },
  { property: "font-weight", label: "Weight", group: "Type", valueKind: "font-weight" },
  { property: "line-height", label: "Line height", group: "Type", valueKind: "line-height" },
  { property: "font-family", label: "Font", group: "Type", valueKind: "font-family" },
  { property: "background-color", label: "Fill", group: "Surface", valueKind: "color" },
  { property: "border-color", label: "Border", group: "Surface", valueKind: "color" },
  { property: "border-width", label: "Border width", group: "Surface", valueKind: "length" },
  { property: "border-radius", label: "Radius", group: "Surface", valueKind: "length" },
  { property: "padding-top", label: "Pad top", group: "Layout", valueKind: "length" },
  { property: "padding-right", label: "Pad right", group: "Layout", valueKind: "length" },
  { property: "padding-bottom", label: "Pad bottom", group: "Layout", valueKind: "length" },
  { property: "padding-left", label: "Pad left", group: "Layout", valueKind: "length" },
  { property: "margin-top", label: "Margin top", group: "Layout", valueKind: "length" },
  { property: "margin-right", label: "Margin right", group: "Layout", valueKind: "length" },
  { property: "margin-bottom", label: "Margin bottom", group: "Layout", valueKind: "length" },
  { property: "margin-left", label: "Margin left", group: "Layout", valueKind: "length" },
  { property: "gap", label: "Gap", group: "Layout", valueKind: "length" },
  { property: "width", label: "Width", group: "Size", valueKind: "length" },
  { property: "height", label: "Height", group: "Size", valueKind: "length" },
  { property: "min-height", label: "Min height", group: "Size", valueKind: "length" },
  { property: "max-width", label: "Max width", group: "Size", valueKind: "length" },
  { property: "box-shadow", label: "Shadow", group: "Effects", valueKind: "shadow" },
  { property: "opacity", label: "Opacity", group: "Effects", valueKind: "number" },
] as const;

export type DrawgleStyleProperty = typeof DRAWGLE_STYLE_PROPERTY_CONFIGS[number]["property"];

export type DrawgleStyleSource =
  | "token"
  | "inline-token"
  | "inline-custom"
  | "class"
  | "inherited"
  | "browser-default";

export type DrawgleStyleStatus = "linked" | "detached" | "custom" | "resettable";

export type DrawgleStyleValueMap = Partial<Record<DrawgleStyleProperty, string>>;

export type DrawgleRawStyleInspection = {
  tagName: string;
  classList: string[];
  inlineStyle: DrawgleStyleValueMap;
  computedStyle: DrawgleStyleValueMap;
};

export type DrawgleResolvedStyleProperty = {
  property: DrawgleStyleProperty;
  label: string;
  group: DrawgleStyleGroup;
  valueKind: DrawgleStyleValueKind;
  computedValue: string;
  inlineValue: string;
  classBinding: string | null;
  tokenName: string | null;
  tokenLabel: string | null;
  source: DrawgleStyleSource;
  status: DrawgleStyleStatus;
};

export type DrawgleResolvedStyleInspection = DrawgleRawStyleInspection & {
  properties: DrawgleResolvedStyleProperty[];
};

export type DrawgleTokenReferenceLike = {
  name: string;
  path: string;
  label: string;
  value: string;
};

export const DRAWGLE_STYLE_PROPERTY_SET = new Set<DrawgleStyleProperty>(
  DRAWGLE_STYLE_PROPERTY_CONFIGS.map((config) => config.property),
);

export const normalizeCssValue = (value: string | undefined | null) => (value ?? "").trim();

export const tokenVariableNameFromValue = (value: string | undefined | null) => {
  const match = normalizeCssValue(value).match(/^var\((--dg-[^) ,]+)(?:,[^)]+)?\)$/);
  return match?.[1] ?? null;
};

const cssColorToComparableHex = (value: string) => {
  const color = normalizeCssValue(value).toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }

  const shortHex = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (shortHex) {
    return `#${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}`.toLowerCase();
  }

  const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(1|1\.0|1\.00))?\)$/i);
  if (!rgb) {
    return color;
  }

  return `#${[rgb[1], rgb[2], rgb[3]]
    .map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0"))
    .join("")}`;
};

export const normalizeComparableStyleValue = (
  property: DrawgleStyleProperty,
  value: string | undefined | null,
) => {
  const normalized = normalizeCssValue(value).toLowerCase();
  if (!normalized) {
    return "";
  }

  if (DRAWGLE_STYLE_PROPERTY_CONFIGS.find((config) => config.property === property)?.valueKind === "color") {
    return cssColorToComparableHex(normalized);
  }

  return normalized.replace(/\s+/g, " ");
};

const TOKEN_CLASS_MAP: Partial<Record<DrawgleStyleProperty, Record<string, string>>> = {
  color: {
    "dg-text-high": "--dg-color-text-high-emphasis",
    "dg-text-medium": "--dg-color-text-medium-emphasis",
    "dg-text-low": "--dg-color-text-low-emphasis",
    "dg-action-primary": "--dg-color-action-on-primary-text",
  },
  "background-color": {
    "dg-bg-primary": "--dg-color-background-primary",
    "dg-bg-secondary": "--dg-color-background-secondary",
    "dg-surface-card": "--dg-color-surface-card",
    "dg-surface-bottom-sheet": "--dg-color-surface-bottom-sheet",
    "dg-surface-modal": "--dg-color-surface-modal",
    "dg-action-primary": "--dg-color-action-primary",
    "dg-action-secondary": "--dg-color-action-secondary",
  },
  "border-color": {
    "dg-border-divider": "--dg-color-border-divider",
    "dg-border-focused": "--dg-color-border-focused",
  },
  "border-radius": {
    "dg-radius-app": "--dg-radii-app",
    "dg-radius-pill": "--dg-radii-pill",
  },
  "box-shadow": {
    "dg-shadow-surface": "--dg-shadows-surface",
    "dg-shadow-overlay": "--dg-shadows-overlay",
  },
  gap: {
    "dg-section-gap": "--dg-mobile-layout-section-gap",
    "dg-element-gap": "--dg-mobile-layout-element-gap",
  },
};

const arbitraryTokenClassPatterns: Array<[DrawgleStyleProperty[], RegExp]> = [
  [["background-color"], /^bg-\[var\((--dg-[^)]+)\)\]$/],
  [["color"], /^text-\[var\((--dg-[^)]+)\)\]$/],
  [["border-color"], /^border-\[var\((--dg-[^)]+)\)\]$/],
  [["border-radius"], /^rounded-\[var\((--dg-[^)]+)\)\]$/],
  [["box-shadow"], /^shadow-\[var\((--dg-[^)]+)\)\]$/],
  [["gap"], /^gap-\[var\((--dg-[^)]+)\)\]$/],
  [["padding-top", "padding-right", "padding-bottom", "padding-left"], /^p-\[var\((--dg-[^)]+)\)\]$/],
  [["padding-left", "padding-right"], /^px-\[var\((--dg-[^)]+)\)\]$/],
  [["padding-top", "padding-bottom"], /^py-\[var\((--dg-[^)]+)\)\]$/],
  [["padding-top"], /^pt-\[var\((--dg-[^)]+)\)\]$/],
  [["padding-right"], /^pr-\[var\((--dg-[^)]+)\)\]$/],
  [["padding-bottom"], /^pb-\[var\((--dg-[^)]+)\)\]$/],
  [["padding-left"], /^pl-\[var\((--dg-[^)]+)\)\]$/],
  [["margin-top", "margin-right", "margin-bottom", "margin-left"], /^m-\[var\((--dg-[^)]+)\)\]$/],
  [["margin-left", "margin-right"], /^mx-\[var\((--dg-[^)]+)\)\]$/],
  [["margin-top", "margin-bottom"], /^my-\[var\((--dg-[^)]+)\)\]$/],
  [["margin-top"], /^mt-\[var\((--dg-[^)]+)\)\]$/],
  [["margin-right"], /^mr-\[var\((--dg-[^)]+)\)\]$/],
  [["margin-bottom"], /^mb-\[var\((--dg-[^)]+)\)\]$/],
  [["margin-left"], /^ml-\[var\((--dg-[^)]+)\)\]$/],
  [["width"], /^w-\[var\((--dg-[^)]+)\)\]$/],
  [["height"], /^h-\[var\((--dg-[^)]+)\)\]$/],
  [["min-height"], /^min-h-\[var\((--dg-[^)]+)\)\]$/],
  [["max-width"], /^max-w-\[var\((--dg-[^)]+)\)\]$/],
];

const findClassTokenBinding = (property: DrawgleStyleProperty, classList: string[]) => {
  const directMap = TOKEN_CLASS_MAP[property];
  if (directMap) {
    for (const className of classList) {
      const tokenName = directMap[className];
      if (tokenName) {
        return { classBinding: className, tokenName };
      }
    }
  }

  for (const className of classList) {
    for (const [properties, pattern] of arbitraryTokenClassPatterns) {
      if (!properties.includes(property)) {
        continue;
      }

      const match = className.match(pattern);
      if (match?.[1]) {
        return { classBinding: className, tokenName: match[1] };
      }
    }
  }

  for (const className of classList) {
    if (
      (property === "color" && /^text-(?!(?:xs|sm|base|lg|xl|[2-9]xl)$)(?!\[var\()(?!\[-?\d)[a-z0-9[\]#/.-]+$/i.test(className))
      || (property === "background-color" && /^bg-(?!\[var\()[a-z0-9[\]#/.-]+$/i.test(className))
      || (property === "border-color" && /^border-(?!\[var\()[a-z0-9[\]#/.-]+$/i.test(className))
      || (property === "border-width" && /^border(?:-[0-9[\]a-z/.-]+)?$/i.test(className))
      || (property === "border-radius" && /^rounded(?:-[a-z0-9[\]/.-]+)?$/i.test(className))
      || (property === "box-shadow" && /^shadow(?:-[a-z0-9[\]/.-]+)?$/i.test(className))
      || (property === "opacity" && /^opacity-[a-z0-9[\]/.-]+$/i.test(className))
      || (property === "gap" && /^gap-[a-z0-9[\]/.-]+$/i.test(className))
      || (property === "width" && /^w-[a-z0-9[\]/.-]+$/i.test(className))
      || (property === "height" && /^h-[a-z0-9[\]/.-]+$/i.test(className))
      || (property === "min-height" && /^min-h-[a-z0-9[\]/.-]+$/i.test(className))
      || (property === "max-width" && /^max-w-[a-z0-9[\]/.-]+$/i.test(className))
      || (property.startsWith("padding-") && /^(?:p|px|py|pt|pr|pb|pl)-[a-z0-9[\]/.-]+$/i.test(className))
      || (property.startsWith("margin-") && /^(?:m|mx|my|mt|mr|mb|ml)-[a-z0-9[\]/.-]+$/i.test(className))
      || (property === "font-size" && /^text-(?:xs|sm|base|lg|xl|[2-9]xl|\[[^\]]+(?:px|rem|em|%)\])$/i.test(className))
      || (property === "font-weight" && /^font-[a-z0-9[\]/.-]+$/i.test(className))
      || (property === "line-height" && /^leading-[a-z0-9[\]/.-]+$/i.test(className))
      || (property === "font-family" && /^font-[a-z0-9[\]/.-]+$/i.test(className))
    ) {
      return { classBinding: className, tokenName: null };
    }
  }

  return { classBinding: null, tokenName: null };
};

const propertyTokenPrefixes = (property: DrawgleStyleProperty) => {
  if (property === "color") {
    return ["color.text.", "color.action.on_primary_text"];
  }
  if (property === "background-color") {
    return ["color.background.", "color.surface.", "color.action."];
  }
  if (property === "border-color") {
    return ["color.border.", "color.action."];
  }
  if (property === "border-radius") {
    return ["radii."];
  }
  if (property === "box-shadow") {
    return ["shadows."];
  }
  if (property === "font-size" || property === "font-weight" || property === "line-height" || property === "font-family") {
    return ["typography."];
  }
  if (property === "border-width") {
    return ["border_widths."];
  }
  if (
    property === "padding-top"
    || property === "padding-right"
    || property === "padding-bottom"
    || property === "padding-left"
    || property === "margin-top"
    || property === "margin-right"
    || property === "margin-bottom"
    || property === "margin-left"
    || property === "gap"
    || property === "width"
    || property === "height"
    || property === "min-height"
    || property === "max-width"
  ) {
    return ["spacing.", "mobile_layout.", "sizing."];
  }
  if (property === "opacity") {
    return ["opacities."];
  }
  return [];
};

export const getTokenReferencesForStyleProperty = (
  property: DrawgleStyleProperty,
  tokenRefs: DrawgleTokenReferenceLike[],
) => {
  if (property === "font-family") {
    return tokenRefs.filter((token) => token.path === "typography.font_family");
  }
  if (property === "font-size") {
    return tokenRefs.filter((token) => token.path.startsWith("typography.") && token.path.endsWith(".size"));
  }
  if (property === "font-weight") {
    return tokenRefs.filter((token) => token.path.startsWith("typography.") && token.path.endsWith(".weight"));
  }
  if (property === "line-height") {
    return tokenRefs.filter((token) => token.path.startsWith("typography.") && token.path.endsWith(".line_height"));
  }

  const prefixes = propertyTokenPrefixes(property);
  return tokenRefs.filter((token) => prefixes.some((prefix) => token.path === prefix.replace(/\.$/, "") || token.path.startsWith(prefix)));
};

const findTokenByName = (tokenRefs: DrawgleTokenReferenceLike[], tokenName: string | null) =>
  tokenName ? tokenRefs.find((token) => token.name === tokenName) ?? null : null;

const findMatchingToken = (
  property: DrawgleStyleProperty,
  computedValue: string,
  tokenRefs: DrawgleTokenReferenceLike[],
) => {
  const comparable = normalizeComparableStyleValue(property, computedValue);
  if (!comparable) {
    return null;
  }

  return getTokenReferencesForStyleProperty(property, tokenRefs)
    .find((token) => normalizeComparableStyleValue(property, token.value) === comparable) ?? null;
};

export const resolveStyleInspection = (
  rawInspection: DrawgleRawStyleInspection | null | undefined,
  tokenRefs: DrawgleTokenReferenceLike[],
): DrawgleResolvedStyleInspection | null => {
  if (!rawInspection) {
    return null;
  }

  const classList = rawInspection.classList ?? [];
  const properties = DRAWGLE_STYLE_PROPERTY_CONFIGS.map((config): DrawgleResolvedStyleProperty => {
    const property = config.property;
    const inlineValue = normalizeCssValue(rawInspection.inlineStyle?.[property]);
    const computedValue = normalizeCssValue(rawInspection.computedStyle?.[property]);
    const inlineTokenName = tokenVariableNameFromValue(inlineValue);
    const classTokenBinding = findClassTokenBinding(property, classList);
    const fallbackToken = inlineTokenName ? null : classTokenBinding.tokenName ? null : findMatchingToken(property, computedValue, tokenRefs);
    const tokenName = inlineTokenName ?? classTokenBinding.tokenName ?? fallbackToken?.name ?? null;
    const token = findTokenByName(tokenRefs, tokenName) ?? fallbackToken;

    let source: DrawgleStyleSource = "browser-default";
    let status: DrawgleStyleStatus = "custom";

    if (inlineValue) {
      source = inlineTokenName ? "inline-token" : "inline-custom";
      status = inlineTokenName ? "linked" : "detached";
    } else if (classTokenBinding.tokenName || fallbackToken) {
      source = "token";
      status = "linked";
    } else if (classTokenBinding.classBinding) {
      source = "class";
      status = "custom";
    } else if (["color", "font-size", "font-weight", "line-height", "font-family"].includes(property)) {
      source = "inherited";
      status = "resettable";
    }

    return {
      property,
      label: config.label,
      group: config.group,
      valueKind: config.valueKind,
      computedValue,
      inlineValue,
      classBinding: classTokenBinding.classBinding,
      tokenName,
      tokenLabel: token?.label ?? null,
      source,
      status,
    };
  });

  return {
    ...rawInspection,
    classList,
    properties,
  };
};

const isCssVariable = (value: string) => /^var\(--dg-[^)]+\)$/.test(normalizeCssValue(value));
const lengthPattern = /^(?:-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|svh|svw)|0|auto|normal|fit-content|min-content|max-content)$/i;
const lineHeightPattern = /^(?:\d+(?:\.\d+)?|-?\d+(?:\.\d+)?(?:px|rem|em|%)|normal|0)$/i;
const colorPattern = /^(?:#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|transparent|currentcolor)$/i;
const fontWeightPattern = /^(?:[1-9]00|normal|bold|bolder|lighter|inherit)$/i;
const shadowPattern = /^(?:none|(?:inset\s+)?-?\d+(?:\.\d+)?(?:px|rem|em)\s+-?\d+(?:\.\d+)?(?:px|rem|em)(?:\s+-?\d+(?:\.\d+)?(?:px|rem|em)){0,2}(?:\s+(?:#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)))?(?:\s*,\s*(?:inset\s+)?-?\d+(?:\.\d+)?(?:px|rem|em)\s+-?\d+(?:\.\d+)?(?:px|rem|em)(?:\s+-?\d+(?:\.\d+)?(?:px|rem|em)){0,2}(?:\s+(?:#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)))?)*)$/i;
const fontFamilyPattern = /^(?:["'][^<>"']+["']|[a-z0-9\s-]+)(?:\s*,\s*(?:["'][^<>"']+["']|[a-z0-9\s-]+))*$/i;

export const validateStyleValue = (property: DrawgleStyleProperty, value: string) => {
  const normalized = normalizeCssValue(value).replace(/[<>]/g, "");
  if (!normalized || isCssVariable(normalized)) {
    return normalized;
  }

  const kind = DRAWGLE_STYLE_PROPERTY_CONFIGS.find((config) => config.property === property)?.valueKind;
  const valid = kind === "color"
    ? colorPattern.test(normalized)
    : kind === "length"
      ? lengthPattern.test(normalized)
      : kind === "line-height"
        ? lineHeightPattern.test(normalized)
      : kind === "number"
        ? (/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/).test(normalized)
        : kind === "font-weight"
          ? fontWeightPattern.test(normalized)
          : kind === "font-family"
            ? fontFamilyPattern.test(normalized)
            : kind === "shadow"
              ? shadowPattern.test(normalized)
              : false;

  if (!valid) {
    throw new Error(`Unsupported ${property} value: ${value}`);
  }

  return normalized;
};
