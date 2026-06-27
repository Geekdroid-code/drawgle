export type DrawgleStyleGroup = "Position" | "Layout" | "Size" | "Spacing" | "Type" | "Surface" | "Effects";

export type DrawgleStyleValueKind =
  | "color"
  | "font-family"
  | "font-weight"
  | "integer"
  | "keyword"
  | "length"
  | "line-height"
  | "number"
  | "ratio"
  | "shadow"
  | "track-list"
  | "css-function";

export type DrawgleStylePreviewMode = "alignment" | "box" | "code" | "number" | "select" | "slider" | "swatch" | "text";
export type DrawgleStyleRiskLevel = "safe" | "layout" | "high";

export type DrawgleClassUtilityFamily =
  | "align-items"
  | "align-self"
  | "aspect-ratio"
  | "backdrop-filter"
  | "background-color"
  | "border-color"
  | "border-radius"
  | "border-style"
  | "border-width"
  | "bottom"
  | "box-shadow"
  | "display"
  | "filter"
  | "flex-direction"
  | "flex-value"
  | "flex-wrap"
  | "font-size"
  | "font-weight"
  | "gap"
  | "grid-template-columns"
  | "height"
  | "justify-content"
  | "left"
  | "letter-spacing"
  | "line-height"
  | "margin-bottom"
  | "margin-left"
  | "margin-right"
  | "margin-top"
  | "max-width"
  | "min-height"
  | "object-fit"
  | "opacity"
  | "overflow"
  | "padding-bottom"
  | "padding-left"
  | "padding-right"
  | "padding-top"
  | "position"
  | "right"
  | "text-align"
  | "text-color"
  | "top"
  | "transform"
  | "width"
  | "z-index";

export type DrawgleStyleControlConfig = {
  property: string;
  label: string;
  group: DrawgleStyleGroup;
  valueKind: DrawgleStyleValueKind;
  allowedValues?: readonly string[];
  tokenScopes?: readonly string[];
  classUtilityFamily?: DrawgleClassUtilityFamily;
  previewMode?: DrawgleStylePreviewMode;
  riskLevel?: DrawgleStyleRiskLevel;
};

