import { describe, expect, it } from "vitest";

import {
  deltaE2000,
  deltaE76,
  hexDeltaE,
  hexToLab,
  labChroma,
  labToHex,
  mixHex,
  parseHex,
  rgbToHex,
  rgbToLab,
  type Lab,
} from "@/lib/color-lab";

describe("colour maths", () => {
  it("parses short, long and alpha hex values and rejects everything else", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("#ECE9D6")).toEqual([236, 233, 214]);
    expect(parseHex("#ECE9D6cc")).toEqual([236, 233, 214]);
    expect(parseHex("rgb(1,2,3)")).toBeNull();
    expect(parseHex("")).toBeNull();
    expect(parseHex(undefined)).toBeNull();
    expect(rgbToHex([236, 233, 214])).toBe("#ECE9D6");
  });

  it("converts sRGB primaries to their D65 Lab coordinates", () => {
    const close = (actual: readonly number[], expected: number[]) =>
      expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value, 1));
    close(rgbToLab([255, 255, 255]), [100, 0, 0]);
    close(rgbToLab([0, 0, 0]), [0, 0, 0]);
    close(rgbToLab([255, 0, 0]), [53.24, 80.09, 67.2]);
    close(rgbToLab([0, 255, 0]), [87.73, -86.18, 83.18]);
    close(rgbToLab([0, 0, 255]), [32.3, 79.19, -107.86]);
  });

  it("round-trips every hex colour through Lab", () => {
    for (const hex of ["#ECE9D6", "#F7F5E9", "#EFE9D9", "#FFC068", "#010C19", "#123456", "#FEFEFE", "#0A0A0A"]) {
      expect(labToHex(hexToLab(hex)!)).toBe(hex);
    }
  });

  it("matches the published CIEDE2000 reference pairs (Sharma, Wu and Dalal)", () => {
    const pairs: Array<[Lab, Lab, number]> = [
      [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
      [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
      [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
      [[50, 0, 0], [50, -1, 2], 2.3669],
      [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
      [[50, -0.001, 2.49], [50, 0.0009, -2.49], 4.8045],
      [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
      [[50, 2.5, 0], [73, 25, -18], 27.1492],
      [[50, 2.5, 0], [61, -5, 29], 22.8977],
    ];
    for (const [first, second, expected] of pairs) {
      expect(deltaE2000(first, second)).toBeCloseTo(expected, 3);
      expect(deltaE2000(second, first)).toBeCloseTo(expected, 3);
    }
  });

  it("reports 0 for identical colours and grows with distance", () => {
    expect(hexDeltaE("#F7F5E9", "#F7F5E9")).toBe(0);
    const near = hexDeltaE("#F7F5E9", "#F5F2E7")!;
    const far = hexDeltaE("#F7F5E9", "#FFFFFF")!;
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
    expect(hexDeltaE("#F7F5E9", "not a colour")).toBeNull();
    expect(deltaE76(hexToLab("#000000")!, hexToLab("#FFFFFF")!)).toBeCloseTo(100, 1);
  });

  it("separates greys from accents by chroma", () => {
    expect(labChroma(hexToLab("#808080")!)).toBeLessThan(1);
    expect(labChroma(hexToLab("#FFC068")!)).toBeGreaterThan(25);
  });

  it("mixes in sRGB like color-mix and clamps the amount", () => {
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mixHex("#FFC068", "#ECE9D6", 0)).toBe("#FFC068");
    expect(mixHex("#FFC068", "#ECE9D6", 1)).toBe("#ECE9D6");
    expect(mixHex("#FFC068", "#ECE9D6", 5)).toBe("#ECE9D6");
    expect(mixHex("#FFC068", "nope", 0.5)).toBe("#FFC068");
  });
});
