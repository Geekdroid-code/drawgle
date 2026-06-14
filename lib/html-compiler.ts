import { normalizeDesignTokens } from "@/lib/design-tokens";
import { flattenDesignTokensToCssVariables } from "@/lib/token-runtime";
import type { DesignTokens } from "@/lib/types";

const DRAWGLE_TO_NORMALIZED_VAR = new Map<string, string>([
  // Colors
  ["--dg-color-background-primary", "--background"],
  ["--dg-color-background-secondary", "--muted"],
  ["--dg-color-background-surface-elevated", "--muted"],
  ["--dg-color-surface-card", "--card"],
  ["--dg-color-surface-modal", "--popover"],
  ["--dg-color-surface-bottom-sheet", "--card"],
  ["--dg-color-text-high-emphasis", "--foreground"],
  ["--dg-color-text-medium-emphasis", "--muted-foreground"],
  ["--dg-color-text-low-emphasis", "--low-foreground"],
  ["--dg-color-action-primary", "--primary"],
  ["--dg-color-action-on-primary-text", "--primary-foreground"],
  ["--dg-color-action-secondary", "--secondary"],
  ["--dg-color-border-divider", "--border"],
  ["--dg-color-border-focused", "--ring"],
  ["--dg-color-action-disabled", "--action-disabled"],
  ["--dg-color-functional-tints-blue-base", "--tint-blue"],
  ["--dg-color-functional-tints-cyan-base", "--tint-cyan"],
  ["--dg-color-functional-tints-orange-base", "--tint-orange"],
  ["--dg-color-functional-tints-purple-base", "--tint-purple"],
  
  // Radii
  ["--dg-radii-app", "--radius"],
  ["--dg-radii-pill", "--radius-pill"],
  
  // Layout
  ["--dg-mobile-layout-screen-margin", "--screen-margin"],
  ["--dg-mobile-layout-section-gap", "--section-gap"],
  ["--dg-mobile-layout-element-gap", "--element-gap"],
  ["--dg-mobile-layout-safe-area-top", "--safe-area-top"],
  ["--dg-mobile-layout-safe-area-bottom", "--safe-area-bottom"],
  
  // Sizing
  ["--dg-sizing-icon-small", "--icon-small"],
  ["--dg-sizing-icon-standard", "--icon-standard"],
  ["--dg-sizing-bottom-nav-height", "--bottom-nav-height"],
  ["--dg-sizing-standard-input-height", "--standard-input-height"],
  ["--dg-sizing-standard-button-height", "--standard-button-height"],
  ["--dg-sizing-min-touch-target", "--min-touch-target"],

  // Shadows
  ["--dg-shadows-surface", "--shadow-surface"],
  ["--dg-shadows-overlay", "--shadow-overlay"],
  ["--dg-shadows-none", "--shadow-none"],

  // Spacing
  ["--dg-spacing-none", "--spacing-none"],
  ["--dg-spacing-xxs", "--spacing-xxs"],
  ["--dg-spacing-xs", "--spacing-xs"],
  ["--dg-spacing-sm", "--spacing-sm"],
  ["--dg-spacing-md", "--spacing-md"],
  ["--dg-spacing-lg", "--spacing-lg"],
  ["--dg-spacing-xl", "--spacing-xl"],
  ["--dg-spacing-xxl", "--spacing-xxl"],

  // Z-indices
  ["--dg-z-index-base", "--z-index-base"],
  ["--dg-z-index-sticky-header", "--z-index-sticky-header"],
  ["--dg-z-index-bottom-nav", "--z-index-bottom-nav"],
  ["--dg-z-index-bottom-sheet", "--z-index-bottom-sheet"],
  ["--dg-z-index-modal-dialog", "--z-index-modal-dialog"],
  ["--dg-z-index-toast-snackbar", "--z-index-toast-snackbar"],

  // Opacities
  ["--dg-opacities-opaque", "--opacity-opaque"],
  ["--dg-opacities-pressed", "--opacity-pressed"],
  ["--dg-opacities-disabled", "--opacity-disabled"],
  ["--dg-opacities-transparent", "--opacity-transparent"],
  ["--dg-opacities-scrim-overlay", "--opacity-scrim-overlay"],
  
  // Typography font
  ["--dg-typography-font-family", "--font-body"],
]);

