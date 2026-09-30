import { normalizeDesignTokens } from "@/lib/design-tokens";
import { CURATED_STYLE_REFERENCES } from "@/lib/generation/curated-style-catalog";
import { curatedStyleEntryHash } from "@/lib/generation/curated-style-entry-hash";
import type { CuratedStylePreset } from "@/lib/generation/curated-style-presets";
import type { ReferenceNavigationEvidence, StyleComponent } from "@/lib/types";

/** Fixtures for tests of the curated style presets: a real catalogue entry and a preset built from it. */
export const PRESET_REFERENCE_ID = "mindfulness-meditation-beige-light";

export const presetReference = () => {
  const reference = CURATED_STYLE_REFERENCES.find((entry) => entry.id === PRESET_REFERENCE_ID);
  if (!reference) throw new Error(`${PRESET_REFERENCE_ID} is not in the catalogue.`);
  return reference;
};

export const presetComponents = (): StyleComponent[] => [
  {
    name: "calendar-strip",
    use: "A week selector at the top of a day view",
    html: '<div class="dg-surface-card dg-radius-app flex gap-2 p-[var(--dg-spacing-sm)]"><div class="dg-tint-1 dg-radius-pill px-3">Mon</div></div>',
  },
  {
    name: "stat-tile-pair",
    use: "Two counts side by side",
    html: '<div class="grid grid-cols-2 gap-[var(--dg-spacing-sm)]"><div class="dg-surface-inset dg-radius-inner p-3">3</div></div>',
  },
  {
    name: "donut-card",
    use: "One progress figure with its label",
    html: '<div class="dg-surface-card dg-radius-app p-[var(--dg-spacing-md)]"><div class="dg-tint-2 dg-radius-pill h-16 w-16"></div></div>',
  },
];

export const presetNavigation = (): ReferenceNavigationEvidence => ({
  present: true,
  repeatedAcrossScreens: true,
  itemCount: 4,
  items: [
    { label: null, icon: "house" },
    { label: null, icon: "paw-print" },
    { label: null, icon: "calendar" },
    { label: null, icon: "user" },
  ],
  anatomy: "fixed-tab-rail",
  geometry: "An icon-only bar attached to the bottom edge with rounded top corners",
  labels: "hidden",
  activeState: "The active icon sits in a filled circle",
  elevation: "Flat, no shadow",
  safeAreaRelationship: "Attached to the bottom edge",
  activeItemByScreen: [{ screenIndex: 1, itemIndex: 1 }],
  activeTreatment: "icon-fill",
  inactiveTreatment: "plain",
  width: "full",
  material: "solid",
  activeFill: "gradient",
  corners: "rounded",
});

/** Calibrated tokens for the reference: a cream page, a card a tone step above it, an inset, tints, a 20px card. */
export const presetTokens = () => normalizeDesignTokens({
  system_schema: "mobile_universal_core",
  meta: { recommendedFonts: ["Plus Jakarta Sans", "Inter"] },
  tokens: {
    color: {
      background: { primary: "#F2EADC", secondary: "#EDE4D2" },
      surface: { card: "#F7F4E8", inset: "#EDEAD7", bottom_sheet: "#F7F4E8", modal: "#F7F4E8" },
      accent_tints: { "1": "#F6E3C3", "2": "#E8EBC9", "3": "#E7DDE9" },
      accent_tints_text: { "1": "#5B3F12", "2": "#3F4A12", "3": "#4A2F52" },
      text: { high_emphasis: "#211E1E", medium_emphasis: "#5C5650", low_emphasis: "#8A847C" },
      action: { primary: "#FEC068", secondary: "#A8B89A", on_primary_text: "#211E1E" },
      border: { divider: "#E4DCCB", focused: "#FEC068" },
    },
    typography: { heading_font_family: "'Plus Jakarta Sans', sans-serif", body_font_family: "Inter, sans-serif" },
    radii: { app: "20px", inner: "12px", pill: "9999px" },
    shadows: { surface: "none", overlay: "0 -8px 40px rgba(33,30,30,0.16)" },
  },
});

const screen = (index: number, role: string, x: number) => ({
  index,
  suggestedRole: role,
  layoutSummary: `${role}: a greeting, a calendar strip and modular cards`,
  visualHierarchy: "The greeting leads, then the calendar strip, then the cards",
  components: ["Calendar strip", "Stat tile pair", "Donut card"],
  stylingCues: ["Warm cream page", "Cards a tone step lighter than the page"],
  interactionCues: ["Tap a day to select it"],
  copyPatterns: ["Friendly first-name greeting"],
  implementationNotes: [],
  boundingBox: { x, y: 0.03, width: 0.3, height: 0.94 },
});

export const presetAnalysis = () => ({
  overallVisualStyle: "Warm, calm health tracker on a cream page with pastel tiles and a filled-circle tab bar",
  screenCountEstimate: 3,
  screenReferences: [screen(1, "Dashboard", 0.02), screen(2, "History", 0.35), screen(3, "Profile", 0.68)],
  designSystemSignals: {
    palette: "Warm cream with peach and lime accents",
    typography: "Rounded geometric sans",
    surfaces: "Flat tonal cards with no cast shadow",
    iconography: "Line icons",
    density: "Airy",
    motionTone: "Calm",
  },
  radiusClass: "very-rounded" as const,
  surfaceElevation: "flat-tone" as const,
  primaryNavigation: null,
});

/** A complete, approved preset for the reference, as the offline builder writes it once the founder approves. */
export const presetFixture = (overrides: Partial<CuratedStylePreset> = {}): CuratedStylePreset => ({
  catalogHash: curatedStyleEntryHash(presetReference()),
  approved: true,
  analysis: presetAnalysis() as unknown as CuratedStylePreset["analysis"],
  measured: {
    theme: "light",
    background: { hex: "#F2EADC", area: 0.19 },
    raised: { hex: "#F7F4E8", area: 0.25 },
    inset: { hex: "#EDEAD7", area: 0.03 },
    accents: [{ hex: "#FEC068", area: 0.006 }, { hex: "#D8EA60", area: 0.006 }],
    ink: { hex: "#211E1E", area: 0.002 },
  },
  tokens: presetTokens(),
  navigation: presetNavigation(),
  components: presetComponents(),
  builtAt: "2026-09-29T00:00:00.000Z",
  ...overrides,
});
