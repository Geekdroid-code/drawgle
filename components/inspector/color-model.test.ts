import { describe, expect, it } from "vitest";
import { colorAlpha, colorRgb, colorValue, hsvToRgb, rgbToHsv, validColor } from "./color-model";
import { parseCssShadow, serializeCssShadow } from "../design-system/shadow-model";

describe("inspector color and shadow values", () => {
  it("rejects incomplete hex and invalid functional colors", () => {
    for (const value of ["#12345", "#1234567", "#12", "rgb(300, 0, 0)", "rgba(0,0,0,2)"]) expect(validColor(value)).toBe(false);
    for (const value of ["#123", "#1234", "#123456", "#12345678", "hsl(120 50% 50%)"]) expect(validColor(value)).toBe(true);
  });
  it("retains opacity while changing hue and handles HSL units", () => {
    expect(colorAlpha("#0008")).toBeCloseTo(136 / 255);
    expect(colorAlpha("rgba(10 20 30 / 40%)")).toBe(.4);
    const rgb = colorRgb("hsl(.5turn 100% 50%)");
    expect(rgb).toEqual({ r: 0, g: 255, b: 255 });
    expect(colorValue(hsvToRgb({ ...rgbToHsv(rgb), h: 0 }), .4)).toBe("rgba(255, 0, 0, 0.4)");
  });
  it("understands color-first and inset shadows without shifting dimensions", () => {
    const parts = parseCssShadow("rgba(20, 30, 40, 0.25) inset 1px -2px 12px 3px");
    expect(parts).toMatchObject({ x: 1, y: -2, blur: 12, spread: 3, opacity: .25, inset: true, supported: true });
    expect(serializeCssShadow(parts)).toBe("inset 1px -2px 12px 3px rgba(20, 30, 40, 0.25)");
  });
  it("does not pretend layered or inherited shadows are editable as one layer", () => {
    for (const value of ["var(--shadow-card)", "0 2px 4px #0003, 0 8px 12px #0002", "0 1rem 2rem #000"])
      expect(parseCssShadow(value).supported).toBe(false);
  });
});
