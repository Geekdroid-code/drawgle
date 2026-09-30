import { describe, expect, it } from "vitest";

import { capShadow, hasCastShadow, parseShadowLayers, softShadow } from "@/lib/shadow-css";

describe("shadow parsing", () => {
  it("reads rgba, modern rgb, hex and hsl colours with the colour first or last", () => {
    expect(parseShadowLayers("rgba(45, 41, 38, 0.04) 0px 4px 20px 0px")[0]).toMatchObject({ y: 4, blur: 20, alpha: 0.04, rgb: [45, 41, 38] });
    expect(parseShadowLayers("0 12px 32px rgba(15,23,42,0.14)")[0]).toMatchObject({ y: 12, blur: 32, alpha: 0.14, rgb: [15, 23, 42] });
    expect(parseShadowLayers("rgb(0 0 0 / 8%) 0px 8px 24px -4px")[0]).toMatchObject({ alpha: 0.08, spread: -4 });
    expect(parseShadowLayers("0 2px 8px #00000033")[0]).toMatchObject({ alpha: 0.2, rgb: [0, 0, 0] });
    expect(parseShadowLayers("0 2px 8px hsla(210, 50%, 20%, 0.1)")[0]).toMatchObject({ alpha: 0.1 });
    expect(parseShadowLayers("none")).toEqual([]);
    expect(parseShadowLayers("garbage")).toEqual([]);
    expect(parseShadowLayers(undefined)).toEqual([]);
  });

  it("parses every layer of a multi-layer shadow", () => {
    const layers = parseShadowLayers("0 0 0 1px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5), 0 12px 32px rgba(0,0,0,0.14)");
    expect(layers).toHaveLength(3);
    expect(layers[1].inset).toBe(true);
    expect(layers[2].blur).toBe(32);
  });

  it("counts only shadows that lift a surface off the page", () => {
    expect(hasCastShadow("rgba(45, 41, 38, 0.04) 0px 4px 20px 0px")).toBe(true);
    expect(hasCastShadow("none")).toBe(false);
    expect(hasCastShadow("rgba(0, 0, 0, 0.08) 0px 0px 0px 1px")).toBe(false);
    expect(hasCastShadow("rgba(0, 0, 0, 0.2) 0px 2px 6px 0px inset")).toBe(false);
    expect(hasCastShadow("rgba(0, 0, 0, 0) 0px 12px 32px 0px")).toBe(false);
    expect(hasCastShadow("rgba(0, 0, 0, 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, 0.14) 0px 12px 32px 0px")).toBe(true);
  });
});

describe("capShadow", () => {
  it("caps the blur and the alpha of every layer and keeps offsets and spread", () => {
    expect(capShadow("0 12px 32px rgba(15,23,42,0.14)", { maxBlur: 16, maxAlpha: 0.08 }))
      .toBe("0px 12px 16px 0px rgba(15, 23, 42, 0.08)");
    expect(capShadow("0 4px 8px -2px rgba(0,0,0,0.05), 0 20px 40px rgba(0,0,0,0.3)", { maxBlur: 16, maxAlpha: 0.08 }))
      .toBe("0px 4px 8px -2px rgba(0, 0, 0, 0.05), 0px 20px 16px 0px rgba(0, 0, 0, 0.08)");
  });

  it("leaves a shadow that is already soft unchanged in value", () => {
    expect(capShadow("0px 4px 12px 0px rgba(45, 41, 38, 0.04)", { maxBlur: 16, maxAlpha: 0.08 }))
      .toBe("0px 4px 12px 0px rgba(45, 41, 38, 0.04)");
  });

  it("returns null when nothing can be read and gives a canonical soft shadow to fall back on", () => {
    expect(capShadow("none", { maxBlur: 16, maxAlpha: 0.08 })).toBeNull();
    expect(capShadow("nonsense", { maxBlur: 16, maxAlpha: 0.08 })).toBeNull();
    expect(softShadow([45, 41, 38])).toBe("0px 4px 16px 0px rgba(45, 41, 38, 0.06)");
    expect(hasCastShadow(softShadow([0, 0, 0]))).toBe(true);
  });
});
