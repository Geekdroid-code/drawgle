import { describe, expect, it } from "vitest";

import { fontClassOf, keepSansFamilies, loadableFontFamily, parseFontFamilyList, resolveFontFamilies } from "@/lib/font-stack";

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

  it("keeps a font the user named even when only some devices have it, and never a bare keyword", () => {
    const named = { heading: '"SF Pro Display", sans-serif', body: "Inter, sans-serif", recommended: ["SF Pro Display", "Inter"] };
    expect(resolveFontFamilies({ ...named, keepDeviceFaces: true })).toEqual({ heading: '"SF Pro Display", sans-serif', body: "Inter, sans-serif" });
    // without the user's say, the same answer is replaced by a font the canvas can load
    expect(resolveFontFamilies(named).heading).toBe('"Inter", sans-serif');
    expect(resolveFontFamilies({ heading: "serif", body: "sans-serif", keepDeviceFaces: true }))
      .toEqual({ heading: '"Manrope", sans-serif', body: '"Inter", sans-serif' });
  });

  it("builds a fallback stack from the family's name, not from a whole stack", () => {
    expect(resolveFontFamilies({ heading: "serif", recommended: ["Lora, Georgia, serif"] }).heading).toBe('"Lora", sans-serif');
  });

  it("gives a missing body the first other recommended family, or the neutral sans", () => {
    expect(resolveFontFamilies({ heading: '"Space Grotesk", sans-serif', recommended: ["Space Grotesk", "DM Sans"] }))
      .toEqual({ heading: '"Space Grotesk", sans-serif', body: '"DM Sans", sans-serif' });
    expect(resolveFontFamilies({ heading: '"Fraunces", serif' })).toEqual({ heading: '"Fraunces", serif', body: '"Inter", sans-serif' });
    expect(resolveFontFamilies({ heading: '"Inter", sans-serif' })).toEqual({ heading: '"Inter", sans-serif', body: '"Inter", sans-serif' });
  });
});

describe("fontClassOf", () => {
  it("knows a well-known serif and a well-known monospaced family, and takes anything else for a sans", () => {
    expect(fontClassOf('"Libre Baskerville", serif')).toBe("serif");
    expect(fontClassOf("Playfair Display, Georgia, serif")).toBe("serif");
    expect(fontClassOf('"JetBrains Mono", monospace')).toBe("mono");
    expect(fontClassOf('"Plus Jakarta Sans", sans-serif')).toBeNull();
    expect(fontClassOf("Inter")).toBeNull();
    expect(fontClassOf(null)).toBeNull();
  });

  it("goes by the keyword the stack closes with when it does not know the family", () => {
    expect(fontClassOf('"Some Rare Face", serif')).toBe("serif");
    expect(fontClassOf('"Some Rare Face", monospace')).toBe("mono");
    expect(fontClassOf('"Some Rare Face", sans-serif')).toBeNull();
    // a bare keyword names no family: there is nothing to classify
    expect(fontClassOf("serif")).toBeNull();
  });
});

describe("keepSansFamilies", () => {
  it("leaves stacks that are already a sans alone", () => {
    expect(keepSansFamilies({ heading: '"Outfit", sans-serif', body: '"Plus Jakarta Sans", sans-serif' }))
      .toEqual({ heading: '"Outfit", sans-serif', body: '"Plus Jakarta Sans", sans-serif' });
  });

  it("replaces a serif heading with the body's sans, the case of the second mindfulness build", () => {
    expect(keepSansFamilies({ heading: "Libre Baskerville, serif", body: "Quicksand, sans-serif" }))
      .toEqual({ heading: "Quicksand, sans-serif", body: "Quicksand, sans-serif" });
  });

  it("replaces a serif heading by a recommended sans when the body is no sans either, and by the default when there is none", () => {
    expect(keepSansFamilies({ heading: "Lora, serif", body: "Merriweather, serif", recommended: ["Lora", "DM Sans", "Inter"] }))
      .toEqual({ heading: '"DM Sans", sans-serif', body: '"Inter", sans-serif' });
    expect(keepSansFamilies({ heading: "Lora, serif", body: "Merriweather, serif" }))
      .toEqual({ heading: '"Manrope", sans-serif', body: '"Inter", sans-serif' });
  });

  it("replaces a monospaced body, and leaves out a role that was not given", () => {
    expect(keepSansFamilies({ heading: '"Outfit", sans-serif', body: "Roboto Mono, monospace", recommended: ["Outfit", "Inter"] }))
      .toEqual({ heading: '"Outfit", sans-serif', body: '"Inter", sans-serif' });
    expect(keepSansFamilies({ body: "Lora, serif" })).toEqual({ heading: null, body: '"Inter", sans-serif' });
  });
});
