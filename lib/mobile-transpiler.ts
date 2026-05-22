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
  textColor: string; // Hex color e.g. "#111827" or "transparent"

  borderRadius: number;
  borderWidth: number;
  borderColor: string;

  fontSize: number;
  fontWeight: "normal" | "medium" | "semibold" | "bold";
  textAlign: "left" | "center" | "right";

  shadow: string | null; // e.g. "surface", "overlay", or null
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

// Map Lucide icons to SF Symbols (SwiftUI), Jetpack Compose standard Icons, and Material Icons (Flutter)
const ICON_MAP: Record<string, { sf: string; compose: string; flutter: string }> = {
  "home": { sf: "house.fill", compose: "Icons.Default.Home", flutter: "Icons.home" },
  "search": { sf: "magnifyingglass", compose: "Icons.Default.Search", flutter: "Icons.search" },
  "settings": { sf: "gearshape.fill", compose: "Icons.Default.Settings", flutter: "Icons.settings" },
  "user": { sf: "person.crop.circle.fill", compose: "Icons.Default.Person", flutter: "Icons.person" },
  "bell": { sf: "bell.fill", compose: "Icons.Default.Notifications", flutter: "Icons.notifications" },
  "heart": { sf: "heart.fill", compose: "Icons.Default.Favorite", flutter: "Icons.favorite" },
  "plus": { sf: "plus.circle.fill", compose: "Icons.Default.Add", flutter: "Icons.add" },
  "check": { sf: "checkmark.circle.fill", compose: "Icons.Default.Check", flutter: "Icons.check" },
  "x": { sf: "xmark.circle.fill", compose: "Icons.Default.Close", flutter: "Icons.close" },
  "arrow-left": { sf: "arrow.left", compose: "Icons.Default.ArrowBack", flutter: "Icons.arrow_back" },
  "chevron-right": { sf: "chevron.right", compose: "Icons.Default.KeyboardArrowRight", flutter: "Icons.keyboard_arrow_right" },
  "chevron-left": { sf: "chevron.left", compose: "Icons.Default.KeyboardArrowLeft", flutter: "Icons.keyboard_arrow_left" },
  "camera": { sf: "camera.fill", compose: "Icons.Default.PlayArrow", flutter: "Icons.camera_alt" },
  "image": { sf: "photo.fill", compose: "Icons.Default.List", flutter: "Icons.image" },
  "trash": { sf: "trash.fill", compose: "Icons.Default.Delete", flutter: "Icons.delete" },
};

