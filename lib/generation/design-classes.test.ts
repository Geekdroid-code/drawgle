import { describe, expect, it } from "vitest";

import {
  describeSurfaceClasses,
  normalizeRadiusClass,
  normalizeSurfaceElevation,
  RADIUS_CLASSES,
  RADIUS_CLASS_DESCRIPTION,
  RADIUS_CLASS_PX,
  SURFACE_ELEVATIONS,
  SURFACE_ELEVATION_DESCRIPTION,
} from "@/lib/generation/design-classes";

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
