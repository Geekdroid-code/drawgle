import { describe, expect, it } from "vitest";

import {
  buildCreativeDirectionInstruction,
  buildDesignInstruction,
  plannerBlueprintStepInstruction,
  plannerScreenBriefStepInstruction,
} from "@/lib/generation/prompts";

describe("generation prompt routing", () => {
  it("keeps the standard creative-direction path free of spatial-craft routing", () => {
    const instruction = buildCreativeDirectionInstruction({
      mode: "prompt",
      spatialCraftEnabled: false,
    });

    expect(instruction).toContain("MODE: PROMPT ONLY");
    expect(instruction).toContain('"conceptName"');
    expect(instruction).not.toContain("Spatial Craft Foundation is enabled");
    expect(instruction).not.toContain('"craftBlueprint"');
  });

  it("uses a dedicated wrapped schema only for spatial-craft direction", () => {
    const instruction = buildCreativeDirectionInstruction({
      mode: "prompt",
      spatialCraftEnabled: true,
    });

    expect(instruction).toContain('"creativeDirection"');
    expect(instruction).toContain('"craftBlueprint"');
    expect(instruction).not.toContain("When the user content says");
  });

  it.each(["prompt", "recreate", "style", "preset"] as const)(
    "retains the universal art-direction foundation in %s mode",
    (mode) => {
      const instruction = buildCreativeDirectionInstruction({
        mode,
        spatialCraftEnabled: false,
      });

      expect(instruction).toContain("product purpose, target audience, emotional tone, commercial positioning");
      expect(instruction).toContain("composition thesis");
      expect(instruction).toContain("surface and material thesis");
      expect(instruction).toContain("signature constructions");
      expect(instruction).toContain("explicit user decisions");
    },
  );

  it.each([
    ["prompt", "MODE: PROMPT ONLY"],
    ["recreate", "MODE: IMAGE TO UI / STRUCTURAL REFERENCE"],
    ["style", "MODE: STYLE REFERENCE"],
    ["preset", "MODE: APPROVED DESIGN STYLE"],
  ] as const)("selects the %s design-token mode in application code", (mode, marker) => {
    const instruction = buildDesignInstruction({ mode, spatialCraftEnabled: false });

    expect(instruction).toContain(marker);
    expect(instruction).not.toContain("If REFERENCE SCREEN ANALYSIS");
    expect(instruction).not.toContain("If the image is marked");
    expect(instruction).not.toContain('"effects"');
    expect(instruction).not.toContain("Project Craft Blueprint");
  });

  it.each(["prompt", "recreate", "style", "preset"] as const)(
    "retains universal token quality and compatibility rules in %s mode",
    (mode) => {
      const instruction = buildDesignInstruction({ mode, spatialCraftEnabled: false });

      expect(instruction).toContain("product purpose, target audience, emotional tone, commercial positioning");
      expect(instruction).toContain("accent and neutral behavior");
      expect(instruction).toContain("CORE TOKEN RESPONSIBILITIES");
      expect(instruction).toContain("radii.app is the default application geometry");
      expect(instruction).toContain("shadows.surface is standard raised-surface elevation");
      expect(instruction).toContain("one stable, app-wide responsibility");
      expect(instruction).toContain("one dominant radius, border, and elevation language");
    },
  );

  it("keeps prompt-only token generation free of image evidence assumptions", () => {
    const instruction = buildDesignInstruction({ mode: "prompt", spatialCraftEnabled: false });

    expect(instruction).toContain("only design evidence");
    expect(instruction).toContain("Preserve all explicit user decisions");
    expect(instruction).not.toContain("dark dock");
    expect(instruction).not.toContain("attached user image");
    expect(instruction).not.toContain("STYLE REFERENCE ANALYSIS");
  });

  it.each(["recreate", "style"] as const)(
    "keeps authoritative navigation evidence in %s token mode",
    (mode) => {
      const instruction = buildDesignInstruction({ mode, spatialCraftEnabled: false });

      expect(instruction).toContain("Visible navigation is authoritative token evidence");
      expect(instruction).toContain("dark dock");
    },
  );

  it("preserves the complete approved-style grammar in preset token mode", () => {
    const instruction = buildDesignInstruction({ mode: "preset", spatialCraftEnabled: false });

    expect(instruction).toContain("geometry, density, typography mood, surface behavior");
    expect(instruction).toContain("Do not flatten the style into color substitutions");
    expect(instruction).not.toContain("attached user image");
  });

  it("includes advanced token roles only in the spatial-craft token contract", () => {
    const instruction = buildDesignInstruction({
      mode: "prompt",
      spatialCraftEnabled: true,
    });

    expect(instruction).toContain("SPATIAL CRAFT TOKEN CONTRACT");
    expect(instruction).toContain('"effects"');
    expect(instruction).toContain('"surface_blur"');
    expect(instruction).toContain("deliberate geometry hierarchy");
    expect(instruction).toContain("deliberate depth hierarchy");
    expect(instruction).toContain("Emit only its required optional roles");
    expect(instruction).not.toContain("Without a Project Craft Blueprint");
  });

  it.each([false, true])("renders a valid fixed design-token JSON schema when craft=%s", (spatialCraftEnabled) => {
    const instruction = buildDesignInstruction({ mode: "prompt", spatialCraftEnabled });
    const schema = instruction
      .split("REQUIRED JSON SCHEMA:\n")[1]
      ?.split("\n\nRules:")[0];

    expect(schema).toBeTruthy();
    expect(() => JSON.parse(schema!)).not.toThrow();
  });

  it("keeps spatial-craft selection out of the standard planner schema", () => {
    const standard = plannerScreenBriefStepInstruction("style");
    const crafted = plannerScreenBriefStepInstruction("style", { spatialCraftEnabled: true });

    expect(standard).not.toContain('"craft_selection"');
    expect(standard).not.toContain("Spatial craft selection:");
    expect(crafted).toContain('"craft_selection"');
    expect(crafted).toContain("Spatial craft selection:");
  });

  it.each([
    ["prompt", "MODE: PROMPT_ONLY."],
    ["recreate", "MODE: USER_RECREATE."],
    ["style", "MODE: STYLE_REFERENCE."],
    ["preset", "MODE: APPROVED_DESIGN_STYLE."],
    ["project", "MODE: EXISTING_PROJECT_MEMORY."],
  ] as const)("selects the %s planner contract in application code", (mode, marker) => {
    const instruction = plannerBlueprintStepInstruction(mode);

    expect(instruction).toContain(marker);
    expect(instruction).toContain("production-grade mobile app plans");
    expect(instruction).toContain("COMPOSITIONAL DIRECTION");
    expect(instruction).not.toContain("If the reference");
    expect(instruction).not.toContain("When the user content says");
  });

  it("does not leak style-reference evidence into prompt-only planning", () => {
    const instruction = plannerScreenBriefStepInstruction("prompt");

    expect(instruction).toContain("Do not assume a reference image");
    expect(instruction).not.toContain("MODE: STYLE_REFERENCE");
    expect(instruction).not.toContain("attached reference is visual inspiration");
  });

  it("gives existing-project planning a dedicated continuity contract", () => {
    const instruction = plannerScreenBriefStepInstruction("project");

    expect(instruction).toContain("existing charter, navigation architecture, navigation plan");
    expect(instruction).toContain("same product and visual family");
    expect(instruction).toContain("Do not silently redesign established architecture");
  });
});
