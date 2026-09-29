// @vitest-environment node
import { readFile } from "node:fs/promises";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import {
  buildCuratedPreset,
  cropToBox,
  MAX_SPECIMEN_PHONES,
  pickSpecimenScreen,
  PresetBuildError,
  rebuildPresetComponents,
  specimenScreens,
  type PresetBuildDeps,
} from "@/lib/generation/curated-preset-builder";
import {
  PRESET_REFERENCE_ID,
  presetAnalysis,
  presetComponents,
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

    expect(stubs.calls).toEqual(["analyze", "tokens", "specimen", "specimen", "specimen"]);
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

  it("rebuilds every phone, the one with the most components first, each cropped out of the reference", async () => {
    const { result, stubs } = await build();
    expect(result.specimens.map((specimen) => [specimen.screenIndex, specimen.screenName])).toEqual([[2, "History"], [1, "Dashboard"], [3, "Profile"]]);
    // the builds run side by side, so the calls are found by phone and not by their order
    const calls = (stubs.buildSpecimen as ReturnType<typeof vi.fn>).mock.calls.map(([input]) => input);
    expect(calls.map((input) => input.screen.index).sort()).toEqual([1, 2, 3]);
    const call = calls.find((input) => input.screen.index === 2);
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
    expect(result.notes.join("\n")).toContain("phone 2: skipped bottom-tab-bar");
    expect(result.specimens[0].html).toContain("data-dg-component");
  });

  it("learns from every phone, richest first, and keeps one component of each name", async () => {
    const perPhone: Record<number, string> = {
      2: specimenHtml,
      1: `<div class="p-4">
        <div data-dg-component="stat-tile-pair" data-dg-use="another take on the pair" class="grid"><div class="dg-surface-inset">9</div></div>
        <div data-dg-component="media-card" data-dg-use="a featured item with a play button" class="dg-surface-card dg-radius-app p-4"><button class="dg-action-primary dg-radius-pill">Play</button></div>
      </div>`,
      3: '<div data-dg-component="list-row" data-dg-use="one row of a list" class="dg-surface-card dg-radius-inner flex p-3"><span>Row</span></div>',
    };
    const { result } = await build({ buildSpecimen: async ({ screen }) => perPhone[screen.index] });
    expect(result.preset.components.map((component) => component.name)).toEqual(["calendar-strip", "stat-tile-pair", "mood-chips", "donut-card", "media-card", "list-row"]);
    // the richest phone's version of a component is the one kept
    expect(result.preset.components.find((component) => component.name === "stat-tile-pair")?.use).toBe("two counts");
  });

  it("leaves out a phone whose build fails and says which, and keeps what the others gave", async () => {
    const { result } = await build({
      buildSpecimen: async ({ screen }) => {
        if (screen.index === 1) throw new Error("provider said: key sk-secret was refused");
        return specimenHtml;
      },
    });
    expect(result.specimens.map((specimen) => specimen.screenIndex)).toEqual([2, 3]);
    expect(result.notes).toContain("the build of phone 1 (Dashboard) failed and is left out");
    // a provider's error text can carry request details, so none of it is kept
    expect(result.notes.join("\n")).not.toContain("sk-secret");
    expect(result.preset.components).toHaveLength(4);
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

  it("specimens in which nothing usable was marked", async () => {
    const { error } = await refusal({ buildSpecimen: async () => '<div class="p-4">Plain screen</div>' });
    expect(error.stage).toBe("specimen");
    expect(error.message).toContain("marked no usable component");
  });

  it("phone builds that all fail", async () => {
    const { error } = await refusal({ buildSpecimen: async () => { throw new Error("quota exceeded"); } });
    expect(error.stage).toBe("specimen");
    expect(error.message).toContain("none of the 3 phone builds succeeded");
    expect(error.message).not.toContain("quota");
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

  it("learns from the richest phones, at most four, and from none that has no box", () => {
    const analysis = analysisOf([
      screen(1, 3, 0.3), screen(2, 5, 0.2), screen(3, 4, 0.4), screen(4, 2, 0.4), screen(5, 6, 0.1),
      { ...screen(6, 9, 0.5), boundingBox: null },
    ]);
    expect(specimenScreens(analysis).map((phone) => phone.index)).toEqual([5, 2, 3, 1]);
    expect(specimenScreens(analysis)).toHaveLength(MAX_SPECIMEN_PHONES);
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

describe("making the components of a built preset again", () => {
  it("replaces the components and nothing else, and leaves the preset unapproved", async () => {
    const stubs = deps();
    const preset = presetFixture({ approved: true, components: presetComponents().slice(0, 1) });
    const result = await rebuildPresetComponents({
      reference: presetReference(), image: await referenceImage(), preset, deps: stubs, builtAt: "2026-09-30T08:00:00.000Z",
    });
    // a build for each phone, and no analysis and no tokens: those are kept as they were
    expect(stubs.calls).toEqual(["specimen", "specimen", "specimen"]);
    expect(result.preset.approved).toBe(false);
    expect(result.preset.builtAt).toBe("2026-09-30T08:00:00.000Z");
    expect(result.preset.components.map((component) => component.name)).toEqual(["calendar-strip", "stat-tile-pair", "mood-chips", "donut-card"]);
    expect(result.preset.analysis).toEqual(preset.analysis);
    expect(result.preset.measured).toEqual(preset.measured);
    expect(result.preset.tokens).toEqual(preset.tokens);
    expect(result.preset.navigation).toEqual(preset.navigation);
    expect(result.specimens).toHaveLength(3);
  });

  it("refuses a preset built from an older version of the catalogue entry", async () => {
    await expect(rebuildPresetComponents({
      reference: presetReference(), image: await referenceImage(), preset: presetFixture({ catalogHash: "a".repeat(64) }), deps: deps(),
    })).rejects.toThrow("older version");
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
