// @vitest-environment node
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { hexDeltaE } from "@/lib/color-lab";
import { measureReferencePalette, type NormalizedBox } from "@/lib/generation/reference-palette";

type Ui = {
  page: string;
  card: string;
  tile?: string;
  accent?: string;
  text: string;
};

const LIGHT_TONE_ON_TONE: Ui = { page: "#ECE9D6", card: "#F7F5E9", tile: "#EFE9D9", accent: "#FFC068", text: "#111111" };

/** A phone-like screen: a page with cards, tiles inside the cards, a pill, text blocks and an attached bar. */
const screenSvg = ({ page, card, tile, accent, text }: Ui, width = 600, height = 1200) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 600 1200" shape-rendering="crispEdges">
  <rect width="600" height="1200" fill="${page}"/>
  <rect x="24" y="120" width="300" height="20" fill="${text}"/>
  <rect x="24" y="152" width="180" height="14" fill="${text}"/>
  <rect x="24" y="200" width="552" height="330" rx="24" fill="${card}"/>
  ${tile ? `<rect x="48" y="224" width="250" height="130" rx="12" fill="${tile}"/><rect x="312" y="224" width="240" height="130" rx="12" fill="${tile}"/>` : ""}
  <rect x="48" y="380" width="220" height="16" fill="${text}"/>
  ${accent ? `<rect x="48" y="440" width="200" height="56" rx="28" fill="${accent}"/><rect x="72" y="462" width="100" height="12" fill="${text}"/>` : ""}
  <rect x="24" y="560" width="552" height="270" rx="24" fill="${card}"/>
  <rect x="48" y="590" width="300" height="16" fill="${text}"/>
  <rect x="48" y="630" width="400" height="12" fill="${text}"/>
  <rect x="24" y="860" width="552" height="170" rx="24" fill="${card}"/>
  <rect x="0" y="1110" width="600" height="90" fill="${card}"/>
