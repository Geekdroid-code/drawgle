/**
 * Style Charter — the hand-authored design read of a reference, carried
 * forward as constraints instead of being dropped after retrieval.
 *
 * Every curated reference in the catalog already ships a `selectionProfile`
 * written by a designer: what the base color is, what the type character is,
 * what materials belong, and — crucially — an `incompatibleWith` list. Until
 * now that profile existed only to build the retrieval embedding. Once a
 * reference was selected the profile was discarded, so the creative-direction
 * and token stages were free to invent a direction that contradicted the very
 * reference they were matched to.
 *
 * The charter converts those tags into bounded, checkable constraints that
 * survive into token generation, the planner, and the builder.
 *
 * Precedence, highest first:
 *   1. Explicit user prompt decisions (a user who asks for glass gets glass).
 *   2. The curated catalog profile (hand-authored, stable, per-reference).
 *   3. Reference-analysis inference (per-run, model-generated, can hallucinate).
 */

import type {
  CuratedStyleReference,
  CuratedStyleSelectionProfile,
} from "@/lib/generation/curated-style-catalog";
import type { DesignStylePack, ReferenceAnalysis } from "@/lib/types";

export type StyleCharterSource =
  | "curated-catalog"
  | "design-style"
  | "reference-analysis"
  | "default";

export type StyleCharterElevation = "flat" | "soft" | "elevated";
export type StyleCharterHeadingClass = "sans" | "serif" | "display" | "mono" | "unconstrained";
export type StyleCharterTheme = "light" | "dark" | "mixed" | "unspecified";
export type StyleCharterDensity = "airy" | "balanced" | "dense" | "unspecified";

export interface StyleCharterBaseColorConstraint {
  /** Minimum OKLCH lightness for `color.background.primary`. */
  minLightness: number | null;
  /** Maximum OKLCH lightness for `color.background.primary`. */
  maxLightness: number | null;
  /** Maximum OKLCH chroma for `color.background.primary`. */
  maxChroma: number | null;
  label: string;
}

export interface StyleCharterV1 {
  version: 1;
  source: StyleCharterSource;
  referenceId: string | null;
  theme: StyleCharterTheme;
  density: StyleCharterDensity;

  /** Ceiling on how much depth the surface language may express. */
  elevation: StyleCharterElevation;
  /** Hard ceiling on `shadows.surface` blur, in px. Null means unconstrained. */
  maxShadowBlurPx: number | null;
  /** Hard ceiling on `shadows.surface` alpha. Null means unconstrained. */
  maxShadowAlpha: number | null;
  /** Whether translucent/blurred navigation and surfaces are permitted. */
  allowGlass: boolean;
  /** Whether the app background may be a gradient rather than a flat fill. */
  allowGradientBackground: boolean;

  /** Which family the heading font must belong to. */
  headingClass: StyleCharterHeadingClass;
  /** Constraint on the app's base background color. */
  baseColor: StyleCharterBaseColorConstraint | null;
  /** Ceiling on accent chroma for restrained/monochrome directions. */
  maxAccentChroma: number | null;
  /** Inclusive `mobile_layout.section_gap` range in px. */
  sectionGapRangePx: [number, number] | null;
  /** Inclusive `radii.app` range in px. */
  appRadiusRangePx: [number, number] | null;

  /** Human-readable statements rendered into prompts. */
  required: string[];
  forbidden: string[];
  /** Constraints relaxed because the user asked for them explicitly. */
  userOverrides: string[];
  rationale: string;
}

const DENSITY_SECTION_GAP: Record<Exclude<StyleCharterDensity, "unspecified">, [number, number]> = {
  airy: [28, 40],
  balanced: [20, 32],
  dense: [16, 24],
};

/** Tags whose presence caps the surface language at a flat, matte read. */
const FLAT_MATERIAL_TAGS = new Set(["matte", "flat", "flat-layered", "subtle-border", "subtle-shadow"]);
/** Tags that legitimately license real depth. */
const ELEVATED_MATERIAL_TAGS = new Set([
  "soft-elevated",
  "soft-shadow",
  "layered-depth",
  "tactile",
  "skeuomorphic-leather",
  "3d-rendered",
]);
const GLASS_MATERIAL_TAGS = new Set(["glass", "glassmorphism", "atmospheric-blur"]);
const GRADIENT_MATERIAL_TAGS = new Set(["atmospheric", "atmospheric-gradient"]);

