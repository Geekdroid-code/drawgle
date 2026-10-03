import { describe, expect, it } from "vitest";

import {
  analyzePromptScreenIntent,
  describesEveryScreen,
  normalizeReferenceAnalysis,
  resolveGenerationScopeContract,
} from "@/lib/generation/scope-contract";

describe("generation scope reference provenance", () => {
  it("keeps explicit screen counts on the deterministic path", async () => {
    let llmCalls = 0;
    const intent = await analyzePromptScreenIntent({
      prompt: "Create exactly 2 screens: Home and Product Details.",
      llmLog: () => {
        llmCalls += 1;
      },
    });

    expect(intent.promptScreenCount).toBe(2);
    expect(intent.screens).toHaveLength(2);
    expect(llmCalls).toBe(0);
  });

  it("locks ordinary numbered screen lists without an LLM call", async () => {
    let llmCalls = 0;
    const intent = await analyzePromptScreenIntent({
      prompt: [
        "Design a premium travel app.",
        "Create these screens:",
        "1. Trips — upcoming and past trips.",
        "2. Trip Overview — dates, travelers, and saved places.",
        "3. Edit Trip — edit dates and privacy.",
        "4. Place Details — photos, ratings, and votes.",
        "5. Day Itinerary — a rearrangeable timeline.",
      ].join("\n\n"),
      llmLog: () => {
        llmCalls += 1;
      },
    });

    expect(intent.promptScreenCount).toBe(5);
    expect(intent.namedScreenCount).toBe(5);
    expect(intent.screens?.map((screen) => screen.name)).toEqual([
      "Trips",
      "Trip Overview",
      "Edit Trip",
      "Place Details",
      "Day Itinerary",
    ]);
    expect(llmCalls).toBe(0);
  });

  it("keeps single-screen mode deterministic without semantic interpretation", async () => {
    let llmCalls = 0;
    const intent = await analyzePromptScreenIntent({
      prompt: "Create the account workspace.",
      planningMode: "single-screen",
      llmLog: () => {
        llmCalls += 1;
      },
    });

    expect(intent.promptScreenCount).toBe(1);
    expect(llmCalls).toBe(0);
  });

  it("preserves prompt-only internal style instead of labeling it as curated style", () => {
    const contract = resolveGenerationScopeContract({
      prompt: "Create a luxury skincare routine app.",
      image: null,
      referenceMode: "internal_style",
      planningMode: "project",
      referenceAnalysisResult: null,
    });

    expect(contract.referenceMode).toBe("internal_style");
    expect(contract.requiresConfirmation).toBe(false);
  });

  it("preserves an accepted curated reference as curated style", () => {
    const contract = resolveGenerationScopeContract({
      prompt: "Create a luxury skincare routine app.",
      image: {
        data: "image-data",
        mimeType: "image/jpeg",
      },
      referenceMode: "curated_style",
      planningMode: "project",
      referenceAnalysisResult: null,
    });

    expect(contract.referenceMode).toBe("curated_style");
  });
});

describe("whether an analysis describes every screen it counts", () => {
  const screen = (index: number) => ({ index, suggestedRole: `Screen ${index}`, layoutSummary: `Layout ${index}`,
    visualHierarchy: "Title then cards", components: ["card"], stylingCues: ["tone-on-tone"] });

  it("is true for an analysis that describes each screen", () => {
    const { analysis } = normalizeReferenceAnalysis({ screenCountEstimate: 2, screenReferences: [screen(1), screen(2)] });
    expect(analysis && describesEveryScreen(analysis)).toBe(true);
  });

  it("is false when screens are missing or only placeholders a salvage filled in", () => {
    const partial = normalizeReferenceAnalysis({ screenCountEstimate: 3, screenReferences: [screen(1)] }).analysis;
    expect(partial && describesEveryScreen(partial)).toBe(false);
    const salvaged = normalizeReferenceAnalysis({ screenCountEstimate: 3, screenReferences: [] }).analysis;
    expect(salvaged?.screenReferences).toHaveLength(3);
    expect(salvaged && describesEveryScreen(salvaged)).toBe(false);
    // more descriptions than screens counted is a reading that contradicts itself
    const contradictory = normalizeReferenceAnalysis({ screenCountEstimate: 2, screenReferences: [screen(1), screen(2), screen(3)] }).analysis;
    expect(contradictory && describesEveryScreen(contradictory)).toBe(false);
  });
});
