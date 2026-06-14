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

export interface SemanticPattern {
  type: 'divider' | 'status-dot' | 'progress-bar';
  metadata: any;
}

export interface TranspileNode {
  tagName: string;
  classes: string[];
  id: string;
  styleText: string;
  styles: ParsedStyles;
  attributes: Record<string, string>;
  children: (TranspileNode | string)[];
  pattern?: SemanticPattern;
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

export function toFlutterIconName(lucideName: string): string {
  return `Icons.${lucideName.replace(/-/g, '_')}`;
}

export function toComposeIconName(lucideName: string): string {
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

export function toSwiftSFSymbol(lucideName: string): string {
  const normalized = lucideName.trim().toLowerCase();
  if (LUCIDE_TO_SF_SYMBOL[normalized]) {
    return LUCIDE_TO_SF_SYMBOL[normalized];
  }
  // SF Symbols use dot-separated names; best-effort conversion from Lucide kebab-case
  return lucideName.replace(/-/g, '.');
}

export function toSwiftCamelCase(lucideName: string): string {
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

export function toRNIconName(lucideName: string): string {
  return lucideName; // React Native icon libraries accept kebab-case directly
}

export function parsePixel(value: string | undefined): number {
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

export function parseFontWeight(val: string, varMap?: Map<string, string>): "normal" | "medium" | "semibold" | "bold" | "heavy" {
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

export function hasIdenticalBackground(styles: ParsedStyles, parentStyles?: ParsedStyles): boolean {
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

export function resolveTokenToColor(token: string): string {
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
export function resolveArbitraryValue(val: string, varMap: Map<string, string>): number {
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
export function resolveArbitraryColor(val: string, varMap: Map<string, string>): string {
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

export function getStyleTokenKey(varName: string): string | undefined {
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

export function parseColorString(colorStr: string | undefined): { r: number; g: number; b: number; a: number; isRgba: boolean; hex: string } {
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

export function resolveColorToStandard(colorStr: string, varMap?: Map<string, string>): string {
  const parsed = parseCssColor(colorStr, varMap);
  if (parsed.opacity !== undefined) {
    const parsedBase = parseColorString(parsed.color);
    return `rgba(${parsedBase.r}, ${parsedBase.g}, ${parsedBase.b}, ${parsed.opacity})`;
  }
  return parsed.color;
}

export function toSwiftColor(colorStr: string | undefined): string {
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

export function toSwiftBackgroundGradient(styles: ParsedStyles, indent: string, baseColor: string = "Color.clear"): string {
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

export function toComposeColor(colorStr: string | undefined): string {
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

export function toFlutterColor(colorStr: string | undefined): string {
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

export function toRNColor(colorStr: string | undefined): string {
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
        explicitTextColor = true;
      } else if (col.startsWith("[var(")) {
        const varPart = col.substring(1, col.length - 1);
        if (!varPart.includes("-size") && !varPart.includes("-weight") && !varPart.includes("-line-height")) {
          textColor = resolveCssVariable(varPart, varMap);
          textColorToken = getStyleTokenKey(varPart);
          explicitTextColor = true;
        }
      } else if (col.startsWith("[#")) {
        textColor = col.substring(1, col.length - 1);
        explicitTextColor = true;
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

    if (c === "dg-shadow-surface" || c === "shadow-sm" || c === "shadow") shadow = "surface";
    if (c === "dg-shadow-overlay" || c === "shadow-md" || c === "shadow-lg" || c === "shadow-xl" || c === "shadow-2xl") shadow = "overlay";
    if (c.startsWith("shadow-[")) {
      const val = c.substring(8, c.length - 1);
      if (val.includes("overlay")) {
        shadow = "overlay";
      } else if (val.includes("surface")) {
        shadow = "surface";
      } else {
        shadow = "surface";
      }
    }

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
    if (c.styles.backgroundColorToken) return true;
    if (c.styles.borderWidth > 0) return true;
    if (c.styles.borderColorToken) return true;
    if (c.tagName === 'hr') return true;
    // Keep empty nodes with explicit 1px thickness for dividers
    if (c.styles.width === 1 || c.styles.width === "1px" || c.styles.height === 1 || c.styles.height === "1px") return true;
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

export function optimizeAST(node: TranspileNode): TranspileNode {
  // 1. Recursively optimize children first
  node.children = node.children.map(child => {
    if (typeof child === "string") return child;
    return optimizeAST(child);
  });

  // 2. If the node has exactly one child that is not a string, and it is a wrapper container
  if (
    node.children.length === 1 &&
    typeof node.children[0] !== "string" &&
    ["div", "section", "header", "footer", "span"].includes(node.tagName)
  ) {
    const child = node.children[0] as TranspileNode;

    // A container is redundant and can be elevated if it has no styling of its own:
    const hasStyling =
      node.styles.padding.top > 0 || node.styles.padding.bottom > 0 ||
      node.styles.padding.left > 0 || node.styles.padding.right > 0 ||
      node.styles.paddingTopToken || node.styles.paddingBottomToken ||
      node.styles.paddingLeftToken || node.styles.paddingRightToken ||
      node.styles.margin.top > 0 || node.styles.margin.bottom > 0 ||
      node.styles.margin.left > 0 || node.styles.margin.right > 0 ||
      node.styles.marginTopToken || node.styles.marginBottomToken ||
      node.styles.marginLeftToken || node.styles.marginRightToken ||
      (node.styles.backgroundColor && node.styles.backgroundColor !== "transparent") ||
      node.styles.backgroundColorToken || node.styles.gradient ||
      (node.styles.borderWidth > 0 && node.styles.borderColor !== "transparent") ||
      node.styles.borderColorToken || node.styles.borderRadius > 0 || node.styles.borderRadiusToken ||
      node.styles.shadow || node.styles.opacity < 1 || node.styles.isAbsolute || node.styles.isFixedBottom ||
      node.styles.backdropFilterBlur || node.styles.hasFlex1 ||
      (typeof node.styles.width === "number" || node.styles.width === "100%") ||
      (typeof node.styles.height === "number") || node.styles.isGrid;

    if (!hasStyling) {
      return child;
    }
  }

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

  let tree = buildTranspileTree(root, varMap, cssRules);
  if (tree) {
    cascadeInheritedStyles(tree);
    postProcessAST(tree);
    tree = optimizeAST(tree);
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

export function gradientDirectionToSwift(direction: string): { start: string; end: string } {
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

export function gradientDirectionToCompose(direction: string): { start: string; end: string } {
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

export function gradientDirectionToFlutter(direction: string): { begin: string; end: string } {
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

export function isRedundantWrapper(node: TranspileNode): boolean {
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
export function cleanHexColor(hex: string | undefined): string {
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
export const formatSize = (size: string | number): string => {
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

export function detectSemanticPatterns(node: TranspileNode): void {
  const { styles, tagName, children } = node;
  const isEmptyContainer = children.length === 0;

  // Pattern 1: Divider
  if (tagName === "hr") {
    node.pattern = {
      type: 'divider',
      metadata: { orientation: 'horizontal' }
    };
    return;
  }

  if (isEmptyContainer && (tagName === "div" || tagName === "span")) {
    const isVertical = styles.width === 1 || styles.width === "1px";
    const isHorizontal = styles.height === 1 || styles.height === "1px";
    if (isVertical) {
      node.pattern = {
        type: 'divider',
        metadata: { orientation: 'vertical' }
      };
      return;
    } else if (isHorizontal) {
      node.pattern = {
        type: 'divider',
        metadata: { orientation: 'horizontal' }
      };
      return;
    }
  }

  // Pattern 2: Status Dot
  if (isEmptyContainer && (tagName === "div" || tagName === "span")) {
    const hasBg = styles.backgroundColorToken || (styles.backgroundColor && styles.backgroundColor !== "transparent");
    const hasRadius = styles.borderRadiusToken === "borderRadiusPill" || styles.borderRadiusToken === "pill" || styles.borderRadius >= 9999 || styles.borderRadius > 0;
    const w = styles.width;
    const h = styles.height;
    if (hasBg && hasRadius && typeof w === "number" && typeof h === "number" && w === h && w > 0) {
      node.pattern = {
        type: 'status-dot',
        metadata: {
          size: w,
          color: styles.backgroundColor,
          colorToken: styles.backgroundColorToken
        }
      };
      return;
    }
  }

  // Pattern 3: Progress Bar
  if (children.length === 1 && (tagName === "div" || tagName === "span")) {
    const child = children[0];
    if (typeof child !== "string" && (child.tagName === "div" || child.tagName === "span") && child.children.length === 0) {
      const outerBg = styles.backgroundColorToken || (styles.backgroundColor && styles.backgroundColor !== "transparent");
      const innerBg = child.styles.backgroundColorToken || (child.styles.backgroundColor && child.styles.backgroundColor !== "transparent");
      
      const childW = child.styles.width;
      const isPercentWidth = typeof childW === "string" && childW.endsWith("%");
      
      if (outerBg && innerBg && isPercentWidth) {
        const percent = parseFloat(childW);
        if (!isNaN(percent) && percent >= 0 && percent <= 100) {
          node.pattern = {
            type: 'progress-bar',
            metadata: {
              value: percent / 100, // 0.0 to 1.0
              originalPercent: childW,
              outerHeight: typeof styles.height === "number" ? styles.height : (typeof child.styles.height === "number" ? child.styles.height : 8),
              outerColor: styles.backgroundColor,
              outerColorToken: styles.backgroundColorToken,
              innerColor: child.styles.backgroundColor,
              innerColorToken: child.styles.backgroundColorToken,
              borderRadius: styles.borderRadius || child.styles.borderRadius || 9999,
              borderRadiusToken: styles.borderRadiusToken || child.styles.borderRadiusToken
            }
          };
          return;
        }
      }
    }
  }
}

export function postProcessAST(
  node: TranspileNode,
  parentIsGrid: boolean = false
): void {
  if (parentIsGrid) {
    node.styles.hasFlex1 = true;
    node.styles.width = "100%";
  }

  detectSemanticPatterns(node);

  const isGrid = node.styles.isGrid && node.styles.gridCols > 0;
  node.children.forEach(child => {
    if (typeof child !== "string") {
      postProcessAST(child, isGrid);
    }
  });
}

export function generateSwiftUIFilters(styles: ParsedStyles, indent: string): string {
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
export function toSwiftThemeToken(token: string | undefined, fallbackVal: string): string {
  if (!token) return fallbackVal;
  if (token === "bgPrimary") return "AppTheme.backgroundPrimary";
  if (token === "bgSecondary") return "AppTheme.backgroundSecondary";
  return `AppTheme.${token}`;
}
export { transpileToSwiftUI } from "./generators/swiftui-generator";
export { transpileToCompose } from "./generators/compose-generator";
export { transpileToReactNative } from "./generators/react-native-generator";
export { transpileToFlutter } from "./generators/flutter-generator";
