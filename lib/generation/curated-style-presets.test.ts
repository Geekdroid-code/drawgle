import { describe, expect, it } from "vitest";

import { hexDeltaE } from "@/lib/color-lab";
import { normalizeDesignTokens } from "@/lib/design-tokens";
import type { CuratedStyleReference } from "@/lib/generation/curated-style-catalog";
import {
  curatedPresetReport,
  curatedStyleEntryHash,
  curatedStylePresetSchema,
  mergePresetTokens,
  parseCuratedStylePresets,
  presetReferenceAnalysis,
  presetSpecimen,
  resolveCuratedStylePreset,
} from "@/lib/generation/curated-style-presets";
import {
  PRESET_REFERENCE_ID,
  presetAnalysis,
  presetComponents,
  presetFixture,
  presetNavigation,
  presetReference,
  presetTokens,
} from "@/lib/generation/curated-style-preset-fixtures";
import { MAX_STYLE_COMPONENT_HTML_CHARS } from "@/lib/generation/style-components";
import { userNamesTypography } from "@/lib/generation/user-color-roles";

const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

describe("the curated style preset schema", () => {
  it("accepts a complete preset", () => {
    expect(curatedStylePresetSchema.safeParse(asJson(presetFixture())).success).toBe(true);
    expect(curatedStylePresetSchema.safeParse(asJson(presetFixture({ navigation: null, components: [] }))).success).toBe(true);
  });

  const rejects = (label: string, change: (preset: Record<string, any>) => void) =>
    it(`rejects a preset ${label}`, () => {
      const preset = asJson(presetFixture()) as Record<string, any>;
      change(preset);
      expect(curatedStylePresetSchema.safeParse(preset).success).toBe(false);
    });

  rejects("whose analysis misses a phone", (preset) => { preset.analysis.screenReferences.pop(); });
  rejects("whose screens have no box to measure", (preset) => { delete preset.analysis.screenReferences[1].boundingBox; });
  rejects("with a box that is empty", (preset) => { preset.analysis.screenReferences[0].boundingBox.width = 0; });
  rejects("without the classes its tokens are calibrated from", (preset) => { delete preset.analysis.radiusClass; });
  rejects("with an elevation class that is not one", (preset) => { preset.analysis.surfaceElevation = "glass"; });
  rejects("with a card radius over the 24px rule", (preset) => { preset.tokens.tokens.radii.app = "32px"; });
  rejects("whose tokens have no card", (preset) => { delete preset.tokens.tokens.color.surface.card; });
  rejects("whose tokens have no heading font", (preset) => { delete preset.tokens.tokens.typography.heading_font_family; });
  rejects("that was not measured", (preset) => { preset.measured.background.hex = "cream"; });
  rejects("with navigation of an unknown anatomy", (preset) => { preset.navigation.anatomy = "hamburger"; });
  rejects("with more than ten components", (preset) => {
    preset.components = Array.from({ length: 11 }, (_, index) => ({ name: `c${index}`, use: "use", html: "<i></i>" }));
  });
  rejects("with a component that is too large to copy", (preset) => { preset.components[0].html = `<div>${"x".repeat(MAX_STYLE_COMPONENT_HTML_CHARS)}</div>`; });
  rejects("that says nothing of its approval", (preset) => { delete preset.approved; });
});

describe("loading the presets file", () => {
  it("keeps the presets that are valid when another is malformed", () => {
    const { presets, issues } = parseCuratedStylePresets({
      good: asJson(presetFixture()),
      broken: { ...asJson(presetFixture()), tokens: {} },
    });
    expect([...presets.keys()]).toEqual(["good"]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ id: "broken" });
    expect(issues[0].problem).toContain("tokens");
  });

  it("treats a file that is not an object as holding nothing", () => {
    for (const raw of [null, [], "presets", 4]) {
      const { presets, issues } = parseCuratedStylePresets(raw);
      expect(presets.size).toBe(0);
      expect(issues[0].id).toBe("*");
    }
    expect(parseCuratedStylePresets({}).issues).toEqual([]);
  });
});

