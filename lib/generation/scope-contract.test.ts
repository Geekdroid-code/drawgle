import { describe, expect, it } from "vitest";

import {
  analyzePromptScreenIntent,
  hasExplicitFiniteScreenScopeSyntax,
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

  it("does not treat grid columns plus descriptive screen behavior as a finite project count", () => {
    const prompt = "Create a mobile app UI for a plant care assistant app. Home screen should show my saved plants as a 2-column image grid. Tapping a plant opens a screen showing its watering schedule.";

    expect(hasExplicitFiniteScreenScopeSyntax(prompt)).toBe(false);
  });

  it("retains direct bounded screen requests", () => {
    expect(hasExplicitFiniteScreenScopeSyntax("Create a home screen and a plant details screen.")).toBe(true);
    expect(hasExplicitFiniteScreenScopeSyntax("Build the following screens: Home, Plant Details, Settings.")).toBe(true);
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

describe("reference visual evidence diagnostics", () => {
  const base = {
    overallVisualStyle: "Restrained utility UI",
    screenCountEstimate: 1,
    screenReferences: [{
      index: 1,
      suggestedRole: "Home",
      layoutSummary: "Compact summary and list",
      visualHierarchy: "Summary before rows",
      components: ["summary", "rows"],
      stylingCues: ["thin borders"],
    }],
    designSystemSignals: {
      palette: "Neutral",
      typography: "System sans",
      surfaces: "Pale cards",
      iconography: "Outline",
      density: "Compact",
      motionTone: "Quiet",
    },
  };

  it("does not call missing structured visual evidence high confidence", () => {
    const result = normalizeReferenceAnalysis(base);
    expect(result.confidence).toBe("high");
    expect(result.scopeConfidence).toBe("high");
    expect(result.visualEvidenceConfidence).toBe("low");
    expect(result.evidenceCompleteness).toMatchObject({ geometry: "missing", navigation: "missing", motifs: "missing" });
  });

  it("treats explicitly absent navigation as complete evidence", () => {
    const result = normalizeReferenceAnalysis({
      ...base,
      primaryNavigation: { present: false, repeatedAcrossScreens: false, itemCount: 0, items: [] },
      geometryProfile: { measurements: [] },
      motifs: [],
    });
    expect(result.evidenceCompleteness?.navigation).toBe("confirmed-absent");
    expect(result.visualEvidenceConfidence).toBe("medium");
  });

  it("preserves qualitative navigation appearance without claiming omitted measurements", () => {
    const result = normalizeReferenceAnalysis({
      ...base,
      primaryNavigation: {
        present: true,
        repeatedAcrossScreens: false,
        itemCount: 3,
        items: [],
        appearance: {
          primary: {
            anatomy: "glass-dock",
            width: "content",
            labels: "active-only",
            activeTreatment: "compact-chip",
            surface: "glass",
            border: true,
            elevation: "medium",
            itemLayout: "inline",
            blurPx: 18,
          },
          contextualChrome: null,
        },
      },
      geometryProfile: { measurements: [] },
      motifs: [],
    });

    expect(result.analysis?.primaryNavigation?.appearance?.primary).toMatchObject({
      anatomy: "glass-dock",
      width: "content",
      labels: "active-only",
      activeTreatment: "compact-chip",
      surface: "glass",
      blurPx: 18,
    });
    expect(result.analysis?.primaryNavigation?.appearance?.measuredFields).toEqual(["blurPx"]);
    expect(result.analysis?.primaryNavigation?.appearance?.geometryOwner).toBe("reference-measurements");
  });
});
