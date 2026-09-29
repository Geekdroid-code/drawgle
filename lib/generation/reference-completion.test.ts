import { describe, expect, it, vi } from "vitest";

import type { PromptImagePayload, ReferenceAnalysis, ReferenceAnalysisResult, ReferenceScreenAnalysis } from "@/lib/types";

import {
  MAX_COMPLETED_SCREENS,
  completeReferenceAnalysis,
  missingScreenIndexes,
  needsCompletion,
  type ReferenceCompletionDeps,
} from "./reference-completion";

const image: PromptImagePayload = { data: "d2hvbGU=", mimeType: "image/png" };
const box = (x: number, width = 0.28) => ({ x, y: 0.1, width, height: 0.8 });

const screen = (index: number, withBox = true): ReferenceScreenAnalysis => ({
  index, suggestedRole: `Screen ${index}`, layoutSummary: `Layout ${index}`, visualHierarchy: `Hierarchy ${index}`,
  components: [`Component ${index}`], stylingCues: ["cream cards"], interactionCues: [], copyPatterns: [], implementationNotes: [],
  ...(withBox ? { boundingBox: box(0.05 + (index - 1) * 0.33) } : {}),
} as ReferenceScreenAnalysis);

/** What normalisation gives for an image the model counted at `count` screens and described in part. */
const salvaged = (count: number, described: ReferenceScreenAnalysis[], provided = described.length): ReferenceAnalysisResult => ({
  analysis: {
    overallVisualStyle: "Warm and tonal", screenCountEstimate: count, radiusClass: "very-rounded", surfaceElevation: "flat-tone",
    // with none described, a salvage fills in a placeholder for every counted screen
    screenReferences: described.length > 0 ? described : Array.from({ length: count }, (_, position) => ({ ...screen(position + 1, false), layoutSummary: "Visible screen count was detected, but detailed layout analysis was not available." })),
    designSystemSignals: {},
  } as unknown as ReferenceAnalysis,
  screenCountEstimate: count,
  screenReferenceCount: provided > 0 ? provided : null,
  confidence: "medium",
  source: "salvaged_analysis",
  diagnostics: [],
  validationIssues: [
    ...(provided === 0 ? ["No usable screenReferences array was present."] : []),
    ...(provided > 0 && provided !== count ? ["screenCountEstimate must equal the number of screenReferences entries."] : []),
  ],
});

const deps = (overrides: Partial<ReferenceCompletionDeps> = {}): ReferenceCompletionDeps & { crops: Array<{ x: number }> } => {
  const crops: Array<{ x: number }> = [];
  return {
    crops,
    locate: vi.fn(async ({ count }) => Array.from({ length: count }, (_, position) => ({ index: position + 1, box: box(0.05 + position * 0.33) }))),
    crop: vi.fn(async (_image, at) => { crops.push({ x: at.x }); return { data: `crop@${at.x.toFixed(2)}`, mimeType: "image/png" }; }),
    describe: vi.fn(async ({ index }) => ({ ...screen(index, false), suggestedRole: `Described ${index}` })),
    ...overrides,
  };
};

describe("which screens are missing", () => {
  it("names the numbers no described screen has taken", () => {
    expect(missingScreenIndexes([screen(1)], 3)).toEqual([2, 3]);
    expect(missingScreenIndexes([screen(2)], 3)).toEqual([1, 3]);
    expect(missingScreenIndexes([], 2)).toEqual([1, 2]);
    expect(missingScreenIndexes([screen(1), screen(2), screen(3)], 3)).toEqual([]);
  });

  it("never asks for more screens than are missing when the model repeated or misnumbered one", () => {
    expect(missingScreenIndexes([screen(1), screen(1)], 3)).toEqual([2]);
    expect(missingScreenIndexes([screen(7)], 3)).toEqual([1, 2]);
  });

  it("needs a completion when the model described fewer screens than it counted, and only then", () => {
    expect(needsCompletion(salvaged(3, [screen(1)]))).toBe(true);
    expect(needsCompletion(salvaged(3, []))).toBe(true);
    expect(needsCompletion(salvaged(1, []))).toBe(true);
    expect(needsCompletion({ ...salvaged(3, [screen(1), screen(2), screen(3)]), source: "full_analysis" })).toBe(false);
    expect(needsCompletion({ ...salvaged(3, []), analysis: null })).toBe(false);
  });
});

