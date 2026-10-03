import { normalizeDesignTokens } from "@/lib/design-tokens";
import { actionGradientStops, updateActionGradient } from "@/lib/action-gradient";
import type { DesignTokens, DesignTokenValues } from "@/lib/types";
export type TokenUpdate = (path: string[], value: string) => void;
export type ColorToken = { label: string; path: string[]; value: string };
export function updateToken(value: DesignTokens, path: string[], next: string) {
  const draft = normalizeDesignTokens(value);
  let target = draft.tokens as Record<string, unknown>;
  for (const part of path.slice(0, -1)) {
    if (!target[part] || typeof target[part] !== "object" || Array.isArray(target[part])) target[part] = {};
    target = target[part] as Record<string, unknown>;
  }
  target[path.at(-1)!] = next;
  if (path[0] === "color" && path[1] === "action") updateActionGradient(draft.tokens!, path[2], next);
  return normalizeDesignTokens(draft);
}
export const fontName = (value: string) => value.split(",")[0].replace(/["']/g, "").trim() || "Choose font";
export function fontStack(value: string) {
  const clean = value.replace(/[;{}<>]/g, "").trim();
  return !clean || clean.includes(",") || /^['"].*['"]$/.test(clean) || /^(system-ui|sans-serif|serif|monospace|ui-sans-serif|ui-serif|ui-monospace)$/i.test(clean)
    ? clean : `"${clean.replace(/["']/g, "")}", sans-serif`;
}
export const TYPE_ROLES = [
  { key: "screen_title", label: "Screen title", sample: "Your daily overview", fallback: 24 },
  { key: "hero_title", label: "Hero title", sample: "Make room for more.", fallback: 32 },
  { key: "section_title", label: "Section title", sample: "Weekly activity", fallback: 18 },
  { key: "nav_title", label: "Navigation title", sample: "Overview", fallback: 17 },
  { key: "metric_value", label: "Metric value", sample: "$500,000", fallback: 32 },
  { key: "body", label: "Body", sample: "Every detail, considered.", fallback: 16 },
  { key: "supporting", label: "Supporting", sample: "A little more context", fallback: 14 },
  { key: "caption", label: "Caption", sample: "Updated just now", fallback: 12 },
  { key: "button_label", label: "Button label", sample: "Continue", fallback: 15 },
] as const;
export const WEIGHTS = [{ value: "300", label: "Light" }, { value: "400", label: "Regular" }, { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" }, { value: "700", label: "Bold" }, { value: "800", label: "Heavy" }];
export function colorGroups(tokens: DesignTokenValues) {
  const background = tokens.color?.background, text = tokens.color?.text, action = tokens.color?.action, surface = tokens.color?.surface;
  const primary = action?.primary || "#000000", card = surface?.card || "#FFFFFF", divider = tokens.color?.border?.divider || "#E5E7EB";
  const make = (label: string, prefix: string[], items: [string, string, string | undefined, string][]) => ({ label,
    colors: items.map(([name, key, value, fallback]) => ({ label: name, path: [...prefix, key], value: value || fallback })) });
  return [
    make("Canvas", ["color", "background"], [["Background", "primary", background?.primary, "#FFFFFF"], ["Secondary", "secondary", background?.secondary, "#F9FAFB"], ["Raised", "surface_elevated", background?.surface_elevated, background?.secondary || "#F9FAFB"]]),
    make("Text", ["color", "text"], [["Primary text", "high_emphasis", text?.high_emphasis, "#111827"], ["Muted text", "medium_emphasis", text?.medium_emphasis, "#6B7280"], ["Subtle text", "low_emphasis", text?.low_emphasis, "#9CA3AF"], ["Action label", "action_label", text?.action_label, primary]]),
    make("Actions", ["color", "action"], [["Primary action", "primary", action?.primary, "#000000"], ["Secondary action", "secondary", action?.secondary, "#333333"], ["On primary", "on_primary_text", action?.on_primary_text, "#FFFFFF"], ["On surface", "on_surface_white_bg", action?.on_surface_white_bg, primary], ["Disabled action", "disabled", action?.disabled, "#E5E7EB"]]),
    make("Surfaces", ["color", "surface"], [["Card", "card", surface?.card, "#FFFFFF"], ["Inset", "inset", surface?.inset, card], ["Bottom sheet", "bottom_sheet", surface?.bottom_sheet, "#FFFFFF"], ["Modal", "modal", surface?.modal, "#FFFFFF"]]),
    make("Navigation", ["navigation"], [["Surface", "surface", tokens.navigation?.surface, card], ["Content", "content", tokens.navigation?.content, text?.high_emphasis || "#111827"], ["Muted content", "muted_content", tokens.navigation?.muted_content, text?.low_emphasis || "#9CA3AF"], ["Active surface", "active_surface", tokens.navigation?.active_surface, primary], ["Active content", "active_content", tokens.navigation?.active_content, action?.on_primary_text || "#FFFFFF"], ["Navigation border", "border", tokens.navigation?.border, divider]]),
    make("Borders", ["color", "border"], [["Divider", "divider", tokens.color?.border?.divider, "#E5E7EB"], ["Focus", "focused", tokens.color?.border?.focused, "#111827"]]),
    make("Action gradient", ["color", "action"], [["Gradient start", "primary_gradient_start", actionGradientStops(tokens).start, primary], ["Gradient end", "primary_gradient_end", actionGradientStops(tokens).end, primary]]),
    { label: "Accent tints", colors: Object.entries(tokens.color?.accent_tints ?? {}).map(([key, value]) => ({ label: `Tint ${key}`, path: ["color", "accent_tints", key], value })) },
  ];
}
export function previewProps(tokens: DesignTokenValues) {
  const primaryBg = tokens.color?.background?.primary || "#FFFFFF", secondaryBg = tokens.color?.background?.secondary || "#F9FAFB";
  const primaryText = tokens.color?.text?.high_emphasis || "#111827", mediumText = tokens.color?.text?.medium_emphasis || "#6B7280", lowText = tokens.color?.text?.low_emphasis || "#9CA3AF";
  const actionPrimary = tokens.color?.action?.primary || "#000000", actionSecondary = tokens.color?.action?.secondary || "#333333", actionText = tokens.color?.action?.on_primary_text || "#FFFFFF";
  const cardBg = tokens.color?.surface?.card || "#FFFFFF", borderDivider = tokens.color?.border?.divider || "#E5E7EB", shadowSurface = tokens.shadows?.surface || "none";
  return { tokens, primaryBg, secondaryBg, primaryText, mediumText, lowText, actionPrimary, actionSecondary, actionText, cardBg, borderDivider, shadowSurface,
    radius: tokens.radii?.app || "18px", radiusInner: tokens.radii?.inner || "12px", radiusPill: tokens.radii?.pill || "9999px", borderStandard: tokens.border_widths?.standard || "1px",
    headingFontFamily: tokens.typography?.heading_font_family, bodyFontFamily: tokens.typography?.body_font_family,
    navigationSurface: tokens.navigation?.surface || cardBg, navigationContent: tokens.navigation?.content || primaryText, navigationMuted: tokens.navigation?.muted_content || lowText,
    navigationActiveSurface: tokens.navigation?.active_surface || actionPrimary, navigationActiveContent: tokens.navigation?.active_content || actionText,
    navigationBorder: tokens.navigation?.border || borderDivider, navigationShadow: tokens.navigation?.shadow || shadowSurface };
}
