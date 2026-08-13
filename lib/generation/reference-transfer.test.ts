import { describe, expect, it } from "vitest";

import {
  buildPortableReferenceContext,
  createReferenceTransferContract,
  findSourceContentQuarantineLeaks,
  normalizeReferenceTransferContract,
  toPortableCreativeDirection,
} from "@/lib/generation/reference-transfer";
import type { CreativeDirection, ReferenceAnalysis } from "@/lib/types";

const analysis: ReferenceAnalysis = {
  overallVisualStyle: "Dark technical UI with blue highlights.",
  screenCountEstimate: 1,
  screenReferences: [{
    index: 1,
    suggestedRole: "Onboarding",
    layoutSummary: "Three cards connected by a vertical spine.",
    visualHierarchy: "Cards descend toward a CTA.",
    components: ["status card", "connector line", "hero card"],
    stylingCues: [
      "charcoal surfaces with crisp blue borders",
      "thin vertical connector spine behind cards",
    ],
    interactionCues: ["single forward CTA"],
    copyPatterns: ["compact technical labels"],
    implementationNotes: ["connect the cards with a line"],
    compositionRules: ["use a centered vertical spine"],
    componentRules: ["stack three status cards"],
  }],
  designSystemSignals: {
    palette: "Charcoal, near-black, electric blue.",
    typography: "Compact grotesk with technical micro-labels.",
    surfaces: "Low-gloss dark panels with crisp borders.",
    iconography: "Small outlined utility icons.",
    density: "Dense but readable.",
    motionTone: "Precise and restrained.",
    layoutGrammar: "A vertical spine connects three stacked modules.",
    componentGrammar: "Nested status cards.",
    antiPatterns: "Avoid soft gradients.",
  },
  primaryNavigation: null,
  motifs: [{
    id: "dotted-chart-grid",
    description: "Dotted horizontal chart grid lines",
    functionalPurpose: "Help compare values inside a chart plot",
    sourceScreenIndexes: [1],
    scope: "component-local",
  }],
};

