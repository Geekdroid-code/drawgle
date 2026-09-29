import { describe, expect, it } from "vitest";

import { hexDeltaE } from "@/lib/color-lab";
import {
  calibrateGeneratedTokens,
  contrastRatio,
  mergeApprovedDesignTokenEdits,
  normalizeDesignTokens,
  type CalibrationEvidence,
} from "@/lib/design-tokens";
import type { MeasuredPalette } from "@/lib/generation/reference-palette";
import { hasCastShadow } from "@/lib/shadow-css";
import type { DesignTokens } from "@/lib/types";

const baseColor = {
  background: { primary: "#F9F6F0", secondary: "#F1ECE3" },
  surface: { card: "#FFFFFF", bottom_sheet: "#FFFFFF", modal: "#FFFFFF" },
  text: { high_emphasis: "#2D2926", medium_emphasis: "#5C5650", low_emphasis: "#8A847C" },
  action: { primary: "#E89F71", secondary: "#A8B89A", on_primary_text: "#2D2926" },
  border: { divider: "#EBE5DA", focused: "#E89F71" },
};

/** What the token model returned for the pet project: 32px, white on cream, a blurred shadow. */
const generated = (overrides: Record<string, unknown> = {}): DesignTokens =>
  normalizeDesignTokens({
    system_schema: "mobile_universal_core",
    tokens: {
      color: baseColor,
      radii: { app: "32px", inner: "20px", pill: "9999px" },
      shadows: {
        surface: "0 4px 20px rgba(45,41,38,0.04)",
        overlay: "0 -8px 40px rgba(45,41,38,0.30)",
      },
      ...overrides,
    },
  });

/** The token model's action colour, close to the measured apricot (ΔE 6). */
const nearApricot = () => generated({
  color: {
    ...baseColor,
    action: { ...baseColor.action, primary: "#F5B25A" },
    border: { ...baseColor.border, focused: "#F5B25A" },
  },
});

const mindfulness: MeasuredPalette = {
  theme: "light",
  background: { hex: "#F2EADC", area: 0.19 },
  raised: { hex: "#F7F4E8", area: 0.25 },
  inset: { hex: "#EDEAD7", area: 0.03 },
  accents: [{ hex: "#FEC068", area: 0.006 }, { hex: "#D8EA60", area: 0.006 }],
  ink: { hex: "#211E1E", area: 0.002 },
};

const calibrate = (evidence: CalibrationEvidence = {}, tokens: DesignTokens = generated()) =>
  calibrateGeneratedTokens(tokens, evidence).tokens!;

describe("calibrateGeneratedTokens geometry", () => {
  it("caps the card radius at 24px", () => {
    expect(calibrate().radii).toMatchObject({ app: "24px" });
    expect(calibrate({ radiusClass: null }).radii?.app).toBe("24px");
    expect(calibrate({}, generated({ radii: { app: "48px", inner: "40px" } })).radii?.app).toBe("24px");
    expect(calibrate({}, generated({ radii: { app: "16px", inner: "12px" } })).radii?.app).toBe("16px");
  });

  it("clamps the inner radius to 6-16px and keeps it below the card", () => {
    expect(calibrate().radii?.inner).toBe("16px");
    expect(calibrate({}, generated({ radii: { app: "24px", inner: "22px" } })).radii?.inner).toBe("16px");
    expect(calibrate({}, generated({ radii: { app: "12px", inner: "2px" } })).radii?.inner).toBe("6px");
    expect(calibrate({}, generated({ radii: { app: "10px", inner: "8px" } })).radii?.inner).toBe("6px");
    // small systems keep whatever the hierarchy normalisation derived
    expect(calibrate({}, generated({ radii: { app: "6px", inner: "2px" } })).radii).toMatchObject({ app: "6px", inner: "2px" });
    expect(calibrate({}, generated({ radii: { app: "0px", inner: "0px" } })).radii).toMatchObject({ app: "0px", inner: "0px" });
  });

  it("leaves the pill radius alone", () => {
    expect(calibrate().radii?.pill).toBe("9999px");
    expect(calibrate({}, generated({ radii: { app: "32px", pill: "999px" } })).radii?.pill).toBe("999px");
  });

  it("keeps a radius inside the reference's class and moves one that is outside it", () => {
    // 22px is inside very-rounded (18-24pt): kept
    expect(calibrate({ radiusClass: "very-rounded" }, generated({ radii: { app: "22px", inner: "14px" } })).radii?.app).toBe("22px");
    // 32px is outside it: the class's own radius, not merely the cap
    expect(calibrate({ radiusClass: "very-rounded" }).radii?.app).toBe("20px");
    expect(calibrate({ radiusClass: "rounded" }).radii?.app).toBe("16px");
    expect(calibrate({ radiusClass: "soft" }).radii?.app).toBe("10px");
    expect(calibrate({ radiusClass: "square" }).radii?.app).toBe("4px");
    expect(calibrate({ radiusClass: "square" }, generated({ radii: { app: "3px", inner: "0px" } })).radii?.app).toBe("3px");
  });
});

