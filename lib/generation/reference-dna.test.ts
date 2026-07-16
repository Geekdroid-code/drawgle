import { describe, expect, it } from "vitest";

import {
  createProjectReferenceDna,
  formatProjectReferenceDnaForPrompt,
  isProjectReferenceDna,
  reconstructReferenceAnalysisFromCharter,
  resolveProjectReferenceDna,
  selectProjectReferenceImagePath,
} from "@/lib/generation/reference-dna";
import type { JsonValue, ProjectCharter, ReferenceAnalysis, ScreenFamilyContract } from "@/lib/types";

const analysis: ReferenceAnalysis = {
  overallVisualStyle: "Editorial mobile UI with crisp white surfaces and violet feature panels.",
  screenCountEstimate: 1,
  screenReferences: [{
    index: 1,
    suggestedRole: "Dashboard",
    layoutSummary: "Greeting, feature hero, metric cards, progress chart, and dark dock.",
    visualHierarchy: "Greeting leads into one dominant violet feature panel.",
    components: ["avatar", "feature panel", "metric cards", "progress chart", "navigation dock"],
    stylingCues: ["white shell", "violet hero", "orange accents"],
    interactionCues: ["feature arrow", "navigation selection"],
    copyPatterns: ["short labels", "large metric values"],
    implementationNotes: ["keep the feature panel dominant"],
    compositionRules: ["use one dominant feature panel"],
    spacingRules: ["use a compact vertical rhythm"],
    componentRules: ["metrics use bordered rectangular tiles"],
    antiPatterns: ["do not turn every section into a floating card"],
  }],
  designSystemSignals: {
    palette: "White, violet, charcoal, and restrained orange.",
    typography: "Bold geometric display type with compact supporting copy.",
    surfaces: "White app shell, violet hero, and a charcoal navigation dock.",
    iconography: "Rounded outlined icons with occasional filled active states.",
    density: "Compact but breathable mobile density.",
    motionTone: "Direct and polished.",
    layoutGrammar: "One dominant feature followed by paired metric modules.",
    componentGrammar: "Rectangular modules with controlled corner radii.",
    spacingLogic: "Tight internal spacing and larger section breaks.",
    antiPatterns: "Avoid generic card stacks and unrelated gradients.",
  },
  primaryNavigation: null,
};

const family: ScreenFamilyContract = {
  summary: "A crisp editorial product family with one dominant feature per screen.",
  surfaces: analysis.designSystemSignals.surfaces,
  typography: analysis.designSystemSignals.typography,
  spacing: analysis.designSystemSignals.spacingLogic!,
  navigation: "Use the established dark navigation dock.",
  imagery: "Use bright, legible subject imagery with deliberate cropping.",
  consistencyRules: ["Keep one dominant feature panel.", "Avoid generic card stacks."],
};

const legacyCharter: ProjectCharter = {
  originalPrompt: "Build a premium learning app.",
  imageReferenceSummary: analysis.overallVisualStyle,
  appType: "Learning app",
  targetAudience: "Students",
  navigationModel: "Bottom navigation",
  keyFeatures: ["Lessons", "Progress"],
  designRationale: "Make progress feel visual and encouraging.",
  creativeDirection: {
    conceptName: "Focused Momentum",
    styleEssence: family.summary,
    colorStory: analysis.designSystemSignals.palette,
    typographyMood: analysis.designSystemSignals.typography,
    surfaceLanguage: analysis.designSystemSignals.surfaces,
    iconographyStyle: analysis.designSystemSignals.iconography,
    compositionPrinciples: ["Keep one dominant feature panel."],
    signatureMoments: ["Violet feature panel"],
    motionTone: analysis.designSystemSignals.motionTone,
    avoid: ["Generic card stacks"],
  },
  referenceScreens: analysis.screenReferences.map((screen) => ({
    index: screen.index,
    suggestedRole: screen.suggestedRole,
    layoutSummary: screen.layoutSummary,
    visualHierarchy: screen.visualHierarchy,
    components: screen.components,
    stylingCues: screen.stylingCues,
    interactionCues: screen.interactionCues,
    copyPatterns: screen.copyPatterns,
    implementationNotes: screen.implementationNotes,
  })),
  designSystemSignals: analysis.designSystemSignals,
  planningDiagnostics: {
    source: "planner",
    screenFamilyContract: family as unknown as JsonValue,
  },
};

