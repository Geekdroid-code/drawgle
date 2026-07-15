import { describe, expect, it } from "vitest";

import {
  MAX_PROJECT_CRAFT_CANDIDATES,
  MAX_SCREEN_CRAFT_CANDIDATES,
  SPATIAL_CRAFT_GRAMMARS,
  normalizeCraftSelection,
  normalizeProjectCraftBlueprint,
  resolveSpatialConstructionContract,
  shortlistProjectCraftGrammars,
  shortlistScreenCraftGrammars,
  validateSpatialCraftLibrary,
} from "@/lib/generation/spatial-craft";

describe("spatial craft grammar library", () => {
  it("ships a valid category-balanced library with showcase-derived constructions", () => {
    expect(SPATIAL_CRAFT_GRAMMARS.length).toBeGreaterThanOrEqual(26);
    expect(validateSpatialCraftLibrary()).toEqual([]);
    expect(new Set(SPATIAL_CRAFT_GRAMMARS.map((item) => item.category))).toEqual(
      new Set(["macro", "component", "data", "lighting", "navigation"]),
    );
  });

  it("derives tags and token roles from exact ids instead of trusting model aliases", () => {
    const normalized = normalizeProjectCraftBlueprint({
      version: 1,
      compositionIntent: "An unboxed metric flow",
      layerStrategy: "Direct canvas",
      geometryIntent: "Unequal zones",
      lightingIntent: "Restrained",
      elevationIntent: "Mostly flat",
      borderIntent: "Hairlines",
      dataVisualizationIntent: "Inline plots",
      navigationIntent: "Quiet",
      signatureConstructions: ["showcase-unboxed-metric-flow"],
      layoutPrinciples: ["Metrics live on the canvas"],
      preferredCraftIds: ["showcase-unboxed-metric-flow"],
      preferredCraftTags: ["invented-model-alias"],
      requiredTokenRoles: ["radii.magic", "shadow.card"],
      avoid: ["Generic card grid"],
    });

    expect(normalized.preferredCraftIds).toEqual(["showcase-unboxed-metric-flow"]);
    expect(normalized.preferredCraftTags).not.toContain("invented-model-alias");
    expect(normalized.requiredTokenRoles).not.toContain("radii.magic");
    expect(normalized.requiredTokenRoles).toContain("border_widths.hairline");
  });

  it("honors explicit no-effect constraints before shortlisting", () => {
    const project = shortlistProjectCraftGrammars(
      "A flat sleep app with no gradients, no glow, no glass, no blur, and no shadows.",
    );
    const ids = project.map((item) => item.id);
    expect(ids).not.toContain("immersive-atmospheric-canvas");
    expect(project.every((item) => !item.requiredTokenRoles.some((role) => (
      role.startsWith("gradients.") || role.startsWith("effects.") || role.startsWith("shadows.")
    )))).toBe(true);
  });

  it("keeps project and screen context bounded", () => {
    const project = shortlistProjectCraftGrammars("A premium crypto analytics app with live charts and a floating navigation island");
    const screen = shortlistScreenCraftGrammars({
      prompt: "A premium crypto analytics app with live charts",
      screen: { name: "Market Overview", type: "root", description: "Portfolio metrics, asset rows and a performance chart" },
    });

    expect(project.length).toBeLessThanOrEqual(MAX_PROJECT_CRAFT_CANDIDATES);
    expect(screen.length).toBeLessThanOrEqual(MAX_SCREEN_CRAFT_CANDIDATES);
    expect(screen.some((item) => item.category === "macro")).toBe(true);
  });

  it("does not offer recipes whose optional live tokens are unavailable", () => {
    const screen = shortlistScreenCraftGrammars({
      prompt: "A premium glass analytics dashboard",
      screen: { name: "Overview", type: "root", description: "A floating glass dashboard with charts" },
      availableTokenPaths: new Set(),
    });
    const optionalPaths = new Set([
      "color.surface.inset", "color.surface.raised", "color.surface.glass",
      "radii.control", "radii.card", "radii.featured", "radii.sheet",
      "border_widths.hairline", "border_widths.emphasis",
      "shadows.inset", "shadows.raised", "shadows.floating", "shadows.glow",
      "gradients.atmosphere", "gradients.edge_light", "gradients.accent_glow",
      "effects.surface_blur", "effects.overlay_blur", "effects.edge_highlight_opacity",
      "iconography.stroke_width", "iconography.well_size",
    ]);

    expect(screen.every((item) => item.requiredTokenRoles.every((path) => (
      !optionalPaths.has(path)
    )))).toBe(true);
  });

  it("rejects unknown IDs and expands only the selected recipes", () => {
    const selection = normalizeCraftSelection({
      macro_id: "hero-connected-sheet",
      supporting_ids: ["inset-control-well", "unknown-recipe", "localized-atmospheric-glow"],
      rationale: "A connected hero with restrained depth.",
    });
    const contract = resolveSpatialConstructionContract(selection);

    expect(selection?.supportingIds).toEqual(["inset-control-well", "localized-atmospheric-glow"]);
    expect(contract?.grammarIds).toEqual([
      "hero-connected-sheet",
      "inset-control-well",
      "localized-atmospheric-glow",
    ]);
    expect(JSON.stringify(contract)).not.toContain("unknown-recipe");
  });
});
