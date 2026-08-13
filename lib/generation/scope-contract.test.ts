import { describe, expect, it } from "vitest";

import {
  analyzePromptScreenIntent,
  blockingReferenceAnalysisIssues,
  deferNewProjectScopeConfirmation,
  hasExplicitFiniteScreenScopeSyntax,
  normalizeReferenceAnalysis,
  parsePromptScreenIntent,
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

  it("does not mistake trailing product wording for a screen count", () => {
    for (const prompt of [
      "Build a hyper-local pet grooming and vet visits app the premium one",
      "Build a budgeting app version two",
      "Create the luxury option one",
      "Design the first one",
    ]) {
      expect(parsePromptScreenIntent(prompt)).toMatchObject({
        promptScreenCount: null,
        source: null,
      });
    }
  });

  it("still accepts counts attached to explicit screen nouns", () => {
    expect(parsePromptScreenIntent("Build the premium app with one screen").promptScreenCount).toBe(1);
    expect(parsePromptScreenIntent("Create two pages for the booking flow").promptScreenCount).toBe(2);
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

  it("never blocks new-project entry for a normal open-ended product brief", () => {
    const ambiguousContract = resolveGenerationScopeContract({
      prompt: "Build a premium on-demand mobile car washing app where people can book a detailer to come to their home or office. Users should pick a service, pick a time slot, select their location on a map, and pay.",
      image: null,
      referenceMode: "internal_style",
      planningMode: "project",
      referenceAnalysisResult: null,
      promptIntent: {
        promptScreenCount: null,
        namedScreenCount: null,
        allScreensRequested: false,
        source: null,
        confidence: "low",
        requiresConfirmation: true,
        diagnostics: [],
        ambiguities: ["Features were described without a finite screen list."],
        groups: [],
        screens: [],
      },
    });

    expect(ambiguousContract.requiresConfirmation).toBe(true);
    const entryContract = deferNewProjectScopeConfirmation(ambiguousContract, false);
    expect(entryContract.requiresConfirmation).toBe(false);
    expect(entryContract.ambiguities).toEqual(ambiguousContract.ambiguities);
    expect(entryContract.diagnostics.at(-1)).toContain("deferred to the canvas");
  });

  it("keeps confirmation available for existing-project chat workflows", () => {
    const contract = {
      ...resolveGenerationScopeContract({
        prompt: "Add the booking flow.",
        image: null,
        referenceMode: "user_style",
        planningMode: "project",
        referenceAnalysisResult: null,
      }),
      requiresConfirmation: true,
    };

    expect(deferNewProjectScopeConfirmation(contract, true)).toBe(contract);
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

  it("does not fabricate per-screen descriptions from a count-only analysis", () => {
    const result = normalizeReferenceAnalysis({
      ...base,
      screenCountEstimate: 2,
      screenReferences: [],
    });
    expect(result.analysis?.screenCountEstimate).toBe(2);
    expect(result.analysis?.screenReferences).toEqual([]);
    expect(result.validationIssues).toContain("No usable screenReferences array was present.");
  });

  const countOnlyResult = {
    analysis: null,
    screenCountEstimate: 2,
    screenReferenceCount: null,
    confidence: "medium" as const,
    source: "count_only" as const,
    diagnostics: ["Count-only fallback estimated two screens."],
  };

  it("blocks a count-only fallback for an actual uploaded reference", () => {
    expect(blockingReferenceAnalysisIssues({
      result: countOnlyResult,
      referenceMode: "user_style",
      imagePresent: true,
    })).toContain("No usable screenReferences array was present after bounded analysis.");
  });

  it("never blocks prompt-only entry when no reference image exists", () => {
    expect(blockingReferenceAnalysisIssues({
      result: countOnlyResult,
      referenceMode: "internal_style",
      imagePresent: false,
    })).toEqual([]);
  });

  it("keeps optional curated calibration non-blocking", () => {
    expect(blockingReferenceAnalysisIssues({
      result: countOnlyResult,
      referenceMode: "curated_style",
      imagePresent: true,
    })).toEqual([]);
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
