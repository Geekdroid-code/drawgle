import sharp from "sharp";

import { deltaE2000, deltaE76, labChroma, labToHex, rgbToLab, type Lab } from "@/lib/color-lab";

/**
 * Measures a reference image instead of asking a model to guess it.
 *
 * Hex values, radii and shadows that a language model estimates in prose drift
 * toward the same clichés (whiter, rounder, shadowed) and every later stage
 * repeats the drift. The pixels were available the whole time, so the palette is
 * measured here, deterministically: no model call, no random seed.
 *
 * Method. Each screen box is downsampled and its flat pixels (the inside of solid
 * fills, where every neighbour has the same colour) are gathered into colour
 * peaks by mean-shift in Lab. Solid fills survive that census exactly, while
 * gradients, photos, text and anti-aliased edges do not, so an illustration or a
 * gradient card cannot outvote the controls. Roles are assigned from the peaks by
 * tone: the raised surface is the neutral that is lighter than the page, the
 * inset is a neutral step between or just below them, accents are the saturated
 * peaks.
 *
 * The page is not taken from the box's outer ring. A device mockup's bezel, a
 * loose box or a rotated phone all put the wrong colours on the ring, and a page
 * that is a gradient has no single colour there anyway.
 */

/** Normalised 0..1 box, as in ReferenceScreenAnalysis.boundingBox. */
export type NormalizedBox = { x: number; y: number; width: number; height: number };
/** `area` is the share of the sampled pixels that sit inside solid fills of this colour. */
export type MeasuredColor = { hex: string; area: number };
export type MeasuredPalette = {
  theme: "light" | "dark";
  /** The page. A page that is a gradient is measured as the middle of its tones. */
  background: MeasuredColor;
  /** A neutral card surface lighter than the page (also in dark themes). */
  raised: MeasuredColor | null;
  /** A tile or field inside a card: a neutral step between the page and the card, or just below the page. */
  inset: MeasuredColor | null;
  /** Saturated colours (Lab C* of at least 25), ranked by area times chroma, at most four. */
  accents: MeasuredColor[];
  /** The darkest neutral colour with a real area, below the device chrome. */
  ink: MeasuredColor;
};

const SAMPLE_WIDTH = 120;
const MAX_SAMPLE_HEIGHT = 320;
const WORKING_WIDTH = 1200;
const MIN_BOX_SIDE = 0.05;
/** Only image-edge artefacts are trimmed: a wider border would cut the 16pt gutters that connect the page. */
const WHOLE_IMAGE_BORDER = 0.015;
/** The status bar and dynamic island sit at the top of a device screenshot. */
const DEVICE_CHROME_BAND = 0.09;
/** Largest per-channel step to a neighbour that still counts as the inside of a solid fill. */
const FLAT_CHANNEL_STEP = 3;
const PEAK_RADIUS = 1.5;
const MAX_PEAKS = 64;
const MIN_PEAK_PIXELS = 24;
const MIN_PEAK_AREA = 0.0004;
const NEUTRAL_CHROMA = 18;
const ACCENT_CHROMA = 25;
const INK_RADIUS = 6;
const MIN_SURFACE_AREA = 0.012;
/** A surface is dominant when it covers at least this share of the largest surface. */
const DOMINANT_SHARE = 0.25;
const RING_FRACTION = 0.06;
const RAISED_MIN_DELTA_L = 1.5;
const RAISED_MAX_DELTA_L = 45;
/** How far a page may sit from the extreme surface tone before it stops looking like the page. */
const PAGE_TONE_SCALE = 15;
/** A pixel belongs to a colour's region when it is within this distance of the peak. */
const REGION_RADIUS = 3;
/** Tones of one gradient page span the screen and stay within this ΔE of each other. */
const PAGE_FAMILY_DELTA_E = 4.5;
const PAGE_FAMILY_MIN_SPAN = 0.4;
const PAGE_FAMILY_MIN_SHARE = 0.1;
const MIN_INSET_DELTA_E = 1.5;
const INSET_MAX_STEP_BELOW = 8;
const MERGE_ACCENT_DELTA_E = 8;
const MIN_INK_AREA = 0.003;

