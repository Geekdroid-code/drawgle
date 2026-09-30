// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { formatMeasuredColors, measureStyleReferencePalette } from "@/lib/generation/measured-colors";
import type { MeasuredPalette } from "@/lib/generation/reference-palette";
import type { ReferenceAnalysis } from "@/lib/types";

const palette: MeasuredPalette = {
  theme: "light",
  background: { hex: "#F2EADC", area: 0.19 },
  raised: { hex: "#F7F4E8", area: 0.25 },
  inset: { hex: "#EDEAD7", area: 0.03 },
  accents: [{ hex: "#FEC068", area: 0.006 }, { hex: "#D8EA60", area: 0.006 }],
  ink: { hex: "#211E1E", area: 0.002 },
};

describe("formatMeasuredColors", () => {
  it("lists the measured roles as authoritative evidence and the shape in words only", () => {
    const text = formatMeasuredColors(palette, { radiusClass: "very-rounded", surfaceElevation: "flat-tone" });
    expect(text).toContain("MEASURED COLORS (from the reference pixels; authoritative).");
    expect(text).toContain("do not invent hues");
    expect(text).toContain("override them for the roles the user named");
    expect(text).toContain("Page (color.background.primary): #F2EADC");
    expect(text).toContain("Raised card surface (color.surface.card): #F7F4E8");
    expect(text).toContain("Inset tile or field inside a card (color.surface.inset): #EDEAD7");
    expect(text).toContain("most prominent first (action colours, tints, focal fills): #FEC068, #D8EA60");
    expect(text).toContain("Darkest ink: #211E1E");
    expect(text).toContain("generously rounded cards");
    expect(text).toContain("no cast shadow and no border");
    // hex is welcome in a token prompt, but the shape must not carry a number
    const shape = text.split("\n").find((line) => line.startsWith("- Shape and depth")) ?? "";
    expect(shape).not.toMatch(/\d/);
  });

  it("says what is missing instead of inventing it", () => {
    const text = formatMeasuredColors({ ...palette, raised: null, inset: null, accents: [] });
    expect(text).toContain("Raised card surface: none measured");
    expect(text).toContain("Inset tile or field: none measured");
    expect(text).toContain("Accent colours: none measured");
    expect(text).not.toContain("Shape and depth");
  });
});

describe("measureStyleReferencePalette", () => {
  const screen = async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800" shape-rendering="crispEdges">
      <rect width="400" height="800" fill="#ECE9D6"/>
      <rect x="16" y="120" width="368" height="240" rx="20" fill="#F7F5E9"/>
      <rect x="16" y="400" width="368" height="240" rx="20" fill="#F7F5E9"/>
      <rect x="32" y="440" width="140" height="44" rx="22" fill="#FFC068"/>
    </svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return { data: png.toString("base64"), mimeType: "image/png" };
  };

  it("measures style references and passes the analysis boxes to the measurement", async () => {
    const analysis = { screenReferences: [{ index: 1, boundingBox: { x: 0, y: 0, width: 1, height: 1 } }] } as unknown as ReferenceAnalysis;
    for (const referenceMode of ["curated_style", "user_style"] as const) {
      const measured = await measureStyleReferencePalette({ image: await screen(), referenceMode, referenceAnalysis: analysis });
      expect(measured?.theme).toBe("light");
      expect(measured?.background.hex).toMatch(/^#E[CD]E[89A]D[56]$/);
      expect(measured?.raised?.hex).toBe("#F7F5E9");
    }
  });

  it("gives Image to UI, prompt-only and image-less projects no palette", async () => {
    const image = await screen();
    expect(await measureStyleReferencePalette({ image, referenceMode: "user_recreate" })).toBeNull();
    expect(await measureStyleReferencePalette({ image, referenceMode: "internal_style" })).toBeNull();
    expect(await measureStyleReferencePalette({ image: null, referenceMode: "curated_style" })).toBeNull();
    expect(await measureStyleReferencePalette({ referenceMode: "curated_style" })).toBeNull();
  });

  it("reports a measurement that cannot be made and carries on without a palette", async () => {
    const onError = vi.fn();
    const broken = { data: Buffer.from("not an image").toString("base64"), mimeType: "image/png" };
    expect(await measureStyleReferencePalette({ image: broken, referenceMode: "curated_style", onError })).toBeNull();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("ignores non-numeric boxes", async () => {
    const analysis = { screenReferences: [{ index: 1, boundingBox: { x: "a", y: 0, width: 1, height: 1 } }, { index: 2 }] } as unknown as ReferenceAnalysis;
    const measured = await measureStyleReferencePalette({ image: await screen(), referenceMode: "curated_style", referenceAnalysis: analysis });
    expect(measured?.theme).toBe("light");
  });
});