const SANS_TYPOGRAPHY_TAGS = new Set([
  "geometric-sans",
  "functional-ui-sans",
  "neutral-sans",
  "humanist-sans",
  "editorial-sans",
  "playful-sans",
  "clean-legible",
  "data-readability",
]);

const BASE_COLOR_CONSTRAINTS: Record<string, StyleCharterBaseColorConstraint> = {
  "clean-base": { minLightness: 0.94, maxLightness: null, maxChroma: 0.02, label: "clean near-white base" },
  "cream-base": { minLightness: 0.9, maxLightness: null, maxChroma: 0.05, label: "warm cream base" },
  "pastel-base": { minLightness: 0.86, maxLightness: null, maxChroma: 0.09, label: "pastel base" },
  "deep-black-base": { minLightness: null, maxLightness: 0.22, maxChroma: 0.04, label: "deep black base" },
};

const RESTRAINED_COLOR_TAGS = new Set(["monochromatic-neutral", "monochrome", "restrained-neutral"]);

/**
 * Explicit user requests that outrank the catalog. Deliberately narrow: these
 * match the user's own prompt only, never reference text or model prose, so a
 * hallucinated analysis can never unlock a forbidden material.
 */
const USER_OVERRIDE_PATTERNS: Array<{ key: string; pattern: RegExp; label: string }> = [
  { key: "glass", pattern: /\b(?:glass(?:morphism|y)?|frosted|blurred\s+(?:nav|surface|background))\b/i, label: "glass surfaces" },
  { key: "shadow", pattern: /\b(?:drop\s+shadow|heavy\s+shadows?|deep\s+shadows?|elevated\s+cards?|strong\s+elevation)\b/i, label: "pronounced elevation" },
  { key: "serif", pattern: /\bserif\b/i, label: "serif typography" },
  { key: "gradient", pattern: /\bgradient\s+(?:background|backdrop|app|screen)|\bmesh\s+gradient\b/i, label: "gradient background" },
  { key: "dark", pattern: /\bdark\s*(?:mode|theme|ui)\b/i, label: "dark theme" },
];

const detectUserOverrides = (prompt: string) => {
  const active = new Map<string, string>();
  for (const { key, pattern, label } of USER_OVERRIDE_PATTERNS) {
    if (pattern.test(prompt)) active.set(key, label);
  }
  return active;
};

const has = (values: readonly string[] | undefined, tag: string) => Boolean(values?.includes(tag));

const defaultCharter = (): StyleCharterV1 => ({
  version: 1,
  source: "default",
  referenceId: null,
  theme: "unspecified",
  density: "unspecified",
  elevation: "soft",
  maxShadowBlurPx: null,
  maxShadowAlpha: null,
  allowGlass: true,
  allowGradientBackground: true,
  headingClass: "unconstrained",
  baseColor: null,
  maxAccentChroma: null,
  sectionGapRangePx: null,
  appRadiusRangePx: null,
  required: [],
  forbidden: [],
  userOverrides: [],
  rationale: "No hand-authored style profile is available for this run.",
});