export type Peak = { lab: Lab; count: number; ring: number };

type Sample = {
  width: number;
  height: number;
  lab: Lab[];
  flat: Uint8Array;
  ring: Uint8Array;
  chrome: Uint8Array;
};

export type PeakCensus = { peaks: Peak[]; total: number; samples: Sample[] };

const round4 = (value: number) => Math.round(value * 10000) / 10000;

const colorOf = (lab: Lab, count: number, total: number): MeasuredColor => ({ hex: labToHex(lab), area: round4(count / total) });

const clampBox = (box: NormalizedBox): NormalizedBox | null => {
  const x = Math.min(1, Math.max(0, Number(box.x)));
  const y = Math.min(1, Math.max(0, Number(box.y)));
  const width = Math.min(1 - x, Number(box.width));
  const height = Math.min(1 - y, Number(box.height));
  return Number.isFinite(x + y + width + height) && width >= MIN_BOX_SIDE && height >= MIN_BOX_SIDE
    ? { x, y, width, height }
    : null;
};

const regionsFor = (boxes: NormalizedBox[]) => {
  const valid = boxes.map(clampBox).filter((box): box is NormalizedBox => box !== null);
  return valid.length > 0
    ? valid
    : [{ x: WHOLE_IMAGE_BORDER, y: WHOLE_IMAGE_BORDER, width: 1 - 2 * WHOLE_IMAGE_BORDER, height: 1 - 2 * WHOLE_IMAGE_BORDER }];
};

async function sampleRegion(source: Buffer, sourceWidth: number, sourceHeight: number, box: NormalizedBox): Promise<Sample> {
  const left = Math.min(sourceWidth - 1, Math.round(box.x * sourceWidth));
  const top = Math.min(sourceHeight - 1, Math.round(box.y * sourceHeight));
  const width = Math.max(1, Math.min(sourceWidth - left, Math.round(box.width * sourceWidth)));
  const height = Math.max(1, Math.min(sourceHeight - top, Math.round(box.height * sourceHeight)));
  const { data, info } = await sharp(source)
    .extract({ left, top, width, height })
    .resize({ width: SAMPLE_WIDTH, height: MAX_SAMPLE_HEIGHT, fit: "inside", withoutEnlargement: true, kernel: "mitchell" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h } = info;
  const count = w * h;
  const lab: Lab[] = new Array(count);
  for (let index = 0; index < count; index += 1) {
    lab[index] = rgbToLab([data[index * 3], data[index * 3 + 1], data[index * 3 + 2]]);
  }

  const step = (a: number, b: number) =>
    Math.max(
      Math.abs(data[a * 3] - data[b * 3]),
      Math.abs(data[a * 3 + 1] - data[b * 3 + 1]),
      Math.abs(data[a * 3 + 2] - data[b * 3 + 2]),
    );
  const flat = new Uint8Array(count);
  const ring = new Uint8Array(count);
  const chrome = new Uint8Array(count);
  const ringWidth = Math.max(2, Math.round(Math.min(w, h) * RING_FRACTION));
  const chromeRows = Math.round(h * DEVICE_CHROME_BAND);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const index = y * w + x;
      const isFlat = !(
        (x > 0 && step(index, index - 1) > FLAT_CHANNEL_STEP)
        || (x < w - 1 && step(index, index + 1) > FLAT_CHANNEL_STEP)
        || (y > 0 && step(index, index - w) > FLAT_CHANNEL_STEP)
        || (y < h - 1 && step(index, index + w) > FLAT_CHANNEL_STEP)
      );
      flat[index] = isFlat ? 1 : 0;
      ring[index] = x < ringWidth || y < ringWidth || x >= w - ringWidth || y >= h - ringWidth ? 1 : 0;
      chrome[index] = y < chromeRows ? 1 : 0;
    }
  }
  return { width: w, height: h, lab, flat, ring, chrome };
}

const binKey = (lab: Lab) =>
  (Math.round(lab[0]) + 1000) * 1_000_000 + (Math.round(lab[1]) + 500) * 1000 + (Math.round(lab[2]) + 500);