describe("calibrateGeneratedTokens elevation", () => {
  it("removes the card shadow for flat, hairline and unknown elevation", () => {
    for (const surfaceElevation of ["flat-tone", "hairline", null, undefined] as const) {
      const tokens = calibrate({ surfaceElevation });
      expect(tokens.shadows?.surface).toBe("none");
      expect(tokens.shadows?.none).toBe("none");
    }
  });

  it("keeps the model's shadow when the reference shows a strong one", () => {
    const strong = "0 12px 32px rgba(15,23,42,0.3)";
    expect(calibrate({ surfaceElevation: "strong-shadow" }, generated({ shadows: { surface: strong } })).shadows?.surface).toBe(strong);
  });

  it("softens the shadow of a soft-shadow reference: blur at most 16px, alpha at most 0.08", () => {
    const softened = calibrate({ surfaceElevation: "soft-shadow" }, generated({ shadows: { surface: "0 12px 32px rgba(15,23,42,0.14)" } })).shadows?.surface;
    expect(softened).toBe("0px 12px 16px 0px rgba(15, 23, 42, 0.08)");
    expect(hasCastShadow(softened)).toBe(true);
    // a shadow that cannot be read is replaced by a canonical soft one in the text colour
    const replaced = calibrate({ surfaceElevation: "soft-shadow" }, generated({ shadows: { surface: "elevation-2" } })).shadows?.surface;
    expect(replaced).toBe("0px 4px 16px 0px rgba(45, 41, 38, 0.06)");
  });

  it("caps the overlay shadow's alpha at 0.16 whatever the elevation", () => {
    for (const surfaceElevation of ["flat-tone", "strong-shadow"] as const) {
      expect(calibrate({ surfaceElevation }).shadows?.overlay).toBe("0px -8px 40px 0px rgba(45, 41, 38, 0.16)");
    }
    expect(calibrate({}, generated({ shadows: { overlay: "0 -4px 24px rgba(15,23,42,0.1)" } })).shadows?.overlay)
      .toBe("0px -4px 24px 0px rgba(15, 23, 42, 0.1)");
  });

  it("makes the navigation follow the card shadow it copied", () => {
    const input = generated();
    expect(input.tokens?.navigation?.shadow).toBe(input.tokens?.shadows?.surface);
    expect(calibrate().navigation?.shadow).toBe("none");
    expect(calibrate({ surfaceElevation: "strong-shadow" }).navigation?.shadow).toBe(input.tokens?.shadows?.surface);
    // a navigation shadow the model chose itself stays, softened to the overlay cap
    const own = generated({ navigation: { shadow: "0 8px 24px rgba(0,0,0,0.4)" } });
    expect(calibrate({}, own).navigation?.shadow).toBe("0px 8px 24px 0px rgba(0, 0, 0, 0.16)");
  });
});