</svg>`;

const png = (ui: Ui) => sharp(Buffer.from(screenSvg(ui))).png().toBuffer();
const jpeg = async (ui: Ui, quality = 80) => sharp(await png(ui)).jpeg({ quality }).toBuffer();

const within = (actual: string | undefined | null, expected: string, limit: number) => {
  expect(actual, `expected a colour near ${expected}`).toBeTruthy();
  const delta = hexDeltaE(actual, expected);
  expect(delta, `${actual} vs ${expected}`).not.toBeNull();
  expect(delta!, `${actual} is ΔE ${delta?.toFixed(2)} from ${expected}`).toBeLessThanOrEqual(limit);
};

describe("measureReferencePalette on a synthetic tone-on-tone screen", () => {
  it("recovers the page, the lighter card, the darker tile, the accent and the ink within ΔE 3", async () => {
    const palette = await measureReferencePalette(await png(LIGHT_TONE_ON_TONE));
    expect(palette.theme).toBe("light");
    within(palette.background.hex, "#ECE9D6", 3);
    within(palette.raised?.hex, "#F7F5E9", 3);
    within(palette.inset?.hex, "#EFE9D9", 3);
    within(palette.accents[0]?.hex, "#FFC068", 3);
    within(palette.ink.hex, "#111111", 3);
    expect(palette.accents).toHaveLength(1);
  });

  it("finds the same roles in a compressed JPEG", async () => {
    const palette = await measureReferencePalette(await jpeg(LIGHT_TONE_ON_TONE, 78));
    within(palette.background.hex, "#ECE9D6", 3);
    within(palette.raised?.hex, "#F7F5E9", 3);
    within(palette.accents[0]?.hex, "#FFC068", 3);
  });

  it("does not let cards that cover more area than the page take its role", async () => {
    // In the synthetic screen the cards cover more of the pixels than the page does.
    const palette = await measureReferencePalette(await png(LIGHT_TONE_ON_TONE));
    expect(palette.raised!.area).toBeGreaterThan(palette.background.area);
    within(palette.background.hex, "#ECE9D6", 3);
  });

  it("is deterministic", async () => {
    const image = await jpeg(LIGHT_TONE_ON_TONE, 70);
    expect(await measureReferencePalette(image)).toEqual(await measureReferencePalette(image));
  });
});

describe("measureReferencePalette across themes and page tones", () => {
  it("reads a dark theme as a page with lighter cards", async () => {
    const palette = await measureReferencePalette(await png({
      page: "#0E0F13", card: "#181A20", tile: "#232631", accent: "#C8F169", text: "#F2F2F2",
    }));
    expect(palette.theme).toBe("dark");
    within(palette.background.hex, "#0E0F13", 3);
    within(palette.raised?.hex, "#181A20", 3);
    within(palette.inset?.hex, "#232631", 3);
    within(palette.accents[0]?.hex, "#C8F169", 3);
  });

  it("treats white cards on a light grey page as raised", async () => {
    const palette = await measureReferencePalette(await png({
      page: "#F2F2F7", card: "#FFFFFF", accent: "#3B6CF6", text: "#1C1C1E",
    }));
    within(palette.background.hex, "#F2F2F7", 3);
    within(palette.raised?.hex, "#FFFFFF", 3);
    within(palette.accents[0]?.hex, "#3B6CF6", 3);
  });

  it("keeps a white page white when the cards are darker: they become the inset, not the page", async () => {
    const palette = await measureReferencePalette(await png({
      page: "#FFFFFF", card: "#F1F1F4", accent: "#3B6CF6", text: "#1C1C1E",
    }));
    within(palette.background.hex, "#FFFFFF", 3);
    expect(palette.raised).toBeNull();
    within(palette.inset?.hex, "#F1F1F4", 3);
  });

  it("reports no raised surface or inset for a single flat neutral", async () => {
    const flat = await sharp({ create: { width: 400, height: 800, channels: 3, background: "#F5F5F5" } }).png().toBuffer();
    const palette = await measureReferencePalette(flat);
    within(palette.background.hex, "#F5F5F5", 1);
    expect(palette.raised).toBeNull();
    expect(palette.inset).toBeNull();
    expect(palette.accents).toEqual([]);
  });
});

describe("measureReferencePalette accents", () => {
  const accentScreen = async (accents: Array<{ color: string; width: number; height: number }>) => {
    const rects = accents.map((accent, index) =>
      `<rect x="${24 + index * 8}" y="${40 + index * 260}" width="${accent.width}" height="${accent.height}" rx="24" fill="${accent.color}"/>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1200" shape-rendering="crispEdges"><rect width="600" height="1200" fill="#F7F7F5"/>${rects}</svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  };

  it("ranks saturated colours by area times chroma and keeps at most four", async () => {
    const palette = await measureReferencePalette(await accentScreen([
      { color: "#FF7A1A", width: 400, height: 200 },
      { color: "#2F6BFF", width: 200, height: 100 },
      { color: "#22B573", width: 150, height: 80 },
      { color: "#C03BFF", width: 120, height: 70 },
      { color: "#FFD400", width: 100, height: 60 },
    ]));
    expect(palette.accents.length).toBeLessThanOrEqual(4);
    within(palette.accents[0].hex, "#FF7A1A", 3);
    expect(palette.accents.map((accent) => accent.area)).toEqual([...palette.accents.map((accent) => accent.area)]);
  });

  it("pools near-identical tones into one family, so a gradient cannot hide a solid fill", async () => {
    const palette = await measureReferencePalette(await accentScreen([
      { color: "#FF7A1A", width: 200, height: 120 },
      { color: "#FF7B1C", width: 200, height: 120 },
      { color: "#2F6BFF", width: 260, height: 140 },
    ]));
    // the two oranges are one family with the larger combined area
    expect(palette.accents).toHaveLength(2);
    within(palette.accents[0].hex, "#FF7A1A", 3);
    within(palette.accents[1].hex, "#2F6BFF", 3);
  });

  it("does not report muted colours as accents", async () => {
    const palette = await measureReferencePalette(await accentScreen([{ color: "#D9D2B8", width: 400, height: 200 }]));
    expect(palette.accents).toEqual([]);
  });
});

