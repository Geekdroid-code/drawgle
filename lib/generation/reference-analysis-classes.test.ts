import { describe, expect, it } from "vitest";

import { createProjectReferenceDna, isProjectReferenceDna } from "@/lib/generation/reference-dna";
import { normalizeReferenceAnalysis } from "@/lib/generation/scope-contract";
import {
  referenceAnalysisRecreateInstruction,
  referenceAnalysisStyleInstruction,
} from "@/lib/generation/prompts";
import type { ScreenFamilyContract } from "@/lib/types";

const rawAnalysis = (extra: Record<string, unknown> = {}, signals: Record<string, unknown> = {}) => ({
  overallVisualStyle: "Warm, tonal wellness UI",
  screenCountEstimate: 1,
  screenReferences: [{ index: 1, suggestedRole: "Dashboard", boundingBox: { x: 0, y: 0, width: 1, height: 1 } }],
  designSystemSignals: signals,
  ...extra,
});

const family: ScreenFamilyContract = {
  summary: "Tonal cards on a warm page",
  surfaces: "Cards a tone lighter than the page",
  typography: "Regular headlines with bold keywords",
  spacing: "A steady content rail",
  navigation: "A bottom bar",
  imagery: "Illustrated chips",
  consistencyRules: ["Keep the surface ladder"],
};

describe("radius and elevation in the reference analysis", () => {
  it("parses the two classification fields", () => {
    const result = normalizeReferenceAnalysis(rawAnalysis({ radiusClass: "very-rounded", surfaceElevation: "flat-tone" }));
    expect(result.analysis?.radiusClass).toBe("very-rounded");
    expect(result.analysis?.surfaceElevation).toBe("flat-tone");
  });

  it("accepts snake_case, the signals object and the labels a model tends to write", () => {
    const snake = normalizeReferenceAnalysis(rawAnalysis({ radius_class: "Very Rounded", surface_elevation: "tone_on_tone" }));
    expect(snake.analysis).toMatchObject({ radiusClass: "very-rounded", surfaceElevation: "flat-tone" });

    const nested = normalizeReferenceAnalysis(rawAnalysis({}, { radiusClass: "soft", surfaceElevation: "soft-shadow" }));
    expect(nested.analysis).toMatchObject({ radiusClass: "soft", surfaceElevation: "soft-shadow" });
  });

  it("leaves the fields out, not null, when the model gave none or gave a number", () => {
    const missing = normalizeReferenceAnalysis(rawAnalysis());
    expect(missing.analysis).not.toHaveProperty("radiusClass");
    expect(missing.analysis).not.toHaveProperty("surfaceElevation");

    const numeric = normalizeReferenceAnalysis(rawAnalysis({ radiusClass: "24pt", surfaceElevation: 4 }));
    expect(numeric.analysis).not.toHaveProperty("radiusClass");
    expect(numeric.analysis).not.toHaveProperty("surfaceElevation");
  });

  it("keeps the classes in the stored reference DNA", () => {
    const analysis = normalizeReferenceAnalysis(rawAnalysis({ radiusClass: "rounded", surfaceElevation: "hairline" })).analysis!;
    const dna = createProjectReferenceDna({ analysis, screenFamilyContract: family, referenceMode: "curated_style" });
    expect(isProjectReferenceDna(dna)).toBe(true);
    expect(dna.analysis.radiusClass).toBe("rounded");
    expect(dna.analysis.surfaceElevation).toBe("hairline");
    // stored JSON keeps them
    expect(JSON.parse(JSON.stringify(dna)).analysis).toMatchObject({ radiusClass: "rounded", surfaceElevation: "hairline" });
  });
});

describe("reference analysis prompts", () => {
  it("asks both analyses to classify radius and elevation with the same scale", () => {
    for (const instruction of [referenceAnalysisRecreateInstruction, referenceAnalysisStyleInstruction]) {
      expect(instruction).toContain('"radiusClass": "square | soft | rounded | very-rounded | extra-rounded"');
      expect(instruction).toContain('"surfaceElevation": "flat-tone | hairline | soft-shadow | strong-shadow"');
      expect(instruction).toContain("judged against a 390pt-wide screen");
      expect(instruction).toContain("square is 0-4pt, soft is 6-10pt, rounded is 12-16pt, very-rounded is 18-24pt, extra-rounded is 26-32pt");
    }
  });

  it("keeps numeric measurement to recreate mode: style mode classifies and code measures", () => {
    expect(referenceAnalysisRecreateInstruction).toContain("Use real numbers, not adjectives");
    expect(referenceAnalysisRecreateInstruction).toContain("shadow(color/blur/spread/offset)");

    expect(referenceAnalysisStyleInstruction).not.toContain("Use real numbers");
    expect(referenceAnalysisStyleInstruction).not.toContain("shadow(color/blur/spread/offset)");
    expect(referenceAnalysisStyleInstruction).toContain("Classify, do not measure.");
    expect(referenceAnalysisStyleInstruction).toContain("Never write px or pt sizes, hex colour codes, opacity percentages or blur values into any field");
    expect(referenceAnalysisStyleInstruction).toContain("colours are measured from the pixels in code");
  });
});