function charterFromSelectionProfile(
  profile: CuratedStyleSelectionProfile,
  referenceId: string,
  overrides: Map<string, string>,
): StyleCharterV1 {
  const charter = defaultCharter();
  charter.source = "curated-catalog";
  charter.referenceId = referenceId;
  charter.theme = profile.theme;
  charter.density = profile.density;

  const required: string[] = [];
  const forbidden: string[] = [];

  // --- Material and depth -------------------------------------------------
  const wantsFlat = profile.materials.some((tag) => FLAT_MATERIAL_TAGS.has(tag));
  const wantsElevated = profile.materials.some((tag) => ELEVATED_MATERIAL_TAGS.has(tag));
  const vetoesDepth = has(profile.incompatibleWith, "tactile-depth")
    || has(profile.incompatibleWith, "skeuomorphic")
    || has(profile.incompatibleWith, "3d-rendered");
  const vetoesHeavyShadow = has(profile.incompatibleWith, "heavy-shadows");

  if ((wantsFlat && !wantsElevated) || vetoesDepth) {
    charter.elevation = "flat";
    charter.maxShadowBlurPx = 12;
    charter.maxShadowAlpha = 0.08;
    required.push("Separate surfaces with tint or a hairline border, not with elevation.");
    forbidden.push("Layered drop shadows, inner-highlight bevels, or any raised-card illusion.");
  } else if (wantsElevated) {
    charter.elevation = "elevated";
  }

  if (vetoesHeavyShadow) {
    charter.maxShadowBlurPx = Math.min(charter.maxShadowBlurPx ?? 16, 16);
    charter.maxShadowAlpha = Math.min(charter.maxShadowAlpha ?? 0.1, 0.1);
    forbidden.push("Heavy shadows. Elevation must stay barely perceptible.");
  }

  // --- Glass --------------------------------------------------------------
  const wantsGlass = profile.materials.some((tag) => GLASS_MATERIAL_TAGS.has(tag));
  if (has(profile.incompatibleWith, "glassmorphism") && !overrides.has("glass")) {
    charter.allowGlass = false;
    forbidden.push("Glass or frosted surfaces, including a blurred navigation dock.");
  } else if (wantsGlass) {
    charter.allowGlass = true;
    required.push("Glass surfaces are part of this direction; keep the blur consistent app-wide.");
  }

  // --- Gradient background ------------------------------------------------
  const wantsGradient = profile.materials.some((tag) => GRADIENT_MATERIAL_TAGS.has(tag))
    || has(profile.colorCharacter, "vibrant-gradient");
  const vetoesGradient = has(profile.incompatibleWith, "vibrant-gradient")
    || has(profile.incompatibleWith, "atmospheric-gradient");
  if (vetoesGradient && !overrides.has("gradient")) {
    charter.allowGradientBackground = false;
    forbidden.push("Gradient app backgrounds. The base must read as one flat field.");
  } else if (wantsGradient) {
    charter.allowGradientBackground = true;
  }

  // --- Typography ---------------------------------------------------------
  const sansTags = profile.typographyCharacter.filter((tag) => SANS_TYPOGRAPHY_TAGS.has(tag));
  if (has(profile.typographyCharacter, "monospace-code")) {
    charter.headingClass = "mono";
  } else if (has(profile.typographyCharacter, "display-led")) {
    charter.headingClass = "display";
  } else if (sansTags.length > 0 && !overrides.has("serif")) {
    charter.headingClass = "sans";
    required.push(`Headings use a ${sansTags[0].replace(/-/g, " ")} family.`);
    forbidden.push("Serif or script heading families. This reference is a sans-serif system.");
  }

  // --- Base color ---------------------------------------------------------
  for (const tag of profile.colorCharacter) {
    const constraint = BASE_COLOR_CONSTRAINTS[tag];
    if (constraint) {
      charter.baseColor = constraint;
      required.push(`The app background is a ${constraint.label}.`);
      break;
    }
  }
  if (profile.colorCharacter.some((tag) => RESTRAINED_COLOR_TAGS.has(tag))) {
    charter.maxAccentChroma = 0.14;
    required.push("Color stays restrained; contrast and typography carry the hierarchy.");
  }
  if (has(profile.incompatibleWith, "neon-accent")) {
    charter.maxAccentChroma = Math.min(charter.maxAccentChroma ?? 0.2, 0.2);
    forbidden.push("Neon or fluorescent accents.");
  }

  // --- Theme --------------------------------------------------------------
  if (has(profile.incompatibleWith, "dark") && !overrides.has("dark")) {
    charter.theme = "light";
    forbidden.push("Dark backgrounds for the app base.");
  }
  if (has(profile.incompatibleWith, "light")) {
    charter.theme = "dark";
  }

  // --- Density ------------------------------------------------------------
  // A reference tagged `airy` that also excludes `airy` is telling us its
  // density reads generous but must not be reproduced that way.
  const densityKey: Exclude<StyleCharterDensity, "unspecified"> =
    has(profile.incompatibleWith, "airy") && profile.density === "airy"
      ? "balanced"
      : profile.density;
  charter.sectionGapRangePx = DENSITY_SECTION_GAP[densityKey];
  required.push(`Density is ${densityKey}: section gaps stay between ${DENSITY_SECTION_GAP[densityKey][0]}px and ${DENSITY_SECTION_GAP[densityKey][1]}px.`);

  // --- Geometry -----------------------------------------------------------
  // Deliberately permissive. The observed failure was radius *hierarchy*, not
  // the outer radius value, and clamping every project into one band would
  // flatten the visual range the catalog exists to provide. Only genuinely
  // contradictory geometry is bounded.
  if (has(profile.geometries, "organic") || has(profile.geometries, "custom-organic-shapes")) {
    charter.appRadiusRangePx = [12, 40];
  } else if (has(profile.geometries, "bordered-containers")) {
    charter.appRadiusRangePx = [0, 24];
  }

  charter.required = required;
  charter.forbidden = forbidden;
  charter.userOverrides = [...overrides.values()];
  charter.rationale = `Derived from the hand-authored catalog profile for "${referenceId}". `
    + `The catalog outranks per-run reference inference; the user prompt outranks both.`;

  return charter;
}