/** Mean-shift census of the flat pixels: the most common solid colour first, deterministic. */
function findPeaks(samples: Sample[], total: number): Peak[] {
  const pixels: Array<{ lab: Lab; ring: number }> = [];
  for (const sample of samples) {
    for (let index = 0; index < sample.lab.length; index += 1) {
      if (sample.flat[index]) pixels.push({ lab: sample.lab[index], ring: sample.ring[index] });
    }
  }

  const consumed = new Uint8Array(pixels.length);
  const bins = new Map<number, number[]>();
  pixels.forEach((pixel, index) => {
    const key = binKey(pixel.lab);
    const bucket = bins.get(key);
    if (bucket) bucket.push(index);
    else bins.set(key, [index]);
  });

  const floor = Math.max(MIN_PEAK_PIXELS, total * MIN_PEAK_AREA);
  const peaks: Peak[] = [];
  for (let round = 0; round < MAX_PEAKS; round += 1) {
    let bestKey = -1;
    let bestCount = 0;
    for (const [key, bucket] of bins) {
      let live = 0;
      for (const index of bucket) if (!consumed[index]) live += 1;
      if (live > bestCount || (live === bestCount && live > 0 && key < bestKey)) {
        bestCount = live;
        bestKey = key;
      }
    }
    if (bestCount < floor) break;

    const seed = (bins.get(bestKey) ?? []).filter((index) => !consumed[index]);
    let center: Lab = [0, 0, 0];
    for (const index of seed) center = [center[0] + pixels[index].lab[0], center[1] + pixels[index].lab[1], center[2] + pixels[index].lab[2]];
    center = [center[0] / seed.length, center[1] / seed.length, center[2] / seed.length];

    let members: number[] = [];
    for (let pass = 0; pass < 3; pass += 1) {
      members = [];
      let sum: Lab = [0, 0, 0];
      for (let index = 0; index < pixels.length; index += 1) {
        if (consumed[index] || deltaE76(pixels[index].lab, center) > PEAK_RADIUS) continue;
        members.push(index);
        sum = [sum[0] + pixels[index].lab[0], sum[1] + pixels[index].lab[1], sum[2] + pixels[index].lab[2]];
      }
      if (members.length === 0) break;
      center = [sum[0] / members.length, sum[1] / members.length, sum[2] / members.length];
    }
    if (members.length < floor) break;
    let ring = 0;
    for (const index of members) {
      consumed[index] = 1;
      ring += pixels[index].ring;
    }
    peaks.push({ lab: center, count: members.length, ring });
  }
  return peaks;
}

