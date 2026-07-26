import { describe, expect, it } from "vitest";

import {
  buildPortableReferenceContext,
  createReferenceTransferContract,
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

  it("makes the target screen purpose authoritative in style mode", () => {
    const contract = createReferenceTransferContract({
      mode: "style",
      screenName: "Chat Interface",
      referenceAnalysis: analysis,
    });

    expect(contract.layoutSource).toBe("screen-purpose");
    expect(contract.preserve.join(" ")).toContain("electric blue");
    expect(contract.reject.join(" ")).toMatch(/connector|hero scaffold|card topology/i);
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
      },
    });

    expect(contract.layoutSource).toBe("screen-purpose");
    expect(contract.reject.join(" ")).toMatch(/section order|connector/i);
    expect(contract.rationale).not.toContain("Copy the onboarding layout");
    expect(contract.rationale).toContain("user job owns layout");
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