function charterFromDesignStyle(designStyle: DesignStylePack, overrides: Map<string, string>): StyleCharterV1 {
  const charter = defaultCharter();
  charter.source = "design-style";
  charter.referenceId = designStyle.id;

  const text = [
    designStyle.premiumIntent,
    ...designStyle.layoutGrammar,
    ...designStyle.componentRecipes,
    ...designStyle.densityRules,
    ...designStyle.antiPatterns,
  ].join(" ").toLowerCase();

  if (/\bflat\b|\bmatte\b|no shadow|without shadow|border-led/.test(text)) {
    charter.elevation = "flat";
    charter.maxShadowBlurPx = 12;
    charter.maxShadowAlpha = 0.08;
    charter.forbidden.push("Layered drop shadows; this style separates surfaces with borders and tint.");
  }
  if (/\bglass\b|frosted|backdrop-blur/.test(text) || overrides.has("glass")) {
    charter.allowGlass = true;
  } else if (/no glass|avoid glass/.test(text)) {
    charter.allowGlass = false;
    charter.forbidden.push("Glass or frosted surfaces.");
  }
  if (/\bdense\b/.test(text)) charter.sectionGapRangePx = DENSITY_SECTION_GAP.dense;
  else if (/\bairy\b|generous/.test(text)) charter.sectionGapRangePx = DENSITY_SECTION_GAP.airy;

  charter.userOverrides = [...overrides.values()];
  charter.rationale = `Derived from the "${designStyle.label}" design style pack.`;
  return charter;
}

/**
 * Fallback charter for uploaded references and prompt-only runs. Much weaker
 * than the curated path on purpose: a per-run model inference is not evidence
 * strong enough to veto anything, so this only records what was observed.
 */
function charterFromReferenceAnalysis(
  analysis: ReferenceAnalysis,
  overrides: Map<string, string>,
): StyleCharterV1 {
  const charter = defaultCharter();
  charter.source = "reference-analysis";

  const surfaces = analysis.designSystemSignals.surfaces?.toLowerCase() ?? "";
  const density = analysis.designSystemSignals.density?.toLowerCase() ?? "";

  if (/\bflat\b|\bmatte\b|no visible shadow|hairline|border-separated/.test(surfaces)) {
    charter.elevation = "flat";
    charter.maxShadowBlurPx = 16;
    charter.maxShadowAlpha = 0.1;
  }
  if (/\bglass\b|frosted|blur/.test(surfaces) || overrides.has("glass")) {
    charter.allowGlass = true;
  }
  if (/\bdense\b|tight|packed/.test(density)) charter.sectionGapRangePx = DENSITY_SECTION_GAP.dense;
  else if (/\bairy\b|generous|spacious/.test(density)) charter.sectionGapRangePx = DENSITY_SECTION_GAP.airy;

  charter.userOverrides = [...overrides.values()];
  charter.rationale = "Derived from this run's reference analysis. Observational only; it does not veto token decisions.";
  return charter;
}

export function buildStyleCharter({
  prompt = "",
  curatedReference,
  designStyle,
  referenceAnalysis,
}: {
  prompt?: string;
  curatedReference?: CuratedStyleReference | null;
  designStyle?: DesignStylePack | null;
  referenceAnalysis?: ReferenceAnalysis | null;
}): StyleCharterV1 {
  const overrides = detectUserOverrides(prompt);

  if (curatedReference) {
    return charterFromSelectionProfile(curatedReference.selectionProfile, curatedReference.id, overrides);
  }
  if (designStyle) {
    return charterFromDesignStyle(designStyle, overrides);
  }
  if (referenceAnalysis) {
    return charterFromReferenceAnalysis(referenceAnalysis, overrides);
  }

  const charter = defaultCharter();
  charter.userOverrides = [...overrides.values()];
  return charter;
}