/** Samples the boxes (or the whole image minus a 4% border) and finds their solid colours. */
export async function censusReference(image: Buffer, boxes: NormalizedBox[] = []): Promise<PeakCensus> {
  const working = await sharp(image, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: WORKING_WIDTH, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .png()
    .toBuffer({ resolveWithObject: true });

  const samples: Sample[] = [];
  for (const box of regionsFor(boxes)) {
    samples.push(await sampleRegion(working.data, working.info.width, working.info.height, box));
  }
  const total = samples.reduce((sum, sample) => sum + sample.lab.length, 0);
  const peaks = findPeaks(samples, total);
  if (peaks.length === 0) throw new Error("The reference image has no solid colour areas to measure.");
  return { peaks, total, samples };
}

const isNeutral = (peak: Peak) => labChroma(peak.lab) <= NEUTRAL_CHROMA;

const weightedMean = (peaks: Peak[]): { lab: Lab; count: number } => {
  const count = peaks.reduce((sum, peak) => sum + peak.count, 0);
  const lab = peaks
    .reduce<Lab>((sum, peak) => [sum[0] + peak.lab[0] * peak.count, sum[1] + peak.lab[1] * peak.count, sum[2] + peak.lab[2] * peak.count], [0, 0, 0])
    .map((value) => value / count) as unknown as Lab;
  return { lab, count };
};

/**
 * The darkest colour with a real area below the device chrome: the mean of the
 * darkest pixels. Text is thin and anti-aliased, so it rarely forms a solid
 * peak, but its cores are the darkest pixels on the screen. In a dark theme this
 * is the page itself.
 */
function findInk(samples: Sample[], total: number): { lab: Lab; count: number } {
  const lightness: number[] = [];
  for (const sample of samples) {
    for (let index = 0; index < sample.lab.length; index += 1) {
      if (!sample.chrome[index]) lightness.push(sample.lab[index][0]);
    }
  }
  lightness.sort((a, b) => a - b);
  const wanted = Math.max(MIN_PEAK_PIXELS, Math.round(total * MIN_INK_AREA));
  const ceiling = lightness[Math.min(lightness.length - 1, wanted - 1)] ?? 0;
  let sum: Lab = [0, 0, 0];
  let members = 0;
  for (const sample of samples) {
    for (let index = 0; index < sample.lab.length; index += 1) {
      const lab = sample.lab[index];
      if (sample.chrome[index] || lab[0] > ceiling || members >= wanted) continue;
      sum = [sum[0] + lab[0], sum[1] + lab[1], sum[2] + lab[2]];
      members += 1;
    }
  }
  const lab: Lab = members > 0 ? [sum[0] / members, sum[1] / members, sum[2] / members] : [0, 0, 0];
  let near = 0;
  for (const sample of samples) {
    for (let index = 0; index < sample.lab.length; index += 1) {
      if (!sample.chrome[index] && deltaE76(sample.lab[index], lab) <= INK_RADIUS) near += 1;
    }
  }
  return { lab, count: near };
}

/**
 * How much of the screen the colour's largest connected region spans (0..1),
 * averaged over the sampled screens. A page is one network that runs through
 * every gutter, so it spans nearly the whole screen. A card is a block that
 * does not, whatever its area. This holds whatever the bezel or the box looks
 * like.
 */
export function screenSpan(lab: Lab, samples: Sample[]): number {
  let total = 0;
  for (const sample of samples) {
    const { width, height } = sample;
    const inside = new Uint8Array(sample.lab.length);
    for (let index = 0; index < inside.length; index += 1) {
      inside[index] = deltaE76(sample.lab[index], lab) <= REGION_RADIUS ? 1 : 0;
    }
    const seen = new Uint8Array(inside.length);
    let best = 0;
    for (let start = 0; start < inside.length; start += 1) {
      if (seen[start] || !inside[start]) continue;
      const stack = [start];
      seen[start] = 1;
      let minX = width;
      let maxX = -1;
      let minY = height;
      let maxY = -1;
      while (stack.length > 0) {
        const index = stack.pop() as number;
        const x = index % width;
        const y = (index - x) / width;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const neighbours = [
          x > 0 ? index - 1 : -1,
          x < width - 1 ? index + 1 : -1,
          y > 0 ? index - width : -1,
          y < height - 1 ? index + width : -1,
        ];
        for (const next of neighbours) {
          if (next >= 0 && inside[next] && !seen[next]) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
      best = Math.max(best, ((maxX - minX + 1) / width) * ((maxY - minY + 1) / height));
    }
    total += best;
  }
  return total / samples.length;
}

export function paletteFromCensus({ peaks, total, samples }: PeakCensus): MeasuredPalette {
  const neutrals = peaks.filter(isNeutral);
  const largestSurface = Math.max(0, ...neutrals.map((peak) => peak.count));
  const surfaces = neutrals.filter((peak) => peak.count >= total * MIN_SURFACE_AREA && peak.count >= largestSurface * DOMINANT_SHARE);

  // Theme: the area-weighted lightness of the neutral surfaces, or of every peak without any.
  const themeSource = surfaces.length > 0 ? surfaces : peaks;
  const theme: "light" | "dark" = weightedMean(themeSource).lab[0] >= 50 ? "light" : "dark";
  const lighter = theme === "light" ? 1 : -1;

  let page: Peak;
  let raised: Peak | null = null;
  const spans = new Map<Peak, number>();
  if (surfaces.length === 0) {
    // A coloured page: the most common colour on the outer ring is the page.
    page = [...peaks].sort((a, b) => b.ring - a.ring || b.count - a.count)[0];
  } else {
    for (const peak of neutrals) spans.set(peak, screenSpan(peak.lab, samples));
    // The page spans the screen. Weighted by how close its tone is to the extreme surface tone
    // (the lightest in light themes, the darkest in dark ones), so a backdrop that only wraps
    // around a device mockup does not win.
    const extreme = surfaces.reduce((best, peak) => (lighter * (peak.lab[0] - best.lab[0]) > 0 ? peak : best), surfaces[0]);
    const score = (peak: Peak) =>
      (spans.get(peak) ?? 0) / (1 + ((peak.lab[0] - extreme.lab[0]) / PAGE_TONE_SCALE) ** 2);
    page = [...surfaces].sort((a, b) => score(b) - score(a) || b.count - a.count)[0];
    // Cards are lighter than the page (also in dark themes): the most common surface above it.
    raised = surfaces
      .filter((peak) => peak !== page
        && peak.lab[0] - page.lab[0] >= RAISED_MIN_DELTA_L
        && peak.lab[0] - page.lab[0] <= RAISED_MAX_DELTA_L)
      .sort((a, b) => b.count - a.count)[0] ?? null;
  }

  // A page that is a gradient is several tones that all span the screen: measure their middle.
  const family = neutrals.filter((peak) =>
    peak === page
    || (peak !== raised
      && peak.count >= page.count * PAGE_FAMILY_MIN_SHARE
      && (spans.get(peak) ?? 0) >= PAGE_FAMILY_MIN_SPAN
      && deltaE2000(peak.lab, page.lab) <= PAGE_FAMILY_DELTA_E
      && (raised === null || peak.lab[0] < raised.lab[0])));
  const background = weightedMean(family);

  // Inset: a neutral between the page and the card, or just below the page; distinct from both.
  const raisedLab = raised?.lab ?? null;
  const inset = neutrals
    .filter((peak) =>
      peak !== raised
      && peak.count >= total * MIN_PEAK_AREA * 4
      && deltaE2000(peak.lab, background.lab) >= MIN_INSET_DELTA_E
      && (raisedLab === null || deltaE2000(peak.lab, raisedLab) >= MIN_INSET_DELTA_E)
      && (theme === "light"
        ? peak.lab[0] <= (raisedLab?.[0] ?? background.lab[0]) + 0.5 && peak.lab[0] >= background.lab[0] - INSET_MAX_STEP_BELOW
        : peak.lab[0] >= background.lab[0] && peak.lab[0] <= (raisedLab?.[0] ?? background.lab[0]) + 10))
    .sort((a, b) => b.count - a.count)[0] ?? null;

  // Accents: saturated solid colours. Near-identical tones (the ends of a gradient) are one
  // family and pool their area, so a gradient cannot hide a colour that is used as a fill.
  const families: Array<{ peak: Peak; count: number }> = [];
  for (const peak of peaks
    .filter((candidate) => labChroma(candidate.lab) >= ACCENT_CHROMA)
    .sort((a, b) => b.count * labChroma(b.lab) - a.count * labChroma(a.lab))) {
    const existing = families.find((family) => deltaE2000(peak.lab, family.peak.lab) < MERGE_ACCENT_DELTA_E);
    if (existing) existing.count += peak.count;
    else families.push({ peak, count: peak.count });
  }
  const accents = families
    .sort((a, b) => b.count * labChroma(b.peak.lab) - a.count * labChroma(a.peak.lab))
    .slice(0, 4);

  const ink = findInk(samples, total);

  return {
    theme,
    background: colorOf(background.lab, background.count, total),
    raised: raised ? colorOf(raised.lab, raised.count, total) : null,
    inset: inset ? colorOf(inset.lab, inset.count, total) : null,
    accents: accents.map((family) => colorOf(family.peak.lab, family.count, total)),
    ink: colorOf(ink.lab, ink.count, total),
  };
}

export async function measureReferencePalette(image: Buffer, boxes: NormalizedBox[] = []): Promise<MeasuredPalette> {
  return paletteFromCensus(await censusReference(image, boxes));
}