function normalizeVarName(varName: string): string {
  if (DRAWGLE_TO_NORMALIZED_VAR.has(varName)) {
    return DRAWGLE_TO_NORMALIZED_VAR.get(varName)!;
  }
  if (varName.startsWith("--dg-type-")) {
    return "--" + varName.substring("--dg-type-".length);
  }
  if (varName.startsWith("--dg-")) {
    return "--" + varName.substring("--dg-".length);
  }
  return varName;
}

export function normalizeCssVariableNames(value: string): string {
  return value.replace(/var\((--[a-zA-Z0-9_-]+)(?:,\s*([^)]+))?\)/g, (match, varName, fallback) => {
    const normalizedName = normalizeVarName(varName);
    if (normalizedName !== varName) {
      return `var(${normalizedName})`;
    }
    return match;
  });
}

function parseStyle(style: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const declaration of style.split(";")) {
    const [rawProperty, ...rawValueParts] = declaration.split(":");
    const property = rawProperty?.trim().toLowerCase();
    const value = rawValueParts.join(":").trim();
    if (property && value) {
      entries.set(property, value);
    }
  }
  return entries;
}

function serializeStyle(style: Map<string, string>): string {
  return Array.from(style.entries())
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");
}

export function resolveCssVariables(value: string, varMap: Map<string, string>): string {
  let prev = "";
  let current = value;
  let iterations = 0;
  while (current !== prev && iterations < 5) {
    prev = current;
    current = current.replace(/var\((--[a-zA-Z0-9_-]+)(?:,\s*([^)]+))?\)/g, (match, varName, fallback) => {
      if (varMap.has(varName)) {
        return varMap.get(varName)!;
      }
      return fallback ? fallback.trim() : match;
    });
    iterations++;
  }
  return current;
}

function resolveValueToVariable(
  value: string,
  propertyType: 'color' | 'bg' | 'border' | 'radius' | 'spacing' | 'other',
  varMap: Map<string, string>
): string {
  const cleanVal = value.trim().toLowerCase();
  
  // 1. If it's already a var(), normalize it and return
  if (cleanVal.startsWith("var(")) {
    return normalizeCssVariableNames(value);
  }
  
  // 2. Loop over all variables in varMap and find matches
  let bestMatch: string | null = null;
  let bestPriority = -1;
  
  for (const [dgName, val] of varMap.entries()) {
    if (val.trim().toLowerCase() === cleanVal) {
      const normalizedName = normalizeVarName(dgName);
      
      // Assign priority based on propertyType
      let priority = 0;
      if (propertyType === 'bg') {
        if (normalizedName === '--background') priority = 100;
        else if (normalizedName === '--card') priority = 90;
        else if (normalizedName === '--muted') priority = 80;
        else if (normalizedName === '--popover') priority = 70;
        else if (normalizedName === '--tint-blue') priority = 65;
        else if (normalizedName === '--tint-orange') priority = 64;
        else if (normalizedName === '--tint-cyan') priority = 63;
        else if (normalizedName === '--tint-purple') priority = 62;
        else if (normalizedName === '--surface-muted') priority = 61;
        else if (normalizedName === '--primary') priority = 50;
        else if (normalizedName === '--secondary') priority = 40;
      } else if (propertyType === 'color') {
        if (normalizedName === '--foreground') priority = 100;
        else if (normalizedName === '--muted-foreground') priority = 90;
        else if (normalizedName === '--low-foreground') priority = 80;
        else if (normalizedName === '--primary-foreground') priority = 70;
        else if (normalizedName === '--primary') priority = 60;
      } else if (propertyType === 'border') {
        if (normalizedName === '--border') priority = 100;
        else if (normalizedName === '--ring') priority = 90;
        else if (normalizedName === '--primary') priority = 80;
      } else if (propertyType === 'radius') {
        if (normalizedName === '--radius') priority = 100;
        else if (normalizedName === '--radius-pill') priority = 90;
      } else if (propertyType === 'spacing') {
        if (normalizedName === '--screen-margin') priority = 100;
        else if (normalizedName === '--section-gap') priority = 90;
        else if (normalizedName === '--element-gap') priority = 80;
        else if (normalizedName.startsWith('--spacing-')) priority = 70;
      }
      
      if (priority > bestPriority) {
        bestPriority = priority;
        bestMatch = normalizedName;
      } else if (bestMatch === null) {
        bestMatch = normalizedName;
      }
    }
  }
  
  if (bestMatch) {
    return `var(${bestMatch})`;
  }
  
  return value;
}

