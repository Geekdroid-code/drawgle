import { describe, expect, it } from "vitest";

import { normalizeDesignTokens } from "@/lib/design-tokens";
import {
  buildCreativeDirectionInstruction,
  buildDesignInstruction,
  buildPromptScreenInstruction,
  buildRecreateScreenInstruction,
  buildStyleScreenInstruction,
  plannerBlueprintStepInstruction,
  plannerScreenBriefStepInstruction,
  referenceAnalysisStyleInstruction,
} from "@/lib/generation/prompts";
import type { GenerationPromptMode } from "@/lib/generation/prompt-routing";
import type { NavigationPlan, ScreenAssetManifest, ScreenPlan } from "@/lib/types";

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
  it("passes the planned visual family to screen builders without changing exact recreation", () => {
    const screenFamilyContract = {
      summary: "One restrained family",
      surfaces: "Flat lists with a single raised focal surface",
      typography: "Shared heading and body rhythm",
      spacing: "One 20px content rail",
      navigation: "One shared navigation shell",
      imagery: "Use imagery only when the task needs it",
      consistencyRules: ["Keep control geometry consistent", "Do not clone another screen's layout"],
    };
    const input = { ...screenInput, screenFamilyContract };
    const style = buildStyleScreenInstruction(input);
    expect(style).toContain("One restrained family");
    expect(style).toContain("Do not turn a surface cue into a card around every section");
    expect(buildPromptScreenInstruction(input)).toContain("Keep control geometry consistent");
    expect(buildRecreateScreenInstruction(input)).not.toContain("One restrained family");
  });

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
      '"system_schema": "mobile_universal_core"',
      '"recommendedFonts"',
      '"heading_font_family"',
      '"body_font_family"',
      '"screen_margin"',
      '"radii"',
      '"shadows"',
      '"gradients"',
      '"navigation"',
      "Use 16px as the production baseline",
      "SURFACE LADDER",
      "Use radii.app for outer cards",
      "Use radii.inner for nested cards",
      "Use radii.pill only for true capsules",
      "Use border_widths.standard as the default border weight",
      'shadows.surface is "none" unless the evidence shows cast shadows',
      "Use gradients as first-class material tokens",
      "Keep token relationships coherent",
      "Keep touch targets mobile-safe",
      "Output ONLY valid JSON",
    ];

    for (const mode of modes) {
      expectContainsEvery(buildDesignInstruction(mode), commonRules);
    }
  });

  it("asks for a surface ladder instead of one card recipe, in every mode", () => {
    for (const mode of modes) {
      const instruction = buildDesignInstruction(mode);
      expect(instruction).toContain("page, then card (raised: a neutral one tone step lighter than the page, never stark white on a tinted page)");
      expect(instruction).toContain("then inset (tiles and fields inside cards");
      expect(instruction).toContain("then tints (pastel wells and chips)");
      expect(instruction).toContain("at most one strong dark control");
      expect(instruction).toContain("cards are at most 24px, inset surfaces use the inner radius, controls are pills, and icon wells are circles");
      expect(instruction).toContain('"inset": "HEX one tone step from card"');
      expect(instruction).toContain("color.surface.card is the raised surface and color.surface.inset the tile or field inside it");
      // the old single-recipe instruction is gone
      expect(instruction).not.toContain("prefer a single standard surface radius");
      expect(instruction).not.toContain("a single standard surface shadow");
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
      "Every screen brief must include these exact uppercase section labels",
      "Every screen must also include layout_contract",
      "Each screen brief must be builder-ready",
      "Push past generic list layouts",
      "Creative direction is the product-wide art-direction thesis",
      "compact product roadmap",
      "Never fabricate generic Home/Search/Profile filler",
    ];
    const screenRules = [
      "SCREEN BRIEFS ONLY",
      "SCREEN PURPOSE:",
      "INFORMATION HIERARCHY:",
      "LAYOUT ANATOMY:",
      "KEY COMPONENTS:",
      "PREMIUM DESIGN DECISIONS:",
      "INTERACTION:",
      "MUST PRESERVE:",
      "ScreenFamilyContract is CONTEXT, not OUTPUT",
      "Screen-specific decisions over vague placeholders",
      "Human design language vs. tokens",
      "Layout geometry vs. token implementation",
      "900-1800 chars",
      "no generic stacked blocks",
      "Component specificity",
      "Viewport fit",
      "Final self-audit",
    ];

    for (const mode of modes) {
      expectContainsEvery(plannerBlueprintStepInstruction(mode), blueprintRules);
      expectContainsEvery(plannerScreenBriefStepInstruction(mode), [...blueprintRules.slice(0, 9), ...screenRules]);
      expect(plannerScreenBriefStepInstruction(mode)).toContain("Do not output Drawgle utility names, CSS variables, Tailwind classes, token identifiers");
      expect(plannerScreenBriefStepInstruction(mode)).toContain("Layout geometry is the planner responsibility");
      expect(plannerScreenBriefStepInstruction(mode)).toContain("ScreenFamilyContract is CONTEXT, not OUTPUT");
      expect(plannerScreenBriefStepInstruction(mode)).toContain("NEVER restate, echo, or summarize them inside the screen description");
    }
  });

  it("keeps materials and values out of style-mode briefs and leaves them to the reference", () => {
    const style = plannerScreenBriefStepInstruction("style");
    // materials belong to the reference and its preset; the rule stays for the other modes
    expect(style).not.toContain("Material specificity");
    expect(plannerScreenBriefStepInstruction("prompt")).toContain("Material specificity");
    expect(plannerScreenBriefStepInstruction("recreate")).toContain("Material specificity");

    // MUST PRESERVE names structure only
    expect(style).toContain("MUST PRESERVE: Only structure whose loss would materially damage this screen: which components appear, the focal element and the content order. Never token values, sizes, colours or materials.");
    expect(plannerScreenBriefStepInstruction("prompt")).toContain("MUST PRESERVE: Only screen-specific structural decisions whose loss would materially damage this screen.");

    // the eight decisions are about content, hierarchy and components, not values
    expect(style).toContain("at least 8 concrete decisions about content, hierarchy and components");
    expect(style).toContain("px, hex or opacity values");
    expect(plannerScreenBriefStepInstruction("prompt")).toContain("at least 8 concrete visible layout and composition decisions");

    // the reference's components can be named in the brief
    expect(style).toContain("REFERENCE COMPONENT MAPPING");
    expect(style).toContain("Never reproduce the reference's sections, their order or its content.");
    expect(plannerScreenBriefStepInstruction("prompt")).not.toContain("REFERENCE COMPONENT MAPPING");

    // the mode contract no longer asks the planner to write materials, shadows or radii
    expect(style).not.toContain("material quality, shadows, radii, blur/glass");
    expect(style).toContain("the plan names structure and intent, never values");
  });

  it("plans sample people and pets as photos and flags only the user's own identity", () => {
    for (const mode of modes) {
      const instruction = plannerScreenBriefStepInstruction(mode);
      expect(instruction).toContain("Sample people and pets (family members, pet profiles, team avatars) are planned like any other photo: role avatar, assetType photo, desiredAspectRatio 1:1.");
      expect(instruction).toContain("Set userIdentity true only for the signed-in user's own face or their brand's logo, which only they can supply.");
    }
  });

  it("gives a style reference the art direction instead of a second creative direction", () => {
    const withReference = plannerBlueprintStepInstruction("style", { referenceDrivesDirection: true });
    const withoutReference = plannerBlueprintStepInstruction("style");

    expect(withReference).not.toContain('"creativeDirection"');
    expect(withReference).not.toContain("Creative direction is the product-wide art-direction thesis");
    expect(withReference).toContain("The style reference is the product-wide art direction.");
    expect(withReference).toContain("charter.designRationale must be executable layout rules");
    expect(withReference).not.toContain("creativeDirection.compositionPrinciples");
    // the blueprint JSON is still well formed around the removed block
    expect(withReference).toContain('"designRationale": "Human layout contract: viewport budget, horizontal rail, vertical rhythm, nav reservation, card density, wrapping/truncation policy, and consistency rules."\n  }\n}');
    // a design style without a reference, and prompt mode, keep their creative direction
    expect(withoutReference).toContain('"creativeDirection"');
    expect(withoutReference).toContain("Creative direction is the product-wide art-direction thesis");
    expect(plannerBlueprintStepInstruction("prompt", { referenceDrivesDirection: true })).toContain('"creativeDirection"');
    // both style variants tell the planner to keep values out of the charter
    for (const instruction of [withReference, withoutReference]) {
      expect(instruction).toContain("Never write px or pt sizes, hex colours, opacity or blur values into the charter");
    }
    expect(plannerBlueprintStepInstruction("prompt")).not.toContain("Never write px or pt sizes, hex colours");
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
      "TOKEN CONTEXT",
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
    expect(style).toContain("Do not clone a curated or uploaded style screenshot's domain content");
    expect(prompt).toContain("MODE CONTRACT: PROMPT_ONLY");
    expect(prompt).not.toContain("When a style reference image is attached");
    expect(prompt).not.toContain("prioritize its exact original structure and material choices");
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

    expect(instruction).toContain("Semantic composition decisions");
    expect(instruction).toContain("progressive-sequence-screen-1: REJECT");
    expect(instruction).toContain("layered-depth-screen-1: PRESERVE");
    expect(instruction).toContain("Premium quality targets");
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
});

