import { z } from "zod";

import { hasApprovedDesignTokens, MAX_APP_RADIUS_PX, normalizeDesignTokens } from "@/lib/design-tokens";
import {
  CURATED_STYLE_REFERENCES,
  type CuratedStyleReference,
} from "@/lib/generation/curated-style-catalog";
import { curatedStyleEntryHash } from "@/lib/generation/curated-style-entry-hash";
import { RADIUS_CLASSES, SURFACE_ELEVATIONS } from "@/lib/generation/design-classes";
import presetsJson from "@/lib/generation/generated/curated-style-presets.json";
import type { MeasuredPalette } from "@/lib/generation/reference-palette";
import { styleComponentsSchema } from "@/lib/generation/style-components";
import type {
  DesignTokens,
  ReferenceAnalysis,
  ReferenceNavigationEvidence,
  ReferenceSpecimen,
  StyleComponent,
} from "@/lib/types";

/**
 * A curated reference never changes, yet every project used to analyse it again at run time: one model
 * pass that saw one of three phones, invented a 32px radius and missed the navigation items. A preset
 * holds what a complete offline pass found, checked by the founder once, and every project reuses it.
 *
 * Only an approved preset built from the catalogue entry as it is now is used. Anything else, a
 * malformed entry included, means there is no preset and the run-time path runs unchanged.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const measuredColor = z.object({ hex, area: z.number().min(0).max(1) });

export const measuredPaletteSchema = z.object({
  theme: z.enum(["light", "dark"]),
  background: measuredColor,
  raised: measuredColor.nullable(),
  inset: measuredColor.nullable(),
  accents: z.array(measuredColor).max(4),
  ink: measuredColor,
});

const unit = z.number().min(0).max(1);
const boundingBox = z.object({ x: unit, y: unit, width: unit.refine((value) => value > 0), height: unit.refine((value) => value > 0) });
const texts = z.array(z.string());

const screenSchema = z.object({
  index: z.number().int().min(1),
  suggestedRole: z.string().min(1),
  layoutSummary: z.string().min(1),
  visualHierarchy: z.string().min(1),
  components: texts,
  stylingCues: texts,
  interactionCues: texts,
  copyPatterns: texts,
  implementationNotes: texts,
  compositionRules: texts.optional(),
  spacingRules: texts.optional(),
  componentRules: texts.optional(),
  antiPatterns: texts.optional(),
  // A palette is measured per screen box, so a preset has one for every phone.
  boundingBox,
}).passthrough();

export const referenceNavigationSchema = z.object({
  present: z.boolean(),
  repeatedAcrossScreens: z.boolean(),
  itemCount: z.number().int().min(0).max(5),
  items: z.array(z.object({ label: z.string().nullable(), icon: z.string().min(1) })).max(5),
  anatomy: z.enum(["fixed-tab-rail", "floating-dock", "glass-dock", "compact-icon-rail", "center-action-dock"]).nullable(),
  geometry: z.string(),
  labels: z.enum(["always", "active-only", "hidden"]).nullable(),
  activeState: z.string(),
  elevation: z.string(),
  safeAreaRelationship: z.string(),
  activeItemByScreen: z.array(z.object({ screenIndex: z.number().int().min(1), itemIndex: z.number().int().nullable() })),
  activeTreatment: z.enum(["icon-fill", "tint", "underline", "compact-chip"]).nullable().optional(),
  inactiveTreatment: z.enum(["plain", "well"]).nullable().optional(),
  width: z.enum(["content", "inset", "full"]).nullable().optional(),
  material: z.enum(["solid", "translucent", "glass"]).nullable().optional(),
  activeFill: z.enum(["solid", "gradient"]).nullable().optional(),
  corners: z.enum(["square", "rounded"]).nullable().optional(),
});

/** Every phone in the image, each with its box, and the two classifications the tokens are calibrated from. */
export const presetAnalysisSchema = z.object({
  overallVisualStyle: z.string().min(1),
  screenCountEstimate: z.number().int().min(1).max(12),
  screenReferences: z.array(screenSchema).min(1).max(12),
  designSystemSignals: z.object({
    palette: z.string().min(1),
    typography: z.string().min(1),
    surfaces: z.string().min(1),
    iconography: z.string().min(1),
    density: z.string().min(1),
    motionTone: z.string().min(1),
  }).passthrough(),
  primaryNavigation: referenceNavigationSchema.nullable().optional(),
  semanticCompositionPrimitives: z.array(z.record(z.string(), z.unknown())).optional(),
  radiusClass: z.enum(RADIUS_CLASSES),
  surfaceElevation: z.enum(SURFACE_ELEVATIONS),
}).passthrough().refine(
  (analysis) => analysis.screenReferences.length === analysis.screenCountEstimate,
  { message: "the analysis must describe every phone in the image", path: ["screenReferences"] },
);

const pixels = (value: unknown) => Number.parseFloat(String(value ?? ""));

/**
 * Calibrated tokens: a page, a card and an accent, one heading font, and a card radius a person can approve. Up to
 * 24px is the default; a reference that is clearly extra-rounded may go to 32px, since the founder looks at it first.
 */
