import type { DesignTokens } from "@/lib/types";
import { flattenDesignTokensToCssVariables } from "@/lib/token-runtime";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface ParsedStyles {
  isFlex: boolean;
  flexDirection: "row" | "column";
  alignItems: "start" | "center" | "end" | "stretch";
  justifyContent: "start" | "center" | "end" | "between" | "around";
  gap: number;

  padding: { top: number; right: number; bottom: number; left: number };
  margin: { top: number; right: number; bottom: number; left: number };

  width: string | number; // e.g. "100%", "auto", or a number in pixels
  height: string | number; // e.g. "100%", "auto", or a number in pixels

  backgroundColor: string; // Hex color e.g. "#FFFFFF" or "transparent"
  textColor?: string; // Hex color e.g. "#111827" or "transparent"

  borderRadius: number;
  borderWidth: number;
  borderColor: string;

  fontSize?: number;
  fontWeight?: "normal" | "medium" | "semibold" | "bold" | "heavy";
  textAlign?: "left" | "center" | "right";

  shadow: string | null; // e.g. "surface", "overlay", or null

  // Grid layout
  isGrid: boolean;
  gridCols: number;

  // Fixed positioning
  isFixedBottom: boolean;

  // Opacity
  opacity: number;

  // Min dimensions
  minHeight: string | number;

  // Gradient
  gradient: { direction: string; fromColor: string; toColor: string; isRepeating?: boolean } | null;

  // Raw SVG flag (no icon mapping available)
  isRawSvg: boolean;

  // Flex-1 (fill available space)
  hasFlex1: boolean;

  // Absolute positioning
  isAbsolute: boolean;
  isBackgroundAbsolute: boolean;
  absolutePosition?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
    topToken?: string;
    rightToken?: string;
    bottomToken?: string;
    leftToken?: string;
  };

  // Dynamic theme token mapping fields
  backgroundColorToken?: string;
  textColorToken?: string;
  borderColorToken?: string;
  borderRadiusToken?: string;
  gapToken?: string;
  paddingLeftToken?: string;
  paddingRightToken?: string;
  paddingTopToken?: string;
  paddingBottomToken?: string;
  marginLeftToken?: string;
  marginRightToken?: string;
  marginTopToken?: string;
  marginBottomToken?: string;

  explicitTextColor?: boolean;
  backdropFilterBlur?: number;
  filter?: {
    hueRotate?: number;
    brightness?: number;
    saturate?: number;
    contrast?: number;
    blur?: number;
  };
}

export interface TranspileNode {
  tagName: string;
  classes: string[];
  id: string;
  styleText: string;
  styles: ParsedStyles;
  attributes: Record<string, string>;
  children: (TranspileNode | string)[];
}

// ---------------------------------------------------------------------------
// COMPILER CORE: TAILWIND & CSS VARIABLE RESOLVER
// ---------------------------------------------------------------------------

// Helper to convert standard tailwind colors to Hex values
const TAILWIND_COLOR_MAP: Record<string, string> = {
  "white": "#FFFFFF",
  "black": "#000000",
  "transparent": "transparent",
  
  "gray-50": "#F9FAFB", "gray-100": "#F3F4F6", "gray-200": "#E5E7EB", "gray-300": "#D1D5DB",
  "gray-400": "#9CA3AF", "gray-500": "#6B7280", "gray-600": "#4B5563", "gray-700": "#374151",
  "gray-800": "#1F2937", "gray-900": "#111827",

  "slate-50": "#F8FAFC", "slate-100": "#F1F5F9", "slate-200": "#E2E8F0", "slate-300": "#CBD5E1",
  "slate-400": "#94A3B8", "slate-500": "#64748B", "slate-600": "#475569", "slate-700": "#334155",
  "slate-800": "#1E293B", "slate-900": "#0F172A",

  "zinc-50": "#FAFAFA", "zinc-100": "#F4F4F5", "zinc-200": "#E4E4E7", "zinc-300": "#D4D4D8",
  "zinc-400": "#A1A1AA", "zinc-500": "#71717A", "zinc-600": "#52525B", "zinc-700": "#3F3F46",
  "zinc-800": "#27272A", "zinc-900": "#18181B",

  "neutral-50": "#FAFAFA", "neutral-100": "#F5F5F5", "neutral-200": "#E5E5E5", "neutral-300": "#D4D4D4",
  "neutral-400": "#A3A3A3", "neutral-500": "#737373", "neutral-600": "#525252", "neutral-700": "#404040",
  "neutral-800": "#262626", "neutral-900": "#171717",

  "blue-50": "#EFF6FF", "blue-100": "#DBEAFE", "blue-200": "#BFDBFE", "blue-300": "#93C5FD",
  "blue-400": "#60A5FA", "blue-500": "#3B82F6", "blue-600": "#2563EB", "blue-700": "#1D4ED8",
  "blue-800": "#1E40AF", "blue-900": "#1E3A8A",

  "red-50": "#FEF2F2", "red-100": "#FEE2E2", "red-200": "#FECACA", "red-300": "#FCA5A5",
  "red-400": "#F87171", "red-500": "#EF4444", "red-600": "#DC2626", "red-700": "#B91C1C",

  "green-50": "#F0FDF4", "green-100": "#DCFCE7", "green-200": "#BBF7D0", "green-300": "#86EFAC",
  "green-400": "#4ADE80", "green-500": "#22C55E", "green-600": "#16A34A", "green-700": "#15803D",

  "amber-50": "#FEF3C7", "amber-100": "#FEF3C7", "amber-200": "#FDE68A", "amber-300": "#FCD34D",
  "amber-400": "#FBBF24", "amber-500": "#F59E0B", "amber-600": "#D97706", "amber-700": "#B45309",

  "yellow-50": "#FEFDF0", "yellow-100": "#FEF9C3", "yellow-200": "#FEF08A", "yellow-300": "#FDE047",
  "yellow-400": "#FACC15", "yellow-500": "#EAB308", "yellow-600": "#CA8A04",
};

// ---------------------------------------------------------------------------
// DYNAMIC ICON NAME CONVERTERS (no hardcoded map — works for ANY Lucide icon)
// ---------------------------------------------------------------------------

function toFlutterIconName(lucideName: string): string {
  return `Icons.${lucideName.replace(/-/g, '_')}`;
}

function toComposeIconName(lucideName: string): string {
  const pascal = lucideName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  return `Icons.Default.${pascal}`;
}

const LUCIDE_TO_SF_SYMBOL: Record<string, string> = {
  "utensils": "fork.knife",
  "salad": "leaf",
  "cookie": "circle.hexagongrid",
  "flame": "flame",
  "glass-water": "drop",
  "coffee": "cup.and.saucer",
  "search": "magnifyingglass",
  "home": "house",
  "user": "person",
  "settings": "gearshape",
  "chevron-left": "chevron.left",
  "chevron-right": "chevron.right",
  "chevron-up": "chevron.up",
  "chevron-down": "chevron.down",
  "arrow-left": "arrow.left",
  "arrow-right": "arrow.right",
  "arrow-up": "arrow.up",
  "arrow-down": "arrow.down",
  "check": "checkmark",
  "x": "xmark",
  "plus": "plus",
  "minus": "minus",
  "more-horizontal": "ellipsis",
  "more-vertical": "ellipsis.vertical",
  "menu": "line.3.horizontal",
  "clock": "clock",
  "calendar": "calendar",
  "bell": "bell",
  "camera": "camera",
  "trash": "trash",
  "edit": "pencil",
  "info": "info.circle",
  "help-circle": "questionmark.circle",
  "alert-triangle": "exclamationmark.triangle",
  "pie-chart": "chart.pie",
  "trending-up": "chart.line.uptrend.xyaxis",
  "book-open": "book.pages",
  "award": "trophy",
  "target": "target",
  "heart": "heart",
  "activity": "waveform.path.ecg",
  "dumbbell": "dumbbell"
};

function toSwiftSFSymbol(lucideName: string): string {
  const normalized = lucideName.trim().toLowerCase();
  if (LUCIDE_TO_SF_SYMBOL[normalized]) {
    return LUCIDE_TO_SF_SYMBOL[normalized];
  }
  // SF Symbols use dot-separated names; best-effort conversion from Lucide kebab-case
  return lucideName.replace(/-/g, '.');
}

function toSwiftCamelCase(lucideName: string): string {
  const normalized = lucideName.trim();
  const parts = normalized.split(/[-_]+/);
  if (parts.length === 0) return "";
  let result = parts[0].toLowerCase();
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    result += part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }
  return result;
}

function toRNIconName(lucideName: string): string {
  return lucideName; // React Native icon libraries accept kebab-case directly
}

function parsePixel(value: string | undefined): number {
  if (!value) return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

export interface CssRule {
  selector: string;
  declarations: Map<string, string>;
}

export function parseCssStylesheet(htmlDoc: Document): CssRule[] {
  const rules: CssRule[] = [];
  const styleTags = htmlDoc.getElementsByTagName("style");
  for (let i = 0; i < styleTags.length; i++) {
    const text = styleTags[i].textContent || "";
    const matches = text.matchAll(/([^{}\n]+)\s*\{([^}]+)\}/g);
    for (const match of matches) {
      const selector = match[1].trim();
      const declText = match[2].trim();
      const declarations = new Map<string, string>();
      declText.split(";").forEach(decl => {
        const colonIdx = decl.indexOf(":");
        if (colonIdx !== -1) {
          const key = decl.substring(0, colonIdx).trim().toLowerCase();
          const val = decl.substring(colonIdx + 1).trim();
          if (key && val) {
            declarations.set(key, val);
          }
        }
      });
      rules.push({ selector, declarations });
    }
  }
  return rules;
}

function matchSingleSelector(singleSel: string, element: HTMLElement): boolean {
  let sel = singleSel.trim();
  if (!sel || sel === "*") return true;

  // Match tag name if it starts with an alphanumeric word
  const tagMatch = sel.match(/^([a-zA-Z0-9_-]+)/);
  if (tagMatch) {
    const tagName = tagMatch[1];
    if (element.tagName.toLowerCase() !== tagName.toLowerCase()) {
      return false;
    }
    sel = sel.substring(tagName.length);
  }

  // Parse classes, attributes, and pseudo-classes
  while (sel.length > 0) {
    if (sel.startsWith(".")) {
      const classMatch = sel.match(/^\.([a-zA-Z0-9_-]+)/);
      if (!classMatch) return false;
      const className = classMatch[1];
      const classes = Array.from(element.classList || []);
      if (!classes.includes(className)) {
        return false;
      }
      sel = sel.substring(classMatch[0].length);
    } else if (sel.startsWith("[")) {
      const attrMatch = sel.match(/^\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]/);
      if (!attrMatch) return false;
      const attrName = attrMatch[1];
      let expectedVal = attrMatch[2];
      if (expectedVal) {
        if ((expectedVal.startsWith('"') && expectedVal.endsWith('"')) || 
            (expectedVal.startsWith("'") && expectedVal.endsWith("'"))) {
          expectedVal = expectedVal.slice(1, -1);
        }
      }
      if (!element.hasAttribute(attrName)) {
        return false;
      }
      if (expectedVal && element.getAttribute(attrName) !== expectedVal) {
        return false;
      }
      sel = sel.substring(attrMatch[0].length);
    } else if (sel.startsWith(":")) {
      const pseudoMatch = sel.match(/^:[a-zA-Z0-9_-]+/);
      if (!pseudoMatch) return false;
      sel = sel.substring(pseudoMatch[0].length);
    } else {
      break;
    }
  }

  return true;
}

export function selectorMatchesElement(selector: string, element: HTMLElement): boolean {
  const sel = selector.trim();
  if (!sel || sel === "*") return true;
  
  const parts = sel.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    if (!matchSingleSelector(parts[parts.length - 1], element)) {
      return false;
    }
    let currentElement = element.parentElement || (element as any).parentElement;
    for (let i = parts.length - 2; i >= 0; i--) {
      const part = parts[i];
      let matched = false;
      while (currentElement) {
        if (matchSingleSelector(part, currentElement)) {
          matched = true;
          break;
        }
        currentElement = currentElement.parentElement || (currentElement as any).parentElement;
      }
      if (!matched) return false;
      currentElement = currentElement.parentElement || (currentElement as any).parentElement;
    }
    return true;
  }
  
  return matchSingleSelector(sel, element);
}

const DEFAULT_TYPOGRAPHY = {
  nav_title: { size: "17px", weight: "700", line_height: "22px" },
  screen_title: { size: "24px", weight: "800", line_height: "30px" },
  hero_title: { size: "32px", weight: "800", line_height: "40px" },
  section_title: { size: "18px", weight: "700", line_height: "24px" },
  metric_value: { size: "32px", weight: "800", line_height: "38px" },
  body: { size: "16px", weight: "500", line_height: "24px" },
  supporting: { size: "14px", weight: "400", line_height: "20px" },
  caption: { size: "12px", weight: "600", line_height: "16px" },
  button_label: { size: "15px", weight: "700", line_height: "20px" },
} as const;

function resolveCssVariable(varName: string, varMap?: Map<string, string>): string {
  const cleanVar = varName.trim().replace(/^var\(/, "").replace(/\)$/, "").trim();
  const parts = cleanVar.split(",");
  const varKey = parts[0].trim();
  const fallback = parts[1] ? parts[1].trim() : undefined;
  
  let val = varMap?.get(varKey);
  if (val !== undefined) return val;

  // Fallback to standard design system typography values if not found in varMap
  if (varKey.startsWith("--dg-type-")) {
    const subKey = varKey.replace("--dg-type-", ""); // e.g. "screen-title-size" or "body-weight"
    const typKey = subKey.replace(/-/g, "_"); // e.g. "screen_title_size"
    
    const roles = ["nav_title", "screen_title", "hero_title", "section_title", "metric_value", "body", "supporting", "caption", "button_label"];
    for (const r of roles) {
      if (typKey.startsWith(r + "_")) {
        const prop = typKey.substring(r.length + 1); // "size", "weight", "line_height"
        const defaultRoleVal = DEFAULT_TYPOGRAPHY[r as keyof typeof DEFAULT_TYPOGRAPHY];
        if (defaultRoleVal) {
          if (prop === "size") return defaultRoleVal.size;
          if (prop === "weight") return defaultRoleVal.weight;
          if (prop === "line_height" || prop === "line-height") return defaultRoleVal.line_height;
        }
      }
    }
  }

  // Spacing and radii standard fallbacks
  if (varKey === "--dg-mobile-layout-screen-margin") return "24px";
  if (varKey === "--dg-mobile-layout-section-gap") return "24px";
  if (varKey === "--dg-mobile-layout-element-gap") return "16px";
  if (varKey === "--dg-radii-app") return "18px";
  if (varKey === "--dg-radii-pill") return "9999px";
  if (varKey === "--dg-sizing-bottom-nav-height") return "80px";
  if (varKey === "--dg-mobile-layout-safe-area-top") return "16px";
  if (varKey === "--dg-mobile-layout-safe-area-bottom") return "16px";

  // Color standard fallbacks
  if (varKey === "--dg-color-background-primary") return "#F5F5FA";
  if (varKey === "--dg-color-background-secondary") return "#FFFFFF";
  if (varKey === "--dg-color-surface-card") return "#FFFFFF";
  if (varKey === "--dg-color-action-primary") return "#3B82F6";
  if (varKey === "--dg-color-action-on-primary-text") return "#FFFFFF";
  if (varKey === "--dg-color-text-high-emphasis") return "#111827";
  if (varKey === "--dg-color-text-medium-emphasis") return "#4B5563";
  if (varKey === "--dg-color-text-low-emphasis") return "#9CA3AF";
  if (varKey === "--dg-color-border-divider") return "rgba(0, 0, 0, 0.05)";

  if (fallback !== undefined) return fallback;
  return varName;
}

function parseFontWeight(val: string, varMap?: Map<string, string>): "normal" | "medium" | "semibold" | "bold" | "heavy" {
  const resolved = val.trim().startsWith("var(") ? resolveCssVariable(val.trim(), varMap) : val.trim();
  const cleanVal = resolved.toLowerCase();
  
  const num = parseInt(cleanVal, 10);
  if (!isNaN(num)) {
    if (num >= 800) return "heavy";
    if (num >= 700) return "bold";
    if (num >= 600) return "semibold";
    if (num >= 500) return "medium";
    return "normal";
  }

  if (cleanVal === "heavy" || cleanVal === "black" || cleanVal === "extra-bold" || cleanVal === "extrabold" || cleanVal === "800" || cleanVal === "900") {
    return "heavy";
  }
  if (cleanVal === "bold" || cleanVal === "700") {
    return "bold";
  }
  if (cleanVal === "semibold" || cleanVal === "600") {
    return "semibold";
  }
  if (cleanVal === "medium" || cleanVal === "500") {
    return "medium";
  }
  return "normal";
}

function hasIdenticalBackground(styles: ParsedStyles, parentStyles?: ParsedStyles): boolean {
  if (!parentStyles) return false;
  if (styles.gradient || parentStyles.gradient) return false;

  const thisBgToken = styles.backgroundColorToken;
  const parentBgToken = parentStyles.backgroundColorToken;
  const thisBgColor = styles.backgroundColor;
  const parentBgColor = parentStyles.backgroundColor;

  if (thisBgToken && parentBgToken && thisBgToken === parentBgToken) {
    return true;
  }

  if (!thisBgToken && !parentBgToken) {
    if (thisBgColor !== "transparent" && parentBgColor !== "transparent") {
      return thisBgColor === parentBgColor;
    }
  }

  const resolvedThis = thisBgToken ? resolveTokenToColor(thisBgToken) : thisBgColor;
  const resolvedParent = parentBgToken ? resolveTokenToColor(parentBgToken) : parentBgColor;

  if (resolvedThis !== "transparent" && resolvedParent !== "transparent") {
    return resolvedThis === resolvedParent;
  }

  return false;
}

function resolveTokenToColor(token: string): string {
  switch (token) {
    case "bgPrimary": return "#FFFFFF";
    case "bgSecondary": return "#F3F4F6";
    case "surfaceCard": return "#FFFFFF";
    case "actionPrimary": return "#3B82F6";
    case "actionSecondary": return "#E5E7EB";
    default: return token;
  }
}

// Resolves compound values like calc(var(--x) + 8px), plain 120px, var(--x), etc.
function resolveArbitraryValue(val: string, varMap: Map<string, string>): number {
  const trimmed = val.trim();
  // Plain pixel value: "120px" or "120"
  if (/^[\d.]+(?:px)?$/.test(trimmed)) return parseFloat(trimmed);
  // Plain percentage: "100%" — not convertible to a number for spacing, return 0
  if (trimmed.endsWith('%')) return 0;
  // var() reference
  if (trimmed.startsWith('var(')) {
    const resolved = resolveCssVariable(trimmed, varMap);
    return parsePixel(resolved);
  }
  // calc() expression: resolve inner var() refs, then evaluate simple +/- arithmetic
  if (trimmed.startsWith('calc(')) {
    let inner = trimmed.slice(5, -1).trim(); // strip calc( and )
    // Resolve all nested var() references
    inner = inner.replace(/var\([^)]+\)/g, (match) => {
      const resolved = resolveCssVariable(match, varMap);
      return String(parsePixel(resolved));
    });
    // Evaluate simple addition/subtraction: "16 + 8" or "16+8px"
    try {
      // Strip remaining "px" units and split on +/- preserving the operator
      const cleaned = inner.replace(/px/g, '').trim();
      const tokens = cleaned.split(/([+-])/).map(t => t.trim()).filter(Boolean);
      let result = parseFloat(tokens[0]) || 0;
      for (let i = 1; i < tokens.length; i += 2) {
        const op = tokens[i];
        const operand = parseFloat(tokens[i + 1]) || 0;
        if (op === '+') result += operand;
        else if (op === '-') result -= operand;
      }
      return isNaN(result) ? 0 : result;
    } catch (_e) {
      return 0;
    }
  }
  // color-mix() — not a numeric value, return 0
  if (trimmed.startsWith('color-mix(')) return 0;
  // Fallback
  return parseFloat(trimmed) || 0;
}

// Resolves a color from an arbitrary bracket value like [var(--dg-color-x)] or [#FF0000] or [color-mix(...)]
function resolveArbitraryColor(val: string, varMap: Map<string, string>): string {
  const trimmed = val.trim();
  if (trimmed.startsWith('#')) return trimmed;
  if (trimmed.startsWith('var(')) return resolveCssVariable(trimmed, varMap);
  if (trimmed.startsWith('color-mix(')) {
    // Extract the first color argument as fallback
    const match = trimmed.match(/,\s*(#[0-9a-fA-F]{3,8}|var\([^)]+\))/);  
    if (match) {
      if (match[1].startsWith('var(')) return resolveCssVariable(match[1], varMap);
      return match[1];
    }
    return 'transparent';
  }
  return trimmed;
}

function getStyleTokenKey(varName: string): string | undefined {
  const clean = varName.trim().replace(/^var\(/, "").replace(/\)$/, "").trim();
  switch (clean) {
    case "--dg-color-background-primary": return "bgPrimary";
    case "--dg-color-background-secondary": return "bgSecondary";
    case "--dg-color-surface-card": return "surfaceCard";
    case "--dg-color-action-primary": return "actionPrimary";
    case "--dg-color-action-on-primary-text": return "actionOnPrimary";
    case "--dg-color-text-high-emphasis": return "textHigh";
    case "--dg-color-text-medium-emphasis": return "textMedium";
    case "--dg-color-text-low-emphasis": return "textLow";
    case "--dg-color-border-divider": return "borderDivider";
    case "--dg-color-border-subtle": return "borderDivider";
    case "--dg-color-border-strong": return "borderDivider";
    case "--dg-radii-app": return "borderRadiusApp";
    case "--dg-radii-pill": return "borderRadiusPill";
    case "--dg-mobile-layout-screen-margin": return "screenPadding";
    case "--dg-mobile-layout-section-gap": return "sectionGap";
    case "--dg-mobile-layout-element-gap": return "elementGap";
    default: return undefined;
  }
}

function parseRgbRgba(val: string): { color: string; opacity?: number } | null {
  const match = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d\.]+)\s*)?\)/);
  if (match) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    const a = match[4] !== undefined ? parseFloat(match[4]) : 1.0;
    const hex = "#" + [r, g, b].map(x => {
      const hexStr = x.toString(16);
      return hexStr.length === 1 ? "0" + hexStr : hexStr;
    }).join("").toUpperCase();
    return { color: hex, opacity: a };
  }
  return null;
}

function parseCssColor(colorStr: string, varMap?: Map<string, string>): { color: string; opacity?: number } {
  let val = colorStr.trim();
  
  // Resolve CSS variables recursively
  while (val.includes("var(")) {
    const newVal = val.replace(/var\(([^)]+)\)/g, (match) => {
      return resolveCssVariable(match, varMap);
    });
    if (newVal === val) break;
    val = newVal;
  }
  
  if (val.startsWith("color-mix")) {
    const percentMatch = val.match(/([\d\.]+)%/);
    const opacity = percentMatch ? parseFloat(percentMatch[1]) / 100 : 1.0;
    const hexMatch = val.match(/#[0-9a-fA-F]{3,8}/);
    if (hexMatch) {
      return { color: hexMatch[0], opacity };
    }
    const rgbMatch = val.match(/rgba?\(.*?\)/);
    if (rgbMatch) {
      const parsedRgb = parseRgbRgba(rgbMatch[0]);
      if (parsedRgb) {
        return { color: parsedRgb.color, opacity: (parsedRgb.opacity ?? 1.0) * opacity };
      }
    }
    return { color: "#FFFFFF", opacity };
  }

  const parsedRgb = parseRgbRgba(val);
  if (parsedRgb) {
    return parsedRgb;
  }

  return { color: val };
}