describe("builder inputs that carry the reference's component vocabulary", () => {
  const component = {
    name: "calendar-strip",
    use: "A week selector at the top of a day view",
    html: `<div class="dg-surface-card dg-radius-app flex gap-2 p-[var(--dg-spacing-sm)]"><div class="dg-tint-1 dg-radius-pill">Mon</div></div>`,
  };
  const transfer = {
    layoutSource: "screen-purpose" as const,
    preserve: ["Warm tonal surfaces."],
    adapt: ["Use depth for message ownership."],
    reject: [],
    rationale: "The user job owns layout.",
    targetCapabilities: ["conversation" as const],
    semanticDecisions: [{
      primitiveId: "layered-depth-screen-1",
      decision: "preserve" as const,
      suitabilityScore: 75,
      targetCapability: "conversation" as const,
      rationale: "Plane hierarchy clarifies authorship.",
      adaptation: "Use depth for message ownership.",
      qualityTargets: ["Radius should be at least 24px."],
    }],
    premiumQualityTargets: ["Radius should be at least 24px.", "Create one dominant first read."],
  };
  const tokensWithLadder = normalizeDesignTokens({
    system_schema: "mobile_universal_core",
    tokens: {
      color: {
        background: { primary: "#F2EADC", secondary: "#EDE4D2" },
        surface: { card: "#F7F4E8", inset: "#EDEAD7", bottom_sheet: "#F7F4E8", modal: "#F7F4E8" },
        accent_tints: { "1": "#F6E3C3", "2": "#E8EBC9", "3": "#E7DDE9", "4": "#D9E6EE" },
        text: { high_emphasis: "#211E1E", medium_emphasis: "#5C5650", low_emphasis: "#8A847C" },
        action: { primary: "#FEC068", secondary: "#A8B89A", on_primary_text: "#211E1E" },
        border: { divider: "#E4DCCB", focused: "#FEC068" },
      },
      radii: { app: "20px", inner: "12px", pill: "9999px" },
      shadows: { surface: "none", overlay: "0 -8px 40px rgba(33,30,30,0.16)" },
    },
  });
  const oldTokens = normalizeDesignTokens({
    system_schema: "mobile_universal_core",
    tokens: {
      color: {
        background: { primary: "#FFFFFF" },
        surface: { card: "#F5F5F5" },
        text: { high_emphasis: "#111111" },
        action: { primary: "#2563EB" },
      },
      radii: { app: "18px", inner: "12px", pill: "9999px" },
      shadows: { surface: "0 12px 32px rgba(15,23,42,0.14)" },
    },
  });
  const sharedNavigation: NavigationPlan = {
    version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs",
    evidence: { source: "product-architecture", reason: "Peer areas" },
    items: [
      { id: "today", label: "Today", icon: "home", role: "Day view", availability: "generated", linkedScreenName: "Dashboard" },
      { id: "pets", label: "Pets", icon: "paw-print", role: "Pet list", availability: "planned", linkedScreenName: null },
    ],
    design: { anatomy: "floating-dock", width: "content", labels: "active-only", activeTreatment: "compact-chip", surface: "solid",
      radiusPx: 32, safeAreaOffsetPx: 16, itemGapPx: 8, iconSizePx: 22, border: false, elevation: "low", centerActionItemId: null },
    visualBrief: "Attached dock",
    screenChrome: [{ screenName: "Dashboard", chrome: "bottom-tabs", navigationItemId: "today" }],
  };

  describe("the style components block", () => {
    it("reaches a style builder, with its rules, after the family contract and before navigation", () => {
      const style = buildStyleScreenInstruction({
        ...screenInput,
        screenFamilyContract: {
          summary: "Quiet family", surfaces: "Tonal", typography: "One pair", spacing: "One rail", navigation: "None", imagery: "Photos", consistencyRules: [],
        },
        styleComponents: [component],
      });
      expect(style).toContain("STYLE COMPONENTS (this project's reference vocabulary.");
      expect(style).toContain("- calendar-strip — A week selector at the top of a day view — <div class=\"dg-surface-card");
      expect(style).toContain("Never reproduce the reference's sections, their order or its content");
      expect(style.indexOf("SCREEN FAMILY CONTRACT")).toBeLessThan(style.indexOf("STYLE COMPONENTS"));
      expect(style.indexOf("STYLE COMPONENTS")).toBeLessThan(style.indexOf("NAVIGATION ARCHITECTURE CONTRACT"));
    });

    it("is absent without components, and never sent to Image to UI or a prompt-only build", () => {
      expect(buildStyleScreenInstruction(screenInput)).not.toContain("STYLE COMPONENTS");
      expect(buildStyleScreenInstruction({ ...screenInput, styleComponents: [] })).not.toContain("STYLE COMPONENTS");
      expect(buildRecreateScreenInstruction({ ...screenInput, styleComponents: [component] } as never)).not.toContain("STYLE COMPONENTS");
      expect(buildPromptScreenInstruction({ ...screenInput, styleComponents: [component] } as never)).not.toContain("STYLE COMPONENTS");
    });

    it("keeps the block inside its size budget on every build", () => {
      const huge = Array.from({ length: 30 }, (_, index) => ({ ...component, name: `component-${index}`, html: `<div>${"x".repeat(650)}</div>` }));
      const block = buildStyleScreenInstruction({ ...screenInput, styleComponents: huge })
        .split("STYLE COMPONENTS")[1].split("NAVIGATION ARCHITECTURE CONTRACT")[0];
      expect(block.length).toBeLessThan(6300);
      expect(block.match(/\n- component-/g)?.length).toBeLessThanOrEqual(10);
    });

    it("drops the semantic quality targets it would duplicate, and keeps the composition decisions", () => {
      const plan = { ...screenPlan, referenceTransfer: transfer };
      const without = buildStyleScreenInstruction({ ...screenInput, screenPlan: plan });
      const withComponents = buildStyleScreenInstruction({ ...screenInput, screenPlan: plan, styleComponents: [component] });

      expect(without).toContain("Premium quality targets: Radius should be at least 24px. | Create one dominant first read.");
      expect(withComponents).not.toContain("Premium quality targets");
      expect(withComponents).not.toContain("Radius should be at least 24px");
      expect(withComponents).toContain("layered-depth-screen-1: PRESERVE");
      expect(withComponents).toContain("Use depth for message ownership.");
      expect(withComponents).toContain("REFERENCE TRANSFER CONTRACT");
    });
  });

  describe("the strict design contract", () => {
    it("describes the surface ladder and the radius roles when the tokens define them", () => {
      const style = buildStyleScreenInstruction({ ...screenInput, designTokens: tokensWithLadder });
      expect(style).toContain("Surface ladder, back to front: page (dg-bg-primary) → card (dg-surface-card) → inset tile or field inside a card (dg-surface-inset) → pastel tint wells and chips (dg-tint-1 to dg-tint-4) → one focal accent (dg-action-primary or a token gradient) → at most one strong dark control.");
      expect(style).toContain("Radius roles: card 20px (cards, sheets, panels, fields, and navigation shells); inner 12px (tiles and fields inside a card, segmented tabs, and active navigation items); pill 9999px (capsule controls); circle 9999px on a square element (icon wells and avatars).");
      expect(style).toContain("Shadows: only where a token defines one. Surface shadow: none, so cards separate by tone.");
      // the single card recipe is gone
      expect(style).not.toContain("Outer surface radius");
      expect(style).not.toContain("Standard surface shadow");
    });

    it("keeps to the rungs an older project has, and names its shadow", () => {
      const style = buildStyleScreenInstruction({ ...screenInput, designTokens: oldTokens });
      // the token guide lists every utility class; the contract lists only the rungs this project defines
      const contract = style.split("STRICT DESIGN CONTRACT:")[1].split("NAVIGATION ARCHITECTURE CONTRACT:")[0];
      expect(contract).toContain("Surface ladder, back to front: page (dg-bg-primary) → card (dg-surface-card) → one focal accent (dg-action-primary or a token gradient) → at most one strong dark control.");
      expect(contract).not.toContain("dg-surface-inset");
      expect(contract).not.toContain("dg-tint-1");
      expect(contract).toContain("Surface shadow: 0 12px 32px rgba(15,23,42,0.14).");
    });

    it("reads the same in every mode", () => {
      for (const instruction of [
        buildRecreateScreenInstruction({ ...screenInput, designTokens: tokensWithLadder }),
        buildStyleScreenInstruction({ ...screenInput, designTokens: tokensWithLadder }),
        buildPromptScreenInstruction({ ...screenInput, designTokens: tokensWithLadder }),
      ]) {
        expect(instruction).toContain("Surface ladder, back to front");
        expect(instruction).toContain("Radius roles: card 20px");
      }
    });
  });

  describe("a project with no shared navigation", () => {
    const noNavigation = "This project has no persistent bottom navigation. Do not draw a tab bar, dock, bottom navigation, or a floating button that stands in for one. Use this screen's chrome:";

    it("is told so, with the chrome its screen does use", () => {
      const root = buildStyleScreenInstruction({ ...screenInput, navigationPlan: { ...sharedNavigation, enabled: false } });
      expect(root).toContain(`NO SHARED NAVIGATION:\n${noNavigation} a top app bar or an anchored header.`);
      expect(root).not.toContain("SHARED NAVIGATION CONTRACT");

      const detail = buildStyleScreenInstruction({ ...screenInput, screenPlan: { ...screenPlan, type: "detail" } });
      expect(detail).toContain(`${noNavigation} a top app bar with a back affordance.`);
      expect(buildPromptScreenInstruction(screenInput)).toContain(noNavigation);
    });

    it("says nothing of the kind when the project has shared navigation", () => {
      const withNavigation = buildStyleScreenInstruction({ ...screenInput, navigationPlan: sharedNavigation, requiresBottomNav: true });
      expect(withNavigation).toContain("SHARED NAVIGATION CONTRACT:");
      expect(withNavigation).toContain("Do not output <nav>, <footer>, bottom tabs, tab bars, docks");
      expect(withNavigation).not.toContain("NO SHARED NAVIGATION");
      expect(withNavigation).not.toContain("no persistent bottom navigation");
    });

    it("leaves Image to UI and a screen that owns its own navigation alone", () => {
      // exact recreation reproduces whatever navigation the source frame shows
      expect(buildRecreateScreenInstruction(screenInput)).not.toContain("no persistent bottom navigation");
      // a legacy project without a navigation plan still draws its primary navigation in the screen
      const legacy = buildStyleScreenInstruction({
        ...screenInput,
        requiresBottomNav: true,
        navigationArchitecture: {
          kind: "bottom-tabs-app", primaryNavigation: "bottom-tabs", rootChrome: "bottom-tabs", detailChrome: "top-bar-back",
          consistencyRules: [], rationale: "Legacy tabs",
        },
      });
      expect(legacy).toContain("primaryNav=render in this screen");
      expect(legacy).not.toContain("no persistent bottom navigation");
      expect(legacy).not.toContain("NO SHARED NAVIGATION");
    });
  });
});