function parsePixel(value: string | undefined): number {
  if (!value) return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

function resolveCssVariable(varName: string, varMap: Map<string, string>): string {
  const cleanVar = varName.trim().replace(/^var\(/, "").replace(/\)$/, "").trim();
  return varMap.get(cleanVar) || varName;
}

export function parseStyles(element: HTMLElement, varMap: Map<string, string>): ParsedStyles {
  const classes = Array.from(element.classList);
  
  // Default values
  let isFlex = classes.includes("flex") || classes.some(c => c.startsWith("flex-"));
  let flexDirection: "row" | "column" = "column";
  let alignItems: "start" | "center" | "end" | "stretch" = "stretch";
  let justifyContent: "start" | "center" | "end" | "between" | "around" = "start";
  let gap = 0;

  const padding = { top: 0, right: 0, bottom: 0, left: 0 };
  const margin = { top: 0, right: 0, bottom: 0, left: 0 };

  let width: string | number = "auto";
  let height: string | number = "auto";

  let backgroundColor = "transparent";
  let textColor = "#111827";

  let borderRadius = 0;
  let borderWidth = 0;
  let borderColor = "transparent";

  let fontSize = 14;
  let fontWeight: "normal" | "medium" | "semibold" | "bold" = "normal";
  let textAlign: "left" | "center" | "right" = "left";

  let shadow: string | null = null;

  // Resolve Drawgle Token classes first
  classes.forEach(c => {
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
    const arbWidth = c.match(/^w-\[(.+)\]$/);
    if (arbWidth) {
      const val = arbWidth[1];
      if (val.startsWith("var(")) {
        width = parsePixel(resolveCssVariable(val, varMap));
      } else if (val.endsWith("px")) {
        width = parseFloat(val);
      } else {
        width = val;
      }
    }
    const arbHeight = c.match(/^h-\[(.+)\]$/);
    if (arbHeight) {
      const val = arbHeight[1];
      if (val.startsWith("var(")) {
        height = parsePixel(resolveCssVariable(val, varMap));
      } else if (val.endsWith("px")) {
        height = parseFloat(val);
      } else {
        height = val;
      }
    }
    const arbPadding = c.match(/^p-\[(.+)\]$/);
    if (arbPadding) {
      const val = arbPadding[1];
      const parsedVal = val.startsWith("var(") ? parsePixel(resolveCssVariable(val, varMap)) : parseFloat(val);
      padding.top = padding.right = padding.bottom = padding.left = parsedVal;
    }
    const arbGap = c.match(/^gap-\[(.+)\]$/);
    if (arbGap) {
      const val = arbGap[1];
      gap = val.startsWith("var(") ? parsePixel(resolveCssVariable(val, varMap)) : parseFloat(val);
    }
    const arbRadius = c.match(/^rounded-\[(.+)\]$/);
    if (arbRadius) {
      const val = arbRadius[1];
      borderRadius = val.startsWith("var(") ? parsePixel(resolveCssVariable(val, varMap)) : parseFloat(val);
    }

    // Color utilities
    if (c.startsWith("bg-")) {
      const col = c.substring(3);
      if (TAILWIND_COLOR_MAP[col]) {
        backgroundColor = TAILWIND_COLOR_MAP[col];
      } else if (col.startsWith("[var(")) {
        backgroundColor = resolveCssVariable(col.substring(1, col.length - 1), varMap);
      } else if (col.startsWith("[#")) {
        backgroundColor = col.substring(1, col.length - 1);
      }
    }
    if (c.startsWith("text-")) {
      const col = c.substring(5);
      if (TAILWIND_COLOR_MAP[col]) {
        textColor = TAILWIND_COLOR_MAP[col];
      } else if (col.startsWith("[var(")) {
        textColor = resolveCssVariable(col.substring(1, col.length - 1), varMap);
      } else if (col.startsWith("[#")) {
        textColor = col.substring(1, col.length - 1);
      }
    }
    if (c.startsWith("border-")) {
      const col = c.substring(7);
      if (TAILWIND_COLOR_MAP[col]) {
        borderColor = TAILWIND_COLOR_MAP[col];
      } else if (col.startsWith("[var(")) {
        borderColor = resolveCssVariable(col.substring(1, col.length - 1), varMap);
      } else if (col.startsWith("[#")) {
        borderColor = col.substring(1, col.length - 1);
      }
    }

    // Drawgle Semantic tokens
    if (c === "dg-bg-primary") backgroundColor = varMap.get("--dg-color-background-primary") || "#FFFFFF";
    if (c === "dg-bg-secondary") backgroundColor = varMap.get("--dg-color-background-secondary") || "#F3F4F6";
    if (c === "dg-surface-card") backgroundColor = varMap.get("--dg-color-surface-card") || "#FFFFFF";
    if (c === "dg-surface-bottom-sheet") backgroundColor = varMap.get("--dg-color-surface-bottom-sheet") || "#FFFFFF";
    if (c === "dg-surface-modal") backgroundColor = varMap.get("--dg-color-surface-modal") || "#FFFFFF";
    
    if (c === "dg-text-high") textColor = varMap.get("--dg-color-text-high-emphasis") || "#111827";
    if (c === "dg-text-medium") textColor = varMap.get("--dg-color-text-medium-emphasis") || "#4B5563";
    if (c === "dg-text-low") textColor = varMap.get("--dg-color-text-low-emphasis") || "#9CA3AF";

    if (c === "dg-action-primary") {
      backgroundColor = varMap.get("--dg-color-action-primary") || "#3B82F6";
      textColor = varMap.get("--dg-color-action-on-primary-text") || "#FFFFFF";
    }
    if (c === "dg-action-secondary") backgroundColor = varMap.get("--dg-color-action-secondary") || "#E5E7EB";
    if (c === "dg-border-divider") borderColor = varMap.get("--dg-color-border-divider") || "#E5E7EB";
    if (c === "dg-border-focused") borderColor = varMap.get("--dg-color-border-focused") || "#3B82F6";
    
    if (c === "dg-radius-app") borderRadius = parsePixel(varMap.get("--dg-radii-app") || "18px");
    if (c === "dg-radius-pill") borderRadius = parsePixel(varMap.get("--dg-radii-pill") || "9999px");

    if (c === "dg-shadow-surface") shadow = "surface";
    if (c === "dg-shadow-overlay") shadow = "overlay";

    if (c === "dg-screen-padding") {
      const val = parsePixel(varMap.get("--dg-mobile-layout-screen-margin") || "24px");
      padding.left = padding.right = val;
    }
    if (c === "dg-section-gap") gap = parsePixel(varMap.get("--dg-mobile-layout-section-gap") || "24px");
    if (c === "dg-element-gap") gap = parsePixel(varMap.get("--dg-mobile-layout-element-gap") || "16px");

    // Semantic typography classes
    if (c.startsWith("dg-type-")) {
      const typeName = c.substring(8).replace(/-/g, "_"); // E.g. screen-title -> screen_title
      // Let's approximate based on standard system or loaded tokens
      if (typeName === "hero_title") { fontSize = 32; fontWeight = "bold"; }
      else if (typeName === "screen_title") { fontSize = 24; fontWeight = "bold"; }
      else if (typeName === "section_title") { fontSize = 18; fontWeight = "bold"; }
      else if (typeName === "nav_title") { fontSize = 17; fontWeight = "bold"; }
      else if (typeName === "metric_value") { fontSize = 32; fontWeight = "bold"; }
      else if (typeName === "body") { fontSize = 16; fontWeight = "normal"; }
      else if (typeName === "supporting") { fontSize = 14; fontWeight = "normal"; }
      else if (typeName === "caption") { fontSize = 12; fontWeight = "semibold"; }
      else if (typeName === "button_label") { fontSize = 15; fontWeight = "bold"; }
    }
  });

  // Parse inline style declarations as overriding attributes
  const inlineStyle = element.getAttribute("style");
  if (inlineStyle) {
    const rules = inlineStyle.split(";");
    rules.forEach(rule => {
      const parts = rule.split(":");
      if (parts.length < 2) return;
      const key = parts[0].trim().toLowerCase();
      const val = parts.slice(1).join(":").trim();

      if (key === "background-color" || key === "background") {
        if (val.startsWith("#")) backgroundColor = val;
        else if (val.startsWith("var(")) backgroundColor = resolveCssVariable(val, varMap);
      }
      if (key === "color") {
        if (val.startsWith("#")) textColor = val;
        else if (val.startsWith("var(")) textColor = resolveCssVariable(val, varMap);
      }
      if (key === "font-size") {
        fontSize = parsePixel(val.endsWith("px") ? val : resolveCssVariable(val, varMap));
      }
      if (key === "border-radius") {
        borderRadius = parsePixel(val.endsWith("px") ? val : resolveCssVariable(val, varMap));
      }
      if (key === "padding") {
        const valPx = parsePixel(val);
        padding.top = padding.right = padding.bottom = padding.left = valPx;
      }
      if (key === "gap") {
        gap = parsePixel(val);
      }
    });
  }

  return {
    isFlex,
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
  };
}

// Recursively builds the TranspileNode tree starting from an element
export function buildTranspileTree(element: Element, varMap: Map<string, string>): TranspileNode | null {
  if (element.nodeType !== 1) return null; // Element node only
  const htmlElement = element as HTMLElement;
  const tagName = htmlElement.tagName.toLowerCase();

  // Exclude stylesheets and script blocks from the native visual layout
  if (tagName === "style" || tagName === "script") {
    return null;
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
      const parsedChild = buildTranspileTree(child as Element, varMap);
      if (parsedChild) children.push(parsedChild);
    }
  });

  const node: TranspileNode = {
    tagName: htmlElement.tagName.toLowerCase(),
    classes: Array.from(htmlElement.classList),
    id: htmlElement.id || "",
    styleText: htmlElement.getAttribute("style") || "",
    styles: parseStyles(htmlElement, varMap),
    attributes,
    children,
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

  return buildTranspileTree(root, varMap);
}

