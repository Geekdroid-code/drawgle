// @vitest-environment node
import { readFile } from "node:fs/promises";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { presetAnalysis, presetNavigation } from "@/lib/generation/curated-style-preset-fixtures";
import {
  consensus,
  focusCrop,
  NAVIGATION_QUESTION,
  parseNavigationRead,
  parseTypefaceRead,
  refineAnalysisFromCrops,
  TYPEFACE_QUESTION,
  type FocusAsk,
} from "@/lib/generation/reference-focus";
import type { ReferenceAnalysis } from "@/lib/types";

const referenceImage = async () => {
  const bytes = await readFile(new URL("./__fixtures__/mindfulness-meditation-beige-light.jpg", import.meta.url));
  return { data: bytes.toString("base64"), mimeType: "image/jpeg" };
};

/** The three phones of the mindfulness reference, whose bar the first reads took for a floating capsule. */
const misreadAnalysis = (): ReferenceAnalysis => ({
  ...(presetAnalysis() as unknown as ReferenceAnalysis),
  designSystemSignals: {
    ...(presetAnalysis().designSystemSignals as unknown as ReferenceAnalysis["designSystemSignals"]),
    typography: "A mix of a high-contrast, elegant serif for headlines and a clean sans-serif for body text.",
  },
  primaryNavigation: {
    ...presetNavigation(),
    anatomy: "floating-dock", width: "inset", corners: null, itemCount: 0, items: [], activeTreatment: null,
    geometry: "Floating capsule inset from the screen edges", safeAreaRelationship: "Floating 20pt above the bottom edge",
  },
});

const sansRead = { headingClass: "sans", kind: "geometric", bodyClass: "sans", sameTypefaceForBody: true, weights: "a light word beside a bold word" };
const attachedRead = {
  present: true, attachment: "attached", topCorners: "rounded", itemCount: 5, icons: ["house", "lightning", "trophy", "music", "user"],
  labels: "hidden", activeTreatment: "icon-fill", inactiveTreatment: "plain", activeFill: "gradient", material: "glass",
  geometry: "A full-width bar with rounded top corners attached to the bottom edge",
};

/** A model that answers the two questions from scripts, one answer for each phone in turn. */
const asker = (typefaces: unknown[], navigations: unknown[]) => {
  const seen = { typeface: 0, navigation: 0 };
  const ask: FocusAsk = vi.fn(async ({ instruction }) => {
    if (instruction === TYPEFACE_QUESTION) {
      const answer = typefaces[seen.typeface % typefaces.length];
      seen.typeface += 1;
      if (answer instanceof Error) throw answer;
      return answer;
    }
    const answer = navigations[seen.navigation % navigations.length];
    seen.navigation += 1;
    if (answer instanceof Error) throw answer;
    return answer;
  });
  return ask;
};

describe("reading the answers", () => {
  it("takes a typeface answer as the model wrote it, and none that names no class", () => {
    expect(parseTypefaceRead(sansRead)).toEqual({ headingClass: "sans", kind: "geometric", bodyClass: "sans", sameTypeface: true, weights: "a light word beside a bold word" });
    expect(parseTypefaceRead({ headingClass: "Sans-Serif" })?.headingClass).toBe("sans");
    expect(parseTypefaceRead({ headingClass: "elegant" })).toBeNull();
    expect(parseTypefaceRead("sans")).toBeNull();
    expect(parseTypefaceRead(null)).toBeNull();
  });

  it("takes a bar answer, keeping only what is one of the allowed words", () => {
    expect(parseNavigationRead(attachedRead)).toMatchObject({ present: true, attachment: "attached", topCorners: "rounded", itemCount: 5, labels: "hidden", activeFill: "gradient" });
    expect(parseNavigationRead({ present: false })).toMatchObject({ present: false, attachment: null, itemCount: null });
    expect(parseNavigationRead({ present: true, attachment: "hovering", itemCount: 9, material: "wood" })).toMatchObject({ attachment: null, itemCount: 5, material: null });
    expect(parseNavigationRead([])).toBeNull();
  });

  it("finds what more than half of the answers agree on, and nothing when they split", () => {
    expect(consensus(["sans", "sans", "serif"])).toBe("sans");
    expect(consensus(["sans"])).toBe("sans");
    expect(consensus(["sans", "serif"])).toBeNull();
    expect(consensus(["sans", null, undefined, "sans"])).toBe("sans");
    expect(consensus([null, undefined])).toBeNull();
    expect(consensus([])).toBeNull();
  });
});

