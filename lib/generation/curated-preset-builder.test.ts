// @vitest-environment node
import { readFile } from "node:fs/promises";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import {
  buildCuratedPreset,
  cropToBox,
  pickSpecimenScreen,
  PresetBuildError,
  type PresetBuildDeps,
} from "@/lib/generation/curated-preset-builder";
import {
  PRESET_REFERENCE_ID,
  presetAnalysis,
  presetFixture,
  presetNavigation,
  presetReference,
  presetTokens,
} from "@/lib/generation/curated-style-preset-fixtures";
import {
  curatedStylePresetSchema,
  curatedStyleEntryHash,
  serializeCuratedPresets,
  withCuratedPreset,
  withCuratedPresetApproval,
} from "@/lib/generation/curated-style-presets";
import { hexDeltaE } from "@/lib/color-lab";
import type { ReferenceAnalysis, ReferenceAnalysisResult } from "@/lib/types";

const phoneBoxes = [
  { x: 0.05, y: 0.137, width: 0.264, height: 0.761 },
  { x: 0.354, y: 0.105, width: 0.292, height: 0.776 },
  { x: 0.687, y: 0.137, width: 0.263, height: 0.761 },
];

const referenceImage = async () => {
  const bytes = await readFile(new URL("./__fixtures__/mindfulness-meditation-beige-light.jpg", import.meta.url));
  return { data: bytes.toString("base64"), mimeType: "image/jpeg" };
};

const completeAnalysis = (): ReferenceAnalysis => {
  const analysis = presetAnalysis() as unknown as ReferenceAnalysis;
  return {
    ...analysis,
    // the second phone has the most components, so it is the specimen
    screenReferences: analysis.screenReferences.map((screen, index) => ({
      ...screen,
      boundingBox: phoneBoxes[index],
      components: index === 1 ? [...screen.components, "Mood chips", "Streak badge"] : screen.components,
    })),
    primaryNavigation: presetNavigation(),
  };
};

const fullResult = (analysis: ReferenceAnalysis = completeAnalysis()): ReferenceAnalysisResult => ({
  analysis,
  screenCountEstimate: analysis.screenCountEstimate,
  screenReferenceCount: analysis.screenReferences.length,
  confidence: "high",
  source: "full_analysis",
  diagnostics: [],
  validationIssues: [],
});

const specimenHtml = `<div class="w-full min-h-screen dg-bg-primary">
  <div data-dg-component="calendar-strip" data-dg-use="a week selector" class="dg-surface-card dg-radius-app flex p-3"><span class="dg-tint-1">Mon</span></div>
  <div data-dg-component="stat-tile-pair" data-dg-use="two counts" class="grid grid-cols-2"><div class="dg-surface-inset">3</div><div class="dg-surface-inset">2</div></div>
  <div data-dg-component="mood-chips" data-dg-use="pick how you feel" class="flex gap-2"><span class="dg-tint-2 dg-radius-pill px-3">Calm</span></div>
  <div data-dg-component="donut-card" data-dg-use="one progress figure" class="dg-surface-card dg-radius-app p-4"><svg viewBox="0 0 10 10"><circle r="4"></circle></svg></div>
  <nav data-dg-component="bottom-tab-bar" class="fixed bottom-0"><i data-lucide="home"></i></nav>
</div>`;

const deps = (overrides: Partial<PresetBuildDeps> = {}): PresetBuildDeps & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    analyze: vi.fn(async () => { calls.push("analyze"); return fullResult(); }),
    generateTokens: vi.fn(async () => { calls.push("tokens"); return presetTokens(); }),
    buildSpecimen: vi.fn(async () => { calls.push("specimen"); return specimenHtml; }),
    ...overrides,
  };
};

const build = async (overrides: Partial<PresetBuildDeps> = {}) => {
  const stubs = deps(overrides);
  const result = await buildCuratedPreset({ reference: presetReference(), image: await referenceImage(), deps: stubs, builtAt: "2026-09-29T12:00:00.000Z" });
  return { result, stubs };
};

const refusal = async (overrides: Partial<PresetBuildDeps>) => {
  const stubs = deps(overrides);
  try {
    await buildCuratedPreset({ reference: presetReference(), image: await referenceImage(), deps: stubs });
  } catch (error) {
    expect(error).toBeInstanceOf(PresetBuildError);
    return { error: error as PresetBuildError, stubs };
  }
  throw new Error("The build was expected to refuse.");
};