const tokensSchema = z.custom<DesignTokens>((value) => {
  if (!isRecord(value) || !hasApprovedDesignTokens(value as DesignTokens)) return false;
  const tokens = (value as DesignTokens).tokens;
  const radius = pixels(tokens?.radii?.app);
  return Boolean(
    tokens?.color?.background?.primary
    && tokens.color.surface?.card
    && tokens.color.action?.primary
    && tokens.typography?.heading_font_family
    && Number.isFinite(radius)
    && radius <= MAX_APP_RADIUS_PX,
  );
}, "the tokens must be a complete calibrated set");

export const curatedStylePresetSchema = z.object({
  /** The catalogue entry it was built from: curatedStyleEntryHash(reference). */
  catalogHash: z.string().min(16),
  /** Set by the founder after looking at the preview. Only an approved preset is used. */
  approved: z.boolean(),
  analysis: presetAnalysisSchema,
  measured: measuredPaletteSchema,
  tokens: tokensSchema,
  /** How the reference's own navigation is built. Overrides analysis.primaryNavigation when both exist. */
  navigation: referenceNavigationSchema.nullable(),
  components: styleComponentsSchema,
  builtAt: z.string().optional(),
  sourceImageSha256: z.string().optional(),
});

export type CuratedStylePreset = {
  catalogHash: string;
  approved: boolean;
  analysis: ReferenceAnalysis;
  measured: MeasuredPalette;
  tokens: DesignTokens;
  navigation: ReferenceNavigationEvidence | null;
  components: StyleComponent[];
  builtAt?: string;
  sourceImageSha256?: string;
};

export { curatedStyleEntryHash };

export type CuratedPresetIssue = { id: string; problem: string };

export type LoadedCuratedPresets = { presets: Map<string, CuratedStylePreset>; issues: CuratedPresetIssue[] };

