// @vitest-environment node
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));

import { referenceAnalysisRecreateInstruction, referenceAnalysisStyleInstruction } from "@/lib/generation/prompts";
import {
  analyzeReferenceImageForScope,
  parseLocatedScreens,
  resolveGenerationScopeContract,
  resultForKnownAnalysis,
} from "@/lib/generation/scope-contract";
import type { ReferenceAnalysis } from "@/lib/types";

/** Three phones side by side on a 900x400 canvas. */
const upload = async () => {
  const phones = [0, 1, 2].map((position) => `<rect x="${30 + position * 290}" y="30" width="250" height="340" rx="24" fill="#${["F6E3C3", "E8EBC9", "E7DDE9"][position]}"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400"><rect width="900" height="400" fill="#ECE9D6"/>${phones.join("")}</svg>`;
  return { data: (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64"), mimeType: "image/png" };
};

const entry = (index: number, extra: Record<string, unknown> = {}) => ({
  index, suggestedRole: `Screen ${index}`, layoutSummary: `Layout ${index}`, visualHierarchy: `Hierarchy ${index}`,
  components: [`Component ${index}`], stylingCues: ["tonal cards"], ...extra,
});
const analysisJson = (screens: unknown[], count = 3) => ({
  overallVisualStyle: "Warm tonal wellness UI", screenCountEstimate: count, radiusClass: "very-rounded", surfaceElevation: "flat-tone",
  screenReferences: screens,
  designSystemSignals: { palette: "cream", typography: "grotesk", surfaces: "tonal", iconography: "line", density: "airy", motionTone: "calm" },
});
const phoneBox = (position: number) => ({ x: (30 + position * 290) / 900, y: 30 / 400, width: 250 / 900, height: 340 / 400 });

const isLocate = (request: { contents: { parts: Array<{ text?: string }> } }) => request.contents.parts.some((part) => part.text?.includes("arranged left to right"));
const isDescribe = (request: { contents: { parts: Array<{ text?: string }> } }) => request.contents.parts.some((part) => part.text?.includes("cropped out of a larger reference image"));

/** The model that saw three phones and described one of them. */
const respond = ({ locate = true, describe = true }: { locate?: boolean; describe?: boolean } = {}) =>
  mocks.generate.mockImplementation(async (request: { contents: { parts: Array<{ text?: string }> } }) => {
    if (isLocate(request)) {
      if (!locate) throw new Error("no answer");
      return { text: JSON.stringify({ screens: [0, 1, 2].map((position) => ({ index: position + 1, boundingBox: phoneBox(position) })) }) };
    }
    if (isDescribe(request)) {
      if (!describe) return { text: "{}" };
      return { text: JSON.stringify({ screenCountEstimate: 1, screenReferences: [entry(1, { suggestedRole: "Described from its crop" })] }) };
    }
    return { text: JSON.stringify(analysisJson([entry(1, { boundingBox: phoneBox(0) })])) };
  });

beforeEach(() => { mocks.generate.mockReset(); });

describe("an analysis that counts three phones and describes one", () => {
  it("asks for the two missing screens only, from crops of their boxes, and comes back complete", async () => {
    respond();
    const image = await upload();
    const result = await analyzeReferenceImageForScope({ prompt: "A pet app", image, referenceMode: "user_style" });

    // the first analysis, one look at where the screens are, and one description for each of the two missing
    expect(mocks.generate).toHaveBeenCalledTimes(4);
    const requests = mocks.generate.mock.calls.map(([request]) => request);
    const described = requests.filter(isDescribe);
    expect(described).toHaveLength(2);

    // each description is of a crop: not the whole image, and the size of one phone
    for (const request of described) {
      const crop = request.contents.parts[0].inlineData;
      expect(crop.data).not.toBe(image.data);
      const { width, height } = await sharp(Buffer.from(crop.data, "base64")).metadata();
      expect(width).toBeGreaterThan(240);
      expect(width).toBeLessThan(270);
      expect(height).toBeGreaterThan(330);
      expect(height).toBeLessThan(360);
    }
    expect(described.map((request) => request.contents.parts[1].text).join("\n")).toContain("screen 2 of 3");
    expect(described.map((request) => request.contents.parts[1].text).join("\n")).toContain("screen 3 of 3");
    // they are described the way the first pass is: with the same instruction
    expect(described.every((request) => request.config.systemInstruction === referenceAnalysisStyleInstruction)).toBe(true);

    expect(result).toMatchObject({ source: "full_analysis", confidence: "high", screenCountEstimate: 3, screenReferenceCount: 3, validationIssues: [] });
    expect(result.analysis?.screenReferences.map((screen) => [screen.index, screen.suggestedRole])).toEqual([
      [1, "Screen 1"], [2, "Described from its crop"], [3, "Described from its crop"]]);
    expect(result.analysis?.screenReferences[1].boundingBox).toMatchObject({ x: expect.closeTo(320 / 900, 3), width: expect.closeTo(250 / 900, 3) });
    // what the first pass saw of the whole image is kept
    expect(result.analysis?.radiusClass).toBe("very-rounded");
    expect(result.analysis?.overallVisualStyle).toBe("Warm tonal wellness UI");
  });

  it("uses the recreate instruction to describe them when the image is to be recreated", async () => {
    respond();
    await analyzeReferenceImageForScope({ prompt: "", image: await upload(), referenceMode: "user_recreate" });
    const described = mocks.generate.mock.calls.map(([request]) => request).filter(isDescribe);
    expect(described).toHaveLength(2);
    expect(described.every((request) => request.config.systemInstruction === referenceAnalysisRecreateInstruction)).toBe(true);
  });

  it("carries no ambiguity into the Image to UI scope over a salvaged count, and counts all three screens", async () => {
    respond();
    const result = await analyzeReferenceImageForScope({ prompt: "", image: await upload(), referenceMode: "user_recreate" });
    const scope = resolveGenerationScopeContract({ prompt: "", image: await upload(), referenceMode: "user_recreate", referenceAnalysisResult: result });
    expect(scope.ambiguities).toEqual([]);
    expect(scope.finalScreenCount).toBe(3);
  });

  it("is a salvaged analysis, as before, when the screens cannot be located", async () => {
    respond({ locate: false });
    const result = await analyzeReferenceImageForScope({ prompt: "", image: await upload(), referenceMode: "user_style" });
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ source: "salvaged_analysis", screenCountEstimate: 3, screenReferenceCount: 1 });
    expect(result.analysis?.screenReferences).toHaveLength(1);
    expect(result.diagnostics.join(" ")).toContain("Locating the missing screens failed");
  });

  it("keeps the screens it could describe, and is salvaged, when a description comes back empty", async () => {
    respond({ describe: false });
    const result = await analyzeReferenceImageForScope({ prompt: "", image: await upload(), referenceMode: "user_style" });
    expect(mocks.generate).toHaveBeenCalledTimes(4);
    expect(result.source).toBe("salvaged_analysis");
    expect(result.analysis?.screenReferences).toHaveLength(1);
    expect(result.validationIssues).toContain("screenCountEstimate must equal the number of screenReferences entries.");
  });

  it("makes no further call for an analysis that described every screen it counted", async () => {
    mocks.generate.mockImplementation(async () => ({ text: JSON.stringify(analysisJson([entry(1), entry(2), entry(3)])) }));
    const result = await analyzeReferenceImageForScope({ prompt: "", image: await upload(), referenceMode: "user_style" });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("full_analysis");
  });
});

describe("the boxes a model gives for the screens of an image", () => {
  it("reads them under the names models use, numbered by position when it forgets", () => {
    expect(parseLocatedScreens({ screens: [{ index: 2, boundingBox: { x: 0.4, y: 0.1, width: 0.3, height: 0.8 } }] }))
      .toEqual([{ index: 2, box: { x: 0.4, y: 0.1, width: 0.3, height: 0.8 } }]);
    expect(parseLocatedScreens([{ bounding_box: { left: 0.1, top: 0.1, w: 0.3, h: 0.8 } }, { box: { x: 0.5, y: 0.1, width: 0.3, height: 0.8 } }]))
      .toEqual([{ index: 1, box: { x: 0.1, y: 0.1, width: 0.3, height: 0.8 } }, { index: 2, box: { x: 0.5, y: 0.1, width: 0.3, height: 0.8 } }]);
  });

  it("drops what is not a box, and reads nothing from what is not a list", () => {
    expect(parseLocatedScreens({ screens: [{ index: 1 }, { index: 2, boundingBox: { x: 0.1, y: 0.1, width: 0, height: 0.5 } }, "no"] })).toEqual([]);
    expect(parseLocatedScreens({ screens: "left" })).toEqual([]);
    expect(parseLocatedScreens(null)).toEqual([]);
  });
});

describe("the result for an analysis that already exists", () => {
  const known = (described: number, counted: number) => ({
    overallVisualStyle: "x", screenCountEstimate: counted, designSystemSignals: {},
    screenReferences: Array.from({ length: described }, (_, position) => entry(position + 1)),
  }) as unknown as ReferenceAnalysis;

  it("is a full analysis when it describes every screen it counts, and salvaged only when it does not", () => {
    expect(resultForKnownAnalysis(known(3, 3), "cached", "high")).toMatchObject({ source: "full_analysis", confidence: "high", screenReferenceCount: 3 });
    expect(resultForKnownAnalysis(known(1, 3), "cached", "high")).toMatchObject({ source: "salvaged_analysis", screenReferenceCount: 1 });
  });
});