const DRAWGLE_STYLE_PROPERTY_CONFIGS_RAW = [
  { property: "position", label: "Position", group: "Position", valueKind: "keyword", allowedValues: ["static", "relative", "absolute", "fixed", "sticky"], classUtilityFamily: "position", previewMode: "select", riskLevel: "layout" },
  { property: "top", label: "Top", group: "Position", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout."], classUtilityFamily: "top", previewMode: "number", riskLevel: "layout" },
  { property: "right", label: "Right", group: "Position", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout."], classUtilityFamily: "right", previewMode: "number", riskLevel: "layout" },
  { property: "bottom", label: "Bottom", group: "Position", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout."], classUtilityFamily: "bottom", previewMode: "number", riskLevel: "layout" },
  { property: "left", label: "Left", group: "Position", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout."], classUtilityFamily: "left", previewMode: "number", riskLevel: "layout" },
  { property: "z-index", label: "Layer", group: "Position", valueKind: "integer", tokenScopes: ["z_index."], classUtilityFamily: "z-index", previewMode: "number", riskLevel: "layout" },
  { property: "overflow", label: "Overflow", group: "Position", valueKind: "keyword", allowedValues: ["visible", "hidden", "auto", "scroll", "clip"], classUtilityFamily: "overflow", previewMode: "select", riskLevel: "layout" },
  { property: "display", label: "Display", group: "Layout", valueKind: "keyword", allowedValues: ["block", "inline-block", "inline", "flex", "inline-flex", "grid", "inline-grid", "none"], classUtilityFamily: "display", previewMode: "select", riskLevel: "layout" },
  { property: "flex-direction", label: "Direction", group: "Layout", valueKind: "keyword", allowedValues: ["row", "row-reverse", "column", "column-reverse"], classUtilityFamily: "flex-direction", previewMode: "select", riskLevel: "layout" },
  { property: "flex-wrap", label: "Wrap", group: "Layout", valueKind: "keyword", allowedValues: ["nowrap", "wrap", "wrap-reverse"], classUtilityFamily: "flex-wrap", previewMode: "select", riskLevel: "layout" },
  { property: "justify-content", label: "Justify", group: "Layout", valueKind: "keyword", allowedValues: ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"], classUtilityFamily: "justify-content", previewMode: "alignment", riskLevel: "layout" },
  { property: "align-items", label: "Align", group: "Layout", valueKind: "keyword", allowedValues: ["stretch", "flex-start", "center", "flex-end", "baseline"], classUtilityFamily: "align-items", previewMode: "alignment", riskLevel: "layout" },
  { property: "align-self", label: "Self", group: "Layout", valueKind: "keyword", allowedValues: ["auto", "stretch", "flex-start", "center", "flex-end", "baseline"], classUtilityFamily: "align-self", previewMode: "alignment", riskLevel: "layout" },
  { property: "flex", label: "Flex", group: "Layout", valueKind: "css-function", classUtilityFamily: "flex-value", previewMode: "text", riskLevel: "layout" },
  { property: "grid-template-columns", label: "Grid columns", group: "Layout", valueKind: "track-list", classUtilityFamily: "grid-template-columns", previewMode: "text", riskLevel: "layout" },
  { property: "gap", label: "Gap", group: "Layout", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout."], classUtilityFamily: "gap", previewMode: "number", riskLevel: "safe" },
  { property: "width", label: "Width", group: "Size", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout.", "sizing."], classUtilityFamily: "width", previewMode: "number", riskLevel: "safe" },
  { property: "height", label: "Height", group: "Size", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout.", "sizing."], classUtilityFamily: "height", previewMode: "number", riskLevel: "safe" },
  { property: "min-height", label: "Min height", group: "Size", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout.", "sizing."], classUtilityFamily: "min-height", previewMode: "number", riskLevel: "safe" },
  { property: "max-width", label: "Max width", group: "Size", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout.", "sizing."], classUtilityFamily: "max-width", previewMode: "number", riskLevel: "safe" },
  { property: "aspect-ratio", label: "Aspect", group: "Size", valueKind: "ratio", classUtilityFamily: "aspect-ratio", previewMode: "text", riskLevel: "safe" },
  { property: "object-fit", label: "Object fit", group: "Size", valueKind: "keyword", allowedValues: ["fill", "contain", "cover", "none", "scale-down"], classUtilityFamily: "object-fit", previewMode: "select", riskLevel: "safe" },
  { property: "padding-top", label: "Top", group: "Spacing", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout."], classUtilityFamily: "padding-top", previewMode: "number", riskLevel: "safe" },
  { property: "padding-right", label: "Right", group: "Spacing", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout."], classUtilityFamily: "padding-right", previewMode: "number", riskLevel: "safe" },
  { property: "padding-bottom", label: "Bottom", group: "Spacing", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout."], classUtilityFamily: "padding-bottom", previewMode: "number", riskLevel: "safe" },
  { property: "padding-left", label: "Left", group: "Spacing", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout."], classUtilityFamily: "padding-left", previewMode: "number", riskLevel: "safe" },
  { property: "margin-top", label: "Top", group: "Spacing", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout."], classUtilityFamily: "margin-top", previewMode: "number", riskLevel: "safe" },
  { property: "margin-right", label: "Right", group: "Spacing", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout."], classUtilityFamily: "margin-right", previewMode: "number", riskLevel: "safe" },
  { property: "margin-bottom", label: "Bottom", group: "Spacing", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout."], classUtilityFamily: "margin-bottom", previewMode: "number", riskLevel: "safe" },
  { property: "margin-left", label: "Left", group: "Spacing", valueKind: "length", tokenScopes: ["spacing.", "mobile_layout."], classUtilityFamily: "margin-left", previewMode: "number", riskLevel: "safe" },
  { property: "color", label: "Text", group: "Type", valueKind: "color", tokenScopes: ["color.text.", "color.action.on_primary_text"], classUtilityFamily: "text-color", previewMode: "swatch", riskLevel: "safe" },
  { property: "font-size", label: "Size", group: "Type", valueKind: "length", tokenScopes: ["typography."], classUtilityFamily: "font-size", previewMode: "number", riskLevel: "safe" },
  { property: "font-weight", label: "Weight", group: "Type", valueKind: "font-weight", tokenScopes: ["typography."], classUtilityFamily: "font-weight", previewMode: "select", riskLevel: "safe" },
  { property: "line-height", label: "Line height", group: "Type", valueKind: "line-height", tokenScopes: ["typography."], classUtilityFamily: "line-height", previewMode: "number", riskLevel: "safe" },
  { property: "font-family", label: "Font", group: "Type", valueKind: "font-family", tokenScopes: ["typography."], previewMode: "text", riskLevel: "safe" },
  { property: "text-align", label: "Align text", group: "Type", valueKind: "keyword", allowedValues: ["left", "center", "right", "justify", "start", "end"], classUtilityFamily: "text-align", previewMode: "select", riskLevel: "safe" },
  { property: "letter-spacing", label: "Tracking", group: "Type", valueKind: "length", classUtilityFamily: "letter-spacing", previewMode: "number", riskLevel: "safe" },
  { property: "background-color", label: "Fill", group: "Surface", valueKind: "color", tokenScopes: ["color.background.", "color.surface.", "color.action."], classUtilityFamily: "background-color", previewMode: "swatch", riskLevel: "safe" },
  { property: "border-color", label: "Border", group: "Surface", valueKind: "color", tokenScopes: ["color.border.", "color.action."], classUtilityFamily: "border-color", previewMode: "swatch", riskLevel: "safe" },
  { property: "border-style", label: "Border style", group: "Surface", valueKind: "keyword", allowedValues: ["none", "solid", "dashed", "dotted", "double"], classUtilityFamily: "border-style", previewMode: "select", riskLevel: "safe" },
  { property: "border-width", label: "Border width", group: "Surface", valueKind: "length", tokenScopes: ["border_widths."], classUtilityFamily: "border-width", previewMode: "number", riskLevel: "safe" },
  { property: "border-top-width", label: "Border top", group: "Surface", valueKind: "length", tokenScopes: ["border_widths."], classUtilityFamily: "border-width", previewMode: "number", riskLevel: "safe" },
  { property: "border-right-width", label: "Border right", group: "Surface", valueKind: "length", tokenScopes: ["border_widths."], classUtilityFamily: "border-width", previewMode: "number", riskLevel: "safe" },
  { property: "border-bottom-width", label: "Border bottom", group: "Surface", valueKind: "length", tokenScopes: ["border_widths."], classUtilityFamily: "border-width", previewMode: "number", riskLevel: "safe" },
  { property: "border-left-width", label: "Border left", group: "Surface", valueKind: "length", tokenScopes: ["border_widths."], classUtilityFamily: "border-width", previewMode: "number", riskLevel: "safe" },
  { property: "border-radius", label: "Radius", group: "Surface", valueKind: "length", tokenScopes: ["radii."], classUtilityFamily: "border-radius", previewMode: "number", riskLevel: "safe" },
  { property: "border-top-left-radius", label: "Top left", group: "Surface", valueKind: "length", tokenScopes: ["radii."], classUtilityFamily: "border-radius", previewMode: "number", riskLevel: "safe" },
  { property: "border-top-right-radius", label: "Top right", group: "Surface", valueKind: "length", tokenScopes: ["radii."], classUtilityFamily: "border-radius", previewMode: "number", riskLevel: "safe" },
  { property: "border-bottom-right-radius", label: "Bottom right", group: "Surface", valueKind: "length", tokenScopes: ["radii."], classUtilityFamily: "border-radius", previewMode: "number", riskLevel: "safe" },
  { property: "border-bottom-left-radius", label: "Bottom left", group: "Surface", valueKind: "length", tokenScopes: ["radii."], classUtilityFamily: "border-radius", previewMode: "number", riskLevel: "safe" },
  { property: "box-shadow", label: "Shadow", group: "Effects", valueKind: "shadow", tokenScopes: ["shadows."], classUtilityFamily: "box-shadow", previewMode: "text", riskLevel: "safe" },
  { property: "opacity", label: "Opacity", group: "Effects", valueKind: "number", tokenScopes: ["opacities."], classUtilityFamily: "opacity", previewMode: "slider", riskLevel: "safe" },
  { property: "transform", label: "Transform", group: "Effects", valueKind: "css-function", classUtilityFamily: "transform", previewMode: "text", riskLevel: "high" },
  { property: "filter", label: "Filter", group: "Effects", valueKind: "css-function", classUtilityFamily: "filter", previewMode: "text", riskLevel: "high" },
  { property: "backdrop-filter", label: "Backdrop", group: "Effects", valueKind: "css-function", classUtilityFamily: "backdrop-filter", previewMode: "text", riskLevel: "high" },
] as const satisfies readonly DrawgleStyleControlConfig[];

export type DrawgleStyleProperty = typeof DRAWGLE_STYLE_PROPERTY_CONFIGS_RAW[number]["property"];
export const DRAWGLE_STYLE_PROPERTY_CONFIGS: readonly DrawgleStyleControlConfig[] = DRAWGLE_STYLE_PROPERTY_CONFIGS_RAW;
export type DrawgleStyleSource = "token" | "inline-token" | "inline-custom" | "class" | "inherited" | "browser-default";
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
  allowedValues: readonly string[];
  tokenScopes: readonly string[];
  classUtilityFamily: DrawgleClassUtilityFamily | null;
  previewMode: DrawgleStylePreviewMode;
  riskLevel: DrawgleStyleRiskLevel;
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

export type DrawgleClassUtility = {
  family: DrawgleClassUtilityFamily;
  className: string;
};

export const DRAWGLE_STYLE_PROPERTY_SET = new Set<DrawgleStyleProperty>(
  DRAWGLE_STYLE_PROPERTY_CONFIGS_RAW.map((config) => config.property),
);

export const getStylePropertyConfig = (property: DrawgleStyleProperty) =>
  DRAWGLE_STYLE_PROPERTY_CONFIGS.find((config) => config.property === property) ?? null;

export const normalizeCssValue = (value: string | undefined | null) => (value ?? "").trim();

export const tokenVariableNameFromValue = (value: string | undefined | null) => {
  const match = normalizeCssValue(value).match(/^var\((--dg-[^) ,]+)(?:,[^)]+)?\)$/);
  return match?.[1] ?? null;
};

const cssColorToComparableHex = (value: string) => {
  const color = normalizeCssValue(value).toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;

  const shortHex = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (shortHex) return `#${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}`.toLowerCase();

  const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(1|1\.0|1\.00))?\)$/i);
  if (!rgb) return color;

  return `#${[rgb[1], rgb[2], rgb[3]]
    .map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0"))
    .join("")}`;
};

export const normalizeComparableStyleValue = (property: DrawgleStyleProperty, value: string | undefined | null) => {
  const normalized = normalizeCssValue(value).toLowerCase();
  if (!normalized) return "";
  if (getStylePropertyConfig(property)?.valueKind === "color") return cssColorToComparableHex(normalized);
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
  [["border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"], /^rounded(?:-[trbl]{1,2})?-\[var\((--dg-[^)]+)\)\]$/],
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

const textSizeClassPattern = /^text-(?:xs|sm|base|lg|xl|[2-9]xl|\[[^\]]+(?:px|rem|em|%)\])$/i;
const textAlignmentClasses = new Set(["text-left", "text-center", "text-right", "text-justify", "text-start", "text-end"]);

const isTextColorClass = (className: string) => {
  if (!/^text-/i.test(className) || textAlignmentClasses.has(className) || textSizeClassPattern.test(className)) return false;
  const arbitrary = className.match(/^text-\[([^\]]+)\]$/);
  if (arbitrary?.[1] && /(?:px|rem|em|%|--dg-type-|--.*size)/i.test(arbitrary[1])) return false;
  return true;
};

const isBackgroundClass = (className: string) =>
  /^bg-/i.test(className) && !/^(?:bg-cover|bg-contain|bg-center|bg-repeat|bg-no-repeat|bg-local|bg-fixed|bg-scroll)$/i.test(className);

const isBorderColorClass = (className: string) => {
  if (!/^border-/i.test(className)) return false;
  if (/^border(?:-[trblxy])?(?:-\d+|\-\[[^\]]+\])?$/i.test(className)) return false;
  if (/^border-(?:solid|dashed|dotted|double|none)$/i.test(className)) return false;
  return true;
};

const startsWithAny = (className: string, prefixes: string[]) =>
  prefixes.some((prefix) => className === prefix.replace(/-$/, "") || className.startsWith(prefix));

export const classNameMatchesUtilityFamily = (family: DrawgleClassUtilityFamily, className: string) => {
  if (family === "text-color") return isTextColorClass(className);
  if (family === "background-color") return isBackgroundClass(className);
  if (family === "font-size") return textSizeClassPattern.test(className);
  if (family === "border-color") return isBorderColorClass(className);
  if (family === "border-width") return /^border(?:-[trblxy])?(?:-\d+|\-\[[^\]]+\])?$/i.test(className);
  if (family === "border-radius") return /^rounded(?:-[trbl]{1,2})?(?:-[a-z0-9/]+|\-\[[^\]]+\])?$/i.test(className);
  if (family === "display") return /^(?:block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden)$/i.test(className);
  if (family === "position") return /^(?:static|relative|absolute|fixed|sticky)$/i.test(className);
  if (family === "flex-direction") return /^(?:flex-row|flex-row-reverse|flex-col|flex-col-reverse)$/i.test(className);
  if (family === "flex-wrap") return /^(?:flex-wrap|flex-nowrap|flex-wrap-reverse)$/i.test(className);
  if (family === "justify-content") return /^justify-/i.test(className);
  if (family === "align-items") return /^items-/i.test(className);
  if (family === "align-self") return /^self-/i.test(className);
  if (family === "object-fit") return /^object-/i.test(className);
  if (family === "text-align") return textAlignmentClasses.has(className);
  if (family === "box-shadow") return /^shadow(?:-|$)/i.test(className);
  if (family === "opacity") return /^opacity-/i.test(className);
  if (family === "overflow") return /^overflow-/i.test(className);
  if (family === "z-index") return /^z-/i.test(className);
  if (family === "width") return /^w-/i.test(className);
  if (family === "height") return /^h-/i.test(className);
  if (family === "min-height") return /^min-h-/i.test(className);
  if (family === "max-width") return /^max-w-/i.test(className);
  if (family === "aspect-ratio") return /^aspect-/i.test(className);
  if (family === "grid-template-columns") return /^grid-cols-/i.test(className);
  if (family === "flex-value") return /^(?:flex-\[|flex-1|flex-auto|flex-initial|flex-none)/i.test(className);
  if (family === "font-weight") return /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[[^\]]+\]|\d+)$/i.test(className);
  if (family === "line-height") return /^leading-/i.test(className);
  if (family === "letter-spacing") return /^tracking-/i.test(className);
  if (family === "gap") return /^gap-/i.test(className);
  if (family === "top") return /^top-/i.test(className);
  if (family === "right") return /^right-/i.test(className);
  if (family === "bottom") return /^bottom-/i.test(className);
  if (family === "left") return /^left-/i.test(className);
  if (family === "padding-top") return startsWithAny(className, ["p-", "py-", "pt-"]);
  if (family === "padding-right") return startsWithAny(className, ["p-", "px-", "pr-"]);
  if (family === "padding-bottom") return startsWithAny(className, ["p-", "py-", "pb-"]);
  if (family === "padding-left") return startsWithAny(className, ["p-", "px-", "pl-"]);
  if (family === "margin-top") return startsWithAny(className, ["m-", "my-", "mt-"]);
  if (family === "margin-right") return startsWithAny(className, ["m-", "mx-", "mr-"]);
  if (family === "margin-bottom") return startsWithAny(className, ["m-", "my-", "mb-"]);
  if (family === "margin-left") return startsWithAny(className, ["m-", "mx-", "ml-"]);
  if (family === "filter") return /^filter(?:-|$)/i.test(className) || /^\[filter:/i.test(className);
  if (family === "backdrop-filter") return /^backdrop-/i.test(className) || /^\[backdrop-filter:/i.test(className);
  if (family === "transform") return /^(?:transform|translate-|scale-|rotate-|skew-)/i.test(className) || /^\[transform:/i.test(className);
  if (family === "border-style") return /^border-(?:solid|dashed|dotted|double|none)$/i.test(className);
  return false;
};

const findClassTokenBinding = (property: DrawgleStyleProperty, classList: string[]) => {
  const directMap = TOKEN_CLASS_MAP[property];
  if (directMap) {
    for (const className of classList) {
      const tokenName = directMap[className];
      if (tokenName) return { classBinding: className, tokenName };
    }
  }

  for (const className of classList) {
    for (const [properties, pattern] of arbitraryTokenClassPatterns) {
      if (!properties.includes(property)) continue;
      const match = className.match(pattern);
      if (match?.[1]) return { classBinding: className, tokenName: match[1] };
    }
  }

  const family = getStylePropertyConfig(property)?.classUtilityFamily;
  if (family) {
    for (const className of classList) {
      if (classNameMatchesUtilityFamily(family, className)) return { classBinding: className, tokenName: null };
    }
  }

  return { classBinding: null, tokenName: null };
};

const propertyTokenPrefixes = (property: DrawgleStyleProperty) => {
  const config = getStylePropertyConfig(property);
  return config?.tokenScopes?.length ? [...config.tokenScopes] : [];
};

export const getTokenReferencesForStyleProperty = (property: DrawgleStyleProperty, tokenRefs: DrawgleTokenReferenceLike[]) => {
  if (property === "font-family") return tokenRefs.filter((token) => token.path === "typography.font_family");
  if (property === "font-size") return tokenRefs.filter((token) => token.path.startsWith("typography.") && token.path.endsWith(".size"));
  if (property === "font-weight") return tokenRefs.filter((token) => token.path.startsWith("typography.") && token.path.endsWith(".weight"));
  if (property === "line-height") return tokenRefs.filter((token) => token.path.startsWith("typography.") && token.path.endsWith(".line_height"));

  const prefixes = propertyTokenPrefixes(property);
  return tokenRefs.filter((token) => prefixes.some((prefix) => token.path === prefix.replace(/\.$/, "") || token.path.startsWith(prefix)));
};

const findTokenByName = (tokenRefs: DrawgleTokenReferenceLike[], tokenName: string | null) =>
  tokenName ? tokenRefs.find((token) => token.name === tokenName) ?? null : null;

const findMatchingToken = (property: DrawgleStyleProperty, computedValue: string, tokenRefs: DrawgleTokenReferenceLike[]) => {
  const comparable = normalizeComparableStyleValue(property, computedValue);
  if (!comparable) return null;
  return getTokenReferencesForStyleProperty(property, tokenRefs)
    .find((token) => normalizeComparableStyleValue(property, token.value) === comparable) ?? null;
};

export const resolveStyleInspection = (rawInspection: DrawgleRawStyleInspection | null | undefined, tokenRefs: DrawgleTokenReferenceLike[]): DrawgleResolvedStyleInspection | null => {
  if (!rawInspection) return null;

  const classList = rawInspection.classList ?? [];
  const properties = DRAWGLE_STYLE_PROPERTY_CONFIGS_RAW.map((config): DrawgleResolvedStyleProperty => {
    const controlConfig: DrawgleStyleControlConfig = config;
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
    } else if (["color", "font-size", "font-weight", "line-height", "font-family", "text-align", "letter-spacing"].includes(property)) {
      source = "inherited";
      status = "resettable";
    }

    return {
      property,
      label: config.label,
      group: config.group,
      valueKind: config.valueKind,
      allowedValues: controlConfig.allowedValues ?? [],
      tokenScopes: controlConfig.tokenScopes ?? [],
      classUtilityFamily: controlConfig.classUtilityFamily ?? null,
      previewMode: controlConfig.previewMode ?? "text",
      riskLevel: controlConfig.riskLevel ?? "safe",
      computedValue,
      inlineValue,
      classBinding: classTokenBinding.classBinding,
      tokenName,
      tokenLabel: token?.label ?? null,
      source,
      status,
    };
  });

  return { ...rawInspection, classList, properties };
};

const isCssVariable = (value: string) => /^var\(--dg-[^)]+\)$/.test(normalizeCssValue(value));
const lengthPattern = /^(?:-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|svh|svw|dvh|dvw)|0|auto|normal|fit-content|min-content|max-content|stretch)$/i;
const lineHeightPattern = /^(?:\d+(?:\.\d+)?|-?\d+(?:\.\d+)?(?:px|rem|em|%)|normal|0)$/i;
const colorPattern = /^(?:#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|transparent|currentcolor|currentColor)$/i;
const fontWeightPattern = /^(?:[1-9]00|normal|bold|bolder|lighter|inherit)$/i;
const integerPattern = /^-?\d+$/;
const ratioPattern = /^(?:auto|\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)$/i;
const shadowPattern = /^(?:none|(?:inset\s+)?-?\d+(?:\.\d+)?(?:px|rem|em)\s+-?\d+(?:\.\d+)?(?:px|rem|em)(?:\s+-?\d+(?:\.\d+)?(?:px|rem|em)){0,2}(?:\s+(?:#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)))?(?:\s*,\s*(?:inset\s+)?-?\d+(?:\.\d+)?(?:px|rem|em)\s+-?\d+(?:\.\d+)?(?:px|rem|em)(?:\s+-?\d+(?:\.\d+)?(?:px|rem|em)){0,2}(?:\s+(?:#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)))?)*)$/i;
const fontFamilyPattern = /^(?:["'][^<>"']+["']|[a-z0-9\s-]+)(?:\s*,\s*(?:["'][^<>"']+["']|[a-z0-9\s-]+))*$/i;

const isSafeCssFunctionValue = (value: string) =>
  !/[<>"'`;{}]/.test(value)
  && value.length <= 240
  && /^(?:none|auto|normal|repeat\([^)]+\)|minmax\([^)]+\)|fit-content\([^)]+\)|calc\([^)]+\)|translate[XYZ]?\([^)]+\)|scale[XYZ]?\([^)]+\)|rotate[XYZ]?\([^)]+\)|skew[XY]?\([^)]+\)|matrix(?:3d)?\([^)]+\)|blur\([^)]+\)|brightness\([^)]+\)|contrast\([^)]+\)|grayscale\([^)]+\)|hue-rotate\([^)]+\)|invert\([^)]+\)|opacity\([^)]+\)|saturate\([^)]+\)|sepia\([^)]+\)|drop-shadow\([^)]+\)|[a-z0-9_./%#(), -]+)$/i.test(value);

export const validateStyleValue = (property: DrawgleStyleProperty, value: string) => {
  const normalized = normalizeCssValue(value).replace(/[<>]/g, "");
  if (!normalized || isCssVariable(normalized)) return normalized;

  const config = getStylePropertyConfig(property);
  const kind = config?.valueKind;
  const valid = kind === "color"
    ? colorPattern.test(normalized)
    : kind === "length"
      ? lengthPattern.test(normalized) || /^calc\([^)]+\)$/i.test(normalized)
      : kind === "line-height"
        ? lineHeightPattern.test(normalized)
        : kind === "number"
          ? (/^(?:0(?:\.\d+)?|1(?:\.0+)?|0?\.\d+)$/).test(normalized)
          : kind === "integer"
            ? integerPattern.test(normalized)
            : kind === "font-weight"
              ? fontWeightPattern.test(normalized)
              : kind === "font-family"
                ? fontFamilyPattern.test(normalized)
                : kind === "shadow"
                  ? shadowPattern.test(normalized)
                  : kind === "ratio"
                    ? ratioPattern.test(normalized)
                    : kind === "keyword"
                      ? Boolean(config?.allowedValues?.includes(normalized))
                      : kind === "track-list" || kind === "css-function"
                        ? isSafeCssFunctionValue(normalized)
                        : false;

  if (!valid) throw new Error(`Unsupported ${property} value: ${value}`);
  return normalized;
};

