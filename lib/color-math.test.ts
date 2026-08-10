import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  ensureContrast,
  hueDistance,
  oklchToHex,
  parseCssColor,
  toOklch,
} from "@/lib/color-math";

describe("parseCssColor", () => {
  it("reads hex in every supported length", () => {
    expect(parseCssColor("#fff")).toEqual({ r: 255, g: 255, b: 255, alpha: 1 });
    expect(parseCssColor("#1A1A1A")).toEqual({ r: 26, g: 26, b: 26, alpha: 1 });
    expect(parseCssColor("#1A1A1A80")?.alpha).toBeCloseTo(0.5, 1);
  });

  it("reads rgb and rgba, including percentage alpha", () => {
    expect(parseCssColor("rgba(26, 26, 26, 0.08)")).toEqual({ r: 26, g: 26, b: 26, alpha: 0.08 });
    expect(parseCssColor("rgb(255 255 255 / 40%)")?.alpha).toBeCloseTo(0.4, 2);
  });

  it("returns null for values it cannot resolve", () => {
    expect(parseCssColor("var(--dg-color-text-high-emphasis)")).toBeNull();
    expect(parseCssColor(undefined)).toBeNull();
  });
});

describe("OKLCH conversion", () => {
  it("round-trips within one 8-bit step", () => {
    for (const hex of ["#FFFFFF", "#000000", "#F5F2ED", "#E8D5C4", "#1A1A1A", "#2563EB"]) {
      const oklch = toOklch(hex)!;
      expect(oklchToHex(oklch)).toBe(hex);
    }
  });

  it("reports white as neutral and a warm off-white as chromatic", () => {
    expect(toOklch("#FFFFFF")!.c).toBeCloseTo(0, 3);
    const cream = toOklch("#F5F2ED")!;
    expect(cream.c).toBeGreaterThan(0.004);
    // Warm hues sit in the yellow-orange band.
    expect(cream.h).toBeGreaterThan(40);
    expect(cream.h).toBeLessThan(120);
  });

  it("measures the shortest angular hue distance", () => {
    expect(hueDistance(10, 350)).toBe(20);
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(0, 180)).toBe(180);
  });
});

describe("contrast", () => {
  it("matches known WCAG ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 3);
  });

  it("confirms the shipped low-emphasis grey fails on white", () => {
    expect(contrastRatio("#A0A0A0", "#FFFFFF")!).toBeLessThan(3);
  });

  it("raises contrast while keeping the hue family", () => {
    const repaired = ensureContrast("#A0A0A0", "#FFFFFF", 3)!;
    expect(contrastRatio(repaired, "#FFFFFF")!).toBeGreaterThanOrEqual(3);

    const tinted = ensureContrast("#B08A6A", "#FFFFFF", 4.5)!;
    const before = toOklch("#B08A6A")!;
    const after = toOklch(tinted)!;
    expect(contrastRatio(tinted, "#FFFFFF")!).toBeGreaterThanOrEqual(4.5);
    expect(hueDistance(before.h, after.h)).toBeLessThan(5);
  });

  it("returns the original color when it already passes", () => {
    expect(ensureContrast("#111827", "#FFFFFF", 4.5)).toBe("#111827");
  });
});