describe("buildCuratedPreset", () => {
  it("builds an unapproved preset of the reference from a full analysis, its pixels, tokens and a specimen", async () => {
    const { result, stubs } = await build();
    const { preset } = result;

    expect(stubs.calls).toEqual(["analyze", "tokens", "specimen"]);
    expect(curatedStylePresetSchema.safeParse(JSON.parse(JSON.stringify(preset))).success).toBe(true);
    expect(preset.approved).toBe(false);
    expect(preset.catalogHash).toBe(curatedStyleEntryHash(presetReference()));
    expect(preset.builtAt).toBe("2026-09-29T12:00:00.000Z");
    expect(preset.sourceImageSha256).toMatch(/^[0-9a-f]{64}$/);
    // the palette is measured from the pixels, on the analysis's boxes
    expect(preset.measured.theme).toBe("light");
    expect(hexDeltaE(preset.measured.background.hex, "#ECE9D6")).toBeLessThan(4);
    // the analysis is the model's, with the navigation evidence in both places
    expect(preset.analysis.screenReferences).toHaveLength(3);
    expect(preset.analysis.primaryNavigation).toEqual(preset.navigation);
    expect(preset.navigation).toMatchObject({ anatomy: "fixed-tab-rail" });
    expect(preset.tokens.tokens?.radii?.app).toBe("20px");
  });

  it("makes the specimen of the phone with the most components, cropped out of the reference", async () => {
    const { result, stubs } = await build();
    expect(result.specimen).toMatchObject({ screenIndex: 2, screenName: "History" });
    const call = (stubs.buildSpecimen as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.screen.index).toBe(2);
    const cropped = await sharp(Buffer.from(call.image.data, "base64")).metadata();
    // 0.292 x 0.776 of a 1200x900 image, plus a hair of margin
    expect(cropped.width).toBeGreaterThan(340);
    expect(cropped.width).toBeLessThan(370);
    expect(cropped.height).toBeGreaterThan(690);
    expect(cropped.height).toBeLessThan(710);
    expect(cropped.format).toBe("png");
    expect(call.tokens.tokens.radii.app).toBe("20px");
  });

  it("reads the components out of the specimen, and leaves the navigation to the renderer", async () => {
    const { result } = await build();
    expect(result.preset.components.map((component) => component.name)).toEqual(["calendar-strip", "stat-tile-pair", "mood-chips", "donut-card"]);
    expect(result.skipped).toEqual([{ name: "bottom-tab-bar", reason: expect.stringContaining("drawn by the renderer") }]);
    expect(result.notes.join("\n")).toContain("skipped bottom-tab-bar");
    expect(result.specimen.html).toContain("data-dg-component");
  });

  it("carries no navigation for a reference that shows none, and says so", async () => {
    const analysis = { ...completeAnalysis(), primaryNavigation: { ...presetNavigation(), present: false } };
    const { result } = await build({ analyze: async () => fullResult(analysis) });
    expect(result.preset.navigation).toBeNull();
    expect(result.preset.analysis.primaryNavigation).toBeNull();
    expect(result.notes).toContain("the reference shows no persistent navigation");
  });

  it("notes a specimen with few components", async () => {
    const { result } = await build({ buildSpecimen: async () => specimenHtml.split("\n").slice(0, 3).join("\n") + "</div>" });
    expect(result.preset.components).toHaveLength(2);
    expect(result.notes.join("\n")).toContain("only 2 components were marked");
  });
});

describe("what the build refuses", () => {
  const stops = (stage: PresetBuildError["stage"], text: RegExp) => ({ stage, text });

  it.each([
    ["a salvaged analysis", { ...fullResult(), source: "salvaged_analysis" as const }, stops("analysis", /not a full one/)],
    ["an analysis that counts three phones and describes two", (() => {
      const analysis = completeAnalysis();
      return fullResult({ ...analysis, screenReferences: analysis.screenReferences.slice(0, 2) });
    })(), stops("analysis", /counts 3 phones and describes 2/)],
    ["a screen without a box", (() => {
      const analysis = completeAnalysis();
      return fullResult({ ...analysis, screenReferences: analysis.screenReferences.map((screen, index) => (index === 1 ? { ...screen, boundingBox: null } : screen)) });
    })(), stops("analysis", /screen 2 has no bounding box/)],
    ["an analysis that does not classify the radius", fullResult({ ...completeAnalysis(), radiusClass: null }), stops("analysis", /does not classify the card radius/)],
    ["an analysis that does not classify the elevation", fullResult({ ...completeAnalysis(), surfaceElevation: undefined }), stops("analysis", /does not classify how cards separate/)],
    ["an analysis with validation issues", { ...fullResult(), validationIssues: ["screenCountEstimate must equal the number of screenReferences entries."] }, stops("analysis", /screenCountEstimate must equal/)],
    ["no analysis at all", { ...fullResult(), analysis: null, source: "none" as const }, stops("analysis", /no analysis came back/)],
  ])("%s, before it spends anything else", async (_label, result, expected) => {
    const { error, stubs } = await refusal({ analyze: async () => result });
    expect(error.stage).toBe(expected.stage);
    expect(error.message).toMatch(expected.text);
    expect(error.message).toContain("nothing is salvaged");
    expect(stubs.generateTokens).not.toHaveBeenCalled();
    expect(stubs.buildSpecimen).not.toHaveBeenCalled();
  });

  it("a specimen in which nothing usable was marked", async () => {
    const { error } = await refusal({ buildSpecimen: async () => '<div class="p-4">Plain screen</div>' });
    expect(error.stage).toBe("specimen");
    expect(error.message).toContain("marked no usable component");
  });

  it("tokens that are not a calibrated set", async () => {
    const { error } = await refusal({ generateTokens: async () => ({ ...presetTokens(), tokens: { ...presetTokens().tokens, radii: { app: "32px", inner: "20px", pill: "9999px" } } }) });
    expect(error.stage).toBe("preset");
    expect(error.message).toContain("tokens");
  });

  it("a palette that cannot be measured", async () => {
    const stubs = deps();
    const failing = await buildCuratedPreset({
      reference: presetReference(), image: { data: Buffer.from("not an image").toString("base64"), mimeType: "image/png" }, deps: stubs,
    }).catch((error: unknown) => error);
    expect(failing).toBeInstanceOf(PresetBuildError);
    expect((failing as PresetBuildError).stage).toBe("palette");
    expect(stubs.generateTokens).not.toHaveBeenCalled();
  });
});