const formatTailwindArbitraryValue = (value: string) => normalizeCssValue(value).replace(/[<>"'`]/g, "").replace(/\s+/g, "_");

const keywordClassMaps: Partial<Record<DrawgleStyleProperty, Record<string, string>>> = {
  display: { block: "block", "inline-block": "inline-block", inline: "inline", flex: "flex", "inline-flex": "inline-flex", grid: "grid", "inline-grid": "inline-grid", none: "hidden" },
  position: { static: "static", relative: "relative", absolute: "absolute", fixed: "fixed", sticky: "sticky" },
  overflow: { visible: "overflow-visible", hidden: "overflow-hidden", auto: "overflow-auto", scroll: "overflow-scroll", clip: "overflow-clip" },
  "flex-direction": { row: "flex-row", "row-reverse": "flex-row-reverse", column: "flex-col", "column-reverse": "flex-col-reverse" },
  "flex-wrap": { nowrap: "flex-nowrap", wrap: "flex-wrap", "wrap-reverse": "flex-wrap-reverse" },
  "justify-content": { "flex-start": "justify-start", center: "justify-center", "flex-end": "justify-end", "space-between": "justify-between", "space-around": "justify-around", "space-evenly": "justify-evenly" },
  "align-items": { stretch: "items-stretch", "flex-start": "items-start", center: "items-center", "flex-end": "items-end", baseline: "items-baseline" },
  "align-self": { auto: "self-auto", stretch: "self-stretch", "flex-start": "self-start", center: "self-center", "flex-end": "self-end", baseline: "self-baseline" },
  "object-fit": { fill: "object-fill", contain: "object-contain", cover: "object-cover", none: "object-none", "scale-down": "object-scale-down" },
  "text-align": { left: "text-left", center: "text-center", right: "text-right", justify: "text-justify", start: "text-start", end: "text-end" },
  "border-style": { none: "border-none", solid: "border-solid", dashed: "border-dashed", dotted: "border-dotted", double: "border-double" },
};

const fontWeightClassMap: Record<string, string> = {
  "100": "font-thin",
  "200": "font-extralight",
  "300": "font-light",
  "400": "font-normal",
  normal: "font-normal",
  "500": "font-medium",
  "600": "font-semibold",
  "700": "font-bold",
  bold: "font-bold",
  "800": "font-extrabold",
  "900": "font-black",
};

export const getClassUtilityForStyle = (property: DrawgleStyleProperty, value: string): DrawgleClassUtility | null => {
  const config = getStylePropertyConfig(property);
  const family = config?.classUtilityFamily ?? null;
  const normalized = normalizeCssValue(value);
  if (!family || !normalized) return null;

  const keyword = keywordClassMaps[property]?.[normalized];
  if (keyword) return { family, className: keyword };

  if (property === "font-weight") return { family, className: fontWeightClassMap[normalized] ?? `font-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "color") return { family, className: `text-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "background-color") return { family, className: `bg-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "border-color") return { family, className: `border-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "font-size") return { family, className: `text-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "line-height") return { family, className: `leading-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "letter-spacing") return { family, className: `tracking-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "border-radius") return { family, className: `rounded-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "border-top-left-radius") return { family, className: `rounded-tl-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "border-top-right-radius") return { family, className: `rounded-tr-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "border-bottom-right-radius") return { family, className: `rounded-br-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "border-bottom-left-radius") return { family, className: `rounded-bl-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "box-shadow") return { family, className: normalized === "none" ? "shadow-none" : `shadow-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "opacity") return { family, className: `opacity-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "width") return { family, className: normalized === "100%" ? "w-full" : normalized === "auto" ? "w-auto" : `w-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "height") return { family, className: normalized === "100%" ? "h-full" : normalized === "auto" ? "h-auto" : `h-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "min-height") return { family, className: normalized === "100vh" ? "min-h-screen" : `min-h-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "max-width") return { family, className: `max-w-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "aspect-ratio") return { family, className: `aspect-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "grid-template-columns") return { family, className: `grid-cols-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "flex") return { family, className: `flex-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "gap") return { family, className: `gap-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "top") return { family, className: `top-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "right") return { family, className: `right-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "bottom") return { family, className: `bottom-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "left") return { family, className: `left-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "z-index") return { family, className: `z-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "padding-top") return { family, className: `pt-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "padding-right") return { family, className: `pr-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "padding-bottom") return { family, className: `pb-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "padding-left") return { family, className: `pl-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "margin-top") return { family, className: `mt-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "margin-right") return { family, className: `mr-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "margin-bottom") return { family, className: `mb-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "margin-left") return { family, className: `ml-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "border-width") return { family, className: `border-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "border-top-width") return { family, className: `border-t-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "border-right-width") return { family, className: `border-r-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "border-bottom-width") return { family, className: `border-b-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "border-left-width") return { family, className: `border-l-[${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "transform") return { family, className: `[transform:${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "filter") return { family, className: `[filter:${formatTailwindArbitraryValue(normalized)}]` };
  if (property === "backdrop-filter") return { family, className: `[backdrop-filter:${formatTailwindArbitraryValue(normalized)}]` };

  return null;
};