describe("which preset a run may use", () => {
  const presets = (preset = presetFixture()) => new Map([[PRESET_REFERENCE_ID, preset]]);

  it("uses an approved preset built from the catalogue entry as it is now", () => {
    expect(resolveCuratedStylePreset(PRESET_REFERENCE_ID, { presets: presets() })).toMatchObject({ approved: true, catalogHash: curatedStyleEntryHash(presetReference()) });
  });

  it("uses none that is unapproved, stale, for another reference, or for no reference", () => {
    expect(resolveCuratedStylePreset(PRESET_REFERENCE_ID, { presets: presets(presetFixture({ approved: false })) })).toBeNull();
    expect(resolveCuratedStylePreset(PRESET_REFERENCE_ID, { presets: presets(presetFixture({ catalogHash: "0".repeat(64) })) })).toBeNull();
    expect(resolveCuratedStylePreset("crypto-wallet-glowing-dark", { presets: presets() })).toBeNull();
    expect(resolveCuratedStylePreset("not-in-the-catalogue", { presets: new Map([["not-in-the-catalogue", presetFixture()]]) })).toBeNull();
    expect(resolveCuratedStylePreset(null, { presets: presets() })).toBeNull();
    expect(resolveCuratedStylePreset(undefined, { presets: presets() })).toBeNull();
    expect(resolveCuratedStylePreset("", { presets: presets() })).toBeNull();
  });

  it("uses none once its catalogue entry has been edited", () => {
    const edited: CuratedStyleReference = { ...presetReference(), styleIntent: `${presetReference().styleIntent} It is now also dark and dramatic.` };
    expect(resolveCuratedStylePreset(PRESET_REFERENCE_ID, { presets: presets(), catalog: [edited] })).toBeNull();
    expect(resolveCuratedStylePreset(PRESET_REFERENCE_ID, { presets: presets(), catalog: [presetReference()] })).not.toBeNull();
  });

  it("finds nothing in the file that ships, until a founder approves a preset", () => {
    expect(resolveCuratedStylePreset(PRESET_REFERENCE_ID)).toBeNull();
  });
});

describe("the catalogue entry hash", () => {
  it("is stable, and changes with the entry's text, image address and id", () => {
    const reference = presetReference();
    expect(curatedStyleEntryHash(reference)).toBe(curatedStyleEntryHash({ ...reference }));
    expect(curatedStyleEntryHash(reference)).toMatch(/^[0-9a-f]{64}$/);
    expect(curatedStyleEntryHash({ ...reference, styleIntent: `${reference.styleIntent} Also bold.` })).not.toBe(curatedStyleEntryHash(reference));
    expect(curatedStyleEntryHash({ ...reference, imageUrl: `${reference.imageUrl}?v=2` })).not.toBe(curatedStyleEntryHash(reference));
    expect(curatedStyleEntryHash({ ...reference, id: "another-id" })).not.toBe(curatedStyleEntryHash(reference));
    expect(curatedStyleEntryHash({
      ...reference,
      selectionProfile: { ...reference.selectionProfile, moods: [...reference.selectionProfile.moods, "dramatic"] },
    })).not.toBe(curatedStyleEntryHash(reference));
  });
});

describe("the preset report", () => {
  const catalog = [presetReference(), { ...presetReference(), id: "second-reference" }, { ...presetReference(), id: "third-reference" }, { ...presetReference(), id: "fourth-reference" }];
  const entry = (reference: CuratedStyleReference, overrides: Record<string, unknown> = {}) => ({
    ...asJson(presetFixture({ catalogHash: curatedStyleEntryHash(reference) })), ...overrides,
  });

  it("gives every catalogue entry a status, and finds presets that belong to none", () => {
    const report = curatedPresetReport({
      [catalog[0].id]: entry(catalog[0]),
      [catalog[1].id]: entry(catalog[1], { approved: false }),
      [catalog[2].id]: entry(catalog[2], { catalogHash: "f".repeat(64) }),
      "deleted-reference": entry(catalog[0]),
      "broken-and-deleted": { nonsense: true },
    }, catalog);
    expect(report.statuses).toEqual([
      { id: catalog[0].id, status: "approved" },
      { id: catalog[1].id, status: "unapproved" },
      { id: catalog[2].id, status: "stale" },
      { id: catalog[3].id, status: "none" },
    ]);
    expect(report.orphans.sort()).toEqual(["broken-and-deleted", "deleted-reference"]);
  });

  it("reports a malformed preset for a catalogue entry as malformed", () => {
    const report = curatedPresetReport({ [catalog[0].id]: { ...entry(catalog[0]), tokens: {} } }, catalog);
    expect(report.statuses[0]).toEqual({ id: catalog[0].id, status: "malformed" });
    expect(report.issues[0].id).toBe(catalog[0].id);
    expect(report.orphans).toEqual([]);
  });

  it("finds the real catalogue with no presets in it, and nothing wrong", () => {
    const report = curatedPresetReport({});
    expect(report.statuses.every((status) => status.status === "none")).toBe(true);
    expect(report.orphans).toEqual([]);
    expect(report.issues).toEqual([]);
  });
});

describe("what a run takes from a preset", () => {
  it("uses the preset's navigation over the analysis's own", () => {
    const preset = presetFixture({ analysis: { ...presetAnalysis(), primaryNavigation: { ...presetNavigation(), anatomy: "floating-dock", itemCount: 2, items: presetNavigation().items.slice(0, 2) } } as never });
    expect(presetReferenceAnalysis(preset).primaryNavigation).toMatchObject({ anatomy: "fixed-tab-rail", itemCount: 4, activeTreatment: "icon-fill" });
    // and falls back to the analysis's when the preset carries none
    const without = presetFixture({ navigation: null, analysis: { ...presetAnalysis(), primaryNavigation: presetNavigation() } as never });
    expect(presetReferenceAnalysis(without).primaryNavigation).toMatchObject({ anatomy: "fixed-tab-rail" });
    expect(presetReferenceAnalysis(presetFixture({ navigation: null })).primaryNavigation).toBeNull();
  });

  it("gives the project its components as a specimen", () => {
    expect(presetSpecimen(presetFixture())).toEqual({ source: "preset", components: presetComponents() });
    expect(presetSpecimen(presetFixture({ components: [] }))).toBeNull();
  });
});