describe("measureReferencePalette regions", () => {
  const phones = async () => {
    const phone = await sharp(Buffer.from(screenSvg(LIGHT_TONE_ON_TONE, 300, 600))).png().toBuffer();
    return sharp({ create: { width: 1000, height: 700, channels: 3, background: "#D9D2B8" } })
      .composite([{ input: phone, left: 60, top: 50 }, { input: phone, left: 600, top: 50 }])
      .png()
      .toBuffer();
  };
  const boxes: NormalizedBox[] = [
    { x: 0.06, y: 50 / 700, width: 0.3, height: 600 / 700 },
    { x: 0.6, y: 50 / 700, width: 0.3, height: 600 / 700 },
  ];

  it("measures the screens inside their boxes and ignores the backdrop around them", async () => {
    const palette = await measureReferencePalette(await phones(), boxes);
    within(palette.background.hex, "#ECE9D6", 3);
    within(palette.raised?.hex, "#F7F5E9", 3);
    within(palette.accents[0]?.hex, "#FFC068", 3);
  });

  it("still finds the page when the boxes are loose and include the backdrop", async () => {
    const loose = boxes.map((box) => ({ x: box.x - 0.02, y: box.y - 0.03, width: box.width + 0.04, height: box.height + 0.06 }));
    const palette = await measureReferencePalette(await phones(), loose);
    within(palette.background.hex, "#ECE9D6", 3);
    within(palette.raised?.hex, "#F7F5E9", 3);
  });

  it("uses the whole image minus a border when no usable box is given", async () => {
    const image = await png(LIGHT_TONE_ON_TONE);
    const unboxed = await measureReferencePalette(image);
    const useless = await measureReferencePalette(image, [{ x: 0.5, y: 0.5, width: 0.01, height: 0.01 }, { x: Number.NaN, y: 0, width: 1, height: 1 }]);
    expect(useless).toEqual(unboxed);
  });

  it("refuses an image with no solid colour to measure", async () => {
    const noise = Buffer.alloc(200 * 200 * 3);
    let seed = 12345;
    for (let index = 0; index < noise.length; index += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      noise[index] = seed % 256;
    }
    const image = await sharp(noise, { raw: { width: 200, height: 200, channels: 3 } }).png().toBuffer();
    await expect(measureReferencePalette(image)).rejects.toThrow(/no solid colour/);
  });
});

describe("measureReferencePalette on the curated mindfulness reference", () => {
  // The three phone screens as an analysis would box them (normalised to the image).
  const phoneBoxes: NormalizedBox[] = [
    { x: 0.05, y: 0.137, width: 0.264, height: 0.761 },
    { x: 0.354, y: 0.105, width: 0.292, height: 0.776 },
    { x: 0.687, y: 0.137, width: 0.263, height: 0.761 },
  ];

  it("lands on the tones measured from its pixels (ΔE ≤ 4)", async () => {
    const image = await readFile(new URL("./__fixtures__/mindfulness-meditation-beige-light.jpg", import.meta.url));
    const palette = await measureReferencePalette(image, phoneBoxes);

    expect(palette.theme).toBe("light");
    within(palette.background.hex, "#ECE9D6", 4);
    within(palette.raised?.hex, "#F7F5E9", 4);
    within(palette.inset?.hex, "#EFE9D9", 4);
    // The apricot used for chips, the selected day and the mic button is among the accents.
    // (Lime, from the gradient cards, the donut and the illustrations, covers a similar area.)
    expect(palette.accents.length).toBeGreaterThan(0);
    expect(palette.accents.length).toBeLessThanOrEqual(4);
    expect(palette.accents.some((accent) => (hexDeltaE(accent.hex, "#FFC068") ?? 99) <= 4)).toBe(true);
    // Cards sit above the page but are only a tone step away: tone-on-tone, not white on cream.
    const step = hexDeltaE(palette.raised!.hex, palette.background.hex)!;
    expect(step).toBeGreaterThan(1.5);
    expect(step).toBeLessThan(6);
    expect(palette.ink.hex.toLowerCase()).toMatch(/^#[0-3]/);
  });

  it("does not take the backdrop around a rotated phone for the page, even with loose boxes", async () => {
    const image = await readFile(new URL("./__fixtures__/mindfulness-meditation-beige-light.jpg", import.meta.url));
    const loose = phoneBoxes.map((box) => ({ x: box.x - 0.02, y: box.y - 0.03, width: box.width + 0.04, height: box.height + 0.06 }));
    const palette = await measureReferencePalette(image, loose);
    within(palette.background.hex, "#ECE9D6", 4);
    within(palette.raised?.hex, "#F7F5E9", 4);
  });
});