describe("completing an analysis that counted more screens than it described", () => {
  it("describes the missing screens only, each from a crop of its own box, and merges them in order", async () => {
    const d = deps();
    const first = screen(1);
    const result = await completeReferenceAnalysis({ image, result: salvaged(3, [first]), deps: d });

    // the located boxes are used for the missing screens, not the described one
    expect(d.locate).toHaveBeenCalledWith({ image, count: 3, known: [{ index: 1, box: first.boundingBox }] });
    expect(d.describe).toHaveBeenCalledTimes(2);
    expect(vi.mocked(d.describe).mock.calls.map(([input]) => [input.index, input.crop.data])).toEqual([[2, "crop@0.38"], [3, "crop@0.71"]]);

    expect(result.analysis?.screenReferences.map((entry) => [entry.index, entry.suggestedRole])).toEqual([[1, "Screen 1"], [2, "Described 2"], [3, "Described 3"]]);
    // each new screen carries the box it was found at, and the first is untouched
    expect(result.analysis?.screenReferences[0]).toBe(first);
    expect(result.analysis?.screenReferences[1].boundingBox).toEqual(box(0.38));
    expect(result).toMatchObject({ source: "full_analysis", confidence: "high", screenReferenceCount: 3, screenCountEstimate: 3, validationIssues: [] });
    expect(result.diagnostics.join(" ")).toContain("Described 2 missing screens (2, 3) from crops of the image.");
  });

  it("describes every screen of an image whose analysis described none, and drops the placeholders", async () => {
    const d = deps();
    const result = await completeReferenceAnalysis({ image, result: salvaged(2, []), deps: d });
    expect(d.locate).toHaveBeenCalledWith({ image, count: 2, known: [] });
    expect(result.analysis?.screenReferences.map((entry) => entry.suggestedRole)).toEqual(["Described 1", "Described 2"]);
    expect(result.analysis?.screenReferences.some((entry) => entry.layoutSummary.includes("not available"))).toBe(false);
    expect(result).toMatchObject({ source: "full_analysis", validationIssues: [] });
  });

  it("takes the whole image for the one screen of an image that described none, with nothing to locate", async () => {
    const d = deps();
    const result = await completeReferenceAnalysis({ image, result: salvaged(1, []), deps: d });
    expect(d.locate).not.toHaveBeenCalled();
    expect(d.crops).toEqual([{ x: 0 }]);
    expect(result.analysis?.screenReferences).toHaveLength(1);
    expect(result.source).toBe("full_analysis");
  });

  it("leaves a screen it could not find a box for, and stays a salvaged analysis with its issue", async () => {
    const d = deps({ locate: vi.fn(async () => [{ index: 2, box: box(0.38) }]) });
    const result = await completeReferenceAnalysis({ image, result: salvaged(3, [screen(1)]), deps: d });
    expect(d.describe).toHaveBeenCalledTimes(1);
    expect(result.analysis?.screenReferences.map((entry) => entry.index)).toEqual([1, 2]);
    expect(result).toMatchObject({ source: "salvaged_analysis", confidence: "medium", screenReferenceCount: 2 });
    expect(result.validationIssues).toEqual(["screenCountEstimate must equal the number of screenReferences entries."]);
    expect(result.diagnostics.join(" ")).toContain("no box was found for screen 3");
  });

  it("does not take a box that covers a screen already described for a missing one", async () => {
    const first = screen(1);
    const d = deps({ locate: vi.fn(async () => [{ index: 2, box: first.boundingBox! }, { index: 3, box: box(0.71) }]) });
    const result = await completeReferenceAnalysis({ image, result: salvaged(3, [first]), deps: d });
    expect(vi.mocked(d.describe).mock.calls.map(([input]) => input.index)).toEqual([3]);
    expect(result.diagnostics.join(" ")).toContain("covers a screen that is already described");
    expect(result.source).toBe("salvaged_analysis");
  });

  it("ignores a box too small to be a screen", async () => {
    const d = deps({ locate: vi.fn(async () => [{ index: 2, box: { x: 0.4, y: 0.4, width: 0.01, height: 0.02 } }, { index: 3, box: box(0.71) }]) });
    await completeReferenceAnalysis({ image, result: salvaged(3, [screen(1)]), deps: d });
    expect(vi.mocked(d.describe).mock.calls.map(([input]) => input.index)).toEqual([3]);
  });

  it("keeps the screens that were described when another could not be", async () => {
    const d = deps({ describe: vi.fn(async ({ index }) => { if (index === 2) throw new Error("model overloaded"); return { ...screen(index, false), suggestedRole: `Described ${index}` }; }) });
    const result = await completeReferenceAnalysis({ image, result: salvaged(3, [screen(1)]), deps: d });
    expect(result.analysis?.screenReferences.map((entry) => entry.index)).toEqual([1, 3]);
    expect(result.source).toBe("salvaged_analysis");
    expect(result.diagnostics.join(" ")).toContain("screen 2 could not be described");
  });

  it("is unchanged, and says why, when the screens could not be located or none could be described", async () => {
    const original = salvaged(3, [screen(1)]);
    const unlocated = await completeReferenceAnalysis({ image, result: original, deps: deps({ locate: vi.fn(async () => { throw new Error("no answer"); }) }) });
    expect(unlocated.analysis).toBe(original.analysis);
    expect(unlocated.source).toBe("salvaged_analysis");
    expect(unlocated.diagnostics.join(" ")).toContain("Locating the missing screens failed: no answer");

    const undescribed = await completeReferenceAnalysis({ image, result: original, deps: deps({ describe: vi.fn(async () => null) }) });
    expect(undescribed.analysis).toBe(original.analysis);
    expect(undescribed.diagnostics.join(" ")).toContain("screen 2 could not be described; screen 3 could not be described");
  });

  it("does nothing for an analysis that is complete, one without an analysis, or one that missed too many screens", async () => {
    const d = deps();
    const complete = { ...salvaged(3, [screen(1), screen(2), screen(3)]), source: "full_analysis" as const };
    expect(await completeReferenceAnalysis({ image, result: complete, deps: d })).toBe(complete);
    const empty = { ...salvaged(3, []), analysis: null };
    expect(await completeReferenceAnalysis({ image, result: empty, deps: d })).toBe(empty);
    const tooMany = salvaged(MAX_COMPLETED_SCREENS + 2, []);
    expect(await completeReferenceAnalysis({ image, result: tooMany, deps: d })).toBe(tooMany);
    expect(d.locate).not.toHaveBeenCalled();
    expect(d.describe).not.toHaveBeenCalled();
  });

  it("keeps issues other than the count mismatch, and so stays salvaged", async () => {
    const original = { ...salvaged(3, [screen(1)]), validationIssues: ["screenCountEstimate must equal the number of screenReferences entries.", "Something else was wrong."] };
    const result = await completeReferenceAnalysis({ image, result: original, deps: deps() });
    expect(result.analysis?.screenReferences).toHaveLength(3);
    expect(result.validationIssues).toEqual(["Something else was wrong."]);
    expect(result.source).toBe("salvaged_analysis");
  });
});