describe("project reference DNA", () => {
  it("persists a versioned canonical artifact without changing its analysis", () => {
    const dna = createProjectReferenceDna({
      analysis,
      screenFamilyContract: family,
      referenceMode: "user_style",
      sourceImagePath: "owner/prompt-images/reference.webp",
      sourceReferenceId: "crypto-wallet-glowing-dark",
      sourceReferenceCatalogHash: "catalog-hash",
      createdAt: "2026-07-14T00:00:00.000Z",
    });

    expect(isProjectReferenceDna(dna)).toBe(true);
    expect(dna.schemaVersion).toBe(1);
    expect(dna.analysis).toBe(analysis);
    expect(dna.sourceImagePath).toBe("owner/prompt-images/reference.webp");
    expect(dna.sourceReferenceId).toBe("crypto-wallet-glowing-dark");
    expect(dna.sourceReferenceCatalogHash).toBe("catalog-hash");
  });

  it("prefers persisted DNA over reconstructing legacy charter fields", () => {
    const persisted = createProjectReferenceDna({
      analysis,
      screenFamilyContract: family,
      referenceMode: "user_recreate",
      createdAt: "2026-07-14T00:00:00.000Z",
    });
    const resolved = resolveProjectReferenceDna({ ...legacyCharter, referenceDna: persisted });

    expect(resolved?.cacheSource).toBe("persisted");
    expect(resolved?.dna).toBe(persisted);
  });

  it("reconstructs legacy project DNA deterministically without inventing another analysis call", () => {
    const resolved = resolveProjectReferenceDna(legacyCharter);

    expect(resolved?.cacheSource).toBe("legacy_reconstruction");
    expect(resolved?.dna.source).toBe("legacy_reconstruction");
    expect(resolved?.dna.analysis.designSystemSignals.layoutGrammar).toBe(
      analysis.designSystemSignals.layoutGrammar,
    );
    expect(resolved?.dna.analysis.screenReferences[0].components).toContain("progress chart");
    expect(resolved?.dna.analysis.screenReferences[0].compositionRules).toEqual([]);
    expect(resolved?.dna.screenFamilyContract).toEqual(family);
  });

  it("does not claim a valid cache when the charter lacks visual-system evidence", () => {
    const incomplete: ProjectCharter = {
      ...legacyCharter,
      designSystemSignals: null,
      planningDiagnostics: { source: "planner" },
    };

    expect(reconstructReferenceAnalysisFromCharter(incomplete)).toBeNull();
    expect(resolveProjectReferenceDna(incomplete)).toBeNull();
  });

  it("formats the visual rules needed by downstream builders", () => {
    const dna = createProjectReferenceDna({
      analysis,
      screenFamilyContract: family,
      referenceMode: "user_style",
    });
    const prompt = formatProjectReferenceDnaForPrompt(dna);

    expect(prompt).toContain(`Palette: ${analysis.designSystemSignals.palette}`);
    expect(prompt).toContain(`Typography: ${analysis.designSystemSignals.typography}`);
    expect(prompt).toContain(`Layout grammar: ${analysis.designSystemSignals.layoutGrammar}`);
    expect(prompt).toContain(`Avoid: ${analysis.designSystemSignals.antiPatterns}`);
    expect(prompt).toContain("Dashboard: Greeting, feature hero");
  });

  it("keeps the original reference path stable when newer screen uploads exist", () => {
    const dna = createProjectReferenceDna({
      analysis,
      screenFamilyContract: family,
      referenceMode: "user_style",
      sourceImagePath: "owner/prompt-images/original.webp",
    });

    expect(selectProjectReferenceImagePath({
      dna,
      latestImagePath: "owner/prompt-images/later-screen-reference.webp",
    })).toBe("owner/prompt-images/original.webp");
    expect(selectProjectReferenceImagePath({
      dna: { ...dna, sourceImagePath: null },
      latestImagePath: "owner/prompt-images/legacy-reference.webp",
    })).toBe("owner/prompt-images/legacy-reference.webp");
  });
});
