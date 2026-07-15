import type { DesignTokens, ProjectCraftBlueprint } from "@/lib/types";

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

const readTokenString = (tokens: DesignTokens, path: string) => {
  const segments = path.split(".");
  let current: unknown = tokens.tokens;
  for (const segment of segments) {
    if (!isRecord(current)) return null;
    current = current[segment];
  }
  return typeof current === "string" && current.trim() ? current : null;
};

const writeTokenString = (tokens: DesignTokens, path: string, value: string) => {
  const segments = path.split(".");
  const root = (tokens.tokens ??= {}) as Record<string, unknown>;
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    const existing = current[segment];
    if (!isRecord(existing)) current[segment] = {};
    current = current[segment] as Record<string, unknown>;
  }
  current[segments.at(-1)!] = value;
};

const craftTokenFallback = (tokens: DesignTokens, path: string) => {
  const core = (candidate: string, fallback: string) => readTokenString(tokens, candidate) ?? fallback;
  const fallbackByRole: Record<string, string> = {
    "color.surface.inset": core("color.surface.card", core("color.background.secondary", "#F3F4F6")),
    "color.surface.raised": core("color.surface.card", core("color.background.primary", "#FFFFFF")),
    "color.surface.glass": core("color.surface.card", "rgba(255,255,255,0.78)"),
    "radii.control": core("radii.app", "16px"),
    "radii.card": core("radii.app", "20px"),
    "radii.featured": core("radii.app", "24px"),
    "radii.sheet": core("radii.app", "24px"),
    "border_widths.hairline": core("border_widths.standard", "1px"),
    "border_widths.emphasis": "2px",
    "shadows.inset": "inset 0 1px 2px rgba(15, 23, 42, 0.10)",
    "shadows.raised": core("shadows.surface", "0 8px 24px rgba(15, 23, 42, 0.08)"),
    "shadows.floating": core("shadows.overlay", "0 18px 44px rgba(15, 23, 42, 0.16)"),
    "shadows.glow": "0 0 28px color-mix(in srgb, var(--dg-color-action-primary) 24%, transparent)",
    "gradients.atmosphere": core("gradients.app_background", "linear-gradient(180deg, var(--dg-color-background-primary), var(--dg-color-background-secondary))"),
    "gradients.edge_light": core("gradients.surface_highlight", "linear-gradient(135deg, rgba(255,255,255,0.46), rgba(255,255,255,0))"),
    "gradients.accent_glow": core("gradients.action_primary", "linear-gradient(135deg, var(--dg-color-action-primary), var(--dg-color-action-secondary))"),
    "effects.surface_blur": "blur(18px)",
    "effects.overlay_blur": "blur(28px)",
    "effects.edge_highlight_opacity": "0.42",
    "iconography.stroke_width": "1.8",
    "iconography.well_size": core("sizing.icon_container", "44px"),
  };
  return fallbackByRole[path] ?? null;
};

/** Fill only server-approved roles required by a normalized craft blueprint. */
export const ensureCraftTokenCoverage = (
  designTokens: DesignTokens,
  craftBlueprint?: ProjectCraftBlueprint | null,
) => {
  if (!craftBlueprint?.requiredTokenRoles.length) return designTokens;
  for (const path of craftBlueprint.requiredTokenRoles) {
    if (readTokenString(designTokens, path)) continue;
    const fallback = craftTokenFallback(designTokens, path);
    if (fallback) writeTokenString(designTokens, path, fallback);
  }
  return designTokens;
};
