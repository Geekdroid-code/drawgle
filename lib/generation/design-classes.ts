import type { RadiusClass, SurfaceElevation } from "@/lib/types";

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