describe("reference transfer boundary", () => {
  it("keeps portable visual craft and excludes source anatomy", () => {
    const context = buildPortableReferenceContext(analysis);

    expect(context).toContain(analysis.designSystemSignals.palette);
    expect(context).toContain("charcoal surfaces with crisp blue borders");
    expect(context).not.toContain(analysis.designSystemSignals.layoutGrammar!);
    expect(context).not.toContain(analysis.screenReferences[0].layoutSummary);
    expect(context).not.toContain("connector spine");
  });

  it("keeps portable grouping grammar without treating it as a source template", () => {
    const portable = buildPortableReferenceContext({
      ...analysis,
      designSystemSignals: {
        ...analysis.designSystemSignals,
        layoutGrammar: "Balanced two-column grouping with one dominant and one supporting plane.",
        componentGrammar: "Rows use aligned icon, text, metadata, and trailing-action relationships.",
        spacingLogic: "Macro section gaps are visibly larger than internal row gaps.",
      },
    });
    expect(portable).toContain("Balanced two-column grouping");
    expect(portable).toContain("aligned icon, text, metadata");
    expect(portable).toContain("Macro section gaps");
  });

  it("carries literal source copy into quarantine, never preserve/adapt", () => {
    const contract = createReferenceTransferContract({
      mode: "style",
      screenName: "Pet Care Home",
      referenceAnalysis: {
        ...analysis,
        sourceContentEvidence: {
          domainSummary: "Fitness calorie tracker",
          terms: ["Calories"],
          entities: ["Morning Run"],
          actions: ["Log workout"],
          copyFragments: ["Daily goal"],
        },
      },
    });
    expect(contract.sourceContentQuarantine).toEqual(expect.arrayContaining(["Calories", "Morning Run", "Log workout", "Daily goal"]));
    expect(`${contract.preserve.join(" ")} ${contract.adapt.join(" ")}`).not.toContain("Calories");
  });

  it("does not apply the style-only content quarantine to structural recreation", () => {
    const contract = createReferenceTransferContract({
      mode: "recreate",
      screenName: "Referenced Screen",
      referenceAnalysis: {
        ...analysis,
        sourceContentEvidence: {
          domainSummary: "Fitness calorie tracker",
          terms: ["Calories"],
          entities: [],
          actions: ["Log workout"],
          copyFragments: ["Daily goal"],
        },
      },
    });
    expect(contract.sourceContentQuarantine).toEqual([]);
  });

  it("matches quarantined copy on term boundaries rather than inside target words", () => {
    const contract = createReferenceTransferContract({
      mode: "style",
      screenName: "Pet Care Home",
      referenceAnalysis: {
        ...analysis,
        sourceContentEvidence: {
          domainSummary: "Planning tool",
          terms: ["Plan"],
          entities: [],
          actions: [],
          copyFragments: [],
        },
      },
    });
    expect(findSourceContentQuarantineLeaks({ text: "A helpful planner", contract })).not.toContain("plan");
    expect(findSourceContentQuarantineLeaks({ text: "Open the plan", contract })).toContain("plan");
  });

  it("makes the target screen purpose authoritative in style mode", () => {
    const contract = createReferenceTransferContract({
      mode: "style",
      screenName: "Chat Interface",
      referenceAnalysis: analysis,
    });

    expect(contract.layoutSource).toBe("screen-purpose");
    expect(contract.version).toBe(2);
    expect(contract.preserve.join(" ")).toContain("electric blue");
    expect(contract.reject.join(" ")).toMatch(/connector|hero scaffold|card topology/i);
  });

  it("allows a component-local motif only in a matching named target region", () => {
    const chartContract = createReferenceTransferContract({
      mode: "style",
      screenName: "Performance",
      screenDescription: "A performance chart with supporting rows.",
      referenceAnalysis: analysis,
      screenLayoutRegions: [
        { id: "performance-plot", purpose: "Chart plot for comparing performance values", contentKind: "chart" },
        { id: "activity-list", purpose: "Recent activity rows", contentKind: "list" },
      ],
    });
    expect(chartContract.localMotifs).toContainEqual(expect.objectContaining({
      motifId: "dotted-chart-grid",
      decision: "allow-local",
      targetRegionIds: ["performance-plot"],
    }));

    const profileContract = createReferenceTransferContract({
      mode: "style",
      screenName: "Profile",
      screenDescription: "Profile settings and preferences.",
      referenceAnalysis: analysis,
      screenLayoutRegions: [{ id: "settings-list", purpose: "Profile settings rows", contentKind: "list" }],
    });
    expect(profileContract.localMotifs).toContainEqual(expect.objectContaining({
      motifId: "dotted-chart-grid",
      decision: "reject",
      targetRegionIds: [],
    }));
  });

  it("overrides a planner attempt to make a style reference structural", () => {
    const contract = normalizeReferenceTransferContract({
      mode: "style",
      screenName: "Chat Interface",
      referenceAnalysis: analysis,
      value: {
        layout_source: "reference",
        preserve: [],
        adapt: [],
        reject: [],
        rationale: "Copy the onboarding layout.",
        source_content_quarantine: ["Chat Interface"],
      },
    });

    expect(contract.layoutSource).toBe("screen-purpose");
    expect(contract.reject.join(" ")).toMatch(/section order|connector/i);
    expect(contract.rationale).not.toContain("Copy the onboarding layout");
    expect(contract.rationale).toContain("user job owns layout");
    expect(contract.sourceContentQuarantine).not.toContain("Chat Interface");
  });

  it("recomputes region assignments and ignores planner-authored unrelated mappings", () => {
    const withPrimitive: ReferenceAnalysis = {
      ...analysis,
      semanticCompositionPrimitives: [{
        id: "anchored-action",
        kind: "anchored-action",
        label: "Anchored action",
        purpose: "Keep the submit action reachable during form entry",
        sourceEvidence: "A local submit action",
        transferableTraits: ["reachable action"],
        suitableFor: ["form-entry"],
        avoidFor: [],
        adaptationGuidance: "Anchor the target submit action",
        qualityDetails: ["clear separation"],
        strength: "primary",
      }],
    };
    const contract = normalizeReferenceTransferContract({
      mode: "style",
      screenName: "Create Payment Link",
      screenDescription: "Form entry with a final submit action",
      referenceAnalysis: withPrimitive,
      screenLayoutRegions: [
        { id: "fields", purpose: "Payment form fields", contentKind: "form" },
        { id: "submit", purpose: "Submit payment link action", contentKind: "action" },
      ],
      value: {
        compositionAdaptations: [{
          sourcePrimitiveId: "anchored-action",
          principle: "Put it in the fields",
          targetRegionIds: ["fields"],
          functionalPurpose: "Planner-selected form placement",
        }],
      },
    });
    expect(contract.compositionAdaptations).toEqual([expect.objectContaining({
      sourcePrimitiveId: "anchored-action",
      sourcePrimitiveKind: "anchored-action",
      targetRegionIds: ["submit"],
    })]);
  });

  it("removes source composition and signature moments from saved art direction", () => {
    const direction: CreativeDirection = {
      conceptName: "Neural Spine",
      styleEssence: "Dark precise utility",
      colorStory: "Electric blue on charcoal",
      typographyMood: "Technical grotesk",
      surfaceLanguage: "Crisp dark panels",
      iconographyStyle: "Outlined",
      compositionPrinciples: ["Connect every screen with a vertical spine"],
      signatureMoments: ["Three connected cards"],
      motionTone: "Precise",
      avoid: ["Soft gradients"],
    };

    expect(toPortableCreativeDirection(direction)?.compositionPrinciples.join(" ")).not.toContain("vertical spine");
    expect(toPortableCreativeDirection(direction)?.conceptName).not.toBe("Neural Spine");
    expect(JSON.stringify(toPortableCreativeDirection(direction))).not.toContain("vertical spine");
    expect(toPortableCreativeDirection(direction)?.signatureMoments.join(" ")).not.toContain("connected cards");
  });
});