function parseColorString(colorStr: string | undefined): { r: number; g: number; b: number; a: number; isRgba: boolean; hex: string } {
  if (!colorStr) {
    return { r: 255, g: 255, b: 255, a: 1, isRgba: false, hex: "FFFFFF" };
  }
  const str = colorStr.trim();
  if (str === "transparent") {
    return { r: 0, g: 0, b: 0, a: 0, isRgba: true, hex: "000000" };
  }
  
  const rgbaMatch = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d\.]+)\s*\)/i);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3]),
      a: parseFloat(rgbaMatch[4]),
      isRgba: true,
      hex: ""
    };
  }
  
  const rgbMatch = str.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
      a: 1.0,
      isRgba: false,
      hex: ""
    };
  }
  
  if (str.startsWith("#")) {
    let clean = str.substring(1);
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    } else if (clean.length === 8) {
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      const a = parseInt(clean.substring(6, 8), 16) / 255.0;
      return { r, g, b, a, isRgba: true, hex: clean.substring(0, 6).toUpperCase() };
    }
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return { r, g, b, a: 1.0, isRgba: false, hex: clean.toUpperCase() };
  }
  
  return { r: 255, g: 255, b: 255, a: 1, isRgba: false, hex: "FFFFFF" };
}

function resolveColorToStandard(colorStr: string, varMap?: Map<string, string>): string {
  const parsed = parseCssColor(colorStr, varMap);
  if (parsed.opacity !== undefined) {
    const parsedBase = parseColorString(parsed.color);
    return `rgba(${parsedBase.r}, ${parsedBase.g}, ${parsedBase.b}, ${parsed.opacity})`;
  }
  return parsed.color;
}

function toSwiftColor(colorStr: string | undefined): string {
  if (!colorStr) return "Color.clear";
  if (colorStr === "transparent") return "Color.clear";
  const { r, g, b, a, isRgba, hex } = parseColorString(colorStr);
  if (isRgba) {
    return `Color(red: ${r}/255.0, green: ${g}/255.0, blue: ${b}/255.0).opacity(${a})`;
  }
  if (hex) {
    return `Color(hex: "#${hex}")`;
  }
  return `Color(red: ${r}/255.0, green: ${g}/255.0, blue: ${b}/255.0)`;
}

function toSwiftBackgroundGradient(styles: ParsedStyles, indent: string, baseColor: string = "Color.clear"): string {
  if (!styles.gradient || !styles.gradient.fromColor || !styles.gradient.toColor) return "";
  
  let canvasBg = toSwiftColor(styles.gradient.fromColor);
  if (canvasBg === "Color.clear" && baseColor !== "Color.clear") {
    canvasBg = baseColor;
  }
  
  if (styles.gradient.isRepeating) {
    return `${indent}.background(\n` +
           `${indent}    Canvas { context, size in\n` +
           `${indent}        let stripeWidth: CGFloat = 6\n` +
           `${indent}        let totalWidth = size.width + size.height\n` +
           `${indent}        var x: CGFloat = 0\n` +
           `${indent}        while x < totalWidth {\n` +
           `${indent}            var path = Path()\n` +
           `${indent}            path.move(to: CGPoint(x: x, y: 0))\n` +
           `${indent}            path.addLine(to: CGPoint(x: x + stripeWidth, y: 0))\n` +
           `${indent}            path.addLine(to: CGPoint(x: x - size.height + stripeWidth, y: size.height))\n` +
           `${indent}            path.addLine(to: CGPoint(x: x - size.height, y: size.height))\n` +
           `${indent}            path.closeSubpath()\n` +
           `${indent}            context.fill(path, with: .color(${toSwiftColor(styles.gradient.toColor)}))\n` +
           `${indent}            x += stripeWidth * 2\n` +
           `${indent}        }\n` +
           `${indent}    }\n` +
           `${indent}    .background(${canvasBg})\n` +
           `${indent})\n`;
  }
  
  const { start, end } = gradientDirectionToSwift(styles.gradient.direction);
  return `${indent}.background(LinearGradient(gradient: Gradient(colors: [${toSwiftColor(styles.gradient.fromColor)}, ${toSwiftColor(styles.gradient.toColor)}]), startPoint: ${start}, endPoint: ${end}))\n`;
}

function toComposeColor(colorStr: string | undefined): string {
  if (!colorStr) return "Color.Transparent";
  if (colorStr === "transparent") return "Color.Transparent";
  const { r, g, b, a, isRgba, hex } = parseColorString(colorStr);
  if (isRgba) {
    return `Color(red = ${r}/255f, green = ${g}/255f, blue = ${b}/255f, alpha = ${a}f)`;
  }
  if (hex) {
    return `Color(0xFF${hex})`;
  }
  return `Color(red = ${r}/255f, green = ${g}/255f, blue = ${b}/255f)`;
}

function toFlutterColor(colorStr: string | undefined): string {
  if (!colorStr) return "Colors.transparent";
  if (colorStr === "transparent") return "Colors.transparent";
  const { r, g, b, a, isRgba, hex } = parseColorString(colorStr);
  if (isRgba) {
    return `Color.fromRGBO(${r}, ${g}, ${b}, ${a})`;
  }
  if (hex) {
    return `Color(0xFF${hex})`;
  }
  return `Color.fromRGBO(${r}, ${g}, ${b}, 1.0)`;
}

function toRNColor(colorStr: string | undefined): string {
  if (!colorStr) return "'transparent'";
  if (colorStr === "transparent") return "'transparent'";
  const { r, g, b, a, isRgba, hex } = parseColorString(colorStr);
  if (isRgba) {
    return `'rgba(${r}, ${g}, ${b}, ${a})'`;
  }
  if (hex) {
    return `'#${hex}'`;
  }
  return `'rgb(${r}, ${g}, ${b})'`;
}

function extractParenthesesContent(str: string, functionName: string): string | null {
  const idx = str.toLowerCase().indexOf(functionName.toLowerCase() + "(");
  if (idx === -1) return null;
  let depth = 0;
  let contentStart = idx + functionName.length + 1;
  for (let i = contentStart; i < str.length; i++) {
    if (str[i] === "(") depth++;
    else if (str[i] === ")") {
      if (depth === 0) {
        return str.substring(contentStart, i);
      }
      depth--;
    }
  }
  return null;
}

function splitByCommasIgnoringParentheses(str: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current) {
    parts.push(current.trim());
  }
  return parts;
}