// ---------------------------------------------------------------------------
// TO-HEX CONVERTOR HELPER FOR NATIVE DEFS
// ---------------------------------------------------------------------------
function cleanHexColor(hex: string): string {
  if (!hex || hex === "transparent") return "FFFFFF"; // fallback without '#'
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

  return {
    swift: `//\n//  DesignTokens.swift\n//  Drawgle Auto-generated\n//\n\nimport SwiftUI\n\nstruct AppTheme {\n    static let backgroundPrimary = Color(hex: "${colors.bgPrimary}")\n    static let backgroundSecondary = Color(hex: "${colors.bgSecondary}")\n    static let surfaceCard = Color(hex: "${colors.surfaceCard}")\n    static let actionPrimary = Color(hex: "${colors.actionPrimary}")\n    static let actionOnPrimary = Color(hex: "${colors.actionOnPrimary}")\n    static let textHigh = Color(hex: "${colors.textHigh}")\n    static let textMedium = Color(hex: "${colors.textMedium}")\n    static let textLow = Color(hex: "${colors.textLow}")\n    static let borderDivider = Color(hex: "${colors.borderDivider}")\n    \n    static let borderRadiusApp: CGFloat = ${parseFloat(radii.app)}\n    static let borderRadiusPill: CGFloat = 9999.0\n}\n\nextension Color {\n    init(hex: String) {\n        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)\n        var int: UInt64 = 0\n        Scanner(string: hex).scanHexInt64(&int)\n        let a, r, g, b: UInt64\n        switch hex.count {\n        case 3: // RGB (12-bit)\n            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)\n        case 6: // RGB (24-bit)\n            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)\n        case 8: // ARGB (32-bit)\n            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)\n        default:\n            (a, r, g, b) = (255, 0, 0, 0)\n        }\n        self.init(\n            .sRGB,\n            red: Double(r) / 255,\n            green: Double(g) / 255,\n            blue:  Double(b) / 255,\n            opacity: Double(a) / 255\n        )\n    }\n}\n`,

    compose: `/*\n * AppTheme.kt\n * Drawgle Auto-generated\n */\n\npackage com.drawgle.theme\n\nimport androidx.compose.ui.graphics.Color\nimport androidx.compose.ui.unit.dp\n\nobject AppTheme {\n    val BackgroundPrimary = Color(0xFF${cleanHexColor(colors.bgPrimary)})\n    val BackgroundSecondary = Color(0xFF${cleanHexColor(colors.bgSecondary)})\n    val SurfaceCard = Color(0xFF${cleanHexColor(colors.surfaceCard)})\n    val ActionPrimary = Color(0xFF${cleanHexColor(colors.actionPrimary)})\n    val ActionOnPrimary = Color(0xFF${cleanHexColor(colors.actionOnPrimary)})\n    val TextHigh = Color(0xFF${cleanHexColor(colors.textHigh)})\n    val TextMedium = Color(0xFF${cleanHexColor(colors.textMedium)})\n    val TextLow = Color(0xFF${cleanHexColor(colors.textLow)})\n    val BorderDivider = Color(0xFF${cleanHexColor(colors.borderDivider)})\n    \n    val BorderRadiusApp = ${parseFloat(radii.app)}.dp\n    val BorderRadiusPill = 9999.dp\n}\n`,

    rn: `//\n// AppTheme.js\n// Drawgle Auto-generated\n//\n\nexport const AppTheme = {\n  colors: {\n    backgroundPrimary: '${colors.bgPrimary}',\n    backgroundSecondary: '${colors.bgSecondary}',\n    surfaceCard: '${colors.surfaceCard}',\n    actionPrimary: '${colors.actionPrimary}',\n    actionOnPrimary: '${colors.actionOnPrimary}',\n    textHigh: '${colors.textHigh}',\n    textMedium: '${colors.textMedium}',\n    textLow: '${colors.textLow}',\n    borderDivider: '${colors.borderDivider}',\n  },\n  radii: {\n    app: ${parseFloat(radii.app)},\n    pill: 9999,\n  }\n};\n`,

    flutter: `//\n// app_theme.dart\n// Drawgle Auto-generated\n//\n\nimport 'package:flutter/material.dart';\n\nclass AppTheme {\n  static const Color backgroundPrimary = Color(0xFF${cleanHexColor(colors.bgPrimary)});\n  static const Color backgroundSecondary = Color(0xFF${cleanHexColor(colors.bgSecondary)});\n  static const Color surfaceCard = Color(0xFF${cleanHexColor(colors.surfaceCard)});\n  static const Color actionPrimary = Color(0xFF${cleanHexColor(colors.actionPrimary)});\n  static const Color actionOnPrimary = Color(0xFF${cleanHexColor(colors.actionOnPrimary)});\n  static const Color textHigh = Color(0xFF${cleanHexColor(colors.textHigh)});\n  static const Color textMedium = Color(0xFF${cleanHexColor(colors.textMedium)});\n  static const Color textLow = Color(0xFF${cleanHexColor(colors.textLow)});\n  static const Color borderDivider = Color(0xFF${cleanHexColor(colors.borderDivider)});\n  \n  static const double borderRadiusApp = ${parseFloat(radii.app)};\n  static const double borderRadiusPill = 9999.0;\n}\n`
  };
}

