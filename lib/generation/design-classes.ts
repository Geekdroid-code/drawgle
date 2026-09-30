import { hasCastShadow, parseShadowLayers } from "@/lib/shadow-css";
import type { DesignTokens, RadiusClass, SurfaceElevation } from "@/lib/types";

/**
 * Radius and elevation reach the model layers as categories, never as numbers.
 *
 * A model that writes "32px" or "4% shadow" into prose has that value copied
 * downstream as an order, and every stage amplifies it. So a model only
 * classifies what it sees, and code maps the class to the number.
 */

export const RADIUS_CLASSES = ["square", "soft", "rounded", "very-rounded"] as const satisfies readonly RadiusClass[];
export const SURFACE_ELEVATIONS = ["flat-tone", "hairline", "soft-shadow", "strong-shadow"] as const satisfies readonly SurfaceElevation[];

/** The card radius (px) each class stands for. The founder's rule caps it at 24px. */
export const RADIUS_CLASS_PX: Record<RadiusClass, number> = { square: 4, soft: 10, rounded: 16, "very-rounded": 20 };

const slug = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase().replace(/[\s_]+/g, "-") : "";

const RADIUS_SYNONYMS: Record<string, RadiusClass> = {
  square: "square",
  sharp: "square",
  "square-cornered": "square",
  none: "square",
  soft: "soft",
  "softly-rounded": "soft",
  "slightly-rounded": "soft",
  subtle: "soft",
  small: "soft",
  rounded: "rounded",
  round: "rounded",
  medium: "rounded",
  moderate: "rounded",
  "very-rounded": "very-rounded",
  "extra-rounded": "very-rounded",
  "highly-rounded": "very-rounded",
  large: "very-rounded",
  "extra-large": "very-rounded",
};

const ELEVATION_SYNONYMS: Record<string, SurfaceElevation> = {
  "flat-tone": "flat-tone",
  flat: "flat-tone",
  tonal: "flat-tone",
  tone: "flat-tone",
  "tone-on-tone": "flat-tone",
  "no-shadow": "flat-tone",
  none: "flat-tone",
  hairline: "hairline",
  border: "hairline",
  bordered: "hairline",
  outline: "hairline",
  "thin-border": "hairline",
  "soft-shadow": "soft-shadow",
  soft: "soft-shadow",
  diffuse: "soft-shadow",
  "subtle-shadow": "soft-shadow",
  "low-shadow": "soft-shadow",
  "strong-shadow": "strong-shadow",
  strong: "strong-shadow",
  "hard-shadow": "strong-shadow",
  "heavy-shadow": "strong-shadow",
  "drop-shadow": "strong-shadow",
  dramatic: "strong-shadow",
};

export const normalizeRadiusClass = (value: unknown): RadiusClass | null => RADIUS_SYNONYMS[slug(value)] ?? null;

export const normalizeSurfaceElevation = (value: unknown): SurfaceElevation | null => ELEVATION_SYNONYMS[slug(value)] ?? null;

/** Prose for the layers that must not carry a value. */
export const RADIUS_CLASS_DESCRIPTION: Record<RadiusClass, string> = {
  square: "square-cornered surfaces",
  soft: "softly rounded corners",
  rounded: "clearly rounded cards",
  "very-rounded": "generously rounded cards (cards are never pill-shaped)",
};

export const SURFACE_ELEVATION_DESCRIPTION: Record<SurfaceElevation, string> = {
  "flat-tone": "surfaces separate by tone alone: a lighter or darker fill, no cast shadow and no border",
  hairline: "surfaces separate by a thin hairline edge, with no cast shadow",
  "soft-shadow": "surfaces lift with a very soft, diffuse shadow",
  "strong-shadow": "surfaces cast a clearly visible shadow",
};

/** The reference's shape and depth language in words, without a single number. */
export const describeSurfaceClasses = ({
  radiusClass,
  surfaceElevation,
}: {
  radiusClass?: RadiusClass | null;
  surfaceElevation?: SurfaceElevation | null;
}) => [
  radiusClass ? RADIUS_CLASS_DESCRIPTION[radiusClass] : null,
  surfaceElevation ? SURFACE_ELEVATION_DESCRIPTION[surfaceElevation] : null,
].filter((line): line is string => Boolean(line));

/** The class a card radius in px falls into, using the same ranges the analysis is judged against. */
export const radiusClassForPx = (px: number): RadiusClass =>
  px <= 5 ? "square" : px <= 11 ? "soft" : px <= 17 ? "rounded" : "very-rounded";

/** The most opaque a "soft" surface shadow layer may be. Token calibration caps a soft reference's shadow here. */
export const SOFT_SHADOW_MAX_ALPHA = 0.08;

/** How a surface shadow token separates cards: none is flat, a light diffuse one is soft, anything more is strong. */
export const surfaceElevationOfShadow = (shadow: string | null | undefined): SurfaceElevation => {
  const layers = parseShadowLayers(shadow).filter((layer) => !layer.inset);
  if (!hasCastShadow(shadow)) return layers.some((layer) => layer.alpha > 0.015) ? "hairline" : "flat-tone";
  return layers.every((layer) => layer.alpha <= SOFT_SHADOW_MAX_ALPHA) ? "soft-shadow" : "strong-shadow";
};

const firstFontFamily = (stack: string | undefined) =>
  stack?.split(",")[0]?.replace(/["']/g, "").trim() || null;

/**
 * The approved tokens in words, for the layers that plan structure. Fonts are names
 * and the rest is the same category language the analysis uses, so a planner sees
 * the design language without a single value it could copy into a brief.
 */
export const describeTokenLanguage = (designTokens: DesignTokens | null | undefined): string[] => {
  const tokens = designTokens?.tokens;
  if (!tokens) return [];
  const heading = firstFontFamily(tokens.typography?.heading_font_family);
  const body = firstFontFamily(tokens.typography?.body_font_family);
  const appRadius = Number.parseFloat(String(tokens.radii?.app ?? ""));
  const shape = describeSurfaceClasses({
    radiusClass: Number.isFinite(appRadius) ? radiusClassForPx(appRadius) : null,
    surfaceElevation: tokens.shadows ? surfaceElevationOfShadow(tokens.shadows.surface) : null,
  });
  // The rungs this project's tokens define: a project with no inset or tints has no such rungs to describe.
  const rungs = [
    "the page",
    "cards one tone step above it",
    tokens.color?.surface?.inset ? "inset tiles and fields inside cards" : null,
    Object.keys(tokens.color?.accent_tints ?? {}).length > 0 ? "tint wells and chips" : null,
    "one focal accent",
  ].filter((rung): rung is string => Boolean(rung));
  return [
    heading && body ? (heading === body ? `Fonts: ${heading} for everything.` : `Fonts: ${heading} for headings and ${body} for everything else.`) : null,
    shape.length ? `Shape and depth: ${shape.join("; ")}.` : null,
    `Surface ladder: ${rungs.join(", then ")}.`,
  ].filter((line): line is string => Boolean(line));
};