describe("the close-ups", () => {
  it("cut the top and the bottom of a phone, and enlarge them so that letters and edges can be read", async () => {
    const image = await referenceImage();
    const box = { x: 0.05, y: 0.137, width: 0.264, height: 0.761 };
    const top = await sharp(Buffer.from((await focusCrop(image, box, "top")).data, "base64")).metadata();
    const bottom = await sharp(Buffer.from((await focusCrop(image, box, "bottom")).data, "base64")).metadata();
    expect(top.width).toBe(900);
    expect(bottom.width).toBe(900);
    // the phone is 317 x 685 px in the image: its top 40% is wider than tall once cropped, its bottom 22% much wider
    expect(top.height! / top.width!).toBeGreaterThan(0.8);
    expect(top.height! / top.width!).toBeLessThan(1.1);
    expect(bottom.height! / bottom.width!).toBeGreaterThan(0.4);
    expect(bottom.height! / bottom.width!).toBeLessThan(0.6);
  });
});

describe("refining an analysis from the close-ups", () => {
  it("corrects a typeface and an attached bar that the first read got wrong, when the phones agree", async () => {
    const analysis = misreadAnalysis();
    const ask = asker([sansRead], [attachedRead]);
    const { analysis: refined, notes } = await refineAnalysisFromCrops({ image: await referenceImage(), analysis, ask });

    expect(refined.typefaceClass).toBe("sans");
    expect(refined.designSystemSignals.typography).toBe("Geometric sans-serif headings, and the smaller text is set in the same typeface in other weights. A light word may sit beside a bold one in a heading: that is one typeface in two weights.");
    expect(refined.designSystemSignals.typography).not.toMatch(/serif for headlines/);

    expect(refined.primaryNavigation).toMatchObject({
      present: true, anatomy: "fixed-tab-rail", width: "full", corners: "rounded", itemCount: 5, labels: "hidden",
      activeTreatment: "icon-fill", inactiveTreatment: "plain", activeFill: "gradient", material: "glass", repeatedAcrossScreens: true,
    });
    expect(refined.primaryNavigation?.items.map((item) => item.icon)).toEqual(["house", "lightning", "trophy", "music", "user"]);
    expect(refined.primaryNavigation?.geometry).toContain("rounded top corners");
    expect(refined.primaryNavigation?.safeAreaRelationship).toBe("Attached to the bottom edge of the screen.");

    expect(notes).toContain("headings: sans-serif (3 of 3 phones)");
    expect(notes).toContain("bottom bar: attached with rounded top corners, 5 icons (3 of 3 phones); the first read said floating-dock");
    // everything else in the analysis is as it was
    expect(refined.screenReferences).toBe(analysis.screenReferences);
    expect(refined.radiusClass).toBe(analysis.radiusClass);
  });

  it("asks two questions of each phone, a close-up of its top and of its bottom", async () => {
    const ask = asker([sansRead], [attachedRead]);
    await refineAnalysisFromCrops({ image: await referenceImage(), analysis: misreadAnalysis(), ask });
    const calls = (ask as ReturnType<typeof vi.fn>).mock.calls.map(([request]) => request as { instruction: string; image: { data: string } });
    expect(calls).toHaveLength(6);
    expect(calls.filter((call) => call.instruction === TYPEFACE_QUESTION)).toHaveLength(3);
    expect(calls.filter((call) => call.instruction === NAVIGATION_QUESTION)).toHaveLength(3);
    expect(new Set(calls.map((call) => call.image.data)).size).toBe(6);
  });

  it("goes with the majority of the phones, and says how many", async () => {
    const serif = { ...sansRead, headingClass: "serif", kind: "transitional" };
    const { analysis: refined, notes } = await refineAnalysisFromCrops({
      image: await referenceImage(), analysis: misreadAnalysis(), ask: asker([sansRead, serif, sansRead], [attachedRead]),
    });
    expect(refined.typefaceClass).toBe("sans");
    expect(notes).toContain("headings: sans-serif (2 of 3 phones)");
  });

  it("leaves the first read alone when the phones split, or when nothing answers", async () => {
    const analysis = misreadAnalysis();
    const twoPhones = { ...analysis, screenReferences: analysis.screenReferences.slice(0, 2) };
    const split = await refineAnalysisFromCrops({
      image: await referenceImage(), analysis: twoPhones, ask: asker([sansRead, { ...sansRead, headingClass: "serif" }], [attachedRead, { ...attachedRead, attachment: "floating" }]),
    });
    expect(split.analysis.typefaceClass).toBeUndefined();
    expect(split.analysis.designSystemSignals.typography).toBe(analysis.designSystemSignals.typography);
    expect(split.analysis.primaryNavigation?.anatomy).toBe("floating-dock");
    expect(split.notes).toContain("headings: the phones disagree, so the first read stands");
    expect(split.notes.join(" ")).toContain("the phones disagree about whether it is attached");

    const silent = await refineAnalysisFromCrops({ image: await referenceImage(), analysis, ask: asker([new Error("provider key sk-secret")], [new Error("quota")]) });
    expect(silent.analysis).toBe(analysis);
    expect(silent.notes).toEqual(["headings: no close-up gave an answer, so the first read stands", "bottom bar: no close-up gave an answer, so the first read stands"]);
    expect(silent.notes.join(" ")).not.toContain("sk-secret");
  });

  it("keeps a floating bar floating, and makes it inset with no top corners", async () => {
    const floating = { ...attachedRead, attachment: "floating", topCorners: "rounded", geometry: "A capsule inset from both sides" };
    const { analysis: refined, notes } = await refineAnalysisFromCrops({ image: await referenceImage(), analysis: misreadAnalysis(), ask: asker([sansRead], [floating]) });
    expect(refined.primaryNavigation).toMatchObject({ anatomy: "floating-dock", width: "inset", corners: null, itemCount: 5 });
    expect(refined.primaryNavigation?.geometry).toBe("A capsule inset from both sides");
    expect(notes.join(" ")).toContain("bottom bar: floating, 5 icons (3 of 3 phones)");
  });

  it("does not invent a bar that the close-ups do not show", async () => {
    const analysis = { ...misreadAnalysis(), primaryNavigation: null };
    const { analysis: refined } = await refineAnalysisFromCrops({ image: await referenceImage(), analysis, ask: asker([sansRead], [{ present: false }]) });
    expect(refined.primaryNavigation).toBeNull();
  });

  it("makes a bar of its own when the first read found none and the close-ups show one", async () => {
    const analysis = { ...misreadAnalysis(), primaryNavigation: null };
    const { analysis: refined } = await refineAnalysisFromCrops({ image: await referenceImage(), analysis, ask: asker([sansRead], [attachedRead]) });
    expect(refined.primaryNavigation).toMatchObject({ present: true, anatomy: "fixed-tab-rail", itemCount: 5 });
  });

  it("asks nothing of an analysis with no phone box, and looks at four phones at most", async () => {
    const boxless = { ...misreadAnalysis(), screenReferences: misreadAnalysis().screenReferences.map((screen) => ({ ...screen, boundingBox: undefined })) } as unknown as ReferenceAnalysis;
    const ask = asker([sansRead], [attachedRead]);
    const result = await refineAnalysisFromCrops({ image: await referenceImage(), analysis: boxless, ask });
    expect(ask).not.toHaveBeenCalled();
    expect(result.notes).toEqual(["no phone has a box to look at closely"]);

    const many = misreadAnalysis();
    many.screenReferences = Array.from({ length: 6 }, (_, index) => ({ ...many.screenReferences[0], index: index + 1 }));
    const askMany = asker([sansRead], [attachedRead]);
    await refineAnalysisFromCrops({ image: await referenceImage(), analysis: many, ask: askMany });
    expect(askMany).toHaveBeenCalledTimes(8);
  });

  it("leaves the analysis it was given as it was", async () => {
    const analysis = misreadAnalysis();
    const before = JSON.stringify(analysis);
    await refineAnalysisFromCrops({ image: await referenceImage(), analysis, ask: asker([sansRead], [attachedRead]) });
    expect(JSON.stringify(analysis)).toBe(before);
  });
});
