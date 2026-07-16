import { describe, expect, it } from "vitest";

import {
  buildCreativeDirectionInstruction,
  buildDesignInstruction,
  buildPromptScreenInstruction,
  buildRecreateScreenInstruction,
  buildStyleScreenInstruction,
  plannerBlueprintStepInstruction,
  plannerScreenBriefStepInstruction,
} from "@/lib/generation/prompts";
import type { GenerationPromptMode } from "@/lib/generation/prompt-routing";
import type { ScreenPlan } from "@/lib/types";

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

  it("keeps the complete legacy design-token schema and discipline in every mode", () => {
    const commonRules = [
      "comprehensive, production-grade Design Token System",
      '"system_schema": "mobile_universal_core"',
      '"recommendedFonts"',
      '"font_family"',
      '"screen_margin"',
      '"radii"',
      '"shadows"',
      '"gradients"',
      '"navigation"',
      "Use 16px as the production baseline",
      "single standard surface radius",
      "Use radii.app for standard cards",
      "Use radii.pill only for capsule-shaped controls",
      "Use border_widths.standard as the default border weight",
      "Use shadows.surface for standard elevated surfaces",
      "Use gradients as first-class material tokens",
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
      "no generic stacked blocks",
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
    expect(style).toContain("style mode needs at least 3 borrowed style cues");
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
});
