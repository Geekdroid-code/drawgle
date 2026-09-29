import { describe, expect, it } from "vitest";

import {
  buildPortableReferenceContext,
  createReferenceTransferContract,
  formatReferenceTransferContract,
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

/** A px, pt, hex or opacity value: what a style reference must never hand to a planner. */
const VALUE = /\d+(?:\.\d+)?\s?(?:px|pt)\b|#[0-9a-f]{3,8}\b|\d+\s?%\s?opacity/i;

/** An analysis stored before the shape classes existed: its cues carry values. */
const numericAnalysis: ReferenceAnalysis = {
  ...analysis,
  radiusClass: "very-rounded",
  surfaceElevation: "flat-tone",
  screenReferences: [{
    ...analysis.screenReferences[0],
    stylingCues: ["Warm cream background (#FDFBF0)", "High corner radius (24pt+)", "Soft shadow 0 4px 20px rgba(0,0,0,0.04)"],
    spacingRules: ["24px between sections"],
    componentRules: ["Cards use a 24px radius"],
  }],
  designSystemSignals: {
    ...analysis.designSystemSignals,
    palette: "Warm cream (#FDFBF0) with peach (#F5B25A)",
    surfaces: "Cards with a 32px radius and a 4% opacity shadow",
  },
};

describe("reference transfer carries no design values", () => {
  it("describes shape and depth as categories and scrubs an older analysis", () => {
    const context = buildPortableReferenceContext(numericAnalysis);

    expect(context).not.toMatch(VALUE);
    expect(context).toContain("Shape and depth: generously rounded cards (cards are never pill-shaped); surfaces separate by tone alone");
    // the character survives; only the numbers go
    expect(context).toContain("Warm cream");
    expect(context).toContain("peach");
    expect(context).toContain("Cards with a radius and a shadow");
  });

  it("leaves an analysis without values exactly as it was", () => {
    const context = buildPortableReferenceContext(analysis);
    expect(context).toContain("charcoal surfaces with crisp blue borders");
    expect(context).not.toContain("Shape and depth:");
  });

  it("scrubs a saved art direction", () => {
    const direction: CreativeDirection = {
      conceptName: "Soft Ledger",
      styleEssence: "Calm tonal cards with a 32px radius",
      colorStory: "Warm cream (#FDFBF0) and peach",
      typographyMood: "Rounded grotesk",
      surfaceLanguage: "Flat tonal surfaces with a 4% opacity shadow",
      iconographyStyle: "Line icons at 1.5px",
      compositionPrinciples: ["Keep 24px between sections"],
      signatureMoments: ["One large focal card"],
      motionTone: "Calm",
      avoid: ["Hard shadows"],
    };
    expect(JSON.stringify(toPortableCreativeDirection(direction))).not.toMatch(VALUE);
    expect(toPortableCreativeDirection(direction)?.colorStory).toContain("Warm cream");
  });

  it("keeps a style transfer contract free of values, whether it is made or normalised", () => {
    const made = createReferenceTransferContract({ mode: "style", screenName: "Home", referenceAnalysis: numericAnalysis });
    expect(JSON.stringify(made)).not.toMatch(VALUE);
    expect(made.preserve.join(" ")).toContain("Warm cream");

    const normalised = normalizeReferenceTransferContract({
      mode: "style",
      screenName: "Home",
      referenceAnalysis: numericAnalysis,
      value: {
        layout_source: "screen-purpose",
        preserve: ["Warm cream background (#FDFBF0)"],
        adapt: ["Keep the corner radius at 32px"],
        reject: [],
        rationale: "Keep the tonal cards at 4% opacity",
        premium_quality_targets: ["Radius should be at least 24px"],
      },
    });
    expect(JSON.stringify(normalised)).not.toMatch(VALUE);
    expect(normalised.preserve.join(" ")).toContain("Warm cream background");
  });

  it("can leave the premium quality targets out, for a builder that has the components as markup", () => {
    const contract = createReferenceTransferContract({ mode: "style", screenName: "Chat Interface", referenceAnalysis: analysis });
    expect(contract.premiumQualityTargets.length).toBeGreaterThan(0);

    const full = formatReferenceTransferContract(contract);
    const lean = formatReferenceTransferContract(contract, { qualityDetails: false });
    expect(full).toContain("Premium quality targets:");
    expect(formatReferenceTransferContract(contract, { qualityDetails: true })).toBe(full);
    expect(lean).not.toContain("Premium quality targets");
    for (const target of contract.premiumQualityTargets) expect(lean).not.toContain(target);
    // the decisions, the adaptations and the rejections stay
    expect(lean).toContain("Layout authority: screen-purpose");
    expect(lean).toContain("Rejected transfer:");
    expect(lean).toContain("Rationale:");
    expect(lean).toContain("Semantic composition decisions:");
    expect(formatReferenceTransferContract(null, { qualityDetails: false })).toBe("");
  });

  it("does not touch the contracts of modes that reproduce or invent", () => {
    const recreate = createReferenceTransferContract({ mode: "recreate", screenName: "Home", referenceAnalysis: numericAnalysis });
    expect(recreate.preserve.join(" ")).toMatch(VALUE);
    const normalisedRecreate = normalizeReferenceTransferContract({
      mode: "recreate",
      screenName: "Home",
      referenceAnalysis: numericAnalysis,
      value: { layout_source: "reference", preserve: ["Card radius 24px"], adapt: [], reject: [], rationale: "Match the source." },
    });
    expect(normalisedRecreate.preserve).toEqual(["Card radius 24px"]);
  });
});