const describeIssue = (error: z.ZodError) => {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(".") || "preset"}: ${issue.message}` : "the preset is malformed";
};

/** Validates a presets file entry by entry: one malformed preset does not take the others with it. */
export function parseCuratedStylePresets(raw: unknown): LoadedCuratedPresets {
  const presets = new Map<string, CuratedStylePreset>();
  const issues: CuratedPresetIssue[] = [];
  if (!isRecord(raw)) return { presets, issues: [{ id: "*", problem: "the presets file must be an object keyed by reference id" }] };
  for (const [id, value] of Object.entries(raw)) {
    const parsed = curatedStylePresetSchema.safeParse(value);
    if (parsed.success) presets.set(id, parsed.data as unknown as CuratedStylePreset);
    else issues.push({ id, problem: describeIssue(parsed.error) });
  }
  return { presets, issues };
}

let loaded: LoadedCuratedPresets | null = null;

/** The presets file, parsed once. A problem in it is logged and leaves the run-time path in charge. */
export function loadedCuratedStylePresets(): LoadedCuratedPresets {
  if (!loaded) {
    loaded = parseCuratedStylePresets(presetsJson);
    for (const issue of loaded.issues) {
      console.error(`[curated-style-preset] Ignoring the preset for ${issue.id}: ${issue.problem}`);
    }
  }
  return loaded;
}

type PresetSource = { presets?: ReadonlyMap<string, CuratedStylePreset>; catalog?: readonly CuratedStyleReference[] };

/** The preset a run may use for a curated reference: approved, and built from the entry as it is now. */
export function resolveCuratedStylePreset(
  referenceId: string | null | undefined,
  { presets = loadedCuratedStylePresets().presets, catalog = CURATED_STYLE_REFERENCES }: PresetSource = {},
): CuratedStylePreset | null {
  if (!referenceId) return null;
  const reference = catalog.find((entry) => entry.id === referenceId);
  const preset = presets.get(referenceId);
  if (!reference || !preset?.approved) return null;
  return preset.catalogHash === curatedStyleEntryHash(reference) ? preset : null;
}

export type CuratedPresetStatus = "approved" | "unapproved" | "stale" | "malformed" | "none";

/** What the check reports: one status per catalogue entry, and the presets that belong to no entry. */
export function curatedPresetReport(
  raw: unknown,
  catalog: readonly CuratedStyleReference[] = CURATED_STYLE_REFERENCES,
) {
  const { presets, issues } = parseCuratedStylePresets(raw);
  const malformed = new Set(issues.map((issue) => issue.id));
  const known = new Set(catalog.map((reference) => reference.id));
  const statuses = catalog.map((reference): { id: string; status: CuratedPresetStatus } => {
    if (malformed.has(reference.id)) return { id: reference.id, status: "malformed" };
    const preset = presets.get(reference.id);
    if (!preset) return { id: reference.id, status: "none" };
    if (preset.catalogHash !== curatedStyleEntryHash(reference)) return { id: reference.id, status: "stale" };
    return { id: reference.id, status: preset.approved ? "approved" : "unapproved" };
  });
  const orphans = [...new Set([...presets.keys(), ...malformed])].filter((id) => id !== "*" && !known.has(id));
  return { statuses, orphans, issues };
}

/** The analysis a run uses for a curated reference: the preset's, with its own navigation evidence. */
export const presetReferenceAnalysis = (preset: CuratedStylePreset): ReferenceAnalysis => ({
  ...preset.analysis,
  primaryNavigation: preset.navigation ?? preset.analysis.primaryNavigation ?? null,
});

/** The component vocabulary that reaches the builder for every screen of the project. */
export const presetSpecimen = (preset: CuratedStylePreset): ReferenceSpecimen | null =>
  preset.components.length > 0 ? { source: "preset", components: preset.components } : null;

/** The token groups that carry colour. They change together, so that the ladder, gradients and bar stay coherent. */
const PRESET_COLOUR_KEYS = ["color", "gradients", "navigation"] as const;

/**
 * A user whose words ask something of the design gets the preset with that changed and nothing else: their colours,
 * their fonts, their corner style or their depth. Everything they did not ask about stays as it was reviewed.
 * `generated` is a token set made for this project with the preset's analysis and measured palette, so the colours
 * it holds are the user's in a coherent ladder on the reference's own measured colours.
 */
export function mergePresetTokens({
  preset,
  generated,
  fonts,
  colors = true,
  corners = false,
  depth = false,
}: {
  preset: CuratedStylePreset;
  generated: DesignTokens;
  /** The user named fonts: the heading and body families come from `generated`. */
  fonts: boolean;
  /** The user named colours: the colour groups come from `generated`. */
  colors?: boolean;
  /** The user asked for a corner style: the radii come from `generated`. */
  corners?: boolean;
  /** The user asked for a depth: the shadows come from `generated`, and the bar's shadow with them. */
  depth?: boolean;
}): DesignTokens {
  const base = (preset.tokens.tokens ?? {}) as Record<string, unknown>;
  const next = (generated.tokens ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...base };
  if (colors) for (const key of PRESET_COLOUR_KEYS) if (next[key] !== undefined) merged[key] = next[key];
  if (corners && next.radii !== undefined) merged.radii = next.radii;
  if (depth && next.shadows !== undefined) {
    merged.shadows = next.shadows;
    const nextNavigation = next.navigation as Record<string, unknown> | undefined;
    if (!colors && isRecord(merged.navigation) && nextNavigation?.shadow !== undefined) {
      merged.navigation = { ...merged.navigation, shadow: nextNavigation.shadow };
    }
  }
  const baseTypography = (base.typography ?? next.typography) as Record<string, unknown> | undefined;
  const nextTypography = next.typography as Record<string, unknown> | undefined;
  merged.typography = fonts
    ? {
        ...baseTypography,
        heading_font_family: nextTypography?.heading_font_family ?? baseTypography?.heading_font_family,
        body_font_family: nextTypography?.body_font_family ?? baseTypography?.body_font_family,
      }
    : baseTypography;
  return normalizeDesignTokens({
    ...preset.tokens,
    tokens: merged as DesignTokens["tokens"],
    meta: fonts ? generated.meta ?? preset.tokens.meta : preset.tokens.meta ?? generated.meta,
  });
}

const presetsObject = (raw: unknown): Record<string, unknown> => (isRecord(raw) ? { ...raw } : {});

/**
 * The presets file with this reference's preset written into it. A new build always starts unapproved, and
 * replaces an approved one that was there, because the founder has not seen this build yet.
 */
export function withCuratedPreset(raw: unknown, referenceId: string, preset: CuratedStylePreset): Record<string, unknown> {
  return { ...presetsObject(raw), [referenceId]: { ...preset, approved: false } };
}

/**
 * The presets file with this reference's preset approved, after the founder has looked at its preview. It
 * refuses a preset that is missing, malformed, or built from a catalogue entry that has since changed.
 */
export function withCuratedPresetApproval(
  raw: unknown,
  referenceId: string,
  catalog: readonly CuratedStyleReference[] = CURATED_STYLE_REFERENCES,
): Record<string, unknown> {
  const reference = catalog.find((entry) => entry.id === referenceId);
  if (!reference) throw new Error(`"${referenceId}" is not in the curated style catalogue.`);
  const presets = presetsObject(raw);
  if (!(referenceId in presets)) throw new Error(`There is no preset for "${referenceId}". Build it first.`);
  const parsed = curatedStylePresetSchema.safeParse(presets[referenceId]);
  if (!parsed.success) throw new Error(`The preset for "${referenceId}" is malformed: ${describeIssue(parsed.error)}.`);
  if (parsed.data.catalogHash !== curatedStyleEntryHash(reference)) {
    throw new Error(`The preset for "${referenceId}" was built from an older version of its catalogue entry. Rebuild it.`);
  }
  return { ...presets, [referenceId]: { ...(presets[referenceId] as Record<string, unknown>), approved: true } };
}

/** The file as it is committed: keys in order, so that a rebuild of one preset is a small diff. */
export const serializeCuratedPresets = (raw: unknown) =>
  `${JSON.stringify(Object.fromEntries(Object.entries(presetsObject(raw)).sort(([left], [right]) => left.localeCompare(right))), null, 2)}\n`;