describe("calibrateGeneratedTokens colours", () => {
  it("leaves colours alone without a measured palette", () => {
    const before = generated().tokens!;
    const after = calibrate();
    expect(after.color?.background).toEqual(before.color?.background);
    expect(after.color?.surface?.card).toBe("#FFFFFF");
    expect(after.color?.action?.primary).toBe("#E89F71");
  });

  it("puts the measured page, card and inset on the ladder", () => {
    const color = calibrate({ palette: mindfulness }).color!;
    expect(color.background?.primary).toBe("#F2EADC");
    expect(color.surface?.card).toBe("#F7F4E8");
    expect(color.surface?.inset).toBe("#EDEAD7");
    // tone-on-tone, not white on cream
    expect(hexDeltaE(color.surface!.card!, color.background!.primary!)).toBeLessThan(6);
  });

  it("derives a raised colour as a tone step when the palette has none, and an inset when it has none", () => {
    const color = calibrate({ palette: { ...mindfulness, raised: null, inset: null } }).color!;
    expect(color.background?.primary).toBe("#F2EADC");
    const card = hexDeltaE(color.surface!.card!, "#F2EADC")!;
    expect(card).toBeGreaterThan(1.5);
    expect(card).toBeLessThan(6);
    // the card is lighter than the page, the inset a step darker than the card
    expect(contrastRatio(color.surface!.card!, "#000000")!).toBeGreaterThan(contrastRatio("#F2EADC", "#000000")!);
    expect(contrastRatio(color.surface!.inset!, "#000000")!).toBeLessThan(contrastRatio(color.surface!.card!, "#000000")!);
  });

  it("derives a missing inset from the card even without a palette", () => {
    const color = calibrate().color!;
    expect(color.surface?.inset).toBeTruthy();
    expect(color.surface?.inset).not.toBe(color.surface?.card);
    // and keeps one the model wrote
    const withInset = generated();
    withInset.tokens!.color!.surface!.inset = "#F0EAE0";
    expect(calibrate({}, withInset).color?.surface?.inset).toBe("#F0EAE0");
  });

  it("lifts cards above the page in dark themes", () => {
    const dark: MeasuredPalette = {
      theme: "dark",
      background: { hex: "#0E0F13", area: 0.3 },
      raised: { hex: "#181A20", area: 0.3 },
      inset: { hex: "#232631", area: 0.05 },
      accents: [{ hex: "#C8F169", area: 0.01 }],
      ink: { hex: "#0E0F13", area: 0.3 },
    };
    const color = calibrate({ palette: dark }).color!;
    expect(color.background?.primary).toBe("#0E0F13");
    expect(color.surface?.card).toBe("#181A20");
    expect(color.surface?.inset).toBe("#232631");
    const stepped = calibrate({ palette: { ...dark, raised: null, inset: null } }).color!;
    expect(hexDeltaE(stepped.surface!.card!, "#0E0F13")).toBeGreaterThan(1);
    expect(contrastRatio(stepped.surface!.card!, "#000000")!).toBeGreaterThan(contrastRatio("#0E0F13", "#000000")!);
  });

  it("snaps the action colour to the nearest measured accent only when it is within ΔE 12", () => {
    expect(hexDeltaE("#F5B25A", "#FEC068")!).toBeLessThan(12);
    const snapped = calibrate({ palette: mindfulness }, nearApricot()).color!;
    expect(snapped.action?.primary).toBe("#FEC068");
    expect(snapped.border?.focused).toBe("#FEC068");
    // the pet project's generated peach is ΔE 13 from the apricot: a deliberate choice, so it stays
    expect(hexDeltaE("#E89F71", "#FEC068")!).toBeGreaterThan(12);
    expect(calibrate({ palette: mindfulness }).color?.action?.primary).toBe("#E89F71");
    // a colour far from every accent stays
    const far = generated();
    far.tokens!.color!.action!.primary = "#2F6BFF";
    expect(calibrate({ palette: mindfulness }, far).color?.action?.primary).toBe("#2F6BFF");
  });

  it("lets user-named colours win: no snapping or overwriting for the roles they name", () => {
    const named = calibrate({ palette: mindfulness, userColorRoles: new Set(["action", "background"] as const) }, nearApricot()).color!;
    expect(named.action?.primary).toBe("#F5B25A");
    expect(named.background?.primary).toBe("#F9F6F0");
    // the card is still one tone step above the user's page, not the reference's card
    const step = hexDeltaE(named.surface!.card!, "#F9F6F0")!;
    expect(step).toBeGreaterThan(1.5);
    expect(step).toBeLessThan(6);
    expect(named.surface?.card).not.toBe("#F7F4E8");

    const surfaceNamed = calibrate({ palette: mindfulness, userColorRoles: ["surface"] }, nearApricot()).color!;
    expect(surfaceNamed.surface?.card).toBe("#FFFFFF");
    expect(surfaceNamed.background?.primary).toBe("#F2EADC");
    expect(surfaceNamed.action?.primary).toBe("#FEC068");
  });

  it("makes tokens that mirrored a role follow it, and leaves deliberate ones", () => {
    const input = nearApricot();
    input.tokens!.gradients!.accent_ring = "linear-gradient(90deg, #111111, #999999)";
    const after = calibrate({ palette: mindfulness }, input);
    expect(after.navigation?.surface).toBe("#F7F4E8");
    expect(after.navigation?.active_surface).toBe("#FEC068");
    expect(after.gradients?.action_primary).toContain("#FEC068");
    expect(after.gradients?.app_background).toContain("#F2EADC");
    expect(after.gradients?.surface_highlight).toContain("#F7F4E8");
    expect(after.gradients?.accent_ring).toBe("linear-gradient(90deg, #111111, #999999)");
  });

  it("keeps the text on the action colour legible after a snap", () => {
    const input = nearApricot();
    input.tokens!.color!.action!.on_primary_text = "#FFFFFF";
    const color = calibrate({ palette: mindfulness }, input).color!;
    expect(color.action?.primary).toBe("#FEC068");
    expect(contrastRatio(color.action!.on_primary_text!, color.action!.primary!)!).toBeGreaterThanOrEqual(4.5);
  });
});

