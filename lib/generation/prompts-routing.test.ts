import { describe, expect, it } from "vitest";

import { TOKEN_SCHEMA_V2 } from "@/lib/design-token-classification";
import {
  buildCreativeDirectionInstruction,
  buildDesignInstruction,
  buildPromptScreenInstruction,
  buildRecreateScreenInstruction,
  buildScreenInstructionForMode,
  buildStyleScreenInstruction,
  plannerBlueprintStepInstruction,
  plannerScreenBriefStepInstruction,
  referenceAnalysisStyleInstruction,
} from "@/lib/generation/prompts";
import type { GenerationPromptMode } from "@/lib/generation/prompt-routing";
import type { AssetRequirement, ScreenAssetManifest, ScreenPlan } from "@/lib/types";

const modes: GenerationPromptMode[] = ["recreate", "style", "prompt"];

const expectContainsEvery = (instruction: string, rules: string[]) => {
  for (const rule of rules) {
    expect(instruction, `missing legacy quality rule: ${rule}`).toContain(rule);
  }
};

const screenPlan: ScreenPlan = {
  name: "Dashboard",
  type: "root",
  description: "A product-specific dashboard with a constructed focal hero and supporting content rail.",
};

const screenInput = {
  designTokens: null,
  designStyle: null,
  screenPlan,
  prompt: "Build a premium product dashboard.",
  requiresBottomNav: false,
  navigationArchitecture: null,
  navigationPlan: null,
  assetManifest: [],
};

const screenInstruction = (mode: GenerationPromptMode) => mode === "recreate"
  ? buildRecreateScreenInstruction(screenInput)
  : mode === "style"
    ? buildStyleScreenInstruction(screenInput)
    : buildPromptScreenInstruction(screenInput);