// ---------------------------------------------------------------------------
// SWIFTUI TRANSPILER
// ---------------------------------------------------------------------------
export function transpileToSwiftUI(root: TranspileNode): string {
  let indentLevel = 1;
  const getIndent = () => "    ".repeat(indentLevel);

  function walk(node: TranspileNode | string): string {
    if (typeof node === "string") {
      return `${getIndent()}Text("${node.replace(/"/g, '\\"')}")\n`;
    }

    const { styles } = node;
    const isButton = node.tagName === "button" || node.tagName === "a";
    const isImage = node.tagName === "img";
    const lucide = node.attributes["data-lucide"] || node.attributes["data-drawgle-icon"];
    
    let out = "";
    
    // Lucide Icon mapping
    if (lucide && ICON_MAP[lucide]) {
      out += `${getIndent()}Image(systemName: "${ICON_MAP[lucide].sf}")\n`;
      out += `${getIndent()}    .font(.system(size: ${styles.fontSize || 20}))\n`;
      if (styles.textColor !== "transparent") {
        out += `${getIndent()}    .foregroundColor(Color(hex: "${styles.textColor}"))\n`;
      }
      return out;
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
      if (styles.borderRadius > 0) {
        out += `${getIndent()}.cornerRadius(${styles.borderRadius})\n`;
      }
      return out;
    }

    if (isButton) {
      out += `${getIndent()}Button(action: {\n`;
      out += `${getIndent()}    // Action here\n`;
      out += `${getIndent()}}) {\n`;
      indentLevel++;
      
      // Content wrapper inside SwiftUI button (HStack is standard)
      out += `${getIndent()}HStack(spacing: ${styles.gap || 8}) {\n`;
      indentLevel++;
      node.children.forEach(c => {
        out += walk(c);
      });
      indentLevel--;
      out += `${getIndent()}}\n`;
      
      // Style button
      out += `${getIndent()}.padding(.vertical, ${styles.padding.top || 12})\n`;
      out += `${getIndent()}.padding(.horizontal, ${styles.padding.left || 16})\n`;
      if (styles.backgroundColor !== "transparent") {
        out += `${getIndent()}.background(Color(hex: "${styles.backgroundColor}"))\n`;
      }
      if (styles.borderRadius > 0) {
        out += `${getIndent()}.cornerRadius(${styles.borderRadius})\n`;
      }
      if (styles.textColor !== "transparent") {
        out += `${getIndent()}.foregroundColor(Color(hex: "${styles.textColor}"))\n`;
      }
      indentLevel--;
      out += `${getIndent()}}\n`;
      return out;
    }

    // Text Leaf Node Optimization
    const isTextLeaf = ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6"].includes(node.tagName) && 
                       node.children.length === 1 && typeof node.children[0] === "string";
    
    if (isTextLeaf) {
      const textVal = node.children[0] as string;
      out += `${getIndent()}Text("${textVal.replace(/"/g, '\\"')}")\n`;
      if (styles.fontSize > 0) {
        out += `${getIndent()}    .font(.system(size: ${styles.fontSize}))\n`;
      }
      if (styles.fontWeight === "bold" || styles.fontWeight === "semibold") {
        out += `${getIndent()}    .fontWeight(.semibold)\n`;
      }
      if (styles.textColor !== "transparent") {
        out += `${getIndent()}    .foregroundColor(Color(hex: "${styles.textColor}"))\n`;
      }
      if (styles.textAlign === "center") {
        out += `${getIndent()}    .multilineTextAlignment(.center)\n`;
      }
      
      // Handle margin
      if (styles.margin.top > 0) out += `${getIndent()}    .padding(.top, ${styles.margin.top})\n`;
      if (styles.margin.bottom > 0) out += `${getIndent()}    .padding(.bottom, ${styles.margin.bottom})\n`;
      return out;
    }

    // Standard Stack Container
    const isCol = styles.flexDirection === "column";
    const stackName = isCol ? "VStack" : "HStack";
    const alignStr = isCol 
      ? (styles.alignItems === "start" ? "alignment: .leading" : styles.alignItems === "end" ? "alignment: .trailing" : "")
      : (styles.alignItems === "start" ? "alignment: .top" : styles.alignItems === "end" ? "alignment: .bottom" : "");
    const spacingStr = styles.gap > 0 ? `spacing: ${styles.gap}` : "";
    const combo = alignStr && spacingStr ? `${alignStr}, ${spacingStr}` : (alignStr || spacingStr);
    
    out += `${getIndent()}${stackName}(${combo}) {\n`;
    indentLevel++;
    
    node.children.forEach(c => {
      out += walk(c);
    });
    
    indentLevel--;
    out += `${getIndent()}}\n`;

    // Modifiers on stack
    if (styles.padding.top > 0 || styles.padding.bottom > 0 || styles.padding.left > 0 || styles.padding.right > 0) {
      if (styles.padding.top === styles.padding.bottom && styles.padding.left === styles.padding.right) {
        out += `${getIndent()}.padding(.vertical, ${styles.padding.top})\n`;
        out += `${getIndent()}.padding(.horizontal, ${styles.padding.left})\n`;
      } else {
        if (styles.padding.top > 0) out += `${getIndent()}.padding(.top, ${styles.padding.top})\n`;
        if (styles.padding.bottom > 0) out += `${getIndent()}.padding(.bottom, ${styles.padding.bottom})\n`;
        if (styles.padding.left > 0) out += `${getIndent()}.padding(.leading, ${styles.padding.left})\n`;
        if (styles.padding.right > 0) out += `${getIndent()}.padding(.trailing, ${styles.padding.right})\n`;
      }
    }

    if (styles.backgroundColor !== "transparent") {
      out += `${getIndent()}.background(Color(hex: "${styles.backgroundColor}"))\n`;
    }
    if (styles.borderRadius > 0) {
      out += `${getIndent()}.cornerRadius(${styles.borderRadius})\n`;
    }
    
    // Frame
    const w = styles.width;
    const h = styles.height;
    if (w === "100%" || typeof w === "number" || typeof h === "number") {
      const wStr = w === "100%" ? "maxWidth: .infinity" : typeof w === "number" ? `width: ${w}` : "";
      const hStr = typeof h === "number" ? `height: ${h}` : "";
      const comma = wStr && hStr ? ", " : "";
      out += `${getIndent()}.frame(${wStr}${comma}${hStr})\n`;
    }

    return out;
  }

  return walk(root);
}