function stylePropertyToTailwind(property: string, value: string, varMap: Map<string, string>): string | null {
  const prop = property.trim().toLowerCase();

  // Helper to format values for Tailwind arbitrary notation [val]
  const formatArbitraryValue = (v: string) => {
    let cleaned = v.replace(/([a-zA-Z0-9_-]+)\(([^)]+)\)/gi, (match, fn, args) => {
      return `${fn}(${args.replace(/\s+/g, "")})`;
    });
    cleaned = cleaned.replace(/\s+/g, "_");
    return cleaned;
  };

  switch (prop) {
    case "color": {
      const val = resolveValueToVariable(value, 'color', varMap);
      if (val === "var(--foreground)") return "text-foreground";
      if (val === "var(--muted-foreground)") return "text-muted-foreground";
      if (val === "var(--low-foreground)") return "text-low-foreground";
      if (val === "var(--primary-foreground)") return "text-primary-foreground";
      if (val === "var(--primary)") return "text-primary";
      return `text-[${formatArbitraryValue(val)}]`;
    }
    case "background-color": {
      const val = resolveValueToVariable(value, 'bg', varMap);
      if (val === "var(--background)") return "bg-background";
      if (val === "var(--muted)") return "bg-muted";
      if (val === "var(--card)") return "bg-card";
      if (val === "var(--popover)") return "bg-popover";
      if (val === "var(--primary)") return "bg-primary";
      if (val === "var(--secondary)") return "bg-secondary";
      if (val === "var(--tint-blue)") return "bg-tint-blue";
      if (val === "var(--tint-orange)") return "bg-tint-orange";
      if (val === "var(--tint-cyan)") return "bg-tint-cyan";
      if (val === "var(--tint-purple)") return "bg-tint-purple";
      if (val === "var(--surface-muted)") return "bg-tint-gray";
      return `bg-[${formatArbitraryValue(val)}]`;
    }
    case "font-size": {
      const val = resolveValueToVariable(value, 'other', varMap);
      if (val === "var(--nav-title-size)") return "text-nav-title";
      if (val === "var(--screen-title-size)") return "text-screen-title";
      if (val === "var(--hero-title-size)") return "text-hero-title";
      if (val === "var(--section-title-size)") return "text-section-title";
      if (val === "var(--metric-value-size)") return "text-metric-value";
      if (val === "var(--body-size)") return "text-body";
      if (val === "var(--supporting-size)") return "text-supporting";
      if (val === "var(--caption-size)") return "text-caption";
      if (val === "var(--button-label-size)") return "text-button-label";
      return `text-[${formatArbitraryValue(val)}]`;
    }
    case "font-weight": {
      const val = resolveValueToVariable(value, 'other', varMap);
      if (val === "var(--nav-title-weight)") return "font-nav-title";
      if (val === "var(--screen-title-weight)") return "font-screen-title";
      if (val === "var(--hero-title-weight)") return "font-hero-title";
      if (val === "var(--section-title-weight)") return "font-section-title";
      if (val === "var(--metric-value-weight)") return "font-metric-value";
      if (val === "var(--body-weight)") return "font-body";
      if (val === "var(--supporting-weight)") return "font-supporting";
      if (val === "var(--caption-weight)") return "font-caption";
      if (val === "var(--button-label-weight)") return "font-button-label";
      if (val === "400" || val === "normal") return "font-normal";
      if (val === "500" || val === "medium") return "font-medium";
      if (val === "600" || val === "semibold") return "font-semibold";
      if (val === "700" || val === "bold") return "font-bold";
      if (val === "800" || val === "extrabold") return "font-extrabold";
      if (val === "900" || val === "black") return "font-black";
      return `font-[${val}]`;
    }
    case "line-height": {
      const val = resolveValueToVariable(value, 'other', varMap);
      return `leading-[${formatArbitraryValue(val)}]`;
    }
    case "font-family": {
      const val = resolveValueToVariable(value, 'other', varMap);
      if (val === "var(--font-body)") return "font-sans";
      const primary = val.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "").replace(/\s+/g, "_");
      if (primary) {
        return `font-['${primary}']`;
      }
      return null;
    }
    case "border-radius": {
      const val = resolveValueToVariable(value, 'radius', varMap);
      if (val === "var(--radius)") return "rounded-lg";
      if (val === "9999px" || val === "var(--radius-pill)") return "rounded-full";
      return `rounded-[${formatArbitraryValue(val)}]`;
    }
    case "border-color": {
      const val = resolveValueToVariable(value, 'border', varMap);
      if (val === "var(--border)") return "border-border";
      if (val === "var(--primary)") return "border-primary";
      return `border-[${formatArbitraryValue(val)}]`;
    }
    case "border-width": {
      const val = resolveValueToVariable(value, 'other', varMap);
      return `border-[${formatArbitraryValue(val)}]`;
    }
    case "padding-top": {
      const val = resolveValueToVariable(value, 'spacing', varMap);
      return `pt-[${formatArbitraryValue(val)}]`;
    }
    case "padding-bottom": {
      const val = resolveValueToVariable(value, 'spacing', varMap);
      return `pb-[${formatArbitraryValue(val)}]`;
    }
    case "padding-left": {
      const val = resolveValueToVariable(value, 'spacing', varMap);
      return `pl-[${formatArbitraryValue(val)}]`;
    }
    case "padding-right": {
      const val = resolveValueToVariable(value, 'spacing', varMap);
      return `pr-[${formatArbitraryValue(val)}]`;
    }
    case "padding": {
      const val = resolveValueToVariable(value, 'spacing', varMap);
      return `p-[${formatArbitraryValue(val)}]`;
    }
    case "margin-top": {
      const val = resolveValueToVariable(value, 'spacing', varMap);
      return `mt-[${formatArbitraryValue(val)}]`;
    }
    case "margin-bottom": {
      const val = resolveValueToVariable(value, 'spacing', varMap);
      return `mb-[${formatArbitraryValue(val)}]`;
    }
    case "margin-left": {
      const val = resolveValueToVariable(value, 'spacing', varMap);
      return `ml-[${formatArbitraryValue(val)}]`;
    }
    case "margin-right": {
      const val = resolveValueToVariable(value, 'spacing', varMap);
      return `mr-[${formatArbitraryValue(val)}]`;
    }
    case "margin": {
      const val = resolveValueToVariable(value, 'spacing', varMap);
      return `m-[${formatArbitraryValue(val)}]`;
    }
    case "width": {
      const val = resolveValueToVariable(value, 'other', varMap);
      if (val === "100%") return "w-full";
      if (val === "auto") return "w-auto";
      return `w-[${formatArbitraryValue(val)}]`;
    }
    case "height": {
      const val = resolveValueToVariable(value, 'other', varMap);
      if (val === "100%") return "h-full";
      if (val === "auto") return "h-auto";
      return `h-[${formatArbitraryValue(val)}]`;
    }
    case "min-height": {
      const val = resolveValueToVariable(value, 'other', varMap);
      if (val === "100vh") return "min-h-screen";
      return `min-h-[${formatArbitraryValue(val)}]`;
    }
    case "max-width": {
      const val = resolveValueToVariable(value, 'other', varMap);
      return `max-w-[${formatArbitraryValue(val)}]`;
    }
    case "gap": {
      const val = resolveValueToVariable(value, 'spacing', varMap);
      return `gap-[${formatArbitraryValue(val)}]`;
    }
    case "opacity": {
      const val = resolveValueToVariable(value, 'other', varMap);
      return `opacity-[${formatArbitraryValue(val)}]`;
    }
    case "box-shadow": {
      const val = resolveValueToVariable(value, 'other', varMap);
      if (val === "var(--shadow-surface)") return "shadow-surface";
      if (val === "var(--shadow-overlay)") return "shadow-overlay";
      return `shadow-[${formatArbitraryValue(val)}]`;
    }
    case "background-image": {
      const val = resolveValueToVariable(value, 'other', varMap);
      return `bg-[${formatArbitraryValue(val)}]`;
    }
    default:
      return null;
  }
}