describe("choosing and cropping the specimen phone", () => {
  const screen = (index: number, components: number, area: number) => ({
    ...(presetAnalysis().screenReferences[0] as object), index, suggestedRole: `Screen ${index}`,
    components: Array.from({ length: components }, (_, item) => `c${item}`), boundingBox: { x: 0, y: 0, width: area, height: 1 },
  });
  const analysisOf = (screens: unknown[]) => ({ ...completeAnalysis(), screenReferences: screens }) as unknown as ReferenceAnalysis;

  it("prefers the most components, then the larger phone, then the first", () => {
    expect(pickSpecimenScreen(analysisOf([screen(1, 3, 0.3), screen(2, 5, 0.2), screen(3, 4, 0.4)])).index).toBe(2);
    expect(pickSpecimenScreen(analysisOf([screen(1, 4, 0.2), screen(2, 4, 0.3), screen(3, 4, 0.25)])).index).toBe(2);
    expect(pickSpecimenScreen(analysisOf([screen(1, 4, 0.3), screen(2, 4, 0.3)])).index).toBe(1);
  });

  it("crops a box out of the image and never past its edges", async () => {
    const image = await referenceImage();
    const inside = await sharp(Buffer.from((await cropToBox(image, { x: 0.25, y: 0.25, width: 0.5, height: 0.5 })).data, "base64")).metadata();
    expect([inside.width, inside.height]).toEqual([612, 460]);
    const edge = await sharp(Buffer.from((await cropToBox(image, { x: 0.9, y: 0.9, width: 0.2, height: 0.2 })).data, "base64")).metadata();
    // the box runs past the edge of the image, so the crop stops at the edge
    expect([edge.width, edge.height]).toEqual([126, 95]);
    await expect(cropToBox(image, { x: 0.5, y: 0.5, width: 0.001, height: 0.001 })).rejects.toThrow("too small");
  });
});

describe("the presets file", () => {
  const fresh = () => presetFixture({ approved: false });

  it("writes a new build unapproved, replacing one that was approved", () => {
    const written = withCuratedPreset({ [PRESET_REFERENCE_ID]: presetFixture({ approved: true }), other: { keep: true } }, PRESET_REFERENCE_ID, presetFixture({ approved: true }));
    expect((written[PRESET_REFERENCE_ID] as { approved: boolean }).approved).toBe(false);
    expect(written.other).toEqual({ keep: true });
    expect(withCuratedPreset(null, PRESET_REFERENCE_ID, fresh())).toHaveProperty(PRESET_REFERENCE_ID);
  });

  it("approves a preset that is complete and built from the entry as it is now", () => {
    const approved = withCuratedPresetApproval({ [PRESET_REFERENCE_ID]: fresh() }, PRESET_REFERENCE_ID);
    expect((approved[PRESET_REFERENCE_ID] as { approved: boolean }).approved).toBe(true);
  });

  it("refuses to approve what is missing, malformed, stale or unknown", () => {
    expect(() => withCuratedPresetApproval({}, PRESET_REFERENCE_ID)).toThrow("There is no preset");
    expect(() => withCuratedPresetApproval({ [PRESET_REFERENCE_ID]: { ...fresh(), tokens: {} } }, PRESET_REFERENCE_ID)).toThrow("malformed");
    expect(() => withCuratedPresetApproval({ [PRESET_REFERENCE_ID]: presetFixture({ approved: false, catalogHash: "a".repeat(64) }) }, PRESET_REFERENCE_ID)).toThrow("older version");
    expect(() => withCuratedPresetApproval({ nope: fresh() }, "nope")).toThrow("not in the curated style catalogue");
  });

  it("is written with its keys in order and a final newline", () => {
    const text = serializeCuratedPresets({ zebra: 1, alpha: { b: 2, a: 1 }, mid: 3 });
    expect(text.endsWith("}\n")).toBe(true);
    expect(Object.keys(JSON.parse(text))).toEqual(["alpha", "mid", "zebra"]);
    expect(serializeCuratedPresets(null)).toBe("{}\n");
  });
});