describe("calibrateGeneratedTokens accent tints", () => {
  it("mixes each accent most of the way toward the page, with text that passes the contrast floor", () => {
    const color = calibrate({ palette: mindfulness }).color!;
    const tints = color.accent_tints!;
    expect(Object.keys(tints).length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(tints).length).toBeLessThanOrEqual(4);
    expect(Object.keys(tints)).toEqual(["1", "2", "3", "4"].slice(0, Object.keys(tints).length));
    for (const [key, tint] of Object.entries(tints)) {
      expect(tint).toMatch(/^#[0-9A-F]{6}$/);
      // a pastel: close to the page, far from a full accent
      expect(hexDeltaE(tint, color.background!.primary!)).toBeLessThan(30);
      expect(contrastRatio(color.accent_tints_text![key], tint)!).toBeGreaterThanOrEqual(4.5);
    }
    // the first tint is the measured apricot mixed 70% toward the page: #FEC068 toward #F2EADC
    expect(tints["1"]).toBe("#F6DDB9");
  });

  it("uses the action colours when the user named the accent, and none of the reference's", () => {
    const color = calibrate({ palette: mindfulness, userColorRoles: ["action"] }).color!;
    const values = Object.values(color.accent_tints!);
    expect(values.length).toBeGreaterThanOrEqual(1);
    expect(values).not.toContain("#F6DDB9");
  });

  it("gives text that passes 4.5:1 even on a dark tint", () => {
    const dark: MeasuredPalette = {
      theme: "dark",
      background: { hex: "#0E0F13", area: 0.3 },
      raised: { hex: "#181A20", area: 0.3 },
      inset: null,
      accents: [{ hex: "#C8F169", area: 0.01 }, { hex: "#5B8CFF", area: 0.01 }],
      ink: { hex: "#0E0F13", area: 0.3 },
    };
    const input = generated();
    input.tokens!.color!.text!.high_emphasis = "#F2F2F2";
    const color = calibrate({ palette: dark }, input).color!;
    for (const [key, tint] of Object.entries(color.accent_tints!)) {
      expect(contrastRatio(color.accent_tints_text![key], tint)!).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("calibrateGeneratedTokens typeface", () => {
  const withFonts = (heading: string, body: string, recommended: string[] = []) =>
    normalizeDesignTokens({
      system_schema: "mobile_universal_core",
      meta: { recommendedFonts: recommended },
      tokens: { ...generated().tokens, typography: { heading_font_family: heading, body_font_family: body } },
    });

  it("keeps a sans in both roles for a reference whose letters were read as a sans", () => {
    const typography = calibrate({ typeface: "sans" }, withFonts("Libre Baskerville, serif", "Quicksand, sans-serif", ["Libre Baskerville", "Quicksand"])).typography;
    expect(typography?.heading_font_family).toBe("Quicksand, sans-serif");
    expect(typography?.body_font_family).toBe("Quicksand, sans-serif");
  });

  it("leaves a sans heading and body as they are", () => {
    const typography = calibrate({ typeface: "sans" }, withFonts('"Outfit", sans-serif', '"Plus Jakarta Sans", sans-serif')).typography;
    expect(typography?.heading_font_family).toBe('"Outfit", sans-serif');
    expect(typography?.body_font_family).toBe('"Plus Jakarta Sans", sans-serif');
  });

  it("does nothing when the letters were not read, or were read as a serif", () => {
    const serif = withFonts("Fraunces, serif", "Inter, sans-serif");
    expect(calibrate({}, serif).typography?.heading_font_family).toBe("Fraunces, serif");
    expect(calibrate({ typeface: null }, serif).typography?.heading_font_family).toBe("Fraunces, serif");
    expect(calibrate({ typeface: "serif" }, serif).typography?.heading_font_family).toBe("Fraunces, serif");
  });
});

describe("calibrateGeneratedTokens contract", () => {
  it("is idempotent", () => {
    const evidence: CalibrationEvidence = { palette: mindfulness, radiusClass: "very-rounded", surfaceElevation: "flat-tone" };
    const once = calibrateGeneratedTokens(generated(), evidence);
    expect(calibrateGeneratedTokens(once, evidence)).toEqual(once);
  });

  it("does not mutate its input and passes through tokens without values", () => {
    const input = generated();
    const snapshot = JSON.parse(JSON.stringify(input));
    calibrateGeneratedTokens(input, { palette: mindfulness });
    expect(input).toEqual(snapshot);
    const empty: DesignTokens = { system_schema: "mobile_universal_core" };
    expect(calibrateGeneratedTokens(empty, { palette: mindfulness })).toBe(empty);
  });

  it("never touches a user's own token edits: only generation calibrates", () => {
    const edited = mergeApprovedDesignTokenEdits(calibrateGeneratedTokens(generated(), { palette: mindfulness }), {
      radii: { app: "32px" },
      shadows: { surface: "0 12px 32px rgba(0,0,0,0.3)" },
      color: { surface: { card: "#FFFFFF" } },
    });
    expect(edited.tokens?.radii?.app).toBe("32px");
    expect(edited.tokens?.shadows?.surface).toBe("0 12px 32px rgba(0,0,0,0.3)");
    expect(edited.tokens?.color?.surface?.card).toBe("#FFFFFF");
  });

  it("keeps old projects rendering: new tokens are optional", () => {
    const old = generated().tokens!;
    expect(old.color?.surface).not.toHaveProperty("inset");
    expect(old.color).not.toHaveProperty("accent_tints");
  });
});
