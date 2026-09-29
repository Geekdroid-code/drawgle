// @vitest-environment node
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
// These tests are about the model path, so no preset is approved, whatever the presets file holds.
vi.mock("@/lib/generation/generated/curated-style-presets.json", () => ({ default: {} }));

import { curatedReferenceNotes } from "@/lib/generation/curated-reference-notes";
import { CURATED_STYLE_REFERENCES } from "@/lib/generation/curated-style-catalog";
import { PRESET_REFERENCE_ID } from "@/lib/generation/curated-style-preset-fixtures";
import { analyzeReferenceImageForScope } from "@/lib/generation/scope-contract";

const image = async () => ({
  data: (await sharp({ create: { width: 200, height: 400, channels: 3, background: "#ECE9D6" } }).png().toBuffer()).toString("base64"),
  mimeType: "image/png",
});

const completeAnalysis = {
  overallVisualStyle: "Warm tonal wellness UI", screenCountEstimate: 1, radiusClass: "very-rounded", surfaceElevation: "flat-tone",
  screenReferences: [{ index: 1, suggestedRole: "Dashboard", layoutSummary: "Cards", visualHierarchy: "Greeting first", components: ["Card"], stylingCues: ["tonal cards"], boundingBox: { x: 0, y: 0, width: 1, height: 1 } }],
  designSystemSignals: { palette: "cream", typography: "geometric sans", surfaces: "tonal", iconography: "line", density: "balanced", motionTone: "calm" },
};

const partsOfTheFirstCall = () => (mocks.generate.mock.calls[0][0].contents.parts as Array<{ text?: string }>).map((part) => part.text ?? "[image]");

beforeEach(() => {
  mocks.generate.mockReset();
  mocks.generate.mockResolvedValue({ text: JSON.stringify(completeAnalysis) });
});

describe("the curator's notes on a reference", () => {
  it("say how the library records its typeface and density", () => {
    const notes = curatedReferenceNotes(PRESET_REFERENCE_ID)!;
    expect(notes).toContain("CURATOR'S NOTES");
    expect(notes).toContain("Typography character: geometric sans, functional ui sans.");
    expect(notes).toContain("Density: balanced.");
    expect(notes).toContain("must agree with these notes unless the image clearly contradicts them");
  });

  it("exist for every reference in the library, and for none outside it", () => {
    for (const reference of CURATED_STYLE_REFERENCES) {
      expect(curatedReferenceNotes(reference.id), reference.id).toMatch(/Typography character: .+\.\n- Density: (airy|balanced|dense)\./);
    }
    expect(curatedReferenceNotes("not-in-the-library")).toBeNull();
    expect(curatedReferenceNotes(null)).toBeNull();
    expect(curatedReferenceNotes(undefined)).toBeNull();
  });
});

describe("the reference analysis is given the curator's notes", () => {
  it("for a curated reference", async () => {
    await analyzeReferenceImageForScope({ prompt: "A pet app", image: await image(), referenceMode: "curated_style", referenceId: PRESET_REFERENCE_ID });
    const parts = partsOfTheFirstCall();
    expect(parts.some((text) => text.includes("Typography character: geometric sans"))).toBe(true);
  });

  it("not for an uploaded image, which has no curator", async () => {
    await analyzeReferenceImageForScope({ prompt: "A pet app", image: await image(), referenceMode: "user_style" });
    expect(partsOfTheFirstCall().some((text) => text.includes("CURATOR'S NOTES"))).toBe(false);
  });

  it("not for a curated mode without a reference id", async () => {
    await analyzeReferenceImageForScope({ prompt: "A pet app", image: await image(), referenceMode: "curated_style" });
    expect(partsOfTheFirstCall().some((text) => text.includes("CURATOR'S NOTES"))).toBe(false);
  });
});