function compileElement(element: Element, varMap: Map<string, string>) {
  // 1. Loop over all attributes and resolve variables first (like stroke/fill)
  const attrNames = element.getAttributeNames();
  for (const name of attrNames) {
    if (name !== "style" && name !== "class") {
      const val = element.getAttribute(name);
      if (val) {
        element.setAttribute(name, normalizeCssVariableNames(val));
      }
    }
  }

  // 2. Resolve custom dg- utility classes and reverse-engineer arbitrary values in classList
  const classAttr = element.getAttribute("class") || "";
  let classList = classAttr.split(/\s+/).filter(Boolean);

  const nextClassList: string[] = [];
  for (const cls of classList) {
    // Check if the class is an arbitrary utility class like prefix-[value]
    const match = cls.match(/^([a-z]+(?:-[a-z]+)*)-\[([^\]]+)\]$/i);
    if (match) {
      const prefix = match[1];
      const val = match[2];
      
      let propertyType: 'color' | 'bg' | 'border' | 'radius' | 'spacing' | 'other' = 'other';
      if (prefix === 'bg') propertyType = 'bg';
      else if (prefix === 'text') propertyType = 'color';
      else if (prefix === 'border') propertyType = 'border';
      else if (prefix === 'rounded') propertyType = 'radius';
      else if (['p', 'pt', 'pb', 'pl', 'pr', 'px', 'py', 'm', 'mt', 'mb', 'ml', 'mr', 'mx', 'my', 'gap'].includes(prefix)) propertyType = 'spacing';
      
      const resolvedVal = resolveValueToVariable(val, propertyType, varMap);
      if (resolvedVal !== val) {
        const cleanedVal = resolvedVal.replace(/\s+/g, "_");
        nextClassList.push(`${prefix}-[${cleanedVal}]`);
      } else {
        nextClassList.push(cls);
      }
    } else if (cls === "dg-bg-primary") {
      nextClassList.push("bg-background");
    } else if (cls === "dg-bg-secondary") {
      nextClassList.push("bg-muted");
    } else if (cls === "dg-surface-card") {
      nextClassList.push("bg-card");
    } else if (cls === "dg-surface-bottom-sheet") {
      nextClassList.push("bg-card");
    } else if (cls === "dg-surface-modal") {
      nextClassList.push("bg-popover");
    } else if (cls === "dg-text-high") {
      nextClassList.push("text-foreground");
    } else if (cls === "dg-text-medium") {
      nextClassList.push("text-muted-foreground");
    } else if (cls === "dg-text-low") {
      nextClassList.push("text-low-foreground");
    } else if (cls === "dg-action-primary") {
      nextClassList.push("bg-primary", "text-primary-foreground");
    } else if (cls === "dg-action-secondary") {
      nextClassList.push("bg-secondary");
    } else if (cls === "dg-border-divider") {
      nextClassList.push("border-border");
    } else if (cls === "dg-border-focused") {
      nextClassList.push("border-primary");
    } else if (cls === "dg-radius-app") {
      nextClassList.push("rounded-lg");
    } else if (cls === "dg-radius-pill") {
      nextClassList.push("rounded-full");
    } else if (cls === "dg-shadow-surface") {
      nextClassList.push("shadow-surface");
    } else if (cls === "dg-shadow-overlay") {
      nextClassList.push("shadow-overlay");
    } else if (cls === "dg-screen-padding") {
      nextClassList.push("pl-[var(--screen-margin)]", "pr-[var(--screen-margin)]");
    } else if (cls === "dg-section-gap") {
      nextClassList.push("gap-[var(--section-gap)]");
    } else if (cls === "dg-element-gap") {
      nextClassList.push("gap-[var(--element-gap)]");
    } else if (cls === "dg-type-nav-title") {
      nextClassList.push("text-nav-title", "font-nav-title");
    } else if (cls === "dg-type-screen-title") {
      nextClassList.push("text-screen-title", "font-screen-title");
    } else if (cls === "dg-type-hero-title") {
      nextClassList.push("text-hero-title", "font-hero-title");
    } else if (cls === "dg-type-section-title") {
      nextClassList.push("text-section-title", "font-section-title");
    } else if (cls === "dg-type-metric-value") {
      nextClassList.push("text-metric-value", "font-metric-value");
    } else if (cls === "dg-type-body") {
      nextClassList.push("text-body", "font-body");
    } else if (cls === "dg-type-supporting") {
      nextClassList.push("text-supporting", "font-supporting");
    } else if (cls === "dg-type-caption") {
      nextClassList.push("text-caption", "font-caption");
    } else if (cls === "dg-type-button-label") {
      nextClassList.push("text-button-label", "font-button-label");
    } else {
      nextClassList.push(cls);
    }
  }

  // 3. Normalize all variables inside classList
  classList = nextClassList.map(cls => {
    const resolved = normalizeCssVariableNames(cls);
    // Replace spaces with underscores inside any brackets [...] (Tailwind arbitrary notation requirement)
    return resolved.replace(/\[([^\]]+)\]/g, (match, content) => {
      // Remove spaces inside any parenthesis functions (e.g. rgb/rgba/calc)
      let cleaned = content.replace(/([a-zA-Z0-9_-]+)\(([^)]+)\)/gi, (fnMatch, fn, args) => {
        return `${fn}(${args.replace(/\s+/g, "")})`;
      });
      // Replace remaining spaces with underscores
      cleaned = cleaned.replace(/\s+/g, "_");
      return `[${cleaned}]`;
    });
  });

  // 4. Parse and resolve inline styles
  const styleAttr = element.getAttribute("style");
  if (styleAttr) {
    const resolvedStyleAttr = normalizeCssVariableNames(styleAttr);
    const styleDeclarations = parseStyle(resolvedStyleAttr);

    // Track which style declarations we have successfully compiled to Tailwind
    const compiledProperties: string[] = [];

    for (const [property, value] of styleDeclarations.entries()) {
      const tailwindClass = stylePropertyToTailwind(property, value, varMap);
      if (tailwindClass) {
        classList.push(tailwindClass);
        compiledProperties.push(property);
      }
    }

    // Remove compiled properties from style declarations
    for (const prop of compiledProperties) {
      styleDeclarations.delete(prop);
    }

    // Update or remove the style attribute
    if (styleDeclarations.size > 0) {
      element.setAttribute("style", serializeStyle(styleDeclarations));
    } else {
      element.removeAttribute("style");
    }
  }

  // 5. Simplify class list to standard Tailwind classes if they contain simple normalized variable classes
  const simplifiedClassList: string[] = [];
  for (const cls of classList) {
    if (cls === "bg-[var(--background)]") {
      simplifiedClassList.push("bg-background");
    } else if (cls === "bg-[var(--muted)]") {
      simplifiedClassList.push("bg-muted");
    } else if (cls === "bg-[var(--card)]") {
      simplifiedClassList.push("bg-card");
    } else if (cls === "bg-[var(--popover)]") {
      simplifiedClassList.push("bg-popover");
    } else if (cls === "text-[var(--foreground)]") {
      simplifiedClassList.push("text-foreground");
    } else if (cls === "text-[var(--muted-foreground)]") {
      simplifiedClassList.push("text-muted-foreground");
    } else if (cls === "text-[var(--low-foreground)]") {
      simplifiedClassList.push("text-low-foreground");
    } else if (cls === "bg-[var(--primary)]") {
      simplifiedClassList.push("bg-primary");
    } else if (cls === "text-[var(--primary-foreground)]") {
      simplifiedClassList.push("text-primary-foreground");
    } else if (cls === "bg-[var(--secondary)]") {
      simplifiedClassList.push("bg-secondary");
    } else if (cls === "border-[var(--border)]") {
      simplifiedClassList.push("border-border");
    } else if (cls === "border-[var(--primary)]") {
      simplifiedClassList.push("border-primary");
    } else if (cls === "rounded-[var(--radius)]") {
      simplifiedClassList.push("rounded-lg");
    } else if (cls === "shadow-[var(--shadow-surface)]") {
      simplifiedClassList.push("shadow-surface");
    } else if (cls === "shadow-[var(--shadow-overlay)]") {
      simplifiedClassList.push("shadow-overlay");
    } else if (cls === "bg-[var(--tint-blue)]") {
      simplifiedClassList.push("bg-tint-blue");
    } else if (cls === "bg-[var(--tint-orange)]") {
      simplifiedClassList.push("bg-tint-orange");
    } else if (cls === "bg-[var(--tint-cyan)]") {
      simplifiedClassList.push("bg-tint-cyan");
    } else if (cls === "bg-[var(--tint-purple)]") {
      simplifiedClassList.push("bg-tint-purple");
    } else if (cls === "bg-[var(--surface-muted)]") {
      simplifiedClassList.push("bg-tint-gray");
    } else {
      simplifiedClassList.push(cls);
    }
  }
  classList = simplifiedClassList;

  // 6. Update the class attribute with cleaned and deduplicated classes
  const cleanClasses = Array.from(new Set(classList.map(c => c.trim()))).filter(Boolean);
  if (cleanClasses.length > 0) {
    element.setAttribute("class", cleanClasses.join(" "));
  } else {
    element.removeAttribute("class");
  }

  // Recursively compile all children
  for (let i = 0; i < element.children.length; i++) {
    compileElement(element.children[i], varMap);
  }
}

