import { describe, expect, it } from "vitest";

import {
  buildSemanticTransferPlan,
  ensureSemanticCompositionPrimitives,
  formatSemanticCompositionLibrary,
} from "@/lib/generation/semantic-inspiration";
import { normalizeReferenceTransferContract } from "@/lib/generation/reference-transfer";
import { normalizeReferenceAnalysis } from "@/lib/generation/scope-contract";
import type { ReferenceAnalysis } from "@/lib/types";

const onboardingReference: ReferenceAnalysis = {
  overallVisualStyle: "Dark technical interface with precise electric-blue emphasis.",
  screenCountEstimate: 1,
  screenReferences: [{
    index: 1,
    suggestedRole: "Onboarding",
    layoutSummary: "Three status modules descend along a vertical connector toward a continue action.",
    visualHierarchy: "A bright current-state module dominates between quieter past and future states.",
    components: ["status modules", "progress connector", "anchored continue action"],
    stylingCues: ["crisp blue keylines on low-gloss charcoal planes", "tight technical micro-labels"],
    interactionCues: ["advance through ordered stages"],
    copyPatterns: ["short technical labels"],
    implementationNotes: [],
    compositionRules: ["Use progression to turn separate states into one journey."],
    spacingRules: ["Large gaps separate stages; tight gaps bind metadata to each state."],
    componentRules: ["Current state receives the strongest border and depth."],
  }],
  designSystemSignals: {
    palette: "Near-black, charcoal, and electric blue.",
    typography: "Compact grotesk with technical micro-labels.",
    surfaces: "Low-gloss dark planes with crisp keylines.",
    iconography: "Small outlined utility icons.",
    density: "Dense but readable.",
    motionTone: "Precise and restrained.",
    spacingLogic: "Tight internal gaps with larger semantic breaks.",
  },
  primaryNavigation: null,
};

describe("semantic inspiration suitability", () => {
  it("derives reusable principles for legacy reference DNA", () => {
    const enriched = ensureSemanticCompositionPrimitives(onboardingReference);
    const kinds = enriched.semanticCompositionPrimitives?.map((primitive) => primitive.kind);

    expect(kinds).toContain("progressive-sequence");
    expect(kinds).toContain("focal-anchor");
    expect(kinds).toContain("layered-depth");
  });

  it("keeps progression for a same-role onboarding screen without copying geometry", () => {
    const plan = buildSemanticTransferPlan({
      referenceAnalysis: onboardingReference,
      screenName: "Welcome Journey",
      screenDescription: "Introduce the product through a short onboarding sequence.",
      screenType: "root",
    });
    const progression = plan.semanticDecisions.find((decision) => decision.primitiveId.startsWith("progressive-sequence"));

    expect(progression?.decision).toBe("preserve");
    expect(progression?.suitabilityScore).toBeGreaterThanOrEqual(75);
    expect(progression?.adaptation).toContain("invent target-native geometry");
    expect(plan.premiumQualityTargets.join(" ")).toContain("current stage dominant");
  });

  it("rejects an onboarding progression scaffold for ordinary conversation", () => {
    const plan = buildSemanticTransferPlan({
      referenceAnalysis: onboardingReference,
      screenName: "Chat Interface",
      screenDescription: "A continuous assistant conversation that helps the user with their workflow today.",
      screenType: "root",
    });
    const progression = plan.semanticDecisions.find((decision) => decision.primitiveId.startsWith("progressive-sequence"));
    const depth = plan.semanticDecisions.find((decision) => decision.primitiveId.startsWith("layered-depth"));
    const focal = plan.semanticDecisions.find((decision) => decision.primitiveId.startsWith("focal-anchor"));

    expect(progression?.decision).toBe("reject");
    expect(progression?.suitabilityScore).toBeLessThan(50);
    expect(depth?.decision).not.toBe("reject");
    expect(focal?.decision).not.toBe("reject");
  });

  it("allows a cautious reinterpretation when a chat truly contains a staged workflow", () => {
    const plan = buildSemanticTransferPlan({
      referenceAnalysis: onboardingReference,
      screenName: "Deployment Assistant",
      screenDescription: "Chat with an embedded tool-execution timeline showing ordered workflow stages.",
      screenType: "root",
    });
    const progression = plan.semanticDecisions.find((decision) => decision.primitiveId.startsWith("progressive-sequence"));

    expect(progression?.decision).toBe("reinterpret");
    expect(progression?.suitabilityScore).toBeGreaterThanOrEqual(50);
    expect(progression?.suitabilityScore).toBeLessThan(75);
  });

  it("does not let planner prose upgrade a rejected primitive", () => {
    const contract = normalizeReferenceTransferContract({
      mode: "style",
      screenName: "Chat Interface",
      screenDescription: "A continuous assistant conversation.",
      screenType: "root",
      referenceAnalysis: onboardingReference,
      value: {
        layout_source: "reference",
        preserve: [],
        adapt: ["Reuse the connector and three cards as chat bubbles."],
        reject: [],
        rationale: "Copy the source composition.",
        semantic_decisions: [{
          primitive_id: "progressive-sequence-screen-1",
          decision: "preserve",
          rationale: "It looks premium.",
          adaptation: "Reuse the same vertical connector and card positions.",
        }],
      },
    });
    const progression = contract.semanticDecisions.find((decision) => decision.primitiveId.startsWith("progressive-sequence"));

    expect(progression?.decision).toBe("reject");
    expect(progression?.adaptation).toBeNull();
    expect(contract.layoutSource).toBe("screen-purpose");
    expect(contract.adapt.join(" ")).not.toContain("Reuse the connector");
  });

  it("formats design reasoning but never the source layout sentence", () => {
    const library = formatSemanticCompositionLibrary(onboardingReference);

    expect(library).toContain("SEMANTIC COMPOSITION LIBRARY");
    expect(library).toContain("Legible progression");
    expect(library).not.toContain(onboardingReference.screenReferences[0].layoutSummary);
    expect(library).not.toContain("Three status modules");
  });

  it("normalizes analyst-provided primitives for persistence", () => {
    const result = normalizeReferenceAnalysis({
      ...onboardingReference,
      semanticCompositionPrimitives: [{
        id: "intentional-focus",
        kind: "focal-anchor",
        label: "Intentional focus",
        purpose: "Establish one unmistakable first read.",
        sourceEvidence: "Three cards are connected in the same vertical positions.",
        transferableTraits: ["single first read"],
        suitableFor: ["onboarding", "detail-inspection"],
        avoidFor: [],
        adaptationGuidance: "Choose a target-native focal object.",
        qualityDetails: ["Protect negative space around the focal object."],
        strength: "primary",
        sourceScreenIndex: 1,
      }],
    });

    expect(result.analysis?.semanticCompositionPrimitives?.[0]).toMatchObject({
      id: "intentional-focus",
      kind: "focal-anchor",
      strength: "primary",
    });
    expect(result.analysis?.semanticCompositionPrimitives?.[0].sourceEvidence).not.toContain("Three cards");
  });
});