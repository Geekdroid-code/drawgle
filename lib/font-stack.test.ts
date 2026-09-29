import { describe, expect, it } from "vitest";

import { loadableFontFamily, parseFontFamilyList, resolveFontFamilies } from "@/lib/font-stack";

describe("loadableFontFamily", () => {
  it("names the first family of a stack when it is a real font", () => {
    expect(loadableFontFamily('"Plus Jakarta Sans", sans-serif')).toBe("Plus Jakarta Sans");
    expect(loadableFontFamily("Inter, system-ui, sans-serif")).toBe("Inter");
    expect(loadableFontFamily("'DM Sans', sans-serif")).toBe("DM Sans");
    expect(loadableFontFamily("Fraunces")).toBe("Fraunces");
  });

  it("finds no font in a generic keyword, quoted or not", () => {
    for (const stack of ["serif", "sans-serif", '"sans-serif", sans-serif', "system-ui, sans-serif", "ui-serif", "monospace", "-apple-system, sans-serif", "var(--font)", "", null, undefined]) {
      expect(loadableFontFamily(stack), String(stack)).toBeNull();
    }
  });

  it("finds none in a face that only some devices have", () => {
    for (const stack of ['"SF Pro Display", sans-serif', "New York, serif", "Helvetica Neue, Arial, sans-serif", "Georgia, serif", '"Times New Roman"']) {
      expect(loadableFontFamily(stack), stack).toBeNull();
    }
  });

  it("refuses a name that could not be a font name", () => {
    expect(loadableFontFamily("Inter;} body{display:none")).toBeNull();
  });

  it("reads the families of a stack in order, without their quotes", () => {
    expect(parseFontFamilyList('"Plus Jakarta Sans", \'Inter\', sans-serif')).toEqual(["Plus Jakarta Sans", "Inter", "sans-serif"]);
    expect(parseFontFamilyList('"A, B", C')).toEqual(["A, B", "C"]);
  });
});

describe("resolveFontFamilies", () => {
  it("keeps a stack the app can load as it was written", () => {
    expect(resolveFontFamilies({ heading: '"Space Grotesk", system-ui, sans-serif', body: "Inter, sans-serif", recommended: ["Space Grotesk", "Inter"] }))
      .toEqual({ heading: '"Space Grotesk", system-ui, sans-serif', body: "Inter, sans-serif" });
  });

  it("keeps one family for both roles when the model chose one", () => {
    expect(resolveFontFamilies({ heading: '"Manrope", sans-serif', body: '"Manrope", sans-serif', recommended: ["Manrope", "Inter"] }))
      .toEqual({ heading: '"Manrope", sans-serif', body: '"Manrope", sans-serif' });
  });

  it("replaces a generic keyword with a family the model recommended, and never with a device-only one", () => {
    // what the preset build of the mindfulness reference got back: no font at all in either role
    expect(resolveFontFamilies({ heading: "serif", body: '"sans-serif", sans-serif', recommended: ["New York", "SF Pro Display", "Lora", "Inter"] }))
      .toEqual({ heading: '"Lora", sans-serif', body: '"Inter", sans-serif' });
  });

  it("falls back to the neutral defaults when nothing usable was named", () => {
    expect(resolveFontFamilies({})).toEqual({ heading: '"Manrope", sans-serif', body: '"Inter", sans-serif' });
    expect(resolveFontFamilies({ heading: "serif", body: "sans-serif", recommended: ["Helvetica Neue"] }))
      .toEqual({ heading: '"Manrope", sans-serif', body: '"Inter", sans-serif' });
  });

  it("gives a missing body the first other recommended family, or the neutral sans", () => {
    expect(resolveFontFamilies({ heading: '"Space Grotesk", sans-serif', recommended: ["Space Grotesk", "DM Sans"] }))
      .toEqual({ heading: '"Space Grotesk", sans-serif', body: '"DM Sans", sans-serif' });
    expect(resolveFontFamilies({ heading: '"Fraunces", serif' })).toEqual({ heading: '"Fraunces", serif', body: '"Inter", sans-serif' });
    expect(resolveFontFamilies({ heading: '"Inter", sans-serif' })).toEqual({ heading: '"Inter", sans-serif', body: '"Inter", sans-serif' });
  });
});