describe("state-scoped prompt construction", () => {
  it("keeps every legacy creative-direction quality rule in all three modes", () => {
    const commonRules = [
      "elite mobile product Art Director",
      "Return strictly valid JSON",
      "Do not output bland phrases",
      "reusable across multiple screens",
      "Tie the direction to the product domain and audience",
      "Favor premium restraint plus one or two memorable signature moves",
      "Signature moments should describe visible composition patterns",
      "avoid list must explicitly call out generic AI-generated UI habits",
      "specific enough that a planner, token generator, and builder",
    ];

    for (const mode of modes) {
      expectContainsEvery(buildCreativeDirectionInstruction(mode), commonRules);
    }
  });

  it("gives creative direction exactly one application-selected mode contract", () => {
    const recreate = buildCreativeDirectionInstruction("recreate");
    const style = buildCreativeDirectionInstruction("style");
    const prompt = buildCreativeDirectionInstruction("prompt");

    expect(recreate).toContain("MODE CONTRACT: IMAGE_TO_UI");
    expect(recreate).not.toContain("MODE CONTRACT: STYLE_REFERENCE");
    expect(recreate).not.toContain("MODE CONTRACT: PROMPT_ONLY");
    expect(style).toContain("MODE CONTRACT: STYLE_REFERENCE");
    expect(style).not.toContain("MODE CONTRACT: IMAGE_TO_UI");
    expect(style).not.toContain("MODE CONTRACT: PROMPT_ONLY");
    expect(prompt).toContain("MODE CONTRACT: PROMPT_ONLY");
    expect(prompt).not.toContain("MODE CONTRACT: IMAGE_TO_UI");
    expect(prompt).not.toContain("MODE CONTRACT: STYLE_REFERENCE");
  });

  it("keeps the complete design-token schema and discipline in every mode", () => {
    const commonRules = [
      "comprehensive, production-grade Design Token System",
      `"system_schema": "${TOKEN_SCHEMA_V2}"`,
      '"recommendedFonts"',
      '"heading_font_family"',
      '"body_font_family"',
      '"screen_margin"',
      '"radii"',
      '"shadows"',
      '"gradients"',
      '"navigation"',
      "Use 16px as the production baseline",
      "one outer surface radius",
      "one smaller inner/inset radius",
      "Use radii.app for outer cards",
      "Use radii.inner for nested cards",
      "Primary CTAs and segmented items use it only when the deterministic component shape policy explicitly authorizes that role",
      "Use border_widths.standard as the default border weight",
      "Use shadows.surface for standard elevated surfaces",
      // The optional gradients are the template tell: applied to every project
      // they make every generated app look like the same recipe.
      "gradients.action_primary is required",
      "The other three are optional",
      "Keep token relationships coherent",
      "Keep touch targets mobile-safe",
      "Output ONLY valid JSON",
    ];

    for (const mode of modes) {
      expectContainsEvery(buildDesignInstruction(mode), commonRules);
    }
  });

  it("isolates design-token evidence rules by mode", () => {
    const recreate = buildDesignInstruction("recreate");
    const style = buildDesignInstruction("style");
    const prompt = buildDesignInstruction("prompt");

    expect(recreate).toContain("MODE CONTRACT: IMAGE_TO_UI");
    expect(recreate).toContain("structural reference image");
    expect(style).toContain("MODE CONTRACT: STYLE_REFERENCE");
    expect(style).toContain("visual DNA only");
    expect(prompt).toContain("MODE CONTRACT: PROMPT_ONLY");
    expect(prompt).toContain("no image, reference analysis, or approved design-style contract exists");
    expect(prompt).not.toContain("structural reference image");
    expect(prompt).not.toContain("visual DNA only");
  });

  it("preserves planner architecture and screen-brief quality rules in every mode", () => {
    const blueprintRules = [
      "expert mobile UX Architect",
      "Return strictly valid JSON only",
      "390px mobile viewport",
      "one spacing scale, typography hierarchy, surface language, icon rhythm, and navigation family",
      "Every screen brief must include these labels",
      "Every screen must also include layout_contract",
      "Each screen brief must be builder-ready",
      "Push past generic list layouts",
      "Creative direction is the product-wide art-direction thesis",
      "compact product roadmap",
      "Never fabricate generic Home/Search/Profile filler",
    ];
    const screenRules = [
      "SCREEN BRIEFS ONLY",
      "Description quality",
      "900-1800 chars",
      "Creative latitude",
      "Component specificity",
      "Material specificity",
      "Viewport fit",
      "Final self-audit",
    ];

    for (const mode of modes) {
      expectContainsEvery(plannerBlueprintStepInstruction(mode), blueprintRules);
      expectContainsEvery(plannerScreenBriefStepInstruction(mode), [...blueprintRules.slice(0, 9), ...screenRules]);
    }
  });

  it("isolates planner mode rules instead of asking the model to branch", () => {
    const recreate = plannerScreenBriefStepInstruction("recreate");
    const style = plannerScreenBriefStepInstruction("style");
    const prompt = plannerScreenBriefStepInstruction("prompt");

    expect(recreate).toContain("MODE: USER_RECREATE");
    expect(recreate).toContain("recreate mode needs at least 3 reference-traceable cues");
    expect(style).toContain("MODE: STYLE_REFERENCE");
    expect(style).toContain("style mode needs at least 3 borrowed visual invariants");
    expect(prompt).toContain("MODE: PROMPT_ONLY");
    expect(prompt).toContain("prompt-only mode needs at least 3 concrete cues");
    expect(prompt).not.toContain("recreate mode needs");
    expect(prompt).not.toContain("style mode needs");
  });

  it("keeps the complete screen-builder quality contract in every mode", () => {
    const commonRules = [
      "expert mobile UI designer and frontend developer",
      "CRITICAL INSTRUCTION 0: SCREEN SPEC FIDELITY",
      "CRITICAL INSTRUCTION 0.25: STRUCTURAL DEPTH",
      "CRITICAL INSTRUCTION 0.5: STRUCTURAL AND MATERIAL FIDELITY",
      "CRITICAL INSTRUCTION 0.75: HUMAN LAYOUT PREFLIGHT",
      "CRITICAL INSTRUCTION 1: LIVE DESIGN TOKENS",
      "dg-radius-inner",
      "STRICT DESIGN CONTRACT",
      "NAVIGATION ARCHITECTURE CONTRACT",
      "APPROVED VISUAL ASSET MANIFEST",
      "OUTPUT RULES",
      "Do NOT flatten a highly specific composition",
      "Every chart, map, gauge, progress ring, or visual panel must contain visible constructed geometry",
      "Final self-audit",
      "DRAWGLE_GENERATION_COMPLETE",
    ];

    for (const mode of modes) {
      expectContainsEvery(screenInstruction(mode), commonRules);
    }
  });

  it("isolates builder evidence and retains screenshot fidelity only for recreate", () => {
    const recreate = screenInstruction("recreate");
    const style = screenInstruction("style");
    const prompt = screenInstruction("prompt");

    expect(recreate).toContain("MODE CONTRACT: IMAGE_TO_UI");
    expect(recreate).toContain("prioritize its exact original structure and material choices");
    expect(style).toContain("MODE CONTRACT: STYLE_REFERENCE");
    expect(style).toContain("When a guarded style-calibration image is attached");
    expect(style).toContain("study its composition intelligence and craft");
    expect(style).toContain("do use its design taste rather than reducing it to colors and radii");
    expect(style).not.toContain("prioritize its exact original structure and material choices");
    expect(prompt).toContain("MODE CONTRACT: PROMPT_ONLY");
    expect(prompt).not.toContain("When a style reference image is attached");
    expect(prompt).not.toContain("prioritize its exact original structure and material choices");
  });

  it("uses the explicit resolved style mode even when no raw image reaches the builder", () => {
    const instruction = buildScreenInstructionForMode({
      ...screenInput,
      promptMode: "style",
    });

    expect(instruction).toContain("MODE CONTRACT: STYLE_REFERENCE");
    expect(instruction).toContain("When a guarded style-calibration image is attached");
    expect(instruction).not.toContain("MODE CONTRACT: IMAGE_TO_UI");
    expect(instruction).not.toContain("MODE CONTRACT: PROMPT_ONLY");
  });

  it("keeps planner geometry out of style and prompt builder authority", () => {
    const constrainedPlan: ScreenPlan = {
      ...screenPlan,
      layoutContract: {
        version: 3,
        viewportPlan: "Fixed 44px header, 300px hero, and 80px rows.",
        focalHierarchy: "One prescribed hero followed by rows.",
        sectionRhythm: "24px only.",
        componentDensity: "Low density.",
        ctaPolicy: "Bottom-right action.",
        antiPatterns: [],
        regions: [{ id: "fixed-hero", purpose: "Prescribed hero", contentKind: "focal" }],
      },
    };

    const style = buildStyleScreenInstruction({ ...screenInput, screenPlan: constrainedPlan });
    const prompt = buildPromptScreenInstruction({ ...screenInput, screenPlan: constrainedPlan });
    const recreate = buildRecreateScreenInstruction({ ...screenInput, screenPlan: constrainedPlan });

    expect(style).not.toContain("SCREEN LAYOUT CONTRACT");
    expect(style).not.toContain("Fixed 44px header, 300px hero");
    expect(prompt).not.toContain("SCREEN LAYOUT CONTRACT");
    expect(recreate).toContain("SCREEN LAYOUT CONTRACT");
  });

  it("carries suitability decisions and premium craft targets through planner and builder prompts", () => {
    const planner = plannerScreenBriefStepInstruction("style");
    expect(planner).toContain("semantic_decisions");
    expect(planner).toContain("premium_quality_targets");
    expect(planner).toContain("Evaluate every supplied semantic primitive");
    expect(referenceAnalysisStyleInstruction).toContain("semanticCompositionPrimitives");
    expect(referenceAnalysisStyleInstruction).toContain("Extract 2-6");

    const instruction = buildStyleScreenInstruction({
      ...screenInput,
      screenPlan: {
        ...screenPlan,
        name: "Chat Interface",
        referenceTransfer: {
          layoutSource: "screen-purpose",
          preserve: ["Electric-blue emphasis on charcoal surfaces."],
          adapt: ["Use restrained plane hierarchy around conversation state."],
          reject: ["progressive-sequence: Ordinary conversation has no staged dependency."],
          rationale: "The user job owns layout while approved craft and suitable principles transfer.",
          targetCapabilities: ["conversation"],
          semanticDecisions: [{
            primitiveId: "progressive-sequence-screen-1",
            decision: "reject",
            suitabilityScore: 20,
            targetCapability: "conversation",
            rationale: "Progression would force onboarding anatomy into a continuous conversation.",
            adaptation: null,
            qualityTargets: [],
          }, {
            primitiveId: "layered-depth-screen-1",
            decision: "preserve",
            suitabilityScore: 75,
            targetCapability: "conversation",
            rationale: "Plane hierarchy clarifies authorship and system state.",
            adaptation: "Use depth for message ownership and transient tool state, with new chat-native geometry.",
            qualityTargets: ["Limit elevation to a small, legible set of planes."],
          }],
          premiumQualityTargets: ["Limit elevation to a small, legible set of planes."],
        },
      },
    });

    expect(instruction).toContain("Design craft to carry forward");
    expect(instruction).toContain("Electric-blue emphasis on charcoal surfaces");
    expect(instruction).toContain("Never import from the source");
    expect(instruction).toContain("Ordinary conversation has no staged dependency");
    expect(instruction).toContain("Quality bar");
    expect(instruction).toContain("Limit elevation to a small, legible set of planes");
  });

  it("gives every builder an exact deterministic asset-slot contract", () => {
    const asset: ScreenAssetManifest = {
      id: "asset-one",
      requirementId: "skincare-hero",
      role: "background_photo",
      url: "https://assets.example/skincare.webp",
      width: 1200,
      height: 800,
      hasAlpha: false,
      alt: "Luxury skincare serum",
      placementHint: "Full-bleed hero",
      objectFit: "cover",
      objectPosition: "center",
      source: "stock",
      provider: "pexels",
      critical: true,
      visibility: "public_reusable",
      semanticCategory: "beauty",
      semanticTags: ["skincare", "serum"],
      reusePolicy: "repeat",
      expectedUses: 1,
    };

    for (const instruction of [
      buildRecreateScreenInstruction({ ...screenInput, assetManifest: [asset] }),
      buildStyleScreenInstruction({ ...screenInput, assetManifest: [asset] }),
      buildPromptScreenInstruction({ ...screenInput, assetManifest: [asset] }),
    ]) {
      expect(instruction).toContain("requirementId=skincare-hero");
      expect(instruction).toContain('data-asset-slot="true"');
      expect(instruction).not.toContain(asset.url);
    }
  });

  it("lets a builder stream styled pending slots without exposing or inventing URLs", () => {
    const pending: AssetRequirement = {
      id: "plant-grid",
      screenName: "Dashboard",
      role: "product_photo",
      subject: "saved indoor plants",
      assetType: "photo",
      sourcePreference: "stock",
      desiredAspectRatio: "1:1",
      transparentBackground: false,
      placementHint: "Two-column saved plant grid",
      priority: "critical",
      reuseKey: "saved-plants",
      semanticCategory: "nature",
      semanticTags: ["plant", "indoor"],
      slotCount: 4,
      reusePolicy: "distinct",
    };
    const instruction = buildPromptScreenInstruction({
      ...screenInput,
      assetRequirements: [pending],
      assetManifest: [],
    });

    expect(instruction).toContain("Asset resolution is running concurrently");
    expect(instruction).toContain("requirementId=plant-grid");
    expect(instruction).toContain("slotCount=4");
    expect(instruction).toContain("data-asset-slot-index");
    expect(instruction).not.toContain("https://");
  });
});