// ---------------------------------------------------------------------------
// JETPACK COMPOSE TRANSPILER
// ---------------------------------------------------------------------------
export function transpileToCompose(root: TranspileNode): string {
  let indentLevel = 1;
  const getIndent = () => "    ".repeat(indentLevel);

  function walk(node: TranspileNode | string): string {
    if (typeof node === "string") {
      return `${getIndent()}Text(text = "${node.replace(/"/g, '\\"')}")\n`;
    }

    const { styles } = root;
    const isButton = node.tagName === "button" || node.tagName === "a";
    const isImage = node.tagName === "img";
    const lucide = node.attributes["data-lucide"] || node.attributes["data-drawgle-icon"];
    
    let out = "";

    if (lucide && ICON_MAP[lucide]) {
      out += `${getIndent()}Icon(\n`;
      out += `${getIndent()}    imageVector = ${ICON_MAP[lucide].compose},\n`;
      out += `${getIndent()}    contentDescription = null,\n`;
      out += `${getIndent()}    tint = Color(0xFF${cleanHexColor(node.styles.textColor)}),\n`;
      out += `${getIndent()}    modifier = Modifier.size(${node.styles.fontSize || 24}.dp)\n`;
      out += `${getIndent()})\n`;
      return out;
    }

    if (isImage) {
      const src = node.attributes["src"] || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809";
      out += `${getIndent()}AsyncImage(\n`;
      out += `${getIndent()}    model = "${src}",\n`;
      out += `${getIndent()}    contentDescription = null,\n`;
      out += `${getIndent()}    modifier = Modifier\n`;
      
      const w = node.styles.width;
      const h = node.styles.height;
      if (w === "100%") out += `${getIndent()}        .fillMaxWidth()\n`;
      else if (typeof w === "number") out += `${getIndent()}        .width(${w}.dp)\n`;
      if (typeof h === "number") out += `${getIndent()}        .height(${h}.dp)\n`;
      if (node.styles.borderRadius > 0) {
        out += `${getIndent()}        .clip(RoundedCornerShape(${node.styles.borderRadius}.dp))\n`;
      }
      out += `${getIndent()})\n`;
      return out;
    }

    if (isButton) {
      out += `${getIndent()}Button(\n`;
      out += `${getIndent()}    onClick = { /* Action */ },\n`;
      out += `${getIndent()}    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF${cleanHexColor(node.styles.backgroundColor)})),\n`;
      out += `${getIndent()}    shape = RoundedCornerShape(${node.styles.borderRadius || 12}.dp),\n`;
      out += `${getIndent()}    modifier = Modifier\n`;
      if (node.styles.padding.left > 0 || node.styles.padding.top > 0) {
        out += `${getIndent()}        .padding(horizontal = ${node.styles.padding.left || 16}.dp, vertical = ${node.styles.padding.top || 12}.dp)\n`;
      }
      out += `${getIndent()}) {\n`;
      indentLevel++;
      
      // Inline children
      out += `${getIndent()}Row(\n`;
      out += `${getIndent()}    horizontalArrangement = Arrangement.spacedBy(${node.styles.gap || 8}.dp),\n`;
      out += `${getIndent()}    verticalAlignment = Alignment.CenterVertically\n`;
      out += `${getIndent()}) {\n`;
      indentLevel++;
      node.children.forEach(c => {
        out += walk(c);
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
      out += `${getIndent()}    fontSize = ${node.styles.fontSize}.sp,\n`;
      out += `${getIndent()}    color = Color(0xFF${cleanHexColor(node.styles.textColor)}),\n`;
      if (node.styles.fontWeight === "bold" || node.styles.fontWeight === "semibold") {
        out += `${getIndent()}    fontWeight = FontWeight.Bold,\n`;
      }
      if (node.styles.textAlign === "center") {
        out += `${getIndent()}    textAlign = TextAlign.Center,\n`;
      }
      
      // Modifier spacing
      out += `${getIndent()}    modifier = Modifier\n`;
      const mt = node.styles.margin.top;
      const mb = node.styles.margin.bottom;
      if (mt > 0 || mb > 0) {
        out += `${getIndent()}        .padding(top = ${mt}.dp, bottom = ${mb}.dp)\n`;
      }
      // strip trailing modifiers if not used
      if (out.endsWith("modifier = Modifier\n")) {
        out = out.substring(0, out.length - 24) + "\n";
      }
      out += `${getIndent()})\n`;
      return out;
    }

    // Standard Stack
    const isCol = node.styles.flexDirection === "column";
    const composeLayout = isCol ? "Column" : "Row";
    
    out += `${getIndent()}${composeLayout}(\n`;
    out += `${getIndent()}    modifier = Modifier\n`;
    
    if (node.styles.width === "100%") out += `${getIndent()}        .fillMaxWidth()\n`;
    else if (typeof node.styles.width === "number") out += `${getIndent()}        .width(${node.styles.width}.dp)\n`;
    if (typeof node.styles.height === "number") out += `${getIndent()}        .height(${node.styles.height}.dp)\n`;

    if (node.styles.backgroundColor !== "transparent") {
      out += `${getIndent()}        .background(Color(0xFF${cleanHexColor(node.styles.backgroundColor)}))\n`;
    }
    if (node.styles.borderRadius > 0) {
      out += `${getIndent()}        .clip(RoundedCornerShape(${node.styles.borderRadius}.dp))\n`;
    }

    // Padding
    const pt = node.styles.padding.top;
    const pb = node.styles.padding.bottom;
    const pl = node.styles.padding.left;
    const pr = node.styles.padding.right;
    if (pt > 0 || pb > 0 || pl > 0 || pr > 0) {
      out += `${getIndent()}        .padding(start = ${pl}.dp, top = ${pt}.dp, end = ${pr}.dp, bottom = ${pb}.dp)\n`;
    }

    // Alignments
    if (isCol) {
      const align = node.styles.alignItems === "center" ? "Alignment.CenterHorizontally" : node.styles.alignItems === "end" ? "Alignment.End" : "Alignment.Start";
      out += `${getIndent()}    horizontalAlignment = ${align},\n`;
      if (node.styles.gap > 0) {
        out += `${getIndent()}    verticalArrangement = Arrangement.spacedBy(${node.styles.gap}.dp),\n`;
      }
    } else {
      const align = node.styles.alignItems === "center" ? "Alignment.CenterVertically" : node.styles.alignItems === "end" ? "Alignment.Bottom" : "Alignment.Top";
      out += `${getIndent()}    verticalAlignment = ${align},\n`;
      if (node.styles.gap > 0) {
        out += `${getIndent()}    horizontalArrangement = Arrangement.spacedBy(${node.styles.gap}.dp),\n`;
      }
    }

    if (out.endsWith("modifier = Modifier\n")) {
      out = out.substring(0, out.length - 24) + "\n";
    }

    out += `${getIndent()}) {\n`;
    indentLevel++;
    
    node.children.forEach(c => {
      out += walk(c);
    });

    indentLevel--;
    out += `${getIndent()}}\n`;
    return out;
  }

  return walk(root);
}

// ---------------------------------------------------------------------------
// REACT NATIVE TRANSPILER
// ---------------------------------------------------------------------------
export function transpileToReactNative(root: TranspileNode): string {
  let indentLevel = 1;
  const getIndent = () => "  ".repeat(indentLevel);

  function walk(node: TranspileNode | string): string {
    if (typeof node === "string") {
      return `${getIndent()}<Text>${node.replace(/"/g, '\\"')}</Text>\n`;
    }

    const { styles } = node;
    const isButton = node.tagName === "button" || node.tagName === "a";
    const isImage = node.tagName === "img";
    const lucide = node.attributes["data-lucide"] || node.attributes["data-drawgle-icon"];
    
    let out = "";

    if (lucide && ICON_MAP[lucide]) {
      out += `${getIndent()}<Icon name="${lucide}" size={${styles.fontSize || 24}} color="${styles.textColor}" />\n`;
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
      if (styles.width === "100%") out += `${getIndent()}    width: '100%',\n`;
      else if (typeof styles.width === "number") out += `${getIndent()}    width: ${styles.width},\n`;
      if (typeof styles.height === "number") out += `${getIndent()}    height: ${styles.height},\n`;
      if (styles.borderRadius > 0) out += `${getIndent()}    borderRadius: ${styles.borderRadius},\n`;
      out += `${getIndent()}  }}\n`;
      out += `${getIndent()}/>\n`;
      return out;
    }

    if (isButton) {
      out += `${getIndent()}<TouchableOpacity \n`;
      out += `${getIndent()}  onPress={() => {}}\n`;
      out += `${getIndent()}  style={{\n`;
      if (styles.backgroundColor !== "transparent") out += `${getIndent()}    backgroundColor: '${styles.backgroundColor}',\n`;
      if (styles.borderRadius > 0) out += `${getIndent()}    borderRadius: ${styles.borderRadius},\n`;
      out += `${getIndent()}    paddingVertical: ${styles.padding.top || 12},\n`;
      out += `${getIndent()}    paddingHorizontal: ${styles.padding.left || 16},\n`;
      out += `${getIndent()}    flexDirection: 'row',\n`;
      out += `${getIndent()}    alignItems: 'center',\n`;
      out += `${getIndent()}    justifyContent: 'center',\n`;
      out += `${getIndent()}  }}\n`;
      out += `${getIndent()}>\n`;
      indentLevel++;
      
      node.children.forEach(c => {
        out += walk(c);
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
      out += `${getIndent()}  fontSize: ${styles.fontSize},\n`;
      out += `${getIndent()}  color: '${styles.textColor}',\n`;
      if (styles.fontWeight === "bold" || styles.fontWeight === "semibold") {
        out += `${getIndent()}  fontWeight: 'bold',\n`;
      }
      if (styles.textAlign === "center") {
        out += `${getIndent()}  textAlign: 'center',\n`;
      }
      const mt = styles.margin.top;
      const mb = styles.margin.bottom;
      if (mt > 0) out += `${getIndent()}  marginTop: ${mt},\n`;
      if (mb > 0) out += `${getIndent()}  marginBottom: ${mb},\n`;
      
      out += `${getIndent()}}}>\n`;
      out += `${getIndent()}  ${textVal.replace(/"/g, '\\"')}\n`;
      out += `${getIndent()}</Text>\n`;
      return out;
    }

    // View component in React Native
    out += `${getIndent()}<View style={{\n`;
    out += `${getIndent()}  flexDirection: '${styles.flexDirection === "row" ? "row" : "column"}',\n`;
    if (styles.alignItems !== "stretch") {
      out += `${getIndent()}  alignItems: '${styles.alignItems === "start" ? "flex-start" : styles.alignItems === "end" ? "flex-end" : "center"}',\n`;
    }
    if (styles.justifyContent !== "start") {
      const justify = styles.justifyContent === "center" ? "center" : styles.justifyContent === "end" ? "flex-end" : styles.justifyContent === "between" ? "space-between" : "space-around";
      out += `${getIndent()}  justifyContent: '${justify}',\n`;
    }
    if (styles.gap > 0) {
      out += `${getIndent()}  gap: ${styles.gap},\n`;
    }
    if (styles.width === "100%") out += `${getIndent()}  width: '100%',\n`;
    else if (typeof styles.width === "number") out += `${getIndent()}  width: ${styles.width},\n`;
    if (typeof styles.height === "number") out += `${getIndent()}  height: ${styles.height},\n`;

    if (styles.backgroundColor !== "transparent") {
      out += `${getIndent()}  backgroundColor: '${styles.backgroundColor}',\n`;
    }
    if (styles.borderRadius > 0) {
      out += `${getIndent()}  borderRadius: ${styles.borderRadius},\n`;
    }

    // Padding
    if (styles.padding.top > 0) out += `${getIndent()}  paddingTop: ${styles.padding.top},\n`;
    if (styles.padding.bottom > 0) out += `${getIndent()}  paddingBottom: ${styles.padding.bottom},\n`;
    if (styles.padding.left > 0) out += `${getIndent()}  paddingLeft: ${styles.padding.left},\n`;
    if (styles.padding.right > 0) out += `${getIndent()}  paddingRight: ${styles.padding.right},\n`;

    out += `${getIndent()}}}>\n`;
    indentLevel++;

    node.children.forEach(c => {
      out += walk(c);
    });

    indentLevel--;
    out += `${getIndent()}</View>\n`;
    return out;
  }

  return walk(root);
}

// ---------------------------------------------------------------------------
// FLUTTER TRANSPILER
// ---------------------------------------------------------------------------
export function transpileToFlutter(root: TranspileNode): string {
  let indentLevel = 1;
  const getIndent = () => "  ".repeat(indentLevel);

  function walk(node: TranspileNode | string): string {
    if (typeof node === "string") {
      return `${getIndent()}Text('${node.replace(/'/g, "\\'")}')\n`;
    }

    const { styles } = node;
    const isButton = node.tagName === "button" || node.tagName === "a";
    const isImage = node.tagName === "img";
    const lucide = node.attributes["data-lucide"] || node.attributes["data-drawgle-icon"];
    
    let out = "";

    if (lucide && ICON_MAP[lucide]) {
      out += `${getIndent()}Icon(${ICON_MAP[lucide].flutter}, size: ${styles.fontSize || 24}.0, color: Color(0xFF${cleanHexColor(styles.textColor)}))\n`;
      return out;
    }

    if (isImage) {
      const src = node.attributes["src"] || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809";
      out += `${getIndent()}ClipRRect(\n`;
      out += `${getIndent()}  borderRadius: BorderRadius.circular(${styles.borderRadius || 0}.0),\n`;
      out += `${getIndent()}  child: Image.network(\n`;
      out += `${getIndent()}    '${src}',\n`;
      if (typeof styles.width === "number") out += `${getIndent()}    width: ${styles.width}.0,\n`;
      if (typeof styles.height === "number") out += `${getIndent()}    height: ${styles.height}.0,\n`;
      out += `${getIndent()}    fit: BoxFit.cover,\n`,
      out += `${getIndent()}  ),\n`;
      out += `${getIndent()})\n`;
      return out;
    }

    if (isButton) {
      out += `${getIndent()}ElevatedButton(\n`;
      out += `${getIndent()}  onPressed: () {},\n`;
      out += `${getIndent()}  style: ElevatedButton.styleFrom(\n`;
      out += `${getIndent()}    backgroundColor: Color(0xFF${cleanHexColor(styles.backgroundColor)}),\n`;
      out += `${getIndent()}    shape: RoundedRectangleBorder(\n`;
      out += `${getIndent()}      borderRadius: BorderRadius.circular(${styles.borderRadius || 12}.0),\n`;
      out += `${getIndent()}    ),\n`;
      out += `${getIndent()}    padding: EdgeInsets.symmetric(horizontal: ${styles.padding.left || 16}.0, vertical: ${styles.padding.top || 12}.0),\n`;
      out += `${getIndent()}  ),\n`;
      out += `${getIndent()}  child: Row(\n`;
      out += `${getIndent()}    mainAxisSize: MainAxisSize.min,\n`;
      out += `${getIndent()}    children: [\n`;
      indentLevel += 3;
      node.children.forEach((c, idx) => {
        out += walk(c);
        if (idx < node.children.length - 1) out = out.trimEnd() + ",\n";
      });
      indentLevel -= 3;
      out += `${getIndent()}    ],\n`;
      out += `${getIndent()}  ),\n`;
      out += `${getIndent()})\n`;
      return out;
    }

    const isTextLeaf = ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6"].includes(node.tagName) && 
                       node.children.length === 1 && typeof node.children[0] === "string";

    if (isTextLeaf) {
      const textVal = node.children[0] as string;
      out += `${getIndent()}Text(\n`;
      out += `${getIndent()}  '${textVal.replace(/'/g, "\\'")}',\n`;
      out += `${getIndent()}  style: TextStyle(\n`;
      out += `${getIndent()}    fontSize: ${styles.fontSize}.0,\n`;
      out += `${getIndent()}    color: Color(0xFF${cleanHexColor(styles.textColor)}),\n`;
      if (styles.fontWeight === "bold" || styles.fontWeight === "semibold") {
        out += `${getIndent()}    fontWeight: FontWeight.bold,\n`;
      }
      out += `${getIndent()}  ),\n`;
      if (styles.textAlign === "center") {
        out += `${getIndent()}  textAlign: TextAlign.center,\n`;
      }
      out += `${getIndent()})\n`;
      
      // Wrap with Padding if margins exist
      const mt = styles.margin.top;
      const mb = styles.margin.bottom;
      if (mt > 0 || mb > 0) {
        out = `${getIndent()}Padding(\n` +
              `${getIndent()}  padding: EdgeInsets.only(top: ${mt}.0, bottom: ${mb}.0),\n` +
              `${getIndent()}  child: ${out.trim()},\n` +
              `${getIndent()})\n`;
      }
      return out;
    }

    // Stack container (Column / Row) in Flutter
    const isCol = styles.flexDirection === "column";
    const widgetName = isCol ? "Column" : "Row";
    
    let containerWrap = false;
    let decoration = "";
    
    // Determine decoration
    if (styles.backgroundColor !== "transparent" || styles.borderRadius > 0 || styles.borderWidth > 0) {
      containerWrap = true;
      decoration += `    decoration: BoxDecoration(\n`;
      if (styles.backgroundColor !== "transparent") {
        decoration += `      color: Color(0xFF${cleanHexColor(styles.backgroundColor)}),\n`;
      }
      if (styles.borderRadius > 0) {
        decoration += `      borderRadius: BorderRadius.circular(${styles.borderRadius}.0),\n`;
      }
      if (styles.borderWidth > 0) {
        decoration += `      border: Border.all(color: Color(0xFF${cleanHexColor(styles.borderColor)}), width: ${styles.borderWidth}.0),\n`;
      }
      decoration += `    ),\n`;
    }

    // Determine dimensions & padding wrapping
    let sizeAttrs = "";
    if (typeof styles.width === "number") sizeAttrs += `    width: ${styles.width}.0,\n`;
    if (typeof styles.height === "number") sizeAttrs += `    height: ${styles.height}.0,\n`;
    
    const pt = styles.padding.top;
    const pb = styles.padding.bottom;
    const pl = styles.padding.left;
    const pr = styles.padding.right;
    let paddingWrap = "";
    if (pt > 0 || pb > 0 || pl > 0 || pr > 0) {
      paddingWrap = `    padding: EdgeInsets.only(left: ${pl}.0, top: ${pt}.0, right: ${pr}.0, bottom: ${pb}.0),\n`;
      containerWrap = true;
    }

    if (containerWrap || sizeAttrs) {
      out += `${getIndent()}Container(\n`;
      if (sizeAttrs) out += getIndent() + sizeAttrs;
      if (paddingWrap) out += getIndent() + paddingWrap;
      if (decoration) out += getIndent() + decoration;
      out += `${getIndent()}  child: `;
      indentLevel++;
    }

    // Nested stack children
    const alignStr = isCol
      ? `crossAxisAlignment: CrossAxisAlignment.${styles.alignItems === "start" ? "start" : styles.alignItems === "end" ? "end" : styles.alignItems === "center" ? "center" : "stretch"}`
      : `crossAxisAlignment: CrossAxisAlignment.${styles.alignItems === "start" ? "start" : styles.alignItems === "end" ? "end" : "center"}`;
    
    const justifyStr = `mainAxisAlignment: MainAxisAlignment.${styles.justifyContent === "center" ? "center" : styles.justifyContent === "end" ? "end" : styles.justifyContent === "between" ? "spaceBetween" : "start"}`;

    out += `${getIndent().trim()}${widgetName}(\n`;
    out += `${getIndent()}  ${alignStr},\n`;
    out += `${getIndent()}  ${justifyStr},\n`;
    out += `${getIndent()}  children: [\n`;
    
    indentLevel++;
    node.children.forEach((c, idx) => {
      out += walk(c);
      if (idx < node.children.length - 1) {
        out = out.trimEnd() + ",\n";
        // Handle spacing between children (gap representation in Flutter)
        if (styles.gap > 0) {
          const gapSize = isCol ? `height: ${styles.gap}.0` : `width: ${styles.gap}.0`;
          out += `${getIndent()}SizedBox(${gapSize}),\n`;
        }
      }
    });
    indentLevel--;

    out += `${getIndent()}  ],\n`;
    out += `${getIndent()})\n`;

    if (containerWrap || sizeAttrs) {
      indentLevel--;
      out = out.trimEnd() + ",\n" + `${getIndent()})\n`;
    }

    return out;
  }

  return walk(root);
}
