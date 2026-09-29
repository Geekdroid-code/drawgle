import { describe, expect, it } from "vitest";

import { normalizeDesignTokens } from "@/lib/design-tokens";
import {
  describeSurfaceClasses,
  describeTokenLanguage,
  normalizeRadiusClass,
  normalizeSurfaceElevation,
  radiusClassForPx,
  RADIUS_CLASSES,
  RADIUS_CLASS_DESCRIPTION,
  RADIUS_CLASS_PX,
  surfaceElevationOfShadow,
  SURFACE_ELEVATIONS,
  SURFACE_ELEVATION_DESCRIPTION,
} from "@/lib/generation/design-classes";
import { hasDesignValues } from "@/lib/generation/design-value-scrub";

describe("radius and elevation classes", () => {
  it("maps each radius class to a card radius that respects the 24px rule", () => {
    expect(RADIUS_CLASS_PX).toEqual({ square: 4, soft: 10, rounded: 16, "very-rounded": 20 });
    for (const radiusClass of RADIUS_CLASSES) expect(RADIUS_CLASS_PX[radiusClass]).toBeLessThanOrEqual(24);
    expect(RADIUS_CLASSES.map((radiusClass) => RADIUS_CLASS_PX[radiusClass])).toEqual([4, 10, 16, 20]);
  });

  it("normalises the labels a model actually returns", () => {
    for (const label of RADIUS_CLASSES) expect(normalizeRadiusClass(label)).toBe(label);
    expect(normalizeRadiusClass("Very Rounded")).toBe("very-rounded");
    expect(normalizeRadiusClass("very_rounded")).toBe("very-rounded");
    expect(normalizeRadiusClass("  ROUNDED ")).toBe("rounded");
    expect(normalizeRadiusClass("sharp")).toBe("square");
    expect(normalizeRadiusClass("softly rounded")).toBe("soft");
    expect(normalizeRadiusClass("24pt")).toBeNull();
    expect(normalizeRadiusClass(24)).toBeNull();
    expect(normalizeRadiusClass(undefined)).toBeNull();

    for (const label of SURFACE_ELEVATIONS) expect(normalizeSurfaceElevation(label)).toBe(label);
    expect(normalizeSurfaceElevation("Flat Tone")).toBe("flat-tone");
    expect(normalizeSurfaceElevation("tone_on_tone")).toBe("flat-tone");
    expect(normalizeSurfaceElevation("diffuse")).toBe("soft-shadow");
    expect(normalizeSurfaceElevation("drop shadow")).toBe("strong-shadow");
    expect(normalizeSurfaceElevation("glass")).toBeNull();
    expect(normalizeSurfaceElevation(null)).toBeNull();
  });

  it("describes the classes in words, without a single number", () => {
    const words = [...Object.values(RADIUS_CLASS_DESCRIPTION), ...Object.values(SURFACE_ELEVATION_DESCRIPTION)];
    for (const text of words) expect(text).not.toMatch(/\d|px|pt\b|#[0-9a-f]{3}/i);
    expect(describeSurfaceClasses({ radiusClass: "very-rounded", surfaceElevation: "flat-tone" })).toEqual([
      RADIUS_CLASS_DESCRIPTION["very-rounded"],
      SURFACE_ELEVATION_DESCRIPTION["flat-tone"],
    ]);
    expect(describeSurfaceClasses({})).toEqual([]);
    expect(describeSurfaceClasses({ surfaceElevation: "hairline" })).toEqual([SURFACE_ELEVATION_DESCRIPTION.hairline]);
  });
});

describe("token language for the planning layers", () => {
  const tokensWith = (radiiApp: string, surfaceShadow: string, fonts = { heading_font_family: "'Plus Jakarta Sans', sans-serif", body_font_family: "Inter, sans-serif" }) =>
    normalizeDesignTokens({
      system_schema: "mobile_universal_core",
      tokens: {
        color: {
          background: { primary: "#F2EADC", secondary: "#EDE4D2" },
          surface: { card: "#F7F4E8", bottom_sheet: "#F7F4E8", modal: "#F7F4E8" },
          text: { high_emphasis: "#211E1E", medium_emphasis: "#5C5650", low_emphasis: "#8A847C" },
          action: { primary: "#FEC068", secondary: "#A8B89A", on_primary_text: "#211E1E" },
          border: { divider: "#E4DCCB", focused: "#FEC068" },
        },
        typography: fonts,
        radii: { app: radiiApp, inner: "12px", pill: "9999px" },
        shadows: { surface: surfaceShadow, overlay: "0 -8px 40px rgba(33,30,30,0.16)" },
      },
    });

  it("sorts a pixel radius into the class the analysis is judged against", () => {
    expect([4, 5, 6, 10, 11, 12, 16, 17, 18, 20, 24].map(radiusClassForPx)).toEqual([
      "square", "square", "soft", "soft", "soft", "rounded", "rounded", "rounded", "very-rounded", "very-rounded", "very-rounded",
    ]);
    // every class's own radius falls back into that class
    for (const radiusClass of RADIUS_CLASSES) expect(radiusClassForPx(RADIUS_CLASS_PX[radiusClass])).toBe(radiusClass);
  });

  it("reads a surface shadow token as a way of separating cards", () => {
    expect(surfaceElevationOfShadow("none")).toBe("flat-tone");
    expect(surfaceElevationOfShadow(undefined)).toBe("flat-tone");
    expect(surfaceElevationOfShadow(null)).toBe("flat-tone");
    // an inset ring or a 1px edge is a hairline, not a lift
    expect(surfaceElevationOfShadow("0 0 0 1px rgba(33,30,30,0.08)")).toBe("hairline");
    // light and diffuse is soft, whatever its blur
    expect(surfaceElevationOfShadow("0 4px 16px rgba(33,30,30,0.06)")).toBe("soft-shadow");
    expect(surfaceElevationOfShadow("0 4px 20px rgba(45,41,38,0.04)")).toBe("soft-shadow");
    expect(surfaceElevationOfShadow("0 8px 40px rgba(45,41,38,0.08)")).toBe("soft-shadow");
    // anything darker than that is a shadow you can see
    expect(surfaceElevationOfShadow("0 8px 24px rgba(0,0,0,0.18)")).toBe("strong-shadow");
    expect(surfaceElevationOfShadow("0 2px 4px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.22)")).toBe("strong-shadow");
  });

  it("describes fonts, shape and depth in words and never a value", () => {
    const language = describeTokenLanguage(tokensWith("20px", "none"));
    expect(language).toEqual([
      "Fonts: Plus Jakarta Sans for headings and Inter for everything else.",
      `Shape and depth: ${RADIUS_CLASS_DESCRIPTION["very-rounded"]}; ${SURFACE_ELEVATION_DESCRIPTION["flat-tone"]}.`,
      expect.stringContaining("Surface ladder:"),
    ]);
    expect(hasDesignValues(language.join("\n"))).toBe(false);
    expect(language.join("\n")).not.toMatch(/#[0-9a-f]{3}|\d+\s?px/i);
  });

  it("follows the tokens: a small radius and a light shadow read differently", () => {
    const language = describeTokenLanguage(tokensWith("8px", "0 4px 16px rgba(33,30,30,0.06)")).join("\n");
    expect(language).toContain(RADIUS_CLASS_DESCRIPTION.soft);
    expect(language).toContain(SURFACE_ELEVATION_DESCRIPTION["soft-shadow"]);
    expect(language).not.toContain(RADIUS_CLASS_DESCRIPTION["very-rounded"]);
  });

  it("says nothing for tokens that are not approved", () => {
    expect(describeTokenLanguage(null)).toEqual([]);
    expect(describeTokenLanguage(undefined)).toEqual([]);
    expect(describeTokenLanguage({} as never)).toEqual([]);
  });
});