export function parseStyles(element: HTMLElement, varMap: Map<string, string>, cssRules?: CssRule[]): ParsedStyles {
  const classes = Array.from(element.classList);
  
  // 1. Gather all declarations from matching stylesheet rules
  const declarations = new Map<string, string>();
  if (cssRules) {
    for (const rule of cssRules) {
      if (selectorMatchesElement(rule.selector, element)) {
        for (const [key, val] of rule.declarations) {
          declarations.set(key, val);
        }
      }
    }
  }
  const inlineStyle = element.getAttribute("style");
  if (inlineStyle) {
    inlineStyle.split(";").forEach(rule => {
      const parts = rule.split(":");
      if (parts.length < 2) return;
      const key = parts[0].trim().toLowerCase();
      const val = parts.slice(1).join(":").trim();
      if (key && val) {
        declarations.set(key, val);
      }
    });
  }

  // Default values
  let isFlex = classes.includes("flex") || 
               classes.some(c => c.startsWith("flex-") || c.startsWith("justify-") || c.startsWith("items-") || c.startsWith("gap-")) ||
               element.tagName === "NAV" || element.tagName === "nav";
  let flexDirection: "row" | "column" = "column";
  let alignItems: "start" | "center" | "end" | "stretch" = "stretch";
  let justifyContent: "start" | "center" | "end" | "between" | "around" = "start";
  let gap = 0;

  const padding = { top: 0, right: 0, bottom: 0, left: 0 };
  const margin = { top: 0, right: 0, bottom: 0, left: 0 };

  let width: string | number = "auto";
  let height: string | number = "auto";

  let backgroundColor = "transparent";
  let textColor: string | undefined = undefined;

  let borderRadius = 0;
  let borderWidth = 0;
  let borderColor = "transparent";

  let fontSize: number | undefined = undefined;
  let fontWeight: "normal" | "medium" | "semibold" | "bold" | "heavy" | undefined = undefined;
  let textAlign: "left" | "center" | "right" | undefined = undefined;

  let shadow: string | null = null;

  // Grid layout
  let isGrid = false;
  let gridCols = 0;

  // Fixed positioning tracking
  let isFixedBottom = false;
  let _hasFixedClass = false;
  let _hasBottom0 = false;

  // Opacity
  let opacity = 1;

  // Min dimensions
  let minHeight: string | number = "auto";

  // Gradient
  let gradient: ParsedStyles["gradient"] = null;

  // Flex-1
  let hasFlex1 = false;

  // Absolute positioning
  let isAbsolute = false;
  let isBackgroundAbsolute = false;
  let absolutePosition: ParsedStyles["absolutePosition"] = undefined;

  // Dynamic theme token mapping variables
  let backgroundColorToken: string | undefined;
  let textColorToken: string | undefined;
  let borderColorToken: string | undefined;
  let borderRadiusToken: string | undefined;
  let gapToken: string | undefined;
  let paddingLeftToken: string | undefined;
  let paddingRightToken: string | undefined;
  let paddingTopToken: string | undefined;
  let paddingBottomToken: string | undefined;
  let marginLeftToken: string | undefined;
  let marginRightToken: string | undefined;
  let marginTopToken: string | undefined;
  let marginBottomToken: string | undefined;

  let explicitTextColor = false;
  let backdropFilterBlur = 0;
  let filter: ParsedStyles["filter"] = undefined;

  // Resolve Drawgle Token classes first
  classes.forEach(c => {
    // Text Color Scoping Flag
    if (c.startsWith("text-") && !c.startsWith("text-[") && !/text-(xs|sm|base|lg|xl|2xl|3xl|left|center|right|justify)/.test(c)) {
      explicitTextColor = true;
    }
    if (c.startsWith("dg-text-") || c === "dg-action-primary") {
      explicitTextColor = true;
    }

    // Arbitrary Text Size Match
    const textSizeMatch = c.match(/^text-\[(.+)\]$/);
    if (textSizeMatch) {
      const val = textSizeMatch[1];
      const size = resolveArbitraryValue(val, varMap);
      if (size > 0) {
        fontSize = size;
      }
    }

    // Arbitrary Font Weight Match
    const fontWeightMatch = c.match(/^font-\[(.+)\]$/);
    if (fontWeightMatch) {
      const val = fontWeightMatch[1].trim();
      fontWeight = parseFontWeight(val, varMap);
    }

    // Filter Tailwind Classes
    const hueRotateMatch = c.match(/^(?:-)?hue-rotate-([0-9\.]+)$/);
    if (hueRotateMatch) {
      if (!filter) filter = {};
      const isNegative = c.startsWith("-");
      const deg = parseFloat(hueRotateMatch[1]);
      filter.hueRotate = isNegative ? -deg : deg;
    }
    const brgMatch = c.match(/^brightness-([0-9\.]+)$/);
    if (brgMatch) {
      if (!filter) filter = {};
      filter.brightness = parseFloat(brgMatch[1]) / 100;
    }
    const satMatch = c.match(/^saturate-([0-9\.]+)$/);
    if (satMatch) {
      if (!filter) filter = {};
      filter.saturate = parseFloat(satMatch[1]) / 100;
    }
    const cntMatch = c.match(/^contrast-([0-9\.]+)$/);
    if (cntMatch) {
      if (!filter) filter = {};
      filter.contrast = parseFloat(cntMatch[1]) / 100;
    }
    const blrMatch = c.match(/^blur(?:-([a-z0-9\.]+))?$/);
    if (blrMatch) {
      if (!filter) filter = {};
      if (blrMatch[1] === "sm") filter.blur = 4;
      else if (blrMatch[1] === "md") filter.blur = 8;
      else if (blrMatch[1] === "lg") filter.blur = 12;
      else if (blrMatch[1] === "xl") filter.blur = 16;
      else if (blrMatch[1] === "2xl") filter.blur = 24;
      else if (blrMatch[1] === "3xl") filter.blur = 40;
      else if (blrMatch[1]) filter.blur = parseFloat(blrMatch[1]) || 8;
      else filter.blur = 8;
    }

    // Layout
    if (c === "flex-col") flexDirection = "column";
    if (c === "flex-row") flexDirection = "row";
    
    if (c === "items-start") alignItems = "start";
    if (c === "items-center") alignItems = "center";
    if (c === "items-end") alignItems = "end";
    if (c === "items-stretch") alignItems = "stretch";

    if (c === "justify-start") justifyContent = "start";
    if (c === "justify-center") justifyContent = "center";
    if (c === "justify-end") justifyContent = "end";
    if (c === "justify-between") justifyContent = "between";
    if (c === "justify-around") justifyContent = "around";

    // Text Align
    if (c === "text-left") textAlign = "left";
    if (c === "text-center") textAlign = "center";
    if (c === "text-right") textAlign = "right";

    // Text Sizes
    if (c === "text-xs") fontSize = 12;
    if (c === "text-sm") fontSize = 14;
    if (c === "text-base") fontSize = 16;
    if (c === "text-lg") fontSize = 18;
    if (c === "text-xl") fontSize = 20;
    if (c === "text-2xl") fontSize = 24;
    if (c === "text-3xl") fontSize = 30;

    // Font Weights
    if (c === "font-normal") fontWeight = "normal";
    if (c === "font-medium") fontWeight = "medium";
    if (c === "font-semibold") fontWeight = "semibold";
    if (c === "font-bold") fontWeight = "bold";

    // Spacing (padding / margin / gap)
    const paddingMatch = c.match(/^p-([0-9\.]+)$/);
    if (paddingMatch) {
      const val = parseFloat(paddingMatch[1]) * 4;
      padding.top = padding.right = padding.bottom = padding.left = val;
    }
    const pxMatch = c.match(/^px-([0-9\.]+)$/);
    if (pxMatch) {
      const val = parseFloat(pxMatch[1]) * 4;
      padding.left = padding.right = val;
    }
    const pyMatch = c.match(/^py-([0-9\.]+)$/);
    if (pyMatch) {
      const val = parseFloat(pyMatch[1]) * 4;
      padding.top = padding.bottom = val;
    }
    const ptMatch = c.match(/^pt-([0-9\.]+)$/);
    if (ptMatch) padding.top = parseFloat(ptMatch[1]) * 4;
    const prMatch = c.match(/^pr-([0-9\.]+)$/);
    if (prMatch) padding.right = parseFloat(prMatch[1]) * 4;
    const pbMatch = c.match(/^pb-([0-9\.]+)$/);
    if (pbMatch) padding.bottom = parseFloat(pbMatch[1]) * 4;
    const plMatch = c.match(/^pl-([0-9\.]+)$/);
    if (plMatch) padding.left = parseFloat(plMatch[1]) * 4;

    const marginMatch = c.match(/^m-([0-9\.]+)$/);
    if (marginMatch) {
      const val = parseFloat(marginMatch[1]) * 4;
      margin.top = margin.right = margin.bottom = margin.left = val;
    }
    const mxMatch = c.match(/^mx-([0-9\.]+)$/);
    if (mxMatch) {
      const val = parseFloat(mxMatch[1]) * 4;
      margin.left = margin.right = val;
    }
    const myMatch = c.match(/^my-([0-9\.]+)$/);
    if (myMatch) {
      const val = parseFloat(myMatch[1]) * 4;
      margin.top = margin.bottom = val;
    }
    const mtMatch = c.match(/^mt-([0-9\.]+)$/);
    if (mtMatch) margin.top = parseFloat(mtMatch[1]) * 4;
    const mrMatch = c.match(/^mr-([0-9\.]+)$/);
    if (mrMatch) margin.right = parseFloat(mrMatch[1]) * 4;
    const mbMatch = c.match(/^mb-([0-9\.]+)$/);
    if (mbMatch) margin.bottom = parseFloat(mbMatch[1]) * 4;
    const mlMatch = c.match(/^ml-([0-9\.]+)$/);
    if (mlMatch) margin.left = parseFloat(mlMatch[1]) * 4;

    const gapMatch = c.match(/^gap-([0-9\.]+)$/);
    if (gapMatch) gap = parseFloat(gapMatch[1]) * 4;

    // Border Width & Radius
    if (c === "border") borderWidth = 1;
    const borderW = c.match(/^border-([0-9]+)$/);
    if (borderW) borderWidth = parseInt(borderW[1]);

    if (c === "rounded-sm") borderRadius = 4;
    if (c === "rounded") borderRadius = 6;
    if (c === "rounded-md") borderRadius = 8;
    if (c === "rounded-lg") borderRadius = 12;
    if (c === "rounded-xl") borderRadius = 16;
    if (c === "rounded-2xl") borderRadius = 20;
    if (c === "rounded-3xl") borderRadius = 24;
    if (c === "rounded-full") borderRadius = 9999;

    // Standard Tailwind width & height maps
    if (c === "w-full") width = "100%";
    if (c === "h-full") height = "100%";
    const wMatch = c.match(/^w-([0-9]+)$/);
    if (wMatch) width = parseInt(wMatch[1]) * 4;
    const hMatch = c.match(/^h-([0-9]+)$/);
    if (hMatch) height = parseInt(hMatch[1]) * 4;

    // Arbitrary brackets e.g. w-[120px] or p-[var(--dg-spacing-md)]
    // Arbitrary bracket values — use resolveArbitraryValue for robust calc/var resolution
    const arbWidth = c.match(/^w-\[(.+)\]$/);
    if (arbWidth) {
      const val = arbWidth[1];
      if (val === '100%' || val === 'auto' || val === 'fit-content') { width = val; }
      else { width = resolveArbitraryValue(val, varMap) || val; }
    }
    const arbHeight = c.match(/^h-\[(.+)\]$/);
    if (arbHeight) {
      const val = arbHeight[1];
      if (val === '100%' || val === 'auto' || val === 'fit-content') { height = val; }
      else { height = resolveArbitraryValue(val, varMap) || val; }
    }
    const arbPadding = c.match(/^p-\[(.+)\]$/);
    if (arbPadding) {
      const val = arbPadding[1];
      padding.top = padding.right = padding.bottom = padding.left = resolveArbitraryValue(val, varMap);
      const t = getStyleTokenKey(val);
      if (t) {
        paddingTopToken = paddingRightToken = paddingBottomToken = paddingLeftToken = t;
      }
    }
    const arbPx = c.match(/^px-\[(.+)\]$/);
    if (arbPx) {
      const val = arbPx[1];
      padding.left = padding.right = resolveArbitraryValue(val, varMap);
      const t = getStyleTokenKey(val);
      if (t) {
        paddingLeftToken = paddingRightToken = t;
      }
    }
    const arbPy = c.match(/^py-\[(.+)\]$/);
    if (arbPy) {
      const val = arbPy[1];
      padding.top = padding.bottom = resolveArbitraryValue(val, varMap);
      const t = getStyleTokenKey(val);
      if (t) {
        paddingTopToken = paddingBottomToken = t;
      }
    }
    const arbPt = c.match(/^pt-\[(.+)\]$/);
    if (arbPt) {
      const val = arbPt[1];
      padding.top = resolveArbitraryValue(val, varMap);
      paddingTopToken = getStyleTokenKey(val);
    }
    const arbPr = c.match(/^pr-\[(.+)\]$/);
    if (arbPr) {
      const val = arbPr[1];
      padding.right = resolveArbitraryValue(val, varMap);
      paddingRightToken = getStyleTokenKey(val);
    }
    const arbPb = c.match(/^pb-\[(.+)\]$/);
    if (arbPb) {
      const val = arbPb[1];
      padding.bottom = resolveArbitraryValue(val, varMap);
      paddingBottomToken = getStyleTokenKey(val);
    }
    const arbPl = c.match(/^pl-\[(.+)\]$/);
    if (arbPl) {
      const val = arbPl[1];
      padding.left = resolveArbitraryValue(val, varMap);
      paddingLeftToken = getStyleTokenKey(val);
    }
    const arbMt = c.match(/^mt-\[(.+)\]$/);
    if (arbMt) {
      const val = arbMt[1];
      margin.top = resolveArbitraryValue(val, varMap);
      marginTopToken = getStyleTokenKey(val);
    }
    const arbMb = c.match(/^mb-\[(.+)\]$/);
    if (arbMb) {
      const val = arbMb[1];
      margin.bottom = resolveArbitraryValue(val, varMap);
      marginBottomToken = getStyleTokenKey(val);
    }
    const arbMl = c.match(/^ml-\[(.+)\]$/);
    if (arbMl) {
      const val = arbMl[1];
      margin.left = resolveArbitraryValue(val, varMap);
      marginLeftToken = getStyleTokenKey(val);
    }
    const arbMr = c.match(/^mr-\[(.+)\]$/);
    if (arbMr) {
      const val = arbMr[1];
      margin.right = resolveArbitraryValue(val, varMap);
      marginRightToken = getStyleTokenKey(val);
    }
    const arbGap = c.match(/^gap-\[(.+)\]$/);
    if (arbGap) {
      const val = arbGap[1];
      gap = resolveArbitraryValue(val, varMap);
      gapToken = getStyleTokenKey(val);
    }
    const arbRadius = c.match(/^rounded-\[(.+)\]$/);
    if (arbRadius) {
      const val = arbRadius[1];
      borderRadius = resolveArbitraryValue(val, varMap);
      borderRadiusToken = getStyleTokenKey(val);
    }

    // Color utilities
    if (c.startsWith("bg-")) {
      const col = c.substring(3);
      if (TAILWIND_COLOR_MAP[col]) {
        backgroundColor = TAILWIND_COLOR_MAP[col];
      } else if (col.startsWith("[var(")) {
        const varPart = col.substring(1, col.length - 1);
        backgroundColor = resolveCssVariable(varPart, varMap);
        backgroundColorToken = getStyleTokenKey(varPart);
      } else if (col.startsWith("[#")) {
        backgroundColor = col.substring(1, col.length - 1);
      }
    }
    if (c.startsWith("text-")) {
      const col = c.substring(5);
      if (TAILWIND_COLOR_MAP[col]) {
        textColor = TAILWIND_COLOR_MAP[col];
      } else if (col.startsWith("[var(")) {
        const varPart = col.substring(1, col.length - 1);
        if (!varPart.includes("-size") && !varPart.includes("-weight") && !varPart.includes("-line-height")) {
          textColor = resolveCssVariable(varPart, varMap);
          textColorToken = getStyleTokenKey(varPart);
        }
      } else if (col.startsWith("[#")) {
        textColor = col.substring(1, col.length - 1);
      }
    }
    if (c.startsWith("border-")) {
      const col = c.substring(7);
      if (TAILWIND_COLOR_MAP[col]) {
        borderColor = TAILWIND_COLOR_MAP[col];
      } else if (col.startsWith("[var(")) {
        const varPart = col.substring(1, col.length - 1);
        borderColor = resolveCssVariable(varPart, varMap);
        borderColorToken = getStyleTokenKey(varPart);
      } else if (col.startsWith("[#")) {
        borderColor = col.substring(1, col.length - 1);
      }
    }

    // Drawgle Semantic tokens
    if (c === "dg-bg-primary") {
      backgroundColor = varMap.get("--dg-color-background-primary") || "#FFFFFF";
      backgroundColorToken = "bgPrimary";
    }
    if (c === "dg-bg-secondary") {
      backgroundColor = varMap.get("--dg-color-background-secondary") || "#F3F4F6";
      backgroundColorToken = "bgSecondary";
    }
    if (c === "dg-surface-card") {
      backgroundColor = varMap.get("--dg-color-surface-card") || "#FFFFFF";
      backgroundColorToken = "surfaceCard";
    }
    if (c === "dg-surface-bottom-sheet") {
      backgroundColor = varMap.get("--dg-color-surface-bottom-sheet") || "#FFFFFF";
      backgroundColorToken = "surfaceCard";
    }
    if (c === "dg-surface-modal") {
      backgroundColor = varMap.get("--dg-color-surface-modal") || "#FFFFFF";
      backgroundColorToken = "surfaceCard";
    }
    
    if (c === "dg-text-high") {
      textColor = varMap.get("--dg-color-text-high-emphasis") || "#111827";
      textColorToken = "textHigh";
    }
    if (c === "dg-text-medium") {
      textColor = varMap.get("--dg-color-text-medium-emphasis") || "#4B5563";
      textColorToken = "textMedium";
    }
    if (c === "dg-text-low") {
      textColor = varMap.get("--dg-color-text-low-emphasis") || "#9CA3AF";
      textColorToken = "textLow";
    }

    if (c === "dg-action-primary") {
      backgroundColor = varMap.get("--dg-color-action-primary") || "#3B82F6";
      textColor = varMap.get("--dg-color-action-on-primary-text") || "#FFFFFF";
      backgroundColorToken = "actionPrimary";
      textColorToken = "actionOnPrimary";
    }
    if (c === "dg-action-secondary") {
      backgroundColor = varMap.get("--dg-color-action-secondary") || "#E5E7EB";
      backgroundColorToken = "bgSecondary";
    }
    if (c === "dg-border-divider") {
      borderColor = varMap.get("--dg-color-border-divider") || "#E5E7EB";
      borderColorToken = "borderDivider";
    }
    if (c === "dg-border-focused") {
      borderColor = varMap.get("--dg-color-border-focused") || "#3B82F6";
      borderColorToken = "actionPrimary";
    }
    
    if (c === "dg-radius-app") {
      borderRadius = parsePixel(varMap.get("--dg-radii-app") || "18px");
      borderRadiusToken = "borderRadiusApp";
    }
    if (c === "dg-radius-pill") {
      borderRadius = parsePixel(varMap.get("--dg-radii-pill") || "9999px");
      borderRadiusToken = "borderRadiusPill";
    }

    if (c === "dg-shadow-surface") shadow = "surface";
    if (c === "dg-shadow-overlay") shadow = "overlay";

    if (c === "dg-screen-padding") {
      const val = parsePixel(varMap.get("--dg-mobile-layout-screen-margin") || "24px");
      padding.left = padding.right = val;
      paddingLeftToken = paddingRightToken = "screenPadding";
    }
    if (c === "dg-section-gap") {
      gap = parsePixel(varMap.get("--dg-mobile-layout-section-gap") || "24px");
      gapToken = "sectionGap";
    }
    if (c === "dg-element-gap") {
      gap = parsePixel(varMap.get("--dg-mobile-layout-element-gap") || "16px");
      gapToken = "elementGap";
    }

    // Semantic typography classes
    if (c.startsWith("dg-type-")) {
      const typeName = c.substring(8).replace(/-/g, "_"); // E.g. screen-title -> screen_title
      const defaultVal = DEFAULT_TYPOGRAPHY[typeName as keyof typeof DEFAULT_TYPOGRAPHY];
      if (defaultVal) {
        fontSize = parseInt(defaultVal.size, 10) || fontSize;
        fontWeight = parseFontWeight(defaultVal.weight, varMap);
      }
    }

    // Grid layout detection
    if (c === "grid") isGrid = true;
    const gridColsMatch = c.match(/^grid-cols-(\d+)$/);
    if (gridColsMatch) { isGrid = true; gridCols = parseInt(gridColsMatch[1]); }
    const arbGridCols = c.match(/^grid-cols-\[(\d+)\]$/);
    if (arbGridCols) { isGrid = true; gridCols = parseInt(arbGridCols[1]); }

    // Fixed positioning detection
    if (c === "fixed") _hasFixedClass = true;
    if (c === "bottom-0") _hasBottom0 = true;

    // Opacity (e.g. opacity-20 → 0.2, opacity-50 → 0.5)
    const opacityMatch = c.match(/^opacity-(\d+)$/);
    if (opacityMatch) opacity = parseInt(opacityMatch[1]) / 100;

    // Min-height (e.g. min-h-[160px])
    const minHMatch = c.match(/^min-h-\[(.+)\]$/);
    if (minHMatch) {
      const val = minHMatch[1];
      if (val.endsWith('%')) { minHeight = val; }
      else { minHeight = resolveArbitraryValue(val, varMap); }
    }

    // Gradient (bg-gradient-to-br, from-[color], to-[color])
    const gradDirMatch = c.match(/^bg-gradient-to-(t|tr|r|br|b|bl|l|tl)$/);
    if (gradDirMatch) {
      if (!gradient) gradient = { direction: '', fromColor: '', toColor: '' };
      gradient.direction = gradDirMatch[1];
    }
    const fromColorMatch = c.match(/^from-\[(.+)\]$/);
    if (fromColorMatch) {
      if (!gradient) gradient = { direction: 'b', fromColor: '', toColor: '' };
      gradient.fromColor = resolveArbitraryColor(fromColorMatch[1], varMap);
    }
    const toColorMatch = c.match(/^to-\[(.+)\]$/);
    if (toColorMatch) {
      if (!gradient) gradient = { direction: 'b', fromColor: '', toColor: '' };
      gradient.toColor = resolveArbitraryColor(toColorMatch[1], varMap);
    }

    // items-baseline → closest native equivalent is start/top alignment
    if (c === "items-baseline") alignItems = "start";

    // flex-1 (fill available space in flex parent)
    if (c === "flex-1" || c === "flex-grow" || c === "flex-grow-1" || c.startsWith("flex-[") || c.startsWith("flex-grow-") || c.startsWith("flex-1-")) hasFlex1 = true;

    // absolute positioning classes
    if (c === "absolute") isAbsolute = true;

    const topMatch = c.match(/^top-([0-9\.]+)$/);
    if (topMatch) {
      if (!absolutePosition) absolutePosition = {};
      absolutePosition.top = parseFloat(topMatch[1]) * 4;
    }
    const arbTop = c.match(/^top-\[(.+)\]$/);
    if (arbTop) {
      if (!absolutePosition) absolutePosition = {};
      const val = arbTop[1];
      absolutePosition.top = resolveArbitraryValue(val, varMap);
      absolutePosition.topToken = getStyleTokenKey(val);
    }

    const rightMatch = c.match(/^right-([0-9\.]+)$/);
    if (rightMatch) {
      if (!absolutePosition) absolutePosition = {};
      absolutePosition.right = parseFloat(rightMatch[1]) * 4;
    }
    const arbRight = c.match(/^right-\[(.+)\]$/);
    if (arbRight) {
      if (!absolutePosition) absolutePosition = {};
      const val = arbRight[1];
      absolutePosition.right = resolveArbitraryValue(val, varMap);
      absolutePosition.rightToken = getStyleTokenKey(val);
    }

    const bottomMatch = c.match(/^bottom-([0-9\.]+)$/);
    if (bottomMatch) {
      if (!absolutePosition) absolutePosition = {};
      absolutePosition.bottom = parseFloat(bottomMatch[1]) * 4;
    }
    const arbBottom = c.match(/^bottom-\[(.+)\]$/);
    if (arbBottom) {
      if (!absolutePosition) absolutePosition = {};
      const val = arbBottom[1];
      absolutePosition.bottom = resolveArbitraryValue(val, varMap);
      absolutePosition.bottomToken = getStyleTokenKey(val);
    }

    const leftMatch = c.match(/^left-([0-9\.]+)$/);
    if (leftMatch) {
      if (!absolutePosition) absolutePosition = {};
      absolutePosition.left = parseFloat(leftMatch[1]) * 4;
    }
    const arbLeft = c.match(/^left-\[(.+)\]$/);
    if (arbLeft) {
      if (!absolutePosition) absolutePosition = {};
      const val = arbLeft[1];
      absolutePosition.left = resolveArbitraryValue(val, varMap);
      absolutePosition.leftToken = getStyleTokenKey(val);
    }
  });

  // Post-loop: CSS/Tailwind default — display:flex without flex-col = row direction
  if (isFlex && !classes.includes('flex-col')) {
    flexDirection = "row";
  }

  // Post-loop: Merge fixed position flags
  isFixedBottom = _hasFixedClass || element.tagName === "NAV" || element.tagName === "nav" || classes.includes("fixed");

  // Parse gathered stylesheet + inline style declarations
  declarations.forEach((val, key) => {
    if (key === "display") {
      const cleanVal = val.trim().toLowerCase();
      if (cleanVal === "flex") {
        isFlex = true;
      } else if (cleanVal === "grid") {
        isGrid = true;
      }
    }
    if (key === "flex-direction") {
      const cleanVal = val.trim().toLowerCase();
      if (cleanVal === "row" || cleanVal === "row-reverse") {
        flexDirection = "row";
      } else if (cleanVal === "column" || cleanVal === "column-reverse") {
        flexDirection = "column";
      }
    }
    if (key === "grid-template-columns") {
      const cleanVal = val.trim().toLowerCase();
      isGrid = true;
      const repeatMatch = cleanVal.match(/repeat\(\s*(\d+)\s*,/i);
      if (repeatMatch) {
        gridCols = parseInt(repeatMatch[1]);
      } else {
        const parts = cleanVal.split(/\s+/).filter(p => p !== "");
        if (parts.length > 0) {
          gridCols = parts.length;
        }
      }
    }
    if (key === "justify-content") {
      const cleanVal = val.trim().toLowerCase();
      if (cleanVal === "center") justifyContent = "center";
      else if (cleanVal === "flex-end" || cleanVal === "end") justifyContent = "end";
      else if (cleanVal === "space-between" || cleanVal === "between") justifyContent = "between";
      else if (cleanVal === "space-around" || cleanVal === "around") justifyContent = "around";
      else if (cleanVal === "flex-start" || cleanVal === "start") justifyContent = "start";
    }
    if (key === "align-items") {
      const cleanVal = val.trim().toLowerCase();
      if (cleanVal === "center") alignItems = "center";
      else if (cleanVal === "flex-start" || cleanVal === "start") alignItems = "start";
      else if (cleanVal === "flex-end" || cleanVal === "end") alignItems = "end";
      else if (cleanVal === "stretch") alignItems = "stretch";
    }
    if (key === "flex" || key === "flex-grow") {
      if (val === "1" || val.includes("1") || val === "grow") {
        hasFlex1 = true;
      }
    }
    if (key === "position") {
      if (val === "fixed") _hasFixedClass = true;
      else if (val === "absolute") isAbsolute = true;
    }
    if (key === "bottom") {
      if (val === "0" || val === "0px" || val === "0.0") {
        _hasBottom0 = true;
      }
      if (!absolutePosition) absolutePosition = {};
      absolutePosition.bottom = resolveArbitraryValue(val, varMap);
      absolutePosition.bottomToken = getStyleTokenKey(val);
    }
    if (key === "top") {
      if (!absolutePosition) absolutePosition = {};
      absolutePosition.top = resolveArbitraryValue(val, varMap);
      absolutePosition.topToken = getStyleTokenKey(val);
    }
    if (key === "left") {
      if (!absolutePosition) absolutePosition = {};
      absolutePosition.left = resolveArbitraryValue(val, varMap);
      absolutePosition.leftToken = getStyleTokenKey(val);
    }
    if (key === "right") {
      if (!absolutePosition) absolutePosition = {};
      absolutePosition.right = resolveArbitraryValue(val, varMap);
      absolutePosition.rightToken = getStyleTokenKey(val);
    }
    if (key === "background" || key === "background-image" || key === "background-color") {
      const cleanVal = val.trim();
      if (cleanVal.includes("gradient")) {
        const isRepeating = cleanVal.toLowerCase().includes("repeating-");
        const functionName = isRepeating ? "repeating-linear-gradient" : "linear-gradient";
        const innerContent = extractParenthesesContent(cleanVal, functionName);
        if (innerContent) {
          const parts = splitByCommasIgnoringParentheses(innerContent);
          let direction = "b";
          let fromColor = "#FFFFFF";
          let toColor = "#FFFFFF";
          
          const firstPart = parts[0].trim();
          let colorStartIndex = 1;
          if (firstPart.includes("deg") || firstPart.includes("to ")) {
            if (firstPart.includes("45deg") || firstPart.includes("to top right") || firstPart.includes("to right top")) {
              direction = "tr";
            } else if (firstPart.includes("90deg") || firstPart.includes("to right")) {
              direction = "r";
            } else if (firstPart.includes("135deg") || firstPart.includes("to bottom right") || firstPart.includes("to right bottom")) {
              direction = "br";
            } else if (firstPart.includes("180deg") || firstPart.includes("to bottom")) {
              direction = "b";
            } else if (firstPart.includes("225deg") || firstPart.includes("to bottom left") || Math.abs(parseFloat(firstPart) - 225) < 5 || firstPart.includes("to left bottom")) {
              direction = "bl";
            } else if (firstPart.includes("270deg") || firstPart.includes("to left")) {
              direction = "l";
            } else if (firstPart.includes("315deg") || firstPart.includes("to top left") || firstPart.includes("to left top")) {
              direction = "tl";
            } else if (firstPart.includes("0deg") || firstPart.includes("to top")) {
              direction = "t";
            }
          } else {
            colorStartIndex = 0;
          }
          
          const colorsList: string[] = [];
          for (let j = colorStartIndex; j < parts.length; j++) {
            const part = parts[j].trim();
            const colMatch = part.match(/(#[0-9a-fA-F]{3,8}|rgba?\(.*?\)|var\([^)]+\)|transparent)/i);
            if (colMatch) {
              colorsList.push(colMatch[1]);
            }
          }
          
          if (colorsList.length >= 2) {
            fromColor = resolveColorToStandard(colorsList[0], varMap);
            toColor = resolveColorToStandard(colorsList[colorsList.length - 1], varMap);
            gradient = { direction, fromColor, toColor, isRepeating };
          }
        }
      } else if (cleanVal.startsWith("#")) {
        backgroundColor = cleanVal;
      } else if (cleanVal.startsWith("var(")) {
        backgroundColor = resolveColorToStandard(cleanVal, varMap);
        backgroundColorToken = getStyleTokenKey(cleanVal);
      } else if (cleanVal.startsWith("rgba") || cleanVal.startsWith("rgb") || cleanVal.startsWith("color-mix")) {
        backgroundColor = resolveColorToStandard(cleanVal, varMap);
      } else {
        backgroundColor = cleanVal;
      }
    }
    if (key === "color") {
      explicitTextColor = true;
      if (val.startsWith("#")) textColor = val;
      else if (val.startsWith("var(")) {
        textColor = resolveColorToStandard(val, varMap);
        textColorToken = getStyleTokenKey(val);
      } else if (val.startsWith("rgba") || val.startsWith("rgb") || val.startsWith("color-mix")) {
        textColor = resolveColorToStandard(val, varMap);
      } else {
        textColor = val;
      }
    }
    if (key === "font-size") {
      const parsedSize = parsePixel(val.endsWith("px") ? val : resolveCssVariable(val, varMap));
      if (parsedSize > 0) {
        fontSize = parsedSize;
      }
    }
    if (key === "font-weight") {
      fontWeight = parseFontWeight(val, varMap);
    }
    if (key === "text-align") {
      const cleanVal = val.trim().toLowerCase();
      if (cleanVal === "center") textAlign = "center";
      else if (cleanVal === "right") textAlign = "right";
      else if (cleanVal === "left") textAlign = "left";
    }
    if (key === "border-radius") {
      borderRadius = parsePixel(val.endsWith("px") ? val : resolveCssVariable(val, varMap));
      if (val.startsWith("var(")) {
        borderRadiusToken = getStyleTokenKey(val);
      }
    }
    if (key === "padding") {
      const parts = val.split(/\s+/).map(p => parsePixel(p));
      if (parts.length === 1) {
        padding.top = padding.right = padding.bottom = padding.left = parts[0];
      } else if (parts.length === 2) {
        padding.top = padding.bottom = parts[0];
        padding.left = padding.right = parts[1];
      } else if (parts.length === 4) {
        padding.top = parts[0];
        padding.right = parts[1];
        padding.bottom = parts[2];
        padding.left = parts[3];
      }
    }
    if (key === "padding-left") padding.left = parsePixel(val);
    if (key === "padding-right") padding.right = parsePixel(val);
    if (key === "padding-top") padding.top = parsePixel(val);
    if (key === "padding-bottom") padding.bottom = parsePixel(val);

    if (key === "margin") {
      const parts = val.split(/\s+/).map(p => parsePixel(p));
      if (parts.length === 1) {
        margin.top = margin.right = margin.bottom = margin.left = parts[0];
      } else if (parts.length === 2) {
        margin.top = margin.bottom = parts[0];
        margin.left = margin.right = parts[1];
      } else if (parts.length === 4) {
        margin.top = parts[0];
        margin.right = parts[1];
        margin.bottom = parts[2];
        margin.left = parts[3];
      }
    }
    if (key === "margin-left") margin.left = parsePixel(val);
    if (key === "margin-right") margin.right = parsePixel(val);
    if (key === "margin-top") margin.top = parsePixel(val);
    if (key === "margin-bottom") margin.bottom = parsePixel(val);

    if (key === "gap") {
      gap = parsePixel(val);
      if (val.startsWith("var(")) {
        gapToken = getStyleTokenKey(val);
      }
    }
    if (key === "border") {
      const borderMatch = val.match(/(\d+)px/);
      if (borderMatch) borderWidth = parseFloat(borderMatch[1]);
      const colorMatch = val.match(/(#[0-9a-fA-F]{3,8}|rgba?\(.*?\)|var\([^)]+\))/);
      if (colorMatch) {
        if (colorMatch[1].startsWith("var(")) {
          borderColor = resolveColorToStandard(colorMatch[1], varMap);
          borderColorToken = getStyleTokenKey(colorMatch[1]);
        } else {
          borderColor = resolveColorToStandard(colorMatch[1], varMap);
        }
      }
    }
    if (key === "border-width") {
      borderWidth = parsePixel(val);
    }
    if (key === "border-color") {
      borderColor = resolveColorToStandard(val, varMap);
      if (val.startsWith("var(")) {
        borderColorToken = getStyleTokenKey(val);
      }
    }
    if (key === "width") {
      const cleanVal = val.trim();
      if (cleanVal === "100%" || cleanVal === "auto" || cleanVal === "fit-content") {
        width = cleanVal;
      } else {
        width = resolveArbitraryValue(cleanVal, varMap) || cleanVal;
      }
    }
    if (key === "height") {
      const cleanVal = val.trim();
      if (cleanVal === "100%" || cleanVal === "auto" || cleanVal === "fit-content") {
        height = cleanVal;
      } else {
        height = resolveArbitraryValue(cleanVal, varMap) || cleanVal;
      }
    }
    if (key === "min-height") {
      const cleanVal = val.trim();
      if (cleanVal.endsWith("%")) {
        minHeight = cleanVal;
      } else {
        minHeight = resolveArbitraryValue(cleanVal, varMap);
      }
    }
    if (key === "backdrop-filter" || key === "-webkit-backdrop-filter") {
      const blurMatch = val.match(/blur\(([\d\.]+)(?:px)?\)/i);
      if (blurMatch) {
        backdropFilterBlur = parseFloat(blurMatch[1]);
      }
    }
    if (key === "filter") {
      const hueMatch = val.match(/hue-rotate\(([-\d\.]+)deg\)/i);
      if (hueMatch) {
        if (!filter) filter = {};
        filter.hueRotate = parseFloat(hueMatch[1]);
      }
      const brightnessMatch = val.match(/brightness\(([\d\.]+)%?\)/i);
      if (brightnessMatch) {
        if (!filter) filter = {};
        const rawVal = parseFloat(brightnessMatch[1]);
        filter.brightness = val.includes("%") || rawVal > 10 ? rawVal / 100 : rawVal;
      }
      const saturateMatch = val.match(/saturate\(([\d\.]+)%?\)/i);
      if (saturateMatch) {
        if (!filter) filter = {};
        const rawVal = parseFloat(saturateMatch[1]);
        filter.saturate = val.includes("%") || rawVal > 10 ? rawVal / 100 : rawVal;
      }
      const contrastMatch = val.match(/contrast\(([\d\.]+)%?\)/i);
      if (contrastMatch) {
        if (!filter) filter = {};
        const rawVal = parseFloat(contrastMatch[1]);
        filter.contrast = val.includes("%") || rawVal > 10 ? rawVal / 100 : rawVal;
      }
      const blurMatch = val.match(/blur\(([\d\.]+)(?:px)?\)/i);
      if (blurMatch) {
        if (!filter) filter = {};
        filter.blur = parseFloat(blurMatch[1]);
      }
    }
  });

  if (isAbsolute) {
    const hasZIndex0OrNeg = classes.some(c => c === "z-0" || c === "z-[-1]" || c.startsWith("z-[-"));
    const hasInset0 = classes.includes("inset-0");
    const isImg = element.tagName === "IMG";
    if (hasZIndex0OrNeg || hasInset0 || isImg) {
      isBackgroundAbsolute = true;
    }
  }

  // Post-declarations validation: If display is flex or grid, and no column direction is explicitly set
  // either by Tailwind classes or CSS declarations, default to row layout.
  const hasExplicitCol = classes.includes("flex-col") || 
                         (declarations.get("flex-direction")?.trim().toLowerCase().includes("column") ?? false);
  if ((isFlex || isGrid) && !hasExplicitCol) {
    flexDirection = "row";
  }

  return {
    isFlex,
    isBackgroundAbsolute,
    flexDirection,
    alignItems,
    justifyContent,
    gap,
    padding,
    margin,
    width,
    height,
    backgroundColor,
    textColor,
    borderRadius,
    borderWidth,
    borderColor,
    fontSize,
    fontWeight,
    textAlign,
    shadow,
    isGrid,
    gridCols,
    isFixedBottom,
    opacity,
    minHeight,
    gradient,
    isRawSvg: false, // Set externally in buildTranspileTree for SVG nodes
    hasFlex1,
    isAbsolute,
    absolutePosition,
    backgroundColorToken,
    textColorToken,
    borderColorToken,
    borderRadiusToken,
    gapToken,
    paddingLeftToken,
    paddingRightToken,
    paddingTopToken,
    paddingBottomToken,
    marginLeftToken,
    marginRightToken,
    marginTopToken,
    marginBottomToken,
    explicitTextColor,
    backdropFilterBlur,
    filter,
  };
}

function getIconNameFromSvg(htmlElement: HTMLElement): string {
  // 1. Try attributes
  const attr = htmlElement.getAttribute("data-lucide") || htmlElement.getAttribute("data-drawgle-icon");
  if (attr) return attr;

  // 2. Try class name lucide-*
  const classList = Array.from(htmlElement.classList);
  for (const c of classList) {
    if (c.startsWith("lucide-")) {
      return c.replace("lucide-", "");
    }
  }

  // 3. Inference based on parent button attributes / texts
  const parent = htmlElement.parentElement;
  if (parent) {
    const ariaLabel = parent.getAttribute("aria-label")?.toLowerCase() || "";
    if (ariaLabel.includes("back") || ariaLabel.includes("prev")) return "arrow-left";
    if (ariaLabel.includes("next") || ariaLabel.includes("forward")) return "arrow-right";
    if (ariaLabel.includes("filter")) return "filter";
    if (ariaLabel.includes("document") || ariaLabel.includes("report")) return "file-text";
    if (ariaLabel.includes("search")) return "search";
    if (ariaLabel.includes("settings")) return "settings";
    if (ariaLabel.includes("menu")) return "menu";
    if (ariaLabel.includes("close") || ariaLabel.includes("dismiss")) return "x";
    if (ariaLabel.includes("add") || ariaLabel.includes("create") || ariaLabel.includes("new")) return "plus";
    if (ariaLabel.includes("delete") || ariaLabel.includes("trash") || ariaLabel.includes("remove")) return "trash";
    if (ariaLabel.includes("heart") || ariaLabel.includes("like")) return "heart";
    if (ariaLabel.includes("share")) return "share";
    if (ariaLabel.includes("chevron-right") || ariaLabel.includes("expand")) return "chevron-right";
    if (ariaLabel.includes("chevron-left")) return "chevron-left";
  }

  // 4. Fallback based on visual dimensions or tag name
  return "star";
}

// Recursively builds the TranspileNode tree starting from an element
export function buildTranspileTree(element: Element, varMap: Map<string, string>, cssRules?: CssRule[]): TranspileNode | null {
  if (element.nodeType !== 1) return null; // Element node only
  const htmlElement = element as HTMLElement;
  const tagName = htmlElement.tagName.toLowerCase();

  // Exclude stylesheets and script blocks from the native visual layout
  if (tagName === "style" || tagName === "script") {
    return null;
  }

  // If it's an SVG, treat it as a leaf icon node to prevent nested layout garbage
  if (tagName === "svg") {
    const attributes: Record<string, string> = {};
    Array.from(htmlElement.attributes).forEach(attr => {
      attributes[attr.name] = attr.value;
    });

    // Only keep icon name if there's a real data-lucide/data-drawgle-icon attribute
    const existingIcon = htmlElement.getAttribute("data-lucide") || htmlElement.getAttribute("data-drawgle-icon");
    if (existingIcon) {
      attributes["data-lucide"] = existingIcon;
    }
    // If no icon attribute exists, this is a raw/inline SVG — don't hallucinate an icon

    const styles = parseStyles(htmlElement, varMap, cssRules);

    // Mark raw SVGs (those without icon mappings) so transpilers emit placeholders
    if (!existingIcon) {
      styles.isRawSvg = true;
    }

    // Crawl child circle elements if any
    const children: TranspileNode[] = [];
    if (typeof htmlElement.getElementsByTagName === "function") {
      const circles = htmlElement.getElementsByTagName("circle");
      for (let i = 0; i < circles.length; i++) {
        const circleNode = circles[i];
        const circleStyles = parseStyles(circleNode as unknown as HTMLElement, varMap, cssRules);
        const circleAttrs: Record<string, string> = {};
        Array.from(circleNode.attributes).forEach(attr => {
          circleAttrs[attr.name] = attr.value;
        });
        children.push({
          tagName: "circle",
          classes: Array.from(circleNode.classList),
          id: circleNode.id || "",
          styleText: circleNode.getAttribute("style") || "",
          styles: circleStyles,
          attributes: circleAttrs,
          children: []
        });
      }
    }

    return {
      tagName: "svg",
      classes: Array.from(htmlElement.classList),
      id: htmlElement.id || "",
      styleText: htmlElement.getAttribute("style") || "",
      styles,
      attributes,
      children,
    };
  }

  // Read data-lucide icons
  const lucideIcon = htmlElement.getAttribute("data-lucide") || htmlElement.getAttribute("data-drawgle-icon");
  const attributes: Record<string, string> = {};
  Array.from(htmlElement.attributes).forEach(attr => {
    attributes[attr.name] = attr.value;
  });

  const children: (TranspileNode | string)[] = [];
  Array.from(htmlElement.childNodes).forEach(child => {
    if (child.nodeType === 3) {
      const text = child.textContent?.trim();
      if (text) children.push(text);
    } else if (child.nodeType === 1) {
      const parsedChild = buildTranspileTree(child as Element, varMap, cssRules);
      if (parsedChild) children.push(parsedChild);
    }
  });

  // Prune empty structural containers that produce dead widgets like Column(children: [])
  const prunedChildren = children.filter(child => {
    if (typeof child === 'string') return true;
    const c = child as TranspileNode;
    // Keep nodes that have children, icons, images, or visual styling
    if (c.children.length > 0) return true;
    if (c.attributes['data-lucide'] || c.attributes['data-drawgle-icon']) return true;
    if (c.attributes['src']) return true;
    if (c.tagName === 'img' || c.tagName === 'input' || c.tagName === 'textarea') return true;
    if (c.styles.backgroundColor !== 'transparent') return true;
    if (c.styles.borderWidth > 0) return true;
    // Empty div/span with no visual content — prune it
    if (c.tagName === 'div' || c.tagName === 'span') return false;
    return true;
  });

  const node: TranspileNode = {
    tagName: htmlElement.tagName.toLowerCase(),
    classes: Array.from(htmlElement.classList),
    id: htmlElement.id || "",
    styleText: htmlElement.getAttribute("style") || "",
    styles: parseStyles(htmlElement, varMap, cssRules),
    attributes,
    children: prunedChildren,
  };

  return node;
}

// Resolves screen text content inside a clean tree
export function parseScreenHtml(htmlString: string, designTokens?: DesignTokens | null): TranspileNode | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  
  // Find first real layout container
  const root = doc.body.firstElementChild || doc.body;

  // Flatten active design tokens into CSS variables map
  const variables = flattenDesignTokensToCssVariables(designTokens);
  const varMap = new Map<string, string>();
  variables.forEach(v => {
    varMap.set(v.name, v.value);
  });

  // Extract variables from style tags
  const styleTags = doc.getElementsByTagName("style");
  for (let i = 0; i < styleTags.length; i++) {
    const text = styleTags[i].textContent || "";
    const varMatches = text.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g);
    for (const match of varMatches) {
      varMap.set(match[1].trim(), match[2].trim());
    }
  }

  const cssRules = parseCssStylesheet(doc);

  const tree = buildTranspileTree(root, varMap, cssRules);
  if (tree) {
    cascadeInheritedStyles(tree);
    postProcessAST(tree);
  }
  return tree;
}

// ---------------------------------------------------------------------------
// FIXED-BOTTOM NODE EXTRACTION
// ---------------------------------------------------------------------------
// Pre-processes the AST to separate fixed-bottom nodes (e.g., bottom navigation)
// from the main scrollable content tree. Returns the cleaned main tree and
// an array of extracted fixed-bottom nodes.

export function extractFixedBottomNodes(root: TranspileNode): {
  mainTree: TranspileNode;
  fixedBottomNodes: TranspileNode[];
} {
  const fixedBottomNodes: TranspileNode[] = [];

  function filterChildren(node: TranspileNode): TranspileNode {
    const filteredChildren: (TranspileNode | string)[] = [];
    for (const child of node.children) {
      if (typeof child === 'string') {
        filteredChildren.push(child);
        continue;
      }
      if (child.styles.isFixedBottom) {
        fixedBottomNodes.push(child);
        continue; // Remove from main tree
      }
      // Recursively filter children
      filteredChildren.push(filterChildren(child));
    }
    return { ...node, children: filteredChildren };
  }

  const mainTree = filterChildren(root);
  return { mainTree, fixedBottomNodes };
}

// ---------------------------------------------------------------------------
// GRADIENT DIRECTION MAPPING HELPERS
// ---------------------------------------------------------------------------

function gradientDirectionToSwift(direction: string): { start: string; end: string } {
  const map: Record<string, { start: string; end: string }> = {
    'r':  { start: '.leading', end: '.trailing' },
    'l':  { start: '.trailing', end: '.leading' },
    'b':  { start: '.top', end: '.bottom' },
    't':  { start: '.bottom', end: '.top' },
    'br': { start: '.topLeading', end: '.bottomTrailing' },
    'bl': { start: '.topTrailing', end: '.bottomLeading' },
    'tr': { start: '.bottomLeading', end: '.topTrailing' },
    'tl': { start: '.bottomTrailing', end: '.topLeading' },
  };
  return map[direction] || { start: '.topLeading', end: '.bottomTrailing' };
}

function gradientDirectionToCompose(direction: string): { start: string; end: string } {
  const map: Record<string, { start: string; end: string }> = {
    'r':  { start: 'Offset(0f, 0.5f)', end: 'Offset(1f, 0.5f)' },
    'l':  { start: 'Offset(1f, 0.5f)', end: 'Offset(0f, 0.5f)' },
    'b':  { start: 'Offset(0.5f, 0f)', end: 'Offset(0.5f, 1f)' },
    't':  { start: 'Offset(0.5f, 1f)', end: 'Offset(0.5f, 0f)' },
    'br': { start: 'Offset(0f, 0f)', end: 'Offset(1f, 1f)' },
    'bl': { start: 'Offset(1f, 0f)', end: 'Offset(0f, 1f)' },
    'tr': { start: 'Offset(0f, 1f)', end: 'Offset(1f, 0f)' },
    'tl': { start: 'Offset(1f, 1f)', end: 'Offset(0f, 0f)' },
  };
  return map[direction] || { start: 'Offset(0f, 0f)', end: 'Offset(1f, 1f)' };
}

function gradientDirectionToFlutter(direction: string): { begin: string; end: string } {
  const map: Record<string, { begin: string; end: string }> = {
    'r':  { begin: 'Alignment.centerLeft', end: 'Alignment.centerRight' },
    'l':  { begin: 'Alignment.centerRight', end: 'Alignment.centerLeft' },
    'b':  { begin: 'Alignment.topCenter', end: 'Alignment.bottomCenter' },
    't':  { begin: 'Alignment.bottomCenter', end: 'Alignment.topCenter' },
    'br': { begin: 'Alignment.topLeft', end: 'Alignment.bottomRight' },
    'bl': { begin: 'Alignment.topRight', end: 'Alignment.bottomLeft' },
    'tr': { begin: 'Alignment.bottomLeft', end: 'Alignment.topRight' },
    'tl': { begin: 'Alignment.bottomRight', end: 'Alignment.topLeft' },
  };
  return map[direction] || { begin: 'Alignment.topLeft', end: 'Alignment.bottomRight' };
}

function isRedundantWrapper(node: TranspileNode): boolean {
  if (node.children.length !== 1) return false;
  const child = node.children[0];
  if (typeof child === "string") return false;
  
  const { styles } = node;
  const hasStyling = 
    (styles.backgroundColorToken || styles.backgroundColor !== "transparent") ||
    (styles.borderRadiusToken || styles.borderRadius > 0) ||
    (styles.borderColorToken || styles.borderWidth > 0) ||
    (styles.paddingTopToken || styles.padding.top > 0 || styles.padding.bottom > 0 || styles.padding.left > 0 || styles.padding.right > 0) ||
    (styles.marginTopToken || styles.margin.top > 0 || styles.margin.bottom > 0 || styles.margin.left > 0 || styles.margin.right > 0) ||
    (typeof styles.width === "number" || typeof styles.height === "number" || styles.width === "100%" || styles.hasFlex1 || styles.minHeight !== "auto") ||
    styles.isAbsolute || styles.isFixedBottom || styles.isGrid || styles.gradient;
    
  return !hasStyling;
}

// ---------------------------------------------------------------------------
// TO-HEX CONVERTOR HELPER FOR NATIVE DEFS
// ---------------------------------------------------------------------------
function cleanHexColor(hex: string | undefined): string {
  if (!hex || hex === "transparent") return "FFFFFF"; // fallback without '#'
  if (hex.startsWith("var(--") || hex.includes("var(")) {
    if (hex.includes("border")) return "E5E7EB";
    if (hex.includes("background") || hex.includes("surface")) return "FFFFFF";
    if (hex.includes("text")) return "111827";
    if (hex.includes("action")) return "3B82F6";
    return "FFFFFF";
  }
  if (hex.startsWith("#")) {
    let clean = hex.substring(1);
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    return clean.toUpperCase();
  }
  return "FFFFFF";
}

// Helper to format clean spacing values
const formatSize = (size: string | number): string => {
  if (typeof size === "number") return `${size}`;
  if (size === "100%") return "full";
  return "auto";
};

// Helper to generate a shared list of Design Token constants at the top
export function generateTokenHeaderComment(designTokens?: DesignTokens | null): { swift: string; compose: string; rn: string; flutter: string } {
  const variables = flattenDesignTokensToCssVariables(designTokens);
  const map = new Map<string, string>();
  variables.forEach(v => {
    map.set(v.name, v.value);
  });

  const colors = {
    bgPrimary: map.get("--dg-color-background-primary") || "#FFFFFF",
    bgSecondary: map.get("--dg-color-background-secondary") || "#F3F4F6",
    surfaceCard: map.get("--dg-color-surface-card") || "#FFFFFF",
    actionPrimary: map.get("--dg-color-action-primary") || "#3B82F6",
    actionOnPrimary: map.get("--dg-color-action-on-primary-text") || "#FFFFFF",
    textHigh: map.get("--dg-color-text-high-emphasis") || "#111827",
    textMedium: map.get("--dg-color-text-medium-emphasis") || "#4B5563",
    textLow: map.get("--dg-color-text-low-emphasis") || "#9CA3AF",
    borderDivider: map.get("--dg-color-border-divider") || "#E5E7EB",
  };

  const radii = {
    app: map.get("--dg-radii-app") || "18px",
    pill: map.get("--dg-radii-pill") || "9999px",
  };

  const layout = {
    screenPadding: map.get("--dg-mobile-layout-screen-margin") || "24px",
    sectionGap: map.get("--dg-mobile-layout-section-gap") || "24px",
    elementGap: map.get("--dg-mobile-layout-element-gap") || "16px",
  };

  return {
    swift: `//\n//  DesignTokens.swift\n//  Drawgle Auto-generated\n//\n\nimport SwiftUI\n\nstruct AppTheme {\n    static let backgroundPrimary = Color(hex: "${colors.bgPrimary}")\n    static let backgroundSecondary = Color(hex: "${colors.bgSecondary}")\n    static let surfaceCard = Color(hex: "${colors.surfaceCard}")\n    static let actionPrimary = Color(hex: "${colors.actionPrimary}")\n    static let actionOnPrimary = Color(hex: "${colors.actionOnPrimary}")\n    static let textHigh = Color(hex: "${colors.textHigh}")\n    static let textMedium = Color(hex: "${colors.textMedium}")\n    static let textLow = Color(hex: "${colors.textLow}")\n    static let borderDivider = Color(hex: "${colors.borderDivider}")\n    \n    static let borderRadiusApp: CGFloat = ${parseFloat(radii.app)}\n    static let borderRadiusPill: CGFloat = 9999.0\n    \n    static let screenPadding: CGFloat = ${parseFloat(layout.screenPadding)}\n    static let sectionGap: CGFloat = ${parseFloat(layout.sectionGap)}\n    static let elementGap: CGFloat = ${parseFloat(layout.elementGap)}\n}\n\nextension Color {\n    init(hex: String) {\n        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)\n        var int: UInt64 = 0\n        Scanner(string: hex).scanHexInt64(&int)\n        let a, r, g, b: UInt64\n        switch hex.count {\n        case 3: // RGB (12-bit)\n            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)\n        case 6: // RGB (24-bit)\n            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)\n        case 8: // ARGB (32-bit)\n            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)\n        default:\n            (a, r, g, b) = (255, 0, 0, 0)\n        }\n        self.init(\n            .sRGB,\n            red: Double(r) / 255,\n            green: Double(g) / 255,\n            blue:  Double(b) / 255,\n            opacity: Double(a) / 255\n        )\n    }\n}\n`,

    compose: `/*\n * AppTheme.kt\n * Drawgle Auto-generated\n */\n\npackage com.drawgle.theme\n\nimport androidx.compose.ui.graphics.Color\nimport androidx.compose.ui.unit.dp\n\nobject AppTheme {\n    val BackgroundPrimary = Color(0xFF${cleanHexColor(colors.bgPrimary)})\n    val BackgroundSecondary = Color(0xFF${cleanHexColor(colors.bgSecondary)})\n    val SurfaceCard = Color(0xFF${cleanHexColor(colors.surfaceCard)})\n    val ActionPrimary = Color(0xFF${cleanHexColor(colors.actionPrimary)})\n    val ActionOnPrimary = Color(0xFF${cleanHexColor(colors.actionOnPrimary)})\n    val TextHigh = Color(0xFF${cleanHexColor(colors.textHigh)})\n    val TextMedium = Color(0xFF${cleanHexColor(colors.textMedium)})\n    val TextLow = Color(0xFF${cleanHexColor(colors.textLow)})\n    val BorderDivider = Color(0xFF${cleanHexColor(colors.borderDivider)})\n    \n    val BorderRadiusApp = ${parseFloat(radii.app)}.dp\n    val BorderRadiusPill = 9999.dp\n    \n    val ScreenPadding = ${parseFloat(layout.screenPadding)}.dp\n    val SectionGap = ${parseFloat(layout.sectionGap)}.dp\n    val ElementGap = ${parseFloat(layout.elementGap)}.dp\n}\n`,

    rn: `//\n// AppTheme.js\n// Drawgle Auto-generated\n//\n\nexport const AppTheme = {\n  colors: {\n    backgroundPrimary: '${colors.bgPrimary}',\n    backgroundSecondary: '${colors.bgSecondary}',\n    surfaceCard: '${colors.surfaceCard}',\n    actionPrimary: '${colors.actionPrimary}',\n    actionOnPrimary: '${colors.actionOnPrimary}',\n    textHigh: '${colors.textHigh}',\n    textMedium: '${colors.textMedium}',\n    textLow: '${colors.textLow}',\n    borderDivider: '${colors.borderDivider}',\n  },\n  radii: {\n    app: ${parseFloat(radii.app)},\n    pill: 9999,\n  },\n  layout: {\n    screenPadding: ${parseFloat(layout.screenPadding)},\n    sectionGap: ${parseFloat(layout.sectionGap)},\n    elementGap: ${parseFloat(layout.elementGap)},\n  }\n};\n`,

    flutter: `//\n// app_theme.dart\n// Drawgle Auto-generated\n//\n\nimport 'package:flutter/material.dart';\n\nclass AppTheme {\n  static const Color backgroundPrimary = Color(0xFF${cleanHexColor(colors.bgPrimary)});\n  static const Color backgroundSecondary = Color(0xFF${cleanHexColor(colors.bgSecondary)});\n  static const Color surfaceCard = Color(0xFF${cleanHexColor(colors.surfaceCard)});\n  static const Color actionPrimary = Color(0xFF${cleanHexColor(colors.actionPrimary)});\n  static const Color actionOnPrimary = Color(0xFF${cleanHexColor(colors.actionOnPrimary)});\n  static const Color textHigh = Color(0xFF${cleanHexColor(colors.textHigh)});\n  static const Color textMedium = Color(0xFF${cleanHexColor(colors.textMedium)});\n  static const Color textLow = Color(0xFF${cleanHexColor(colors.textLow)});\n  static const Color borderDivider = Color(0xFF${cleanHexColor(colors.borderDivider)});\n  \n  static const double borderRadiusApp = ${parseFloat(radii.app)};\n  static const double borderRadiusPill = 9999.0;\n  \n  static const double screenPadding = ${parseFloat(layout.screenPadding)};\n  static const double sectionGap = ${parseFloat(layout.sectionGap)};\n  static const double elementGap = ${parseFloat(layout.elementGap)};\n}\n`
  };
}

// ---------------------------------------------------------------------------
// SWIFTUI TRANSPILER
// ---------------------------------------------------------------------------
function isColorDark(hex: string): boolean {
  const clean = cleanHexColor(hex);
  if (clean.length !== 6) return false;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  return brightness < 130;
}

function getCssVarNameFromToken(token: string): string | undefined {
  switch (token) {
    case "bgPrimary": return "--dg-color-background-primary";
    case "bgSecondary": return "--dg-color-background-secondary";
    case "surfaceCard": return "--dg-color-surface-card";
    case "actionPrimary": return "--dg-color-action-primary";
    case "actionOnPrimary": return "--dg-color-action-on-primary-text";
    case "textHigh": return "--dg-color-text-high-emphasis";
    case "textMedium": return "--dg-color-text-medium-emphasis";
    case "textLow": return "--dg-color-text-low-emphasis";
    case "borderDivider": return "--dg-color-border-divider";
    default: return undefined;
  }
}

export function cascadeInheritedStyles(
  node: TranspileNode,
  inheritedTextColor?: string,
  inheritedTextColorToken?: string,
  inheritedFontSize?: number,
  inheritedFontWeight?: "normal" | "medium" | "semibold" | "bold" | "heavy",
  inheritedTextAlign?: "left" | "center" | "right"
): void {
  // 1. Inherit Text Color
  if (node.styles.textColor === undefined && node.styles.textColorToken === undefined) {
    if (inheritedTextColor !== undefined || inheritedTextColorToken !== undefined) {
      node.styles.textColor = inheritedTextColor;
      node.styles.textColorToken = inheritedTextColorToken;
    }
  }

  // 2. Inherit Font Size
  if (node.styles.fontSize === undefined && inheritedFontSize !== undefined) {
    node.styles.fontSize = inheritedFontSize;
  }

  // 3. Inherit Font Weight
  if (node.styles.fontWeight === undefined && inheritedFontWeight !== undefined) {
    node.styles.fontWeight = inheritedFontWeight;
  }

  // 4. Inherit Text Align
  if (node.styles.textAlign === undefined && inheritedTextAlign !== undefined) {
    node.styles.textAlign = inheritedTextAlign;
  }

  // Resolve current effective values to cascade down
  const currentTextColor = node.styles.textColor ?? inheritedTextColor;
  const currentTextColorToken = node.styles.textColorToken ?? inheritedTextColorToken;
  const currentFontSize = node.styles.fontSize ?? inheritedFontSize;
  const currentFontWeight = node.styles.fontWeight ?? inheritedFontWeight;
  const currentTextAlign = node.styles.textAlign ?? inheritedTextAlign;

  node.children.forEach(child => {
    if (typeof child !== "string") {
      cascadeInheritedStyles(
        child,
        currentTextColor,
        currentTextColorToken,
        currentFontSize,
        currentFontWeight,
        currentTextAlign
      );
    }
  });
}

export function postProcessAST(
  node: TranspileNode,
  parentIsGrid: boolean = false
): void {
  if (parentIsGrid) {
    node.styles.hasFlex1 = true;
    node.styles.width = "100%";
  }

  const isGrid = node.styles.isGrid && node.styles.gridCols > 0;
  node.children.forEach(child => {
    if (typeof child !== "string") {
      postProcessAST(child, isGrid);
    }
  });
}

function generateSwiftUIFilters(styles: ParsedStyles, indent: string): string {
  let out = "";
  if (styles.filter) {
    const { hueRotate, brightness, saturate, contrast, blur } = styles.filter;
    if (hueRotate !== undefined) {
      out += `${indent}.hueRotation(.degrees(${hueRotate}))\n`;
    }
    if (brightness !== undefined) {
      out += `${indent}.brightness(${brightness - 1.0})\n`;
    }
    if (saturate !== undefined) {
      out += `${indent}.saturation(${saturate})\n`;
    }
    if (contrast !== undefined) {
      out += `${indent}.contrast(${contrast})\n`;
    }
    if (blur !== undefined) {
      out += `${indent}.blur(radius: ${blur})\n`;
    }
  }
  return out;
}

// Spacing/Color theme-aware helpers for Swift
function toSwiftThemeToken(token: string | undefined, fallbackVal: string): string {
  if (!token) return fallbackVal;
  if (token === "bgPrimary") return "AppTheme.backgroundPrimary";
  if (token === "bgSecondary") return "AppTheme.backgroundSecondary";
  return `AppTheme.${token}`;
}

export function transpileToSwiftUI(root: TranspileNode): string {
  let indentLevel = 1;
  const getIndent = () => "    ".repeat(indentLevel);

  function wrapFlexIfNeeded(node: TranspileNode, outCode: string, indent: string): string {
    if (node.styles.hasFlex1) {
      return outCode.trimEnd() + `\n${indent}.frame(maxWidth: .infinity)\n`;
    }
    return outCode;
  }

  function walk(node: TranspileNode | string, parentStyles?: ParsedStyles): string {
    if (typeof node === "string") {
      return `${getIndent()}Text("${node.replace(/"/g, '\\"')}")\n`;
    }

    if (typeof node !== "string" && isRedundantWrapper(node)) {
      return walk(node.children[0], parentStyles);
    }

    const { styles } = node;
    const isButton = node.tagName === "button" || node.tagName === "a";
    const isImage = node.tagName === "img";
    const lucide = node.attributes["data-lucide"] || node.attributes["data-drawgle-icon"];
    
    let out = "";
    
    // Lucide Icon — dynamic name conversion (works for ANY icon)
    if (lucide) {
      out += `${getIndent()}LucideView(icon: .${toSwiftCamelCase(lucide)}) // Lucide: ${lucide}\n`;
      out += `${getIndent()}    .frame(width: ${styles.fontSize || 20}, height: ${styles.fontSize || 20})\n`;
      
      const hasDiffColor = !parentStyles || 
                           parentStyles.textColor !== styles.textColor || 
                           parentStyles.textColorToken !== styles.textColorToken;
      if (styles.explicitTextColor && hasDiffColor) {
        if (styles.textColorToken) {
          out += `${getIndent()}    .foregroundColor(${toSwiftThemeToken(styles.textColorToken, "")})\n`;
        } else if (styles.textColor && styles.textColor !== "transparent") {
          out += `${getIndent()}    .foregroundColor(${toSwiftColor(styles.textColor)})\n`;
        }
      }
      out += generateSwiftUIFilters(styles, getIndent() + "    ");
      return wrapFlexIfNeeded(node, out, getIndent());
    }

    // Raw SVG placeholder — don't hallucinate SF Symbols for inline SVGs
    if (styles.isRawSvg) {
      const svgW = typeof styles.width === 'number' ? styles.width : 48;
      const svgH = typeof styles.height === 'number' ? styles.height : 48;
      
      const circleChildren = node.children.filter(c => typeof c !== "string" && c.tagName === "circle") as TranspileNode[];
      if (circleChildren.length > 0) {
        let rotationDeg = 0;
        const svgClasses = node.classes;
        if (svgClasses.includes("-rotate-90")) {
          rotationDeg = -90;
        } else if (svgClasses.includes("rotate-90")) {
          rotationDeg = 90;
        }
        
        let svgOut = `${getIndent()}ZStack {\n`;
        indentLevel++;
        circleChildren.forEach(circle => {
          const strokeWidth = parseFloat(circle.attributes["stroke-width"]) || 1;
          const strokeColorStr = circle.attributes["stroke"] || "black";
          const tokenKey = strokeColorStr.startsWith("var(") ? getStyleTokenKey(strokeColorStr) : undefined;
          const strokeColor = tokenKey 
            ? toSwiftThemeToken(tokenKey, "") 
            : toSwiftColor(resolveColorToStandard(strokeColorStr));
            
          const strokeLinecap = circle.attributes["stroke-linecap"] === "round" ? ".round" : ".butt";
          const dashArray = parseFloat(circle.attributes["stroke-dasharray"]) || 0;
          const dashOffset = parseFloat(circle.attributes["stroke-dashoffset"]) || 0;
          
          let trimCode = "";
          if (dashArray > 0 && dashOffset > 0) {
            const progress = 1.0 - (dashOffset / dashArray);
            const clampedProgress = Math.max(0, Math.min(1, progress));
            trimCode = `.trim(from: 0, to: ${clampedProgress.toFixed(2)})`;
          }
          
          svgOut += `${getIndent()}Circle()\n`;
          if (trimCode) {
            svgOut += `${getIndent()}    ${trimCode}\n`;
          }
          
          if (strokeLinecap === ".round") {
            svgOut += `${getIndent()}    .stroke(${strokeColor}, style: StrokeStyle(lineWidth: ${strokeWidth}, lineCap: .round))\n`;
          } else {
            svgOut += `${getIndent()}    .stroke(${strokeColor}, lineWidth: ${strokeWidth})\n`;
          }
          
          if (rotationDeg !== 0) {
            svgOut += `${getIndent()}    .rotationEffect(.degrees(${rotationDeg}))\n`;
          }
        });
        indentLevel--;
        svgOut += `${getIndent()}}\n`;
        svgOut += `${getIndent()}.frame(width: ${svgW}, height: ${svgH})\n`;
        return wrapFlexIfNeeded(node, svgOut, getIndent());
      }
      
      out += `${getIndent()}Color.clear.frame(width: ${svgW}, height: ${svgH}) // TODO: Add custom SVG/Asset here\n`;
      out += generateSwiftUIFilters(styles, getIndent());
      return wrapFlexIfNeeded(node, out, getIndent());
    }

    if (isImage) {
      const src = node.attributes["src"] || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809";
      out += `${getIndent()}AsyncImage(url: URL(string: "${src}")) { image in\n`;
      out += `${getIndent()}    image.resizable()\n`;
      out += `${getIndent()}        .aspectRatio(contentMode: .fill)\n`;
      out += `${getIndent()}} placeholder: {\n`;
      out += `${getIndent()}    Color.gray.opacity(0.1)\n`;
      out += `${getIndent()}}\n`;
      
      // Frame
      const w = styles.width;
      const h = styles.height;
      if (typeof w === "number" || typeof h === "number") {
        const wStr = typeof w === "number" ? `width: ${w}` : "";
        const hStr = typeof h === "number" ? `height: ${h}` : "";
        const comma = wStr && hStr ? ", " : "";
        out += `${getIndent()}.frame(${wStr}${comma}${hStr})\n`;
      }
      if (styles.borderRadiusToken) {
        out += `${getIndent()}.cornerRadius(${toSwiftThemeToken(styles.borderRadiusToken, "")})\n`;
      } else if (styles.borderRadius > 0) {
        out += `${getIndent()}.cornerRadius(${styles.borderRadius})\n`;
      }
      out += generateSwiftUIFilters(styles, getIndent());
      return wrapFlexIfNeeded(node, out, getIndent());
    }

    if (isButton) {
      out += `${getIndent()}Button(action: {\n`;
      out += `${getIndent()}    // Action here\n`;
      out += `${getIndent()}}) {\n`;
      indentLevel++;
      
      // Content wrapper inside SwiftUI button (HStack is standard)
      const btnGap = styles.gapToken ? toSwiftThemeToken(styles.gapToken, "") : String(styles.gap || 8);
      const stackCombo = styles.gapToken ? `spacing: ${btnGap}` : (styles.gap > 0 ? `spacing: ${styles.gap}` : "");
      out += `${getIndent()}HStack(${stackCombo}) {\n`;
      indentLevel++;
      node.children.forEach(c => {
        out += walk(c, styles);
      });
      indentLevel--;
      out += `${getIndent()}}\n`;
      
      // Style button
      const paddingY = styles.paddingTopToken ? toSwiftThemeToken(styles.paddingTopToken, "") : String(styles.padding.top || 12);
      const paddingX = styles.paddingLeftToken ? toSwiftThemeToken(styles.paddingLeftToken, "") : String(styles.padding.left || 16);
      out += `${getIndent()}.padding(.vertical, ${paddingY})\n`;
      out += `${getIndent()}.padding(.horizontal, ${paddingX})\n`;
      
      if (styles.backdropFilterBlur && styles.backdropFilterBlur > 0) {
        if (styles.backgroundColorToken) {
          out += `${getIndent()}.background(${toSwiftThemeToken(styles.backgroundColorToken, "")})\n`;
        } else if (styles.backgroundColor !== "transparent") {
          out += `${getIndent()}.background(${toSwiftColor(styles.backgroundColor)})\n`;
        }
        out += `${getIndent()}.background(.ultraThinMaterial)\n`;
      } else {
        if (styles.backgroundColorToken) {
          out += `${getIndent()}.background(${toSwiftThemeToken(styles.backgroundColorToken, "")})\n`;
        } else if (styles.backgroundColor !== "transparent") {
          out += `${getIndent()}.background(${toSwiftColor(styles.backgroundColor)})\n`;
        }
      }
      if (styles.borderRadiusToken) {
        out += `${getIndent()}.cornerRadius(${toSwiftThemeToken(styles.borderRadiusToken, "")})\n`;
      } else if (styles.borderRadius > 0) {
        out += `${getIndent()}.cornerRadius(${styles.borderRadius})\n`;
      }
      if (styles.textColorToken) {
        out += `${getIndent()}.foregroundColor(${toSwiftThemeToken(styles.textColorToken, "")})\n`;
      } else if (styles.textColor && styles.textColor !== "transparent") {
        out += `${getIndent()}.foregroundColor(${toSwiftColor(styles.textColor)})\n`;
      }
      out += generateSwiftUIFilters(styles, getIndent());
      indentLevel--;
      out += `${getIndent()}}\n`;
      return wrapFlexIfNeeded(node, out, getIndent());
    }

    // Text Leaf Node Optimization
    const isTextLeaf = ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6"].includes(node.tagName) && 
                       node.children.length === 1 && typeof node.children[0] === "string";
    
    if (isTextLeaf) {
      const textVal = node.children[0] as string;
      out += `${getIndent()}Text("${textVal.replace(/"/g, '\\"')}")\n`;
      if (styles.fontSize !== undefined) {
        out += `${getIndent()}    .font(.system(size: ${styles.fontSize}))\n`;
      }
      if (styles.fontWeight !== undefined) {
        if (styles.fontWeight === "heavy") {
          out += `${getIndent()}    .fontWeight(.heavy)\n`;
        } else if (styles.fontWeight === "bold") {
          out += `${getIndent()}    .fontWeight(.bold)\n`;
        } else if (styles.fontWeight === "semibold") {
          out += `${getIndent()}    .fontWeight(.semibold)\n`;
        } else if (styles.fontWeight === "medium") {
          out += `${getIndent()}    .fontWeight(.medium)\n`;
        } else if (styles.fontWeight === "normal") {
          out += `${getIndent()}    .fontWeight(.regular)\n`;
        }
      }
      
      const hasDiffColor = !parentStyles || 
                           parentStyles.textColor !== styles.textColor || 
                           parentStyles.textColorToken !== styles.textColorToken;
      if (styles.explicitTextColor && hasDiffColor) {
        if (styles.textColorToken) {
          out += `${getIndent()}    .foregroundColor(${toSwiftThemeToken(styles.textColorToken, "")})\n`;
        } else if (styles.textColor && styles.textColor !== "transparent") {
          out += `${getIndent()}    .foregroundColor(${toSwiftColor(styles.textColor)})\n`;
        }
      }
      if (styles.textAlign !== undefined) {
        if (styles.textAlign === "center") {
          out += `${getIndent()}    .multilineTextAlignment(.center)\n`;
        } else if (styles.textAlign === "right") {
          out += `${getIndent()}    .multilineTextAlignment(.trailing)\n`;
        } else if (styles.textAlign === "left") {
          out += `${getIndent()}    .multilineTextAlignment(.leading)\n`;
        }
      }
      
      // Handle margin
      const mt = styles.marginTopToken ? toSwiftThemeToken(styles.marginTopToken, "") : String(styles.margin.top);
      const mb = styles.marginBottomToken ? toSwiftThemeToken(styles.marginBottomToken, "") : String(styles.margin.bottom);
      if (styles.margin.top > 0 || styles.marginTopToken) out += `${getIndent()}    .padding(.top, ${mt})\n`;
      if (styles.margin.bottom > 0 || styles.marginBottomToken) out += `${getIndent()}    .padding(.bottom, ${mb})\n`;
      out += generateSwiftUIFilters(styles, getIndent() + "    ");
      return wrapFlexIfNeeded(node, out, getIndent());
    }

    // Empty Container Optimization (e.g., Progress Bar segments or Flex Spacers)
    if (node.children.length === 0) {
      let baseColor = "Color.clear";
      const identicalBg = hasIdenticalBackground(styles, parentStyles);
      if (!identicalBg) {
        if (styles.backgroundColorToken) {
          baseColor = toSwiftThemeToken(styles.backgroundColorToken, "");
        } else if (styles.backgroundColor !== "transparent") {
          baseColor = toSwiftColor(styles.backgroundColor);
        }
      }
      
      const fillCol = styles.gradient ? "Color.clear" : baseColor;
      
      if (fillCol === "Color.clear") {
        if (styles.gradient || styles.isAbsolute) {
          out += `${getIndent()}Rectangle().fill(Color.clear)\n`;
        } else if (styles.hasFlex1 || styles.width === "100%") {
          out += `${getIndent()}Spacer()\n`;
          return out;
        } else {
          out += `${getIndent()}Color.clear\n`;
        }
      } else {
        out += `${getIndent()}Rectangle().fill(${fillCol})\n`;
      }

      // Apply modifiers directly to the view
      const pt = styles.paddingTopToken ? toSwiftThemeToken(styles.paddingTopToken, "") : String(styles.padding.top);
      const pb = styles.paddingBottomToken ? toSwiftThemeToken(styles.paddingBottomToken, "") : String(styles.padding.bottom);
      const pl = styles.paddingLeftToken ? toSwiftThemeToken(styles.paddingLeftToken, "") : String(styles.padding.left);
      const pr = styles.paddingRightToken ? toSwiftThemeToken(styles.paddingRightToken, "") : String(styles.padding.right);

      if (styles.paddingLeftToken === "screenPadding" && styles.paddingRightToken === "screenPadding") {
        out += `${getIndent()}.padding(.horizontal, AppTheme.screenPadding)\n`;
        if (styles.padding.top > 0 || styles.paddingTopToken) out += `${getIndent()}.padding(.top, ${pt})\n`;
        if (styles.padding.bottom > 0 || styles.paddingBottomToken) out += `${getIndent()}.padding(.bottom, ${pb})\n`;
      } else {
        if (styles.padding.top > 0 || styles.paddingTopToken) out += `${getIndent()}.padding(.top, ${pt})\n`;
        if (styles.padding.bottom > 0 || styles.paddingBottomToken) out += `${getIndent()}.padding(.bottom, ${pb})\n`;
        if (styles.padding.left > 0 || styles.paddingLeftToken) out += `${getIndent()}.padding(.leading, ${pl})\n`;
        if (styles.padding.right > 0 || styles.paddingRightToken) out += `${getIndent()}.padding(.trailing, ${pr})\n`;
      }

      if (styles.backdropFilterBlur && styles.backdropFilterBlur > 0) {
        if (styles.backgroundColorToken) {
          out += `${getIndent()}.background(${toSwiftThemeToken(styles.backgroundColorToken, "")})\n`;
        } else if (styles.backgroundColor !== "transparent") {
          out += `${getIndent()}.background(${toSwiftColor(styles.backgroundColor)})\n`;
        }
        out += `${getIndent()}.background(.ultraThinMaterial)\n`;
      } else {
        if (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) {
          out += toSwiftBackgroundGradient(styles, getIndent(), baseColor);
        }
      }

      if (styles.borderRadiusToken) {
        out += `${getIndent()}.cornerRadius(${toSwiftThemeToken(styles.borderRadiusToken, "")})\n`;
      } else if (styles.borderRadius > 0) {
        out += `${getIndent()}.cornerRadius(${styles.borderRadius})\n`;
      }

      if (styles.borderWidth > 0 && styles.borderColor !== 'transparent') {
        const borderCol = styles.borderColorToken ? toSwiftThemeToken(styles.borderColorToken, '') : toSwiftColor(styles.borderColor);
        if (styles.borderRadiusToken || styles.borderRadius > 0) {
          const radius = styles.borderRadiusToken ? toSwiftThemeToken(styles.borderRadiusToken, '') : String(styles.borderRadius);
          out += `${getIndent()}.overlay(RoundedRectangle(cornerRadius: ${radius}).stroke(${borderCol}, lineWidth: ${styles.borderWidth}))\n`;
        }
      }

      if (styles.opacity < 1) {
        out += `${getIndent()}.opacity(${styles.opacity})\n`;
      }
      
      const w = styles.width;
      const h = styles.height;
      const frameParts: string[] = [];
      if (w === "100%" || styles.hasFlex1) frameParts.push("maxWidth: .infinity");
      else if (typeof w === "number") frameParts.push(`width: ${w}`);
      if (typeof h === "number") frameParts.push(`height: ${h}`);
      if (typeof styles.minHeight === "number" && styles.minHeight > 0) frameParts.push(`minHeight: ${styles.minHeight}`);
      if (frameParts.length > 0) {
        out += `${getIndent()}.frame(${frameParts.join(", ")})\n`;
      }

      if (styles.isAbsolute && styles.absolutePosition) {
        const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
        let offsetPart = "";
        if (left !== undefined || leftToken) offsetPart += `x: ${leftToken ? toSwiftThemeToken(leftToken, "") : left}`;
        else if (right !== undefined || rightToken) offsetPart += `x: -(${rightToken ? toSwiftThemeToken(rightToken, "") : right})`;
        
        if (top !== undefined || topToken) offsetPart += `${offsetPart ? ", " : ""}y: ${topToken ? toSwiftThemeToken(topToken, "") : top}`;
        else if (bottom !== undefined || bottomToken) offsetPart += `${offsetPart ? ", " : ""}y: -(${bottomToken ? toSwiftThemeToken(bottomToken, "") : bottom})`;
        
        if (offsetPart) {
          out += `${getIndent()}.offset(${offsetPart})\n`;
        }
      }

      out += generateSwiftUIFilters(styles, getIndent());
      return out;
    }

    // Grid Layout → LazyVGrid
    if (styles.isGrid && styles.gridCols > 0) {
      const spacing = styles.gapToken ? toSwiftThemeToken(styles.gapToken, '') : String(styles.gap);
      out += `${getIndent()}LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: ${spacing}), count: ${styles.gridCols}), spacing: ${spacing}) {\n`;
      indentLevel++;
      node.children.forEach(c => { out += walk(c, styles); });
      indentLevel--;
      out += `${getIndent()}}\n`;
      // Grid modifiers
      if (styles.backdropFilterBlur && styles.backdropFilterBlur > 0) {
        if (styles.backgroundColorToken) {
          out += `${getIndent()}.background(${toSwiftThemeToken(styles.backgroundColorToken, "")})\n`;
        } else if (styles.backgroundColor !== "transparent") {
          out += `${getIndent()}.background(${toSwiftColor(styles.backgroundColor)})\n`;
        }
        out += `${getIndent()}.background(.ultraThinMaterial)\n`;
      } else {
        if (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) {
          const baseCol = styles.backgroundColorToken ? toSwiftThemeToken(styles.backgroundColorToken, "") : (styles.backgroundColor !== "transparent" ? toSwiftColor(styles.backgroundColor) : "Color.clear");
          out += toSwiftBackgroundGradient(styles, getIndent(), baseCol);
        } else {
          const identicalBg = hasIdenticalBackground(styles, parentStyles);
          if (!identicalBg) {
            if (styles.backgroundColorToken) {
              out += `${getIndent()}.background(${toSwiftThemeToken(styles.backgroundColorToken, '')})\n`;
            } else if (styles.backgroundColor !== 'transparent') {
              out += `${getIndent()}.background(${toSwiftColor(styles.backgroundColor)})\n`;
            }
          }
        }
      }
      if (styles.borderRadiusToken) {
        out += `${getIndent()}.cornerRadius(${toSwiftThemeToken(styles.borderRadiusToken, '')})\n`;
      } else if (styles.borderRadius > 0) {
        out += `${getIndent()}.cornerRadius(${styles.borderRadius})\n`;
      }
      if (styles.explicitTextColor) {
        if (styles.textColorToken) {
          out += `${getIndent()}.foregroundColor(${toSwiftThemeToken(styles.textColorToken, "")})\n`;
        } else if (styles.textColor && styles.textColor !== "transparent") {
          out += `${getIndent()}.foregroundColor(${toSwiftColor(styles.textColor)})\n`;
        }
      }
      out += generateSwiftUIFilters(styles, getIndent());
      return wrapFlexIfNeeded(node, out, getIndent());
    }

    // Standard Stack Container
    const isCol = styles.flexDirection === "column";
    const stackName = isCol ? "VStack" : "HStack";
    const alignStr = isCol 
      ? (styles.alignItems === "center" ? "alignment: .center" : styles.alignItems === "end" ? "alignment: .trailing" : "alignment: .leading")
      : (styles.alignItems === "start" ? "alignment: .top" : styles.alignItems === "end" ? "alignment: .bottom" : "");
    const spacingStr = styles.gapToken
      ? `spacing: ${toSwiftThemeToken(styles.gapToken, "")}`
      : (styles.gap > 0 ? `spacing: ${styles.gap}` : "");
    const combo = alignStr && spacingStr ? `${alignStr}, ${spacingStr}` : (alignStr || spacingStr);
    
    const normalChildren = node.children.filter(c => typeof c === 'string' || !c.styles.isAbsolute);
    const absoluteChildren = node.children.filter(c => typeof c !== 'string' && c.styles.isAbsolute) as TranspileNode[];
    const hasAbsolute = absoluteChildren.length > 0;

    if (hasAbsolute) {
      const bgAbsoluteChildren = absoluteChildren.filter(c => c.styles.isBackgroundAbsolute);
      const fgAbsoluteChildren = absoluteChildren.filter(c => !c.styles.isBackgroundAbsolute);

      out += `${getIndent()}ZStack(alignment: .topLeading) {\n`;
      indentLevel++;
      
      // 1. Paint background absolute children FIRST (bottom of ZStack painting hierarchy)
      bgAbsoluteChildren.forEach(c => {
        out += walk(c, styles);
      });

      // 2. Paint normal children inside stack
      out += `${getIndent()}${stackName}(${combo}) {\n`;
      indentLevel++;
      normalChildren.forEach((c, idx) => {
        out += walk(c, styles);
        if (styles.justifyContent === "between" && idx < normalChildren.length - 1) {
          out += `${getIndent()}Spacer()\n`;
        }
      });
      indentLevel--;
      out += `${getIndent()}}\n`;
      
      // 3. Paint foreground absolute children LAST (top of ZStack painting hierarchy)
      fgAbsoluteChildren.forEach(c => {
        out += walk(c, styles);
      });
      
      indentLevel--;
      out += `${getIndent()}}\n`;
    } else {
      out += `${getIndent()}${stackName}(${combo}) {\n`;
      indentLevel++;
      normalChildren.forEach((c, idx) => {
        out += walk(c, styles);
        if (styles.justifyContent === "between" && idx < normalChildren.length - 1) {
          out += `${getIndent()}Spacer()\n`;
        }
      });
      indentLevel--;
      out += `${getIndent()}}\n`;
    }

    // Modifiers on stack
    const pt = styles.paddingTopToken ? toSwiftThemeToken(styles.paddingTopToken, "") : String(styles.padding.top);
    const pb = styles.paddingBottomToken ? toSwiftThemeToken(styles.paddingBottomToken, "") : String(styles.padding.bottom);
    const pl = styles.paddingLeftToken ? toSwiftThemeToken(styles.paddingLeftToken, "") : String(styles.padding.left);
    const pr = styles.paddingRightToken ? toSwiftThemeToken(styles.paddingRightToken, "") : String(styles.padding.right);

    if (styles.paddingLeftToken === "screenPadding" && styles.paddingRightToken === "screenPadding") {
      out += `${getIndent()}.padding(.horizontal, AppTheme.screenPadding)\n`;
      if (styles.padding.top > 0 || styles.paddingTopToken) out += `${getIndent()}.padding(.top, ${pt})\n`;
      if (styles.padding.bottom > 0 || styles.paddingBottomToken) out += `${getIndent()}.padding(.bottom, ${pb})\n`;
    } else {
      if (styles.padding.top > 0 || styles.paddingTopToken) out += `${getIndent()}.padding(.top, ${pt})\n`;
      if (styles.padding.bottom > 0 || styles.paddingBottomToken) out += `${getIndent()}.padding(.bottom, ${pb})\n`;
      if (styles.padding.left > 0 || styles.paddingLeftToken) out += `${getIndent()}.padding(.leading, ${pl})\n`;
      if (styles.padding.right > 0 || styles.paddingRightToken) out += `${getIndent()}.padding(.trailing, ${pr})\n`;
    }

    // Background — with gradient support
    if (styles.backdropFilterBlur && styles.backdropFilterBlur > 0) {
      if (styles.backgroundColorToken) {
        out += `${getIndent()}.background(${toSwiftThemeToken(styles.backgroundColorToken, "")})\n`;
      } else if (styles.backgroundColor !== "transparent") {
        out += `${getIndent()}.background(${toSwiftColor(styles.backgroundColor)})\n`;
      }
      out += `${getIndent()}.background(.ultraThinMaterial)\n`;
    } else {
      if (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) {
        const baseCol = styles.backgroundColorToken ? toSwiftThemeToken(styles.backgroundColorToken, "") : (styles.backgroundColor !== "transparent" ? toSwiftColor(styles.backgroundColor) : "Color.clear");
        out += toSwiftBackgroundGradient(styles, getIndent(), baseCol);
      } else {
        const identicalBg = hasIdenticalBackground(styles, parentStyles);
        if (!identicalBg) {
          if (styles.backgroundColorToken) {
            out += `${getIndent()}.background(${toSwiftThemeToken(styles.backgroundColorToken, "")})\n`;
          } else if (styles.backgroundColor !== "transparent") {
            out += `${getIndent()}.background(${toSwiftColor(styles.backgroundColor)})\n`;
          }
        }
      }
    }
    if (styles.borderRadiusToken) {
      out += `${getIndent()}.cornerRadius(${toSwiftThemeToken(styles.borderRadiusToken, "")})\n`;
    } else if (styles.borderRadius > 0) {
      out += `${getIndent()}.cornerRadius(${styles.borderRadius})\n`;
    }

    // Border overlay
    if (styles.borderWidth > 0 && styles.borderColor !== 'transparent') {
      const borderCol = styles.borderColorToken ? toSwiftThemeToken(styles.borderColorToken, '') : toSwiftColor(styles.borderColor);
      if (styles.borderRadiusToken || styles.borderRadius > 0) {
        const radius = styles.borderRadiusToken ? toSwiftThemeToken(styles.borderRadiusToken, '') : String(styles.borderRadius);
        out += `${getIndent()}.overlay(RoundedRectangle(cornerRadius: ${radius}).stroke(${borderCol}, lineWidth: ${styles.borderWidth}))\n`;
      }
    }

    // Opacity
    if (styles.opacity < 1) {
      out += `${getIndent()}.opacity(${styles.opacity})\n`;
    }
    
    // Frame — with min-height and flex-1 support
    const w = styles.width;
    const h = styles.height;
    const frameParts: string[] = [];
    if (w === "100%" || styles.hasFlex1) frameParts.push("maxWidth: .infinity");
    else if (typeof w === "number") frameParts.push(`width: ${w}`);
    if (typeof h === "number") frameParts.push(`height: ${h}`);
    if (typeof styles.minHeight === "number" && styles.minHeight > 0) frameParts.push(`minHeight: ${styles.minHeight}`);
    if (frameParts.length > 0) {
      out += `${getIndent()}.frame(${frameParts.join(", ")})\n`;
    }

    if (styles.explicitTextColor) {
      if (styles.textColorToken) {
        out += `${getIndent()}.foregroundColor(${toSwiftThemeToken(styles.textColorToken, "")})\n`;
      } else if (styles.textColor && styles.textColor !== "transparent") {
        out += `${getIndent()}.foregroundColor(${toSwiftColor(styles.textColor)})\n`;
      }
    }

    // Absolute position modifier
    if (styles.isAbsolute && styles.absolutePosition) {
      const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
      let offsetPart = "";
      if (left !== undefined || leftToken) offsetPart += `x: ${leftToken ? toSwiftThemeToken(leftToken, "") : left}`;
      else if (right !== undefined || rightToken) offsetPart += `x: -(${rightToken ? toSwiftThemeToken(rightToken, "") : right})`;
      
      if (top !== undefined || topToken) offsetPart += `${offsetPart ? ", " : ""}y: ${topToken ? toSwiftThemeToken(topToken, "") : top}`;
      else if (bottom !== undefined || bottomToken) offsetPart += `${offsetPart ? ", " : ""}y: -(${bottomToken ? toSwiftThemeToken(bottomToken, "") : bottom})`;
      
      if (offsetPart) {
        out += `${getIndent()}.offset(${offsetPart})\n`;
      }
    }
    out += generateSwiftUIFilters(styles, getIndent());

    return out;
  }

  return walk(root);
}

// ---------------------------------------------------------------------------
// JETPACK COMPOSE TRANSPILER
// ---------------------------------------------------------------------------
// Spacing/Color theme-aware helpers for Compose
function toComposeThemeToken(token: string | undefined, fallbackVal: string): string {
  if (!token) return fallbackVal;
  if (token === "bgPrimary") return "AppTheme.BackgroundPrimary";
  if (token === "bgSecondary") return "AppTheme.BackgroundSecondary";
  const name = token.charAt(0).toUpperCase() + token.slice(1);
  return `AppTheme.${name}`;
}

export function transpileToCompose(root: TranspileNode): string {
  let indentLevel = 1;
  const getIndent = () => "    ".repeat(indentLevel);

  function walk(node: TranspileNode | string, parentIsFixedBottomRow = false, parentStyles?: ParsedStyles): string {
    if (typeof node === "string") {
      return `${getIndent()}Text(text = "${node.replace(/"/g, '\\"')}")\n`;
    }

    if (typeof node !== "string" && isRedundantWrapper(node)) {
      return walk(node.children[0], parentIsFixedBottomRow, parentStyles);
    }

    const { styles } = node;
    const isButton = node.tagName === "button" || node.tagName === "a";
    const isImage = node.tagName === "img";
    const lucide = node.attributes["data-lucide"] || node.attributes["data-drawgle-icon"];
    
    let out = "";

    if (lucide) {
      const tintColor = styles.textColorToken ? toComposeThemeToken(styles.textColorToken, "") : toComposeColor(styles.textColor);
      out += `${getIndent()}Icon(\n`;
      out += `${getIndent()}    imageVector = ${toComposeIconName(lucide)}, // Lucide: ${lucide}\n`;
      out += `${getIndent()}    contentDescription = null,\n`;
      out += `${getIndent()}    tint = ${tintColor},\n`;
      out += `${getIndent()}    modifier = Modifier.size(${styles.fontSize || 24}.dp)${styles.hasFlex1 ? '.weight(1f)' : ''}\n`;
      out += `${getIndent()})\n`;
      return out;
    }

    // Raw SVG placeholder
    if (styles.isRawSvg) {
      const svgW = typeof styles.width === 'number' ? styles.width : 48;
      const svgH = typeof styles.height === 'number' ? styles.height : 48;
      
      const circleChildren = node.children.filter(c => typeof c !== "string" && c.tagName === "circle") as TranspileNode[];
      if (circleChildren.length > 0) {
        let svgOut = `${getIndent()}Box(\n`;
        svgOut += `${getIndent()}    contentAlignment = Alignment.Center,\n`;
        svgOut += `${getIndent()}    modifier = Modifier.size(${svgW}.dp)\n`;
        svgOut += `${getIndent()}) {\n`;
        indentLevel++;
        circleChildren.forEach(circle => {
          const strokeWidth = parseFloat(circle.attributes["stroke-width"]) || 1;
          const strokeColorStr = circle.attributes["stroke"] || "black";
          const tokenKey = strokeColorStr.startsWith("var(") ? getStyleTokenKey(strokeColorStr) : undefined;
          const strokeColor = tokenKey 
            ? toComposeThemeToken(tokenKey, "") 
            : toComposeColor(resolveColorToStandard(strokeColorStr));
            
          const strokeLinecap = circle.attributes["stroke-linecap"] === "round" ? "StrokeCap.Round" : "StrokeCap.Butt";
          const dashArray = parseFloat(circle.attributes["stroke-dasharray"]) || 0;
          const dashOffset = parseFloat(circle.attributes["stroke-dashoffset"]) || 0;
          
          let progress = 1.0;
          if (dashArray > 0) {
            progress = 1.0 - (dashOffset / dashArray);
            if (progress < 0) progress = 0;
            if (progress > 1) progress = 1;
          }
          
          svgOut += `${getIndent()}CircularProgressIndicator(\n`;
          svgOut += `${getIndent()}    progress = ${progress.toFixed(2)}f,\n`;
          svgOut += `${getIndent()}    color = ${strokeColor},\n`;
          svgOut += `${getIndent()}    strokeWidth = ${strokeWidth}.dp,\n`;
          if (strokeLinecap === "StrokeCap.Round") {
            svgOut += `${getIndent()}    strokeCap = StrokeCap.Round,\n`;
          }
          svgOut += `${getIndent()}    modifier = Modifier.fillMaxSize()\n`;
          svgOut += `${getIndent()})\n`;
        });
        indentLevel--;
        svgOut += `${getIndent()}}\n`;
        return svgOut;
      }
      
      out += `${getIndent()}Box(modifier = Modifier.size(${svgW}.dp)${styles.hasFlex1 ? '.weight(1f)' : ''}) { /* TODO: Add custom SVG/Asset */ }\n`;
      return out;
    }

    if (isImage) {
      const src = node.attributes["src"] || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809";
      out += `${getIndent()}AsyncImage(\n`;
      out += `${getIndent()}    model = "${src}",\n`;
      out += `${getIndent()}    contentDescription = null,\n`;
      out += `${getIndent()}    modifier = Modifier\n`;
      
      const w = styles.width;
      const h = styles.height;
      if (w === "100%") out += `${getIndent()}        .fillMaxWidth()\n`;
      else if (typeof w === "number") out += `${getIndent()}        .width(${w}.dp)\n`;
      if (typeof h === "number") out += `${getIndent()}        .height(${h}.dp)\n`;
      if (styles.hasFlex1) out += `${getIndent()}        .weight(1f)\n`;
      
      if (styles.borderRadiusToken) {
        out += `${getIndent()}        .clip(RoundedCornerShape(${toComposeThemeToken(styles.borderRadiusToken, "")}))\n`;
      } else if (styles.borderRadius > 0) {
        out += `${getIndent()}        .clip(RoundedCornerShape(${styles.borderRadius}.dp))\n`;
      }
      out += `${getIndent()})\n`;
      return out;
    }

    if (isButton) {
      const containerColor = styles.backgroundColorToken ? toComposeThemeToken(styles.backgroundColorToken, "") : `Color(0xFF${cleanHexColor(styles.backgroundColor)})`;
      const btnShape = styles.borderRadiusToken ? `RoundedCornerShape(${toComposeThemeToken(styles.borderRadiusToken, "")})` : `RoundedCornerShape(${(styles.borderRadius || 12)}.dp)`;
      const paddingX = styles.paddingLeftToken ? toComposeThemeToken(styles.paddingLeftToken, "") : `${(styles.padding.left || 16)}.dp`;
      const paddingY = styles.paddingTopToken ? toComposeThemeToken(styles.paddingTopToken, "") : `${(styles.padding.top || 12)}.dp`;

      out += `${getIndent()}Button(\n`;
      out += `${getIndent()}    onClick = { /* Action */ },\n`;
      out += `${getIndent()}    colors = ButtonDefaults.buttonColors(containerColor = ${containerColor}),\n`;
      out += `${getIndent()}    shape = ${btnShape},\n`;
      out += `${getIndent()}    modifier = Modifier\n`;
      if (styles.padding.left > 0 || styles.padding.top > 0 || styles.paddingLeftToken || styles.paddingTopToken) {
        out += `${getIndent()}        .padding(horizontal = ${paddingX}, vertical = ${paddingY})\n`;
      }
      out += `${getIndent()}) {\n`;
      indentLevel++;
      
      // Inline children
      const btnGap = styles.gapToken ? toComposeThemeToken(styles.gapToken, "") : `${(styles.gap || 8)}.dp`;
      out += `${getIndent()}Row(\n`;
      out += `${getIndent()}    horizontalArrangement = Arrangement.spacedBy(${btnGap}),\n`;
      out += `${getIndent()}    verticalAlignment = Alignment.CenterVertically\n`;
      out += `${getIndent()}) {\n`;
      indentLevel++;
      node.children.forEach(c => {
        out += walk(c, parentIsFixedBottomRow, styles);
      });
      indentLevel--;
      out += `${getIndent()}}\n`;
      
      indentLevel--;
      out += `${getIndent()}}\n`;
      return out;
    }

    const isTextLeaf = ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6"].includes(node.tagName) && 
                       node.children.length === 1 && typeof node.children[0] === "string";

    if (isTextLeaf) {
      const textVal = node.children[0] as string;
      out += `${getIndent()}Text(\n`;
      out += `${getIndent()}    text = "${textVal.replace(/"/g, '\\"')}",\n`;
      if (styles.fontSize !== undefined) {
        out += `${getIndent()}    fontSize = ${styles.fontSize}.sp,\n`;
      }
      if (styles.textColorToken || (styles.textColor && styles.textColor !== "transparent")) {
        const textTint = styles.textColorToken ? toComposeThemeToken(styles.textColorToken, "") : toComposeColor(styles.textColor);
        out += `${getIndent()}    color = ${textTint},\n`;
      }
      if (styles.fontWeight !== undefined) {
        if (styles.fontWeight === "heavy") {
          out += `${getIndent()}    fontWeight = FontWeight.ExtraBold,\n`;
        } else if (styles.fontWeight === "bold") {
          out += `${getIndent()}    fontWeight = FontWeight.Bold,\n`;
        } else if (styles.fontWeight === "semibold") {
          out += `${getIndent()}    fontWeight = FontWeight.SemiBold,\n`;
        } else if (styles.fontWeight === "medium") {
          out += `${getIndent()}    fontWeight = FontWeight.Medium,\n`;
        } else {
          out += `${getIndent()}    fontWeight = FontWeight.Normal,\n`;
        }
      }
      if (styles.textAlign !== undefined) {
        if (styles.textAlign === "center") {
          out += `${getIndent()}    textAlign = TextAlign.Center,\n`;
        } else if (styles.textAlign === "right") {
          out += `${getIndent()}    textAlign = TextAlign.Right,\n`;
        } else if (styles.textAlign === "left") {
          out += `${getIndent()}    textAlign = TextAlign.Left,\n`;
        }
      }
      
      // Modifier spacing
      out += `${getIndent()}    modifier = Modifier\n`;
      const mt = styles.marginTopToken ? toComposeThemeToken(styles.marginTopToken, "") : `${styles.margin.top}.dp`;
      const mb = styles.marginBottomToken ? toComposeThemeToken(styles.marginBottomToken, "") : `${styles.margin.bottom}.dp`;
      if (styles.margin.top > 0 || styles.margin.bottom > 0 || styles.marginTopToken || styles.marginBottomToken) {
        out += `${getIndent()}        .padding(top = ${mt}, bottom = ${mb})\n`;
      }
      // strip trailing modifiers if not used
      if (out.endsWith("modifier = Modifier\n")) {
        out = out.substring(0, out.length - 24) + "\n";
      }
      out += `${getIndent()})\n`;
      return out;
    }

    // Grid Layout → LazyVerticalGrid
    if (styles.isGrid && styles.gridCols > 0) {
      const spacing = styles.gapToken ? toComposeThemeToken(styles.gapToken, '') : `${styles.gap}.dp`;
      out += `${getIndent()}LazyVerticalGrid(\n`;
      out += `${getIndent()}    columns = GridCells.Fixed(${styles.gridCols}),\n`;
      out += `${getIndent()}    horizontalArrangement = Arrangement.spacedBy(${spacing}),\n`;
      out += `${getIndent()}    verticalArrangement = Arrangement.spacedBy(${spacing}),\n`;
      out += `${getIndent()}    modifier = Modifier.height(280.dp)\n`;
      out += `${getIndent()}) {\n`;
      indentLevel++;
      node.children.forEach(c => {
        out += `${getIndent()}item {\n`;
        indentLevel++;
        out += walk(c, false);
        indentLevel--;
        out += `${getIndent()}}\n`;
      });
      indentLevel--;
      out += `${getIndent()}}\n`;
      return out;
    }

    // Standard Stack
    let isCol = styles.flexDirection === "column";
    if (parentIsFixedBottomRow && !isButton && !isImage && !lucide && !styles.isRawSvg && !isTextLeaf && !styles.isGrid) {
      isCol = false; // Force Row layout for container children under fixed-bottom row
    }
    const composeLayout = isCol ? "Column" : "Row";
    
    const normalChildren = node.children.filter(c => typeof c === 'string' || !c.styles.isAbsolute);
    const absoluteChildren = node.children.filter(c => typeof c !== 'string' && c.styles.isAbsolute) as TranspileNode[];
    const hasAbsolute = absoluteChildren.length > 0;

    let stackModifier = "Modifier";
    if (styles.width === "100%" || styles.hasFlex1) stackModifier += "\n        .fillMaxWidth()";
    else if (typeof styles.width === "number") stackModifier += `\n        .width(${styles.width}.dp)`;
    if (typeof styles.height === "number") stackModifier += `\n        .height(${styles.height}.dp)`;
    if (typeof styles.minHeight === "number" && styles.minHeight > 0) stackModifier += `\n        .heightIn(min = ${styles.minHeight}.dp)`;
    if (styles.hasFlex1 && !styles.isAbsolute) {
      stackModifier += "\n        .weight(1f)";
    }

    if (styles.borderRadiusToken) {
      stackModifier += `\n        .clip(RoundedCornerShape(${toComposeThemeToken(styles.borderRadiusToken, "")}))`;
    } else if (styles.borderRadius > 0) {
      stackModifier += `\n        .clip(RoundedCornerShape(${styles.borderRadius}.dp))`;
    }

    // Background — with gradient support
    if (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) {
      const { start, end } = gradientDirectionToCompose(styles.gradient.direction);
      stackModifier += `\n        .background(Brush.linearGradient(colors = listOf(${toComposeColor(styles.gradient.fromColor)}, ${toComposeColor(styles.gradient.toColor)}), start = ${start}, end = ${end}))`;
    } else {
      const identicalBg = hasIdenticalBackground(styles, parentStyles);
      if (!identicalBg) {
        if (styles.backgroundColorToken) {
          stackModifier += `\n        .background(${toComposeThemeToken(styles.backgroundColorToken, "")})`;
        } else if (styles.backgroundColor !== "transparent") {
          stackModifier += `\n        .background(${toComposeColor(styles.backgroundColor)})`;
        }
      }
    }

    // Border overlay
    if (styles.borderWidth > 0 && styles.borderColor !== 'transparent') {
      const borderCol = styles.borderColorToken ? toComposeThemeToken(styles.borderColorToken, '') : toComposeColor(styles.borderColor);
      if (styles.borderRadiusToken || styles.borderRadius > 0) {
        const radius = styles.borderRadiusToken ? toComposeThemeToken(styles.borderRadiusToken, '') : `${styles.borderRadius}.dp`;
        stackModifier += `\n        .border(${styles.borderWidth}.dp, ${borderCol}, RoundedCornerShape(${radius}))`;
      }
    }

    // Opacity
    if (styles.opacity < 1) {
      stackModifier += `\n        .alpha(${styles.opacity}f)`;
    }

    // Padding
    const pt = styles.paddingTopToken ? toComposeThemeToken(styles.paddingTopToken, "") : `${styles.padding.top}.dp`;
    const pb = styles.paddingBottomToken ? toComposeThemeToken(styles.paddingBottomToken, "") : `${styles.padding.bottom}.dp`;
    const pl = styles.paddingLeftToken ? toComposeThemeToken(styles.paddingLeftToken, "") : `${styles.padding.left}.dp`;
    const pr = styles.paddingRightToken ? toComposeThemeToken(styles.paddingRightToken, "") : `${styles.padding.right}.dp`;

    if (styles.paddingLeftToken === "screenPadding" && styles.paddingRightToken === "screenPadding") {
      stackModifier += `\n        .padding(start = AppTheme.ScreenPadding, top = ${pt}, end = AppTheme.ScreenPadding, bottom = ${pb})`;
    } else if (styles.padding.top > 0 || styles.padding.bottom > 0 || styles.padding.left > 0 || styles.padding.right > 0 ||
               styles.paddingTopToken || styles.paddingBottomToken || styles.paddingLeftToken || styles.paddingRightToken) {
      stackModifier += `\n        .padding(start = ${pl}, top = ${pt}, end = ${pr}, bottom = ${pb})`;
    }

    // Absolute position modifier
    if (styles.isAbsolute && styles.absolutePosition) {
      const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
      let offsetPart = "";
      if (left !== undefined || leftToken) offsetPart += `x = ${leftToken ? toComposeThemeToken(leftToken, "") : `${left}.dp`}`;
      else if (right !== undefined || rightToken) offsetPart += `x = -(${rightToken ? toComposeThemeToken(rightToken, "") : `${right}.dp`})`;
      
      if (top !== undefined || topToken) offsetPart += `${offsetPart ? ", " : ""}y = ${topToken ? toComposeThemeToken(topToken, "") : `${top}.dp`}`;
      else if (bottom !== undefined || bottomToken) offsetPart += `${offsetPart ? ", " : ""}y = -(${bottomToken ? toComposeThemeToken(bottomToken, "") : `${bottom}.dp`})`;
      
      if (offsetPart) {
        stackModifier += `\n        .offset(${offsetPart})`;
      }
    }

    // Fixed bottom alignment in Box
    if (styles.isFixedBottom) {
      stackModifier += "\n        .align(Alignment.BottomCenter)\n        .fillMaxWidth()";
    }

    const isCurrentFixedBottomRow = styles.isFixedBottom && styles.flexDirection === "row";

    if (hasAbsolute) {
      const bgAbsoluteChildren = absoluteChildren.filter(c => c.styles.isBackgroundAbsolute);
      const fgAbsoluteChildren = absoluteChildren.filter(c => !c.styles.isBackgroundAbsolute);

      out += `${getIndent()}Box(\n`;
      out += `${getIndent()}    modifier = ${stackModifier.replace(/\n        /g, "\n        ")}\n`;
      out += `${getIndent()}) {\n`;
      indentLevel++;
      
      // 1. Render background absolute children FIRST
      bgAbsoluteChildren.forEach(c => {
        out += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles);
      });

      // 2. Inner stack (normal children)
      out += `${getIndent()}${composeLayout}(\n`;
      out += `${getIndent()}    modifier = Modifier.fillMaxSize(),\n`;
      
      // Alignments & Arrangement
      const gapVal = styles.gapToken ? toComposeThemeToken(styles.gapToken, "") : `${styles.gap}.dp`;
      if (isCol) {
        const align = styles.alignItems === "center" ? "Alignment.CenterHorizontally" : styles.alignItems === "end" ? "Alignment.End" : "Alignment.Start";
        out += `${getIndent()}    horizontalAlignment = ${align},\n`;
        if (styles.justifyContent === "between") {
          out += `${getIndent()}    verticalArrangement = Arrangement.SpaceBetween,\n`;
        } else if (styles.gap > 0 || styles.gapToken) {
          out += `${getIndent()}    verticalArrangement = Arrangement.spacedBy(${gapVal}),\n`;
        }
      } else {
        const align = styles.alignItems === "center" ? "Alignment.CenterVertically" : styles.alignItems === "end" ? "Alignment.Bottom" : "Alignment.Top";
        out += `${getIndent()}    verticalAlignment = ${align},\n`;
        if (styles.justifyContent === "between") {
          out += `${getIndent()}    horizontalArrangement = Arrangement.SpaceBetween,\n`;
        } else if (styles.gap > 0 || styles.gapToken) {
          out += `${getIndent()}    horizontalArrangement = Arrangement.spacedBy(${gapVal}),\n`;
        }
      }
      out += `${getIndent()}) {\n`;
      indentLevel++;
      normalChildren.forEach(c => {
        out += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles);
      });
      indentLevel--;
      out += `${getIndent()}}\n`;
      
      // 3. Render foreground absolute children LAST
      fgAbsoluteChildren.forEach(c => {
        out += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles);
      });
      
      indentLevel--;
      out += `${getIndent()}}\n`;
    } else {
      out += `${getIndent()}${composeLayout}(\n`;
      out += `${getIndent()}    modifier = ${stackModifier},\n`;
      
      // Alignments & Arrangement
      const gapVal = styles.gapToken ? toComposeThemeToken(styles.gapToken, "") : `${styles.gap}.dp`;
      if (isCol) {
        const align = styles.alignItems === "center" ? "Alignment.CenterHorizontally" : styles.alignItems === "end" ? "Alignment.End" : "Alignment.Start";
        out += `${getIndent()}    horizontalAlignment = ${align},\n`;
        if (styles.justifyContent === "between") {
          out += `${getIndent()}    verticalArrangement = Arrangement.SpaceBetween,\n`;
        } else if (styles.gap > 0 || styles.gapToken) {
          out += `${getIndent()}    verticalArrangement = Arrangement.spacedBy(${gapVal}),\n`;
        }
      } else {
        const align = styles.alignItems === "center" ? "Alignment.CenterVertically" : styles.alignItems === "end" ? "Alignment.Bottom" : "Alignment.Top";
        out += `${getIndent()}    verticalAlignment = ${align},\n`;
        if (styles.justifyContent === "between") {
          out += `${getIndent()}    horizontalArrangement = Arrangement.SpaceBetween,\n`;
        } else if (styles.gap > 0 || styles.gapToken) {
          out += `${getIndent()}    horizontalArrangement = Arrangement.spacedBy(${gapVal}),\n`;
        }
      }
      out += `${getIndent()}) {\n`;
      indentLevel++;
      normalChildren.forEach(c => {
        out += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles);
      });
      indentLevel--;
      out += `${getIndent()}}\n`;
    }
    return out;
  }

  return walk(root);
}