export function compileHtmlForProduction(html: string, designTokens?: DesignTokens | null): string {
  if (!html.trim()) {
    return html;
  }

  // 1. Flatten active design tokens into CSS variables map
  const normalized = normalizeDesignTokens(designTokens ?? {});
  const variables = flattenDesignTokensToCssVariables(normalized);
  const varMap = new Map<string, string>();
  variables.forEach(v => {
    varMap.set(v.name, v.value);
  });

  // Ensure surface-muted is defined in varMap for dynamic resolution
  if (!varMap.has("--surface-muted")) {
    varMap.set("--surface-muted", "#F5F5F5");
  }

  // 2. Parse the HTML using DOMParser
  if (typeof DOMParser === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // 3. Compile all elements in body
  const rootElements = Array.from(doc.body.children);
  for (const root of rootElements) {
    compileElement(root, varMap);
  }

  return doc.body.innerHTML;
}

export function compileStylesheetForProduction(varMap: Map<string, string>): string {
  const rootVariables: string[] = [];
  
  // Output all variables from varMap normalized
  for (const [key, value] of varMap.entries()) {
    const normalizedName = normalizeVarName(key);
    rootVariables.push(`  ${normalizedName}: ${value};`);
  }

  // Ensure functional tints and surface-muted are explicitly defined if missing
  if (!rootVariables.some(v => v.trim().startsWith("--tint-blue:"))) {
    rootVariables.push(`  --tint-blue: ${varMap.get("--dg-color-functional-tints-blue-base") || "#F0F7FF"};`);
  }
  if (!rootVariables.some(v => v.trim().startsWith("--tint-orange:"))) {
    rootVariables.push(`  --tint-orange: ${varMap.get("--dg-color-functional-tints-orange-base") || "#FFF7F0"};`);
  }
  if (!rootVariables.some(v => v.trim().startsWith("--tint-cyan:"))) {
    rootVariables.push(`  --tint-cyan: ${varMap.get("--dg-color-functional-tints-cyan-base") || "#F0FBFF"};`);
  }
  if (!rootVariables.some(v => v.trim().startsWith("--tint-purple:"))) {
    rootVariables.push(`  --tint-purple: ${varMap.get("--dg-color-functional-tints-purple-base") || "#F9F5FF"};`);
  }
  if (!rootVariables.some(v => v.trim().startsWith("--surface-muted:"))) {
    rootVariables.push(`  --surface-muted: #F5F5F5;`);
  }

  const variableCss = rootVariables.join("\n");

  return `
:root {
${variableCss}
}

html, body { margin: 0; min-height: 100%; }
body {
  font-family: var(--font-body), -apple-system, sans-serif;
  background: var(--background);
  color: var(--foreground);
}
#drawgle-export-root {
  position: relative;
  min-height: 100vh;
  overflow-x: hidden;
  background: var(--background);
}
#drawgle-export-navigation { position: fixed; left: 0; right: 0; bottom: 0; z-index: 80; pointer-events: none; }
#drawgle-export-navigation [data-drawgle-primary-nav] { pointer-events: auto; }
  `.trim();
}

export function buildTailwindConfigScript(): string {
  return `
    <script>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: {
              sans: ["var(--font-body)", "-apple-system", "BlinkMacSystemFont", "sans-serif"]
            },
            colors: {
              background: "var(--background)",
              muted: {
                DEFAULT: "var(--muted)",
                foreground: "var(--muted-foreground)"
              },
              card: {
                DEFAULT: "var(--card)",
                foreground: "var(--foreground)"
              },
              popover: {
                DEFAULT: "var(--popover)",
                foreground: "var(--foreground)"
              },
              foreground: "var(--foreground)",
              primary: {
                DEFAULT: "var(--primary)",
                foreground: "var(--primary-foreground)"
              },
              secondary: "var(--secondary)",
              border: "var(--border)",
              "low-foreground": "var(--low-foreground)",
              tint: {
                blue: "var(--tint-blue)",
                orange: "var(--tint-orange)",
                cyan: "var(--tint-cyan)",
                purple: "var(--tint-purple)",
                gray: "var(--surface-muted)"
              }
            },
            borderRadius: {
              lg: "var(--radius)",
              md: "calc(var(--radius) - 2px)",
              sm: "calc(var(--radius) - 4px)"
            },
            spacing: {
              "screen-margin": "var(--screen-margin)",
              "section-gap": "var(--section-gap)",
              "element-gap": "var(--element-gap)"
            },
            boxShadow: {
              surface: "var(--shadow-surface)",
              overlay: "var(--shadow-overlay)"
            },
            fontSize: {
              "nav-title": ["var(--nav-title-size)", { lineHeight: "var(--nav-title-line-height)" }],
              "screen-title": ["var(--screen-title-size)", { lineHeight: "var(--screen-title-line-height)" }],
              "hero-title": ["var(--hero-title-size)", { lineHeight: "var(--hero-title-line-height)" }],
              "section-title": ["var(--section-title-size)", { lineHeight: "var(--section-title-line-height)" }],
              "metric-value": ["var(--metric-value-size)", { lineHeight: "var(--metric-value-line-height)" }],
              body: ["var(--body-size)", { lineHeight: "var(--body-line-height)" }],
              supporting: ["var(--supporting-size)", { lineHeight: "var(--supporting-line-height)" }],
              caption: ["var(--caption-size)", { lineHeight: "var(--caption-line-height)" }],
              "button-label": ["var(--button-label-size)", { lineHeight: "var(--button-label-line-height)" }]
            },
            fontWeight: {
              "nav-title": "var(--nav-title-weight)",
              "screen-title": "var(--screen-title-weight)",
              "hero-title": "var(--hero-title-weight)",
              "section-title": "var(--section-title-weight)",
              "metric-value": "var(--metric-value-weight)",
              body: "var(--body-weight)",
              supporting: "var(--supporting-weight)",
              caption: "var(--caption-weight)",
              "button-label": "var(--button-label-weight)"
            }
          }
        }
      };
    </script>
  `.trim();
}