/**
 * Detects a reference analysis that contradicts the hand-authored catalog for
 * the same reference. The catalog wins; this returns the disagreements so they
 * can be recorded as diagnostics rather than silently resolved.
 */
export function diffCharterAgainstAnalysis(
  charter: StyleCharterV1,
  analysis: ReferenceAnalysis | null | undefined,
): string[] {
  if (!analysis || charter.source !== "curated-catalog") return [];

  const conflicts: string[] = [];
  const typography = analysis.designSystemSignals.typography?.toLowerCase() ?? "";
  const surfaces = analysis.designSystemSignals.surfaces?.toLowerCase() ?? "";

  if (charter.headingClass === "sans" && /\bserif\b|garamond|didot|bodoni|playfair|baskerville/.test(typography)) {
    conflicts.push("Reference analysis named a serif family, but the catalog profile for this reference is a sans-serif system. Catalog wins.");
  }
  if (!charter.allowGlass && /\bglass\b|frosted|backdrop.?blur/.test(surfaces)) {
    conflicts.push("Reference analysis described glass surfaces, but the catalog profile excludes glassmorphism. Catalog wins.");
  }
  if (charter.elevation === "flat" && /\bdrop shadow\b|elevated card|raised surface|layered shadow/.test(surfaces)) {
    conflicts.push("Reference analysis described raised surfaces, but the catalog profile is flat/matte. Catalog wins.");
  }

  return conflicts;
}

/** Renders the charter for planner, creative-direction, and token prompts. */
export function formatStyleCharterContract(charter: StyleCharterV1 | null | undefined): string | null {
  if (!charter || (charter.required.length === 0 && charter.forbidden.length === 0 && !charter.baseColor)) {
    return null;
  }

  const lines = [
    `STYLE CHARTER (v1, source: ${charter.source}${charter.referenceId ? `, reference: ${charter.referenceId}` : ""})`,
    // Precedence is stated by the caller's AUTHORITY line, which knows the
    // generation mode. Asserting it here made the charter claim priority over
    // a structural reference during exact recreation.
    "Constraints derived from the reference this project was matched to.",
  ];

  if (charter.theme !== "unspecified") lines.push(`- Theme: ${charter.theme}.`);
  if (charter.baseColor) {
    const bounds = [
      charter.baseColor.minLightness !== null ? `lightness >= ${charter.baseColor.minLightness}` : null,
      charter.baseColor.maxLightness !== null ? `lightness <= ${charter.baseColor.maxLightness}` : null,
      charter.baseColor.maxChroma !== null ? `chroma <= ${charter.baseColor.maxChroma}` : null,
    ].filter(Boolean).join(", ");
    lines.push(`- Base color: ${charter.baseColor.label} (OKLCH ${bounds}).`);
  }
  lines.push(`- Surface elevation ceiling: ${charter.elevation}.`);
  if (charter.maxShadowBlurPx !== null || charter.maxShadowAlpha !== null) {
    lines.push(`- Shadow ceiling: blur <= ${charter.maxShadowBlurPx ?? "unbounded"}px, alpha <= ${charter.maxShadowAlpha ?? "unbounded"}.`);
  }
  lines.push(`- Glass/backdrop blur: ${charter.allowGlass ? "permitted" : "FORBIDDEN"}.`);
  lines.push(`- Gradient app background: ${charter.allowGradientBackground ? "permitted" : "FORBIDDEN"}.`);
  if (charter.headingClass !== "unconstrained") lines.push(`- Heading font class: ${charter.headingClass}.`);
  if (charter.sectionGapRangePx) lines.push(`- Section gap: ${charter.sectionGapRangePx[0]}-${charter.sectionGapRangePx[1]}px.`);
  if (charter.appRadiusRangePx) lines.push(`- Outer surface radius: ${charter.appRadiusRangePx[0]}-${charter.appRadiusRangePx[1]}px.`);

  if (charter.required.length > 0) {
    lines.push("Required:", ...charter.required.map((entry) => `  - ${entry}`));
  }
  if (charter.forbidden.length > 0) {
    lines.push("Forbidden:", ...charter.forbidden.map((entry) => `  - ${entry}`));
  }
  if (charter.userOverrides.length > 0) {
    lines.push(`User overrides in force (the prompt explicitly asked for these): ${charter.userOverrides.join(", ")}.`);
  }

  return lines.join("\n");
}