describe("a user's own colours on a preset", () => {
  // what the token model returns for a user who asked for Soft Sage and Warm Cream, after calibration:
  // their colours in a coherent ladder, and the model's own geometry, which the preset does not take
  const generated = normalizeDesignTokens({
    system_schema: "mobile_universal_core",
    meta: { recommendedFonts: ["Fraunces", "Inter"] },
    tokens: {
      color: {
        background: { primary: "#FAF6EC", secondary: "#F3EEDF" },
        surface: { card: "#F5F1E4", inset: "#EDE8D7", bottom_sheet: "#F5F1E4", modal: "#F5F1E4" },
        accent_tints: { "1": "#DCE5D3", "2": "#E9E4C9" },
        text: { high_emphasis: "#25301F", medium_emphasis: "#5C6553", low_emphasis: "#8A9280" },
        action: { primary: "#A8B89A", secondary: "#C9B79C", on_primary_text: "#1F2A18" },
        border: { divider: "#E6E0CE", focused: "#A8B89A" },
      },
      typography: { heading_font_family: "Fraunces, serif", body_font_family: "Inter, sans-serif" },
      radii: { app: "24px", inner: "16px", pill: "9999px" },
      shadows: { surface: "0 4px 16px rgba(37,48,31,0.06)", overlay: "0 -8px 40px rgba(37,48,31,0.16)" },
      spacing: { md: "18px" },
    },
  });

  it("takes the user's colours from the model and everything else from the preset", () => {
    const merged = mergePresetTokens({ preset: presetFixture(), generated, fonts: false }).tokens!;
    // the user's page, card and accent
    expect(merged.color?.background?.primary).toBe("#FAF6EC");
    expect(merged.color?.surface?.card).toBe("#F5F1E4");
    expect(merged.color?.surface?.inset).toBe("#EDE8D7");
    expect(merged.color?.action?.primary).toBe("#A8B89A");
    expect(Object.keys(merged.color?.accent_tints ?? {})).toEqual(["1", "2"]);
    // the reference's geometry and depth, not the model's
    expect(merged.radii).toMatchObject({ app: "20px", inner: "12px" });
    expect(merged.shadows?.surface).toBe("none");
    expect(merged.spacing?.md).toBe(presetTokens().tokens?.spacing?.md);
    // and the preset's type, since no font was named
    expect(merged.typography?.heading_font_family).toContain("Plus Jakarta Sans");
    expect(hexDeltaE(merged.color!.text!.high_emphasis!, "#25301F")).toBeLessThan(1);
  });

  it("takes the fonts from the model too when the user named fonts, and keeps the preset's type scale", () => {
    const merged = mergePresetTokens({ preset: presetFixture(), generated, fonts: true });
    expect(merged.tokens?.typography?.heading_font_family).toBe("Fraunces, serif");
    expect(merged.tokens?.typography?.body_font_family).toContain("Inter");
    expect(merged.meta?.recommendedFonts).toEqual(["Fraunces", "Inter"]);
    expect(merged.tokens?.radii?.app).toBe("20px");
    const unchanged = mergePresetTokens({ preset: presetFixture(), generated, fonts: false });
    expect(unchanged.meta?.recommendedFonts).toEqual(["Plus Jakarta Sans", "Inter"]);
  });

  it("leaves the preset itself untouched", () => {
    const preset = presetFixture();
    const before = JSON.stringify(preset);
    mergePresetTokens({ preset, generated, fonts: true });
    expect(JSON.stringify(preset)).toBe(before);
  });
});

describe("naming fonts", () => {
  it("is heard in a requirement that names a font, and only there", () => {
    const facts = (detail: string) => `EXPLICIT USER DESIGN REQUIREMENTS\nx\n${JSON.stringify([{ id: "f", label: "Typography", detail, evidence: "user" }])}`;
    expect(userNamesTypography(facts("Use a serif font for headings"))).toBe(true);
    expect(userNamesTypography(facts("Inter typeface throughout"))).toBe(true);
    expect(userNamesTypography(facts("A monospace look"))).toBe(true);
    expect(userNamesTypography(facts("Warm cream font colour"))).toBe(false);
    expect(userNamesTypography(facts("Soft Sage and Warm Cream"))).toBe(false);
    expect(userNamesTypography(null)).toBe(false);
    expect(userNamesTypography("  ")).toBe(false);
  });
});