// ---------------------------------------------------------------------------
// REACT NATIVE TRANSPILER
// ---------------------------------------------------------------------------
function gradientDirectionToRN(direction: string): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const map: Record<string, { start: { x: number; y: number }; end: { x: number; y: number } }> = {
    'r':  { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
    'l':  { start: { x: 1, y: 0.5 }, end: { x: 0, y: 0.5 } },
    'b':  { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
    't':  { start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } },
    'br': { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
    'bl': { start: { x: 1, y: 0 }, end: { x: 0, y: 1 } },
    'tr': { start: { x: 0, y: 1 }, end: { x: 1, y: 0 } },
    'tl': { start: { x: 1, y: 1 }, end: { x: 0, y: 0 } },
  };
  return map[direction] || { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
}

// Spacing/Color theme-aware helpers for React Native
function toRNThemeToken(token: string | undefined, fallbackVal: string): string {
  if (!token) return fallbackVal;
  if (token === "borderRadiusApp") return "AppTheme.radii.app";
  if (token === "borderRadiusPill") return "AppTheme.radii.pill";
  if (token === "screenPadding" || token === "sectionGap" || token === "elementGap") return `AppTheme.layout.${token}`;
  
  let colorToken = token;
  if (token === "bgPrimary") colorToken = "backgroundPrimary";
  if (token === "bgSecondary") colorToken = "backgroundSecondary";
  return `AppTheme.colors.${colorToken}`;
}

export function transpileToReactNative(root: TranspileNode): string {
  let indentLevel = 1;
  const getIndent = () => "  ".repeat(indentLevel);

  function walk(node: TranspileNode | string, isGridChildOfCols?: number, parentIsFixedBottomRow = false, parentStyles?: ParsedStyles): string {
    if (typeof node === "string") {
      return `${getIndent()}<Text>${node.replace(/"/g, '\\"')}</Text>\n`;
    }

    if (typeof node !== "string" && isRedundantWrapper(node)) {
      return walk(node.children[0], isGridChildOfCols, parentIsFixedBottomRow, parentStyles);
    }

    const { styles } = node;
    const isButton = node.tagName === "button" || node.tagName === "a";
    const isImage = node.tagName === "img";
    const lucide = node.attributes["data-lucide"] || node.attributes["data-drawgle-icon"];
    
    let out = "";

    // Width percent for Grid children
    let widthPercent = "";
    if (isGridChildOfCols && isGridChildOfCols > 0) {
      if (isGridChildOfCols === 2) {
        widthPercent = "48%";
      } else if (isGridChildOfCols === 3) {
        widthPercent = "31%";
      } else if (isGridChildOfCols === 4) {
        widthPercent = "22%";
      } else {
        widthPercent = `${Math.floor(100 / isGridChildOfCols) - 2}%`;
      }
    }

    if (lucide) {
      const tintColor = styles.textColorToken ? toRNThemeToken(styles.textColorToken, "") : `'${styles.textColor}'`;
      out += `${getIndent()}<Icon name="${toRNIconName(lucide)}" size={${styles.fontSize || 24}} color={${tintColor}} />\n`;
      return out;
    }

    // Raw SVG placeholder
    if (styles.isRawSvg) {
      const svgSize = typeof styles.width === 'number' ? styles.width : 48;
      const finalWidth = (isGridChildOfCols && isGridChildOfCols > 0) ? `'${widthPercent}'` : svgSize;
      out += `${getIndent()}<View style={{ width: ${finalWidth}, height: ${svgSize} }}>{/* TODO: Add custom SVG/Asset */}</View>\n`;
      return out;
    }

    if (isImage) {
      const src = node.attributes["src"] || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809";
      const altText = node.attributes["alt"] || "";
      out += `${getIndent()}<Image \n`;
      out += `${getIndent()}  source={{ uri: '${src}' }}\n`;
      out += `${getIndent()}  alt="${altText.replace(/"/g, '\\"')}"\n`;
      
      // Inline styles for RN
      out += `${getIndent()}  style={{\n`;
      if (isGridChildOfCols && isGridChildOfCols > 0) {
        out += `${getIndent()}    width: '${widthPercent}',\n`;
      }
      if (styles.isAbsolute) {
        out += `${getIndent()}    position: 'absolute',\n`;
        if (styles.isBackgroundAbsolute) {
          out += `${getIndent()}    top: 0,\n`;
          out += `${getIndent()}    left: 0,\n`;
          out += `${getIndent()}    right: 0,\n`;
          out += `${getIndent()}    bottom: 0,\n`;
        } else if (styles.absolutePosition) {
          const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
          if (top !== undefined || topToken) out += `${getIndent()}    top: ${topToken ? toRNThemeToken(topToken, "") : top},\n`;
          if (right !== undefined || rightToken) out += `${getIndent()}    right: ${rightToken ? toRNThemeToken(rightToken, "") : right},\n`;
          if (bottom !== undefined || bottomToken) out += `${getIndent()}    bottom: ${bottomToken ? toRNThemeToken(bottomToken, "") : bottom},\n`;
          if (left !== undefined || leftToken) out += `${getIndent()}    left: ${leftToken ? toRNThemeToken(leftToken, "") : left},\n`;
        }
      }
      if (!(isGridChildOfCols && isGridChildOfCols > 0)) {
        if (styles.isBackgroundAbsolute) {
          out += `${getIndent()}    width: '100%',\n`;
          out += `${getIndent()}    height: '100%',\n`;
        } else {
          if (styles.width === "100%") out += `${getIndent()}    width: '100%',\n`;
          else if (typeof styles.width === "number") out += `${getIndent()}    width: ${styles.width},\n`;
          if (typeof styles.height === "number") out += `${getIndent()}    height: ${styles.height},\n`;
        }
      } else if (typeof styles.height === "number") {
        out += `${getIndent()}    height: ${styles.height},\n`;
      }
      
      if (styles.borderRadiusToken) {
        out += `${getIndent()}    borderRadius: ${toRNThemeToken(styles.borderRadiusToken, "")},\n`;
      } else if (styles.borderRadius > 0) {
        out += `${getIndent()}    borderRadius: ${styles.borderRadius},\n`;
      }
      out += `${getIndent()}  }}\n`;
      out += `${getIndent()}/>\n`;
      return out;
    }

    if (isButton) {
      const containerColor = styles.backgroundColorToken ? toRNThemeToken(styles.backgroundColorToken, "") : `'${styles.backgroundColor}'`;
      const btnRadius = styles.borderRadiusToken ? toRNThemeToken(styles.borderRadiusToken, "") : String(styles.borderRadius || 12);
      const paddingY = styles.paddingTopToken ? toRNThemeToken(styles.paddingTopToken, "") : String(styles.padding.top || 12);
      const paddingX = styles.paddingLeftToken ? toRNThemeToken(styles.paddingLeftToken, "") : String(styles.padding.left || 16);

      out += `${getIndent()}<TouchableOpacity \n`;
      out += `${getIndent()}  onPress={() => {}}\n`;
      out += `${getIndent()}  style={{\n`;
      if (isGridChildOfCols && isGridChildOfCols > 0) {
        out += `${getIndent()}    width: '${widthPercent}',\n`;
      }
      if (styles.isAbsolute) {
        out += `${getIndent()}    position: 'absolute',\n`;
        if (styles.absolutePosition) {
          const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
          if (top !== undefined || topToken) out += `${getIndent()}    top: ${topToken ? toRNThemeToken(topToken, "") : top},\n`;
          if (right !== undefined || rightToken) out += `${getIndent()}    right: ${rightToken ? toRNThemeToken(rightToken, "") : right},\n`;
          if (bottom !== undefined || bottomToken) out += `${getIndent()}    bottom: ${bottomToken ? toRNThemeToken(bottomToken, "") : bottom},\n`;
          if (left !== undefined || leftToken) out += `${getIndent()}    left: ${leftToken ? toRNThemeToken(leftToken, "") : left},\n`;
        }
      }
      if (styles.backgroundColorToken || styles.backgroundColor !== "transparent") {
        out += `${getIndent()}    backgroundColor: ${containerColor},\n`;
      }
      if (styles.borderRadiusToken || styles.borderRadius > 0) {
        out += `${getIndent()}    borderRadius: ${btnRadius},\n`;
      }
      out += `${getIndent()}    paddingVertical: ${paddingY},\n`;
      out += `${getIndent()}    paddingHorizontal: ${paddingX},\n`;
      out += `${getIndent()}    flexDirection: 'row',\n`;
      out += `${getIndent()}    alignItems: 'center',\n`;
      out += `${getIndent()}    justifyContent: 'center',\n`;
      out += `${getIndent()}  }}\n`;
      out += `${getIndent()}>\n`;
      indentLevel++;
      
      node.children.forEach(c => {
        out += walk(c, undefined, parentIsFixedBottomRow, styles);
      });

      indentLevel--;
      out += `${getIndent()}</TouchableOpacity>\n`;
      return out;
    }

    const isTextLeaf = ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6"].includes(node.tagName) && 
                       node.children.length === 1 && typeof node.children[0] === "string";

    if (isTextLeaf) {
      const textVal = node.children[0] as string;
      out += `${getIndent()}<Text style={{\n`;
      if (isGridChildOfCols && isGridChildOfCols > 0) {
        out += `${getIndent()}  width: '${widthPercent}',\n`;
      }
      if (styles.isAbsolute) {
        out += `${getIndent()}  position: 'absolute',\n`;
        if (styles.absolutePosition) {
          const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
          if (top !== undefined || topToken) out += `${getIndent()}  top: ${topToken ? toRNThemeToken(topToken, "") : top},\n`;
          if (right !== undefined || rightToken) out += `${getIndent()}  right: ${rightToken ? toRNThemeToken(rightToken, "") : right},\n`;
          if (bottom !== undefined || bottomToken) out += `${getIndent()}  bottom: ${bottomToken ? toRNThemeToken(bottomToken, "") : bottom},\n`;
          if (left !== undefined || leftToken) out += `${getIndent()}  left: ${leftToken ? toRNThemeToken(leftToken, "") : left},\n`;
        }
      }
      if (styles.fontSize !== undefined) {
        out += `${getIndent()}  fontSize: ${styles.fontSize},\n`;
      }
      if (styles.textColorToken || (styles.textColor && styles.textColor !== "transparent")) {
        const textTint = styles.textColorToken ? toRNThemeToken(styles.textColorToken, "") : `'${styles.textColor}'`;
        out += `${getIndent()}  color: ${textTint},\n`;
      }
      if (styles.fontWeight !== undefined) {
        if (styles.fontWeight === "heavy") {
          out += `${getIndent()}  fontWeight: '800',\n`;
        } else if (styles.fontWeight === "bold") {
          out += `${getIndent()}  fontWeight: 'bold',\n`;
        } else if (styles.fontWeight === "semibold") {
          out += `${getIndent()}  fontWeight: '600',\n`;
        } else if (styles.fontWeight === "medium") {
          out += `${getIndent()}  fontWeight: '500',\n`;
        } else {
          out += `${getIndent()}  fontWeight: 'normal',\n`;
        }
      }
      if (styles.textAlign !== undefined) {
        if (styles.textAlign === "center") {
          out += `${getIndent()}  textAlign: 'center',\n`;
        } else if (styles.textAlign === "right") {
          out += `${getIndent()}  textAlign: 'right',\n`;
        } else if (styles.textAlign === "left") {
          out += `${getIndent()}  textAlign: 'left',\n`;
        }
      }
      
      const mt = styles.marginTopToken ? toRNThemeToken(styles.marginTopToken, "") : String(styles.margin.top);
      const mb = styles.marginBottomToken ? toRNThemeToken(styles.marginBottomToken, "") : String(styles.margin.bottom);
      if (styles.margin.top > 0 || styles.marginTopToken) out += `${getIndent()}  marginTop: ${mt},\n`;
      if (styles.margin.bottom > 0 || styles.marginBottomToken) out += `${getIndent()}  marginBottom: ${mb},\n`;
      
      out += `${getIndent()}}}>\n`;
      out += `${getIndent()}  ${textVal.replace(/"/g, '\\"')}\n`;
      out += `${getIndent()}</Text>\n`;
      return out;
    }

    // Grid Layout → View wrapping children with flexWrap
    if (styles.isGrid && styles.gridCols > 0) {
      const gapVal = styles.gapToken ? toRNThemeToken(styles.gapToken, '') : String(styles.gap);
      out += `${getIndent()}<View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: ${gapVal} }}>\n`;
      indentLevel++;
      node.children.forEach(c => { out += walk(c, styles.gridCols, false, styles); });
      indentLevel--;
      out += `${getIndent()}</View>\n`;
      return out;
    }

    // View component in React Native
    const hasGradient = styles.gradient && styles.gradient.fromColor && styles.gradient.toColor;
    const tag = hasGradient ? "LinearGradient" : "View";
    if (hasGradient) {
      const { start, end } = gradientDirectionToRN(styles.gradient!.direction);
      const color1 = toRNColor(styles.gradient!.fromColor);
      const color2 = toRNColor(styles.gradient!.toColor);
      out += `${getIndent()}<LinearGradient\n`;
      out += `${getIndent()}  colors={[${color1}, ${color2}]}\n`;
      out += `${getIndent()}  start={{ x: ${start.x}, y: ${start.y} }}\n`;
      out += `${getIndent()}  end={{ x: ${end.x}, y: ${end.y} }}\n`;
      out += `${getIndent()}  style={{\n`;
    } else {
      out += `${getIndent()}<View style={{\n`;
    }

    if (isGridChildOfCols && isGridChildOfCols > 0) {
      out += `${getIndent()}  width: '${widthPercent}',\n`;
    }

    if (styles.isAbsolute) {
      out += `${getIndent()}  position: 'absolute',\n`;
      if (styles.isBackgroundAbsolute) {
        out += `${getIndent()}  top: 0,\n`;
        out += `${getIndent()}  left: 0,\n`;
        out += `${getIndent()}  right: 0,\n`;
        out += `${getIndent()}  bottom: 0,\n`;
      } else if (styles.absolutePosition) {
        const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
        if (top !== undefined || topToken) out += `${getIndent()}  top: ${topToken ? toRNThemeToken(topToken, "") : top},\n`;
        if (right !== undefined || rightToken) out += `${getIndent()}  right: ${rightToken ? toRNThemeToken(rightToken, "") : right},\n`;
        if (bottom !== undefined || bottomToken) out += `${getIndent()}  bottom: ${bottomToken ? toRNThemeToken(bottomToken, "") : bottom},\n`;
        if (left !== undefined || leftToken) out += `${getIndent()}  left: ${leftToken ? toRNThemeToken(leftToken, "") : left},\n`;
      }
    }

    let isRow = styles.flexDirection === "row";
    if (parentIsFixedBottomRow && !isButton && !isImage && !lucide && !styles.isRawSvg && !isTextLeaf && !styles.isGrid) {
      isRow = true; // Force horizontal layout inside fixed bottom row
    }

    out += `${getIndent()}  flexDirection: '${isRow ? "row" : "column"}',\n`;
    if (styles.alignItems !== "stretch") {
      out += `${getIndent()}  alignItems: '${styles.alignItems === "start" ? "flex-start" : styles.alignItems === "end" ? "flex-end" : "center"}',\n`;
    }

    let justify = "flex-start";
    if (styles.justifyContent !== "start") {
      justify = styles.justifyContent === "center" ? "center" : styles.justifyContent === "end" ? "flex-end" : styles.justifyContent === "between" ? "space-between" : "space-around";
    }
    if (styles.isFixedBottom && isRow && styles.justifyContent === "start") {
      justify = "space-around"; // Default bottom nav to space-around
    }
    if (justify !== "flex-start") {
      out += `${getIndent()}  justifyContent: '${justify}',\n`;
    }
    
    if (styles.gap > 0 || styles.gapToken) {
      const gapVal = styles.gapToken ? toRNThemeToken(styles.gapToken, "") : String(styles.gap);
      out += `${getIndent()}  gap: ${gapVal},\n`;
    }
    if (!(isGridChildOfCols && isGridChildOfCols > 0)) {
      if (styles.width === "100%" || styles.hasFlex1) out += `${getIndent()}  ${styles.hasFlex1 ? 'flex: 1' : "width: '100%'"},\n`;
      else if (typeof styles.width === "number") out += `${getIndent()}  width: ${styles.width},\n`;
    }
    if (typeof styles.height === "number") out += `${getIndent()}  height: ${styles.height},\n`;
    if (typeof styles.minHeight === "number" && styles.minHeight > 0) out += `${getIndent()}  minHeight: ${styles.minHeight},\n`;

    if (!hasGradient) {
      const identicalBg = hasIdenticalBackground(styles, parentStyles);
      if (!identicalBg) {
        if (styles.backgroundColorToken) {
          out += `${getIndent()}  backgroundColor: ${toRNThemeToken(styles.backgroundColorToken, "")},\n`;
        } else if (styles.backgroundColor !== "transparent") {
          out += `${getIndent()}  backgroundColor: '${styles.backgroundColor}',\n`;
        }
      }
    }
    
    if (styles.borderRadiusToken) {
      out += `${getIndent()}  borderRadius: ${toRNThemeToken(styles.borderRadiusToken, "")},\n`;
    } else if (styles.borderRadius > 0) {
      out += `${getIndent()}  borderRadius: ${styles.borderRadius},\n`;
    }

    // Border
    if (styles.borderWidth > 0 && styles.borderColor !== 'transparent') {
      const borderCol = styles.borderColorToken ? toRNThemeToken(styles.borderColorToken, '') : `'${styles.borderColor}'`;
      out += `${getIndent()}  borderWidth: ${styles.borderWidth},\n`;
      out += `${getIndent()}  borderColor: ${borderCol},\n`;
    }

    // Opacity
    if (styles.opacity < 1) {
      out += `${getIndent()}  opacity: ${styles.opacity},\n`;
    }

    // Padding
    const pt = styles.paddingTopToken ? toRNThemeToken(styles.paddingTopToken, "") : String(styles.padding.top);
    const pb = styles.paddingBottomToken ? toRNThemeToken(styles.paddingBottomToken, "") : String(styles.padding.bottom);
    const pl = styles.paddingLeftToken ? toRNThemeToken(styles.paddingLeftToken, "") : String(styles.padding.left);
    const pr = styles.paddingRightToken ? toRNThemeToken(styles.paddingRightToken, "") : String(styles.padding.right);

    if (styles.paddingLeftToken === "screenPadding" && styles.paddingRightToken === "screenPadding") {
      out += `${getIndent()}  paddingHorizontal: AppTheme.layout.screenPadding,\n`;
      if (styles.padding.top > 0 || styles.paddingTopToken) out += `${getIndent()}  paddingTop: ${pt},\n`;
      if (styles.padding.bottom > 0 || styles.paddingBottomToken) out += `${getIndent()}  paddingBottom: ${pb},\n`;
    } else {
      if (styles.padding.top > 0 || styles.paddingTopToken) out += `${getIndent()}  paddingTop: ${pt},\n`;
      if (styles.padding.bottom > 0 || styles.paddingBottomToken) out += `${getIndent()}  paddingBottom: ${pb},\n`;
      if (styles.padding.left > 0 || styles.paddingLeftToken) out += `${getIndent()}  paddingLeft: ${pl},\n`;
      if (styles.padding.right > 0 || styles.paddingRightToken) out += `${getIndent()}  paddingRight: ${pr},\n`;
    }

    out += `${getIndent()}}}>\n`;
    indentLevel++;

    const normalChildren = node.children.filter(c => typeof c === 'string' || !c.styles.isAbsolute);
    const absoluteChildren = node.children.filter(c => typeof c !== 'string' && c.styles.isAbsolute) as TranspileNode[];

    const bgAbsoluteChildren = absoluteChildren.filter(c => c.styles.isBackgroundAbsolute);
    const fgAbsoluteChildren = absoluteChildren.filter(c => !c.styles.isBackgroundAbsolute);

    const isCurrentFixedBottomRow = styles.isFixedBottom && isRow;

    bgAbsoluteChildren.forEach(c => {
      out += walk(c, isGridChildOfCols, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles);
    });
    normalChildren.forEach(c => {
      out += walk(c, isGridChildOfCols, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles);
    });
    fgAbsoluteChildren.forEach(c => {
      out += walk(c, isGridChildOfCols, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles);
    });

    indentLevel--;
    out += `${getIndent()}</${tag}>\n`;
    return out;
  }

  return walk(root);
}

// ---------------------------------------------------------------------------
// FLUTTER TRANSPILER
// ---------------------------------------------------------------------------
// Spacing/Color theme-aware helpers for Flutter
function toFlutterThemeToken(token: string | undefined, fallbackVal: string): string {
  if (!token) return fallbackVal;
  if (token === "bgPrimary") return "AppTheme.backgroundPrimary";
  if (token === "bgSecondary") return "AppTheme.backgroundSecondary";
  return `AppTheme.${token}`;
}

export function transpileToFlutter(root: TranspileNode): string {
  let indentLevel = 1;
  const getIndent = () => "  ".repeat(indentLevel);

  function wrapExpandedIfNeeded(node: TranspileNode, outCode: string, indent: string): string {
    if (node.styles.hasFlex1 && !node.styles.isAbsolute) {
      return `${indent}Expanded(\n` +
             `${indent}  child: ${outCode.trim()},\n` +
             `${indent})\n`;
    }
    return outCode;
  }

  function walk(node: TranspileNode | string, parentIsFixedBottomRow = false, parentStyles?: ParsedStyles): string {
    if (typeof node === "string") {
      return `${getIndent()}Text('${node.replace(/'/g, "\\'")}')\n`;
    }

    if (typeof node !== "string" && isRedundantWrapper(node)) {
      return walk(node.children[0], parentIsFixedBottomRow, parentStyles);
    }

    const { styles } = node;
    const isButton = node.tagName === "button" || node.tagName === "a";
    const isImage = node.tagName === "img";
    const lucide = node.attributes["data-lucide"] || node.attributes["data-drawgle-icon"];
    
    let out = "";

    if (lucide) {
      const tintColor = styles.textColorToken ? toFlutterThemeToken(styles.textColorToken, "") : toFlutterColor(styles.textColor);
      out += `${getIndent()}Icon(${toFlutterIconName(lucide)}, size: ${styles.fontSize || 24}.0, color: ${tintColor})\n`;
      return wrapExpandedIfNeeded(node, out, getIndent());
    }

    // Raw SVG placeholder
    if (styles.isRawSvg) {
      const svgW = typeof styles.width === 'number' ? styles.width : 48;
      const svgH = typeof styles.height === 'number' ? styles.height : 48;
      
      const circleChildren = node.children.filter(c => typeof c !== "string" && c.tagName === "circle") as TranspileNode[];
      if (circleChildren.length > 0) {
        let svgOut = `${getIndent()}Stack(\n`;
        svgOut += `${getIndent()}  alignment: Alignment.center,\n`;
        svgOut += `${getIndent()}  children: [\n`;
        indentLevel++;
        circleChildren.forEach(circle => {
          const strokeWidth = parseFloat(circle.attributes["stroke-width"]) || 1;
          const strokeColorStr = circle.attributes["stroke"] || "black";
          const tokenKey = strokeColorStr.startsWith("var(") ? getStyleTokenKey(strokeColorStr) : undefined;
          const strokeColor = tokenKey 
            ? toFlutterThemeToken(tokenKey, "") 
            : toFlutterColor(resolveColorToStandard(strokeColorStr));
            
          const strokeLinecap = circle.attributes["stroke-linecap"] === "round" ? "StrokeCap.round" : "StrokeCap.square";
          const dashArray = parseFloat(circle.attributes["stroke-dasharray"]) || 0;
          const dashOffset = parseFloat(circle.attributes["stroke-dashoffset"]) || 0;
          
          let progress = 1.0;
          if (dashArray > 0) {
            progress = 1.0 - (dashOffset / dashArray);
            if (progress < 0) progress = 0;
            if (progress > 1) progress = 1;
          }
          
          svgOut += `${getIndent()}  SizedBox(\n`;
          svgOut += `${getIndent()}    width: ${svgW}.0,\n`;
          svgOut += `${getIndent()}    height: ${svgH}.0,\n`;
          svgOut += `${getIndent()}    child: CircularProgressIndicator(\n`;
          svgOut += `${getIndent()}      value: ${progress.toFixed(2)},\n`;
          svgOut += `${getIndent()}      valueColor: AlwaysStoppedAnimation<Color>(${strokeColor}),\n`;
          svgOut += `${getIndent()}      strokeWidth: ${strokeWidth}.0,\n`;
          if (strokeLinecap === "StrokeCap.round") {
            svgOut += `${getIndent()}      strokeCap: StrokeCap.round,\n`;
          }
          svgOut += `${getIndent()}    ),\n`;
          svgOut += `${getIndent()}  ),\n`;
        });
        indentLevel--;
        svgOut += `${getIndent()}  ],\n`;
        svgOut += `${getIndent()})\n`;
        return wrapExpandedIfNeeded(node, svgOut, getIndent());
      }
      
      out += `${getIndent()}SizedBox(width: ${svgW}.0, height: ${svgH}.0) // TODO: Add custom SVG/Asset\n`;
      return wrapExpandedIfNeeded(node, out, getIndent());
    }

    if (isImage) {
      const src = node.attributes["src"] || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809";
      const rad = styles.borderRadiusToken ? toFlutterThemeToken(styles.borderRadiusToken, "") : `${(styles.borderRadius || 0)}.0`;
      out += `${getIndent()}ClipRRect(\n`;
      out += `${getIndent()}  borderRadius: BorderRadius.circular(${rad}),\n`;
      out += `${getIndent()}  child: Image.network(\n`;
      out += `${getIndent()}    '${src}',\n`;
      if (typeof styles.width === "number") out += `${getIndent()}    width: ${styles.width}.0,\n`;
      if (typeof styles.height === "number") out += `${getIndent()}    height: ${styles.height}.0,\n`;
      out += `${getIndent()}    fit: BoxFit.cover,\n`,
      out += `${getIndent()}  ),\n`;
      out += `${getIndent()})\n`;
      return wrapExpandedIfNeeded(node, out, getIndent());
    }

    if (isButton) {
      const containerColor = styles.backgroundColorToken ? toFlutterThemeToken(styles.backgroundColorToken, "") : toFlutterColor(styles.backgroundColor);
      const btnRadius = styles.borderRadiusToken ? toFlutterThemeToken(styles.borderRadiusToken, "") : `${(styles.borderRadius || 12)}.0`;
      const paddingX = styles.paddingLeftToken ? toFlutterThemeToken(styles.paddingLeftToken, "") : `${(styles.padding.left || 16)}.0`;
      const paddingY = styles.paddingTopToken ? toFlutterThemeToken(styles.paddingTopToken, "") : `${(styles.padding.top || 12)}.0`;

      out += `${getIndent()}ElevatedButton(\n`;
      out += `${getIndent()}  onPressed: () {},\n`;
      out += `${getIndent()}  style: ElevatedButton.styleFrom(\n`;
      out += `${getIndent()}    backgroundColor: ${containerColor},\n`;
      out += `${getIndent()}    shape: RoundedRectangleBorder(\n`;
      out += `${getIndent()}      borderRadius: BorderRadius.circular(${btnRadius}),\n`;
      out += `${getIndent()}    ),\n`;
      out += `${getIndent()}    padding: EdgeInsets.symmetric(horizontal: ${paddingX}, vertical: ${paddingY}),\n`;
      out += `${getIndent()}  ),\n`;
      out += `${getIndent()}  child: Row(\n`;
      out += `${getIndent()}    mainAxisSize: MainAxisSize.min,\n`;
      out += `${getIndent()}    children: [\n`;
      indentLevel += 3;
      node.children.forEach((c, idx) => {
        out += walk(c, parentIsFixedBottomRow, styles);
        if (idx < node.children.length - 1) {
          out = out.trimEnd() + ",\n";
          const btnGap = styles.gapToken ? toFlutterThemeToken(styles.gapToken, "") : `${(styles.gap || 8)}.0`;
          out += `${getIndent()}SizedBox(width: ${btnGap}),\n`;
        }
      });
      indentLevel -= 3;
      out += `${getIndent()}    ],\n`;
      out += `${getIndent()}  ),\n`;
      out += `${getIndent()})\n`;
      return wrapExpandedIfNeeded(node, out, getIndent());
    }

    const isTextLeaf = ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6"].includes(node.tagName) && 
                       node.children.length === 1 && typeof node.children[0] === "string";

    if (isTextLeaf) {
      const textVal = node.children[0] as string;
      out += `${getIndent()}Text(\n`;
      out += `${getIndent()}  '${textVal.replace(/'/g, "\\'")}',\n`;
      
      let hasStyle = (styles.fontSize !== undefined) || 
                     (styles.textColorToken !== undefined || (styles.textColor && styles.textColor !== "transparent")) ||
                     (styles.fontWeight !== undefined);

      if (hasStyle) {
        out += `${getIndent()}  style: TextStyle(\n`;
        if (styles.fontSize !== undefined) {
          out += `${getIndent()}    fontSize: ${styles.fontSize}.0,\n`;
        }
        if (styles.textColorToken || (styles.textColor && styles.textColor !== "transparent")) {
          const textTint = styles.textColorToken ? toFlutterThemeToken(styles.textColorToken, "") : toFlutterColor(styles.textColor);
          out += `${getIndent()}    color: ${textTint},\n`;
        }
        if (styles.fontWeight !== undefined) {
          if (styles.fontWeight === "heavy") {
            out += `${getIndent()}    fontWeight: FontWeight.w800,\n`;
          } else if (styles.fontWeight === "bold") {
            out += `${getIndent()}    fontWeight: FontWeight.bold,\n`;
          } else if (styles.fontWeight === "semibold") {
            out += `${getIndent()}    fontWeight: FontWeight.w600,\n`;
          } else if (styles.fontWeight === "medium") {
            out += `${getIndent()}    fontWeight: FontWeight.w500,\n`;
          } else {
            out += `${getIndent()}    fontWeight: FontWeight.normal,\n`;
          }
        }
        out += `${getIndent()}  ),\n`;
      }
      if (styles.textAlign !== undefined) {
        if (styles.textAlign === "center") {
          out += `${getIndent()}  textAlign: TextAlign.center,\n`;
        } else if (styles.textAlign === "right") {
          out += `${getIndent()}  textAlign: TextAlign.right,\n`;
        } else if (styles.textAlign === "left") {
          out += `${getIndent()}  textAlign: TextAlign.left,\n`;
        }
      }
      out += `${getIndent()})\n`;
      
      // Wrap with Padding if margins exist
      const mt = styles.marginTopToken ? toFlutterThemeToken(styles.marginTopToken, "") : `${styles.margin.top}.0`;
      const mb = styles.marginBottomToken ? toFlutterThemeToken(styles.marginBottomToken, "") : `${styles.margin.bottom}.0`;
      if (styles.margin.top > 0 || styles.margin.bottom > 0 || styles.marginTopToken || styles.marginBottomToken) {
        out = `${getIndent()}Padding(\n` +
              `${getIndent()}  padding: EdgeInsets.only(top: ${mt}, bottom: ${mb}),\n` +
              `${getIndent()}  child: ${out.trim()},\n` +
              `${getIndent()})\n`;
      }
      return wrapExpandedIfNeeded(node, out, getIndent());
    }

    // Grid Layout → GridView.count or Wrap
    if (styles.isGrid && styles.gridCols > 0) {
      const spacing = styles.gapToken ? toFlutterThemeToken(styles.gapToken, '') : `${styles.gap}.0`;
      const useWrap = styles.gridCols >= 4;
      
      if (useWrap) {
        out += `${getIndent()}Wrap(\n`;
        out += `${getIndent()}  spacing: ${spacing},\n`;
        out += `${getIndent()}  runSpacing: ${spacing},\n`;
        out += `${getIndent()}  children: [\n`;
        indentLevel += 2;
        node.children.forEach((c, idx) => {
          out += walk(c, false, styles);
          if (idx < node.children.length - 1) out = out.trimEnd() + ",\n";
        });
        indentLevel -= 2;
        out += `${getIndent()}  ],\n`;
        out += `${getIndent()})\n`;
      } else {
        out += `${getIndent()}GridView.count(\n`;
        out += `${getIndent()}  crossAxisCount: ${styles.gridCols},\n`;
        out += `${getIndent()}  crossAxisSpacing: ${spacing},\n`;
        out += `${getIndent()}  mainAxisSpacing: ${spacing},\n`;
        out += `${getIndent()}  shrinkWrap: true,\n`;
        out += `${getIndent()}  physics: NeverScrollableScrollPhysics(),\n`;
        out += `${getIndent()}  children: [\n`;
        indentLevel += 2;
        node.children.forEach((c, idx) => {
          out += walk(c, false, styles);
          if (idx < node.children.length - 1) out = out.trimEnd() + ",\n";
        });
        indentLevel -= 2;
        out += `${getIndent()}  ],\n`;
        out += `${getIndent()})\n`;
      }
      return wrapExpandedIfNeeded(node, out, getIndent());
    }

    // Stack container (Column / Row) in Flutter
    let isCol = styles.flexDirection === "column";
    if (parentIsFixedBottomRow && !isButton && !isImage && !lucide && !styles.isRawSvg && !isTextLeaf && !styles.isGrid) {
      isCol = false; // Force horizontal layout inside fixed bottom row
    }
    const widgetName = isCol ? "Column" : "Row";
    
    let containerWrap = false;
    let decoration = "";
    
    // Determine decoration — with gradient support
    const identicalBg = hasIdenticalBackground(styles, parentStyles);
    const hasBg = (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) ||
                  (!identicalBg && (styles.backgroundColorToken || styles.backgroundColor !== "transparent"));

    if (hasBg ||
        styles.borderRadiusToken || styles.borderRadius > 0 || 
        styles.borderColorToken || styles.borderWidth > 0) {
      containerWrap = true;
      decoration += `    decoration: BoxDecoration(\n`;

      // Gradient background
      if (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) {
        const { begin, end } = gradientDirectionToFlutter(styles.gradient.direction);
        decoration += `      gradient: LinearGradient(\n`;
        decoration += `        begin: ${begin},\n`;
        decoration += `        end: ${end},\n`;
        decoration += `        colors: [${toFlutterColor(styles.gradient.fromColor)}, ${toFlutterColor(styles.gradient.toColor)}],\n`;
        decoration += `      ),\n`;
      } else if (!identicalBg && styles.backgroundColorToken) {
        decoration += `      color: ${toFlutterThemeToken(styles.backgroundColorToken, "")},\n`;
      } else if (!identicalBg && styles.backgroundColor !== "transparent") {
        decoration += `      color: ${toFlutterColor(styles.backgroundColor)},\n`;
      }
      
      if (styles.borderRadiusToken) {
        decoration += `      borderRadius: BorderRadius.circular(${toFlutterThemeToken(styles.borderRadiusToken, "")}),\n`;
      } else if (styles.borderRadius > 0) {
        decoration += `      borderRadius: BorderRadius.circular(${styles.borderRadius}.0),\n`;
      }
      
      if (styles.borderColorToken || styles.borderWidth > 0) {
        const borderCol = styles.borderColorToken ? toFlutterThemeToken(styles.borderColorToken, "") : toFlutterColor(styles.borderColor);
        decoration += `      border: Border.all(color: ${borderCol}, width: ${styles.borderWidth || 1}.0),\n`;
      }
      decoration += `    ),\n`;
    }

    // Determine dimensions & padding wrapping
    let sizeAttrs = "";
    if (typeof styles.width === "number") sizeAttrs += `    width: ${styles.width}.0,\n`;
    else if (styles.width === "100%" || styles.hasFlex1) sizeAttrs += `    width: double.infinity,\n`;
    if (typeof styles.height === "number") sizeAttrs += `    height: ${styles.height}.0,\n`;
    if (typeof styles.minHeight === "number" && styles.minHeight > 0) {
      sizeAttrs += `    constraints: BoxConstraints(minHeight: ${styles.minHeight}.0),\n`;
    }
    
    const pt = styles.paddingTopToken ? toFlutterThemeToken(styles.paddingTopToken, "") : `${styles.padding.top}.0`;
    const pb = styles.paddingBottomToken ? toFlutterThemeToken(styles.paddingBottomToken, "") : `${styles.padding.bottom}.0`;
    const pl = styles.paddingLeftToken ? toFlutterThemeToken(styles.paddingLeftToken, "") : `${styles.padding.left}.0`;
    const pr = styles.paddingRightToken ? toFlutterThemeToken(styles.paddingRightToken, "") : `${styles.padding.right}.0`;
    let paddingWrap = "";

    if (styles.paddingLeftToken === "screenPadding" && styles.paddingRightToken === "screenPadding") {
      paddingWrap = `    padding: EdgeInsets.only(left: AppTheme.screenPadding, top: ${pt}, right: AppTheme.screenPadding, bottom: ${pb}),\n`;
      containerWrap = true;
    } else if (styles.padding.top > 0 || styles.padding.bottom > 0 || styles.padding.left > 0 || styles.padding.right > 0 ||
               styles.paddingTopToken || styles.paddingBottomToken || styles.paddingLeftToken || styles.paddingRightToken) {
      paddingWrap = `    padding: EdgeInsets.only(left: ${pl}, top: ${pt}, right: ${pr}, bottom: ${pb}),\n`;
      containerWrap = true;
    }

    // Nested stack children
    const alignStr = isCol
      ? `crossAxisAlignment: CrossAxisAlignment.${styles.alignItems === "start" ? "start" : styles.alignItems === "end" ? "end" : styles.alignItems === "center" ? "center" : "stretch"}`
      : `crossAxisAlignment: CrossAxisAlignment.${styles.alignItems === "start" ? "start" : styles.alignItems === "end" ? "end" : "center"}`;
    
    let justifyVal = "start";
    if (styles.justifyContent !== "start") {
      justifyVal = styles.justifyContent === "center" ? "center" : styles.justifyContent === "end" ? "end" : styles.justifyContent === "between" ? "spaceBetween" : "spaceAround";
    }
    if (styles.isFixedBottom && !isCol && styles.justifyContent === "start") {
      justifyVal = "spaceAround"; // Default bottom nav to spaceAround
    }
    const justifyStr = `mainAxisAlignment: MainAxisAlignment.${justifyVal}`;

    const normalChildren = node.children.filter(c => typeof c === 'string' || !c.styles.isAbsolute);
    const absoluteChildren = node.children.filter(c => typeof c !== 'string' && c.styles.isAbsolute) as TranspileNode[];
    const hasAbsolute = absoluteChildren.length > 0;

    const isCurrentFixedBottomRow = styles.isFixedBottom && !isCol;

    let innerStackOut = "";
    if (normalChildren.length > 0) {
      innerStackOut += `${getIndent()}${widgetName}(\n`;
      innerStackOut += `${getIndent()}  ${alignStr},\n`;
      innerStackOut += `${getIndent()}  ${justifyStr},\n`;
      innerStackOut += `${getIndent()}  children: [\n`;
      
      indentLevel++;
      normalChildren.forEach((c, idx) => {
        innerStackOut += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles);
        if (idx < normalChildren.length - 1) {
          innerStackOut = innerStackOut.trimEnd() + ",\n";
          if (styles.gap > 0 || styles.gapToken) {
            const gapVal = styles.gapToken ? toFlutterThemeToken(styles.gapToken, "") : `${styles.gap}.0`;
            const gapSize = isCol ? `height: ${gapVal}` : `width: ${gapVal}`;
            innerStackOut += `${getIndent()}SizedBox(${gapSize}),\n`;
          }
        }
      });
      indentLevel--;
      innerStackOut += `${getIndent()}  ],\n`;
      innerStackOut += `${getIndent()})\n`;
    }

    if (containerWrap || sizeAttrs) {
      if (innerStackOut.trim() !== "") {
        innerStackOut = `${getIndent()}Container(\n` +
                        (sizeAttrs ? getIndent() + "  " + sizeAttrs.trim() + "\n" : "") +
                        (paddingWrap ? getIndent() + "  " + paddingWrap.trim() + "\n" : "") +
                        (decoration ? getIndent() + "  " + decoration.trim() + "\n" : "") +
                        `${getIndent()}  child: ${innerStackOut.trim()},\n` +
                        `${getIndent()})\n`;
      } else {
        innerStackOut = `${getIndent()}Container(\n` +
                        (sizeAttrs ? getIndent() + "  " + sizeAttrs.trim() + "\n" : "") +
                        (paddingWrap ? getIndent() + "  " + paddingWrap.trim() + "\n" : "") +
                        (decoration ? getIndent() + "  " + decoration.trim() + "\n" : "") +
                        `${getIndent()})\n`;
      }
    }

    if (hasAbsolute) {
      const bgAbsoluteChildren = absoluteChildren.filter(c => c.styles.isBackgroundAbsolute);
      const fgAbsoluteChildren = absoluteChildren.filter(c => !c.styles.isBackgroundAbsolute);

      out += `${getIndent()}Stack(\n`;
      out += `${getIndent()}  children: [\n`;
      indentLevel++;
      
      // 1. Paint background absolute children FIRST (bottom of Stack painting hierarchy)
      bgAbsoluteChildren.forEach(c => {
        out += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles).trimEnd() + ",\n";
      });

      // 2. Paint normal children inside Stack
      if (innerStackOut.trim() !== "") {
        out += innerStackOut.trimEnd() + ",\n";
      }

      // 3. Paint foreground absolute children LAST (top of Stack painting hierarchy)
      fgAbsoluteChildren.forEach(c => {
        out += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles).trimEnd() + ",\n";
      });

      indentLevel--;
      out += `${getIndent()}  ],\n`;
      out += `${getIndent()})\n`;
    } else {
      out += innerStackOut;
    }

    if (typeof node !== "string") {
      if (styles.opacity < 1) {
        out = `${getIndent()}Opacity(\n` +
              `${getIndent()}  opacity: ${styles.opacity},\n` +
              `${getIndent()}  child: ${out.trim()},\n` +
              `${getIndent()})\n`;
      }
      if (styles.isAbsolute) {
        if (styles.isBackgroundAbsolute) {
          out = `${getIndent()}Positioned.fill(\n` +
                `${getIndent()}  child: ${out.trim()},\n` +
                `${getIndent()})\n`;
        } else if (styles.absolutePosition) {
          const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
          let posAttrs = "";
          if (top !== undefined || topToken) posAttrs += `top: ${topToken ? toFlutterThemeToken(topToken, "") : `${top}.0`}, `;
          if (right !== undefined || rightToken) posAttrs += `right: ${rightToken ? toFlutterThemeToken(rightToken, "") : `${right}.0`}, `;
          if (bottom !== undefined || bottomToken) posAttrs += `bottom: ${bottomToken ? toFlutterThemeToken(bottomToken, "") : `${bottom}.0`}, `;
          if (left !== undefined || leftToken) posAttrs += `left: ${leftToken ? toFlutterThemeToken(leftToken, "") : `${left}.0`}, `;
          
          out = `${getIndent()}Positioned(\n` +
                `${getIndent()}  ${posAttrs.trim()}\n` +
                `${getIndent()}  child: ${out.trim()},\n` +
                `${getIndent()})\n`;
        } else {
          out = `${getIndent()}Positioned.fill(\n` +
                `${getIndent()}  child: ${out.trim()},\n` +
                `${getIndent()})\n`;
        }
      }
      if (styles.isFixedBottom) {
        out = `${getIndent()}Align(\n` +
              `${getIndent()}  alignment: Alignment.bottomCenter,\n` +
              `${getIndent()}  child: ${out.trim()},\n` +
              `${getIndent()})\n`;
      }
      if (styles.hasFlex1 && !styles.isAbsolute) {
        out = `${getIndent()}Expanded(\n` +
              `${getIndent()}  child: ${out.trim()},\n` +
              `${getIndent()})\n`;
      }
    }

    return out;
  }

  return walk(root);
}
