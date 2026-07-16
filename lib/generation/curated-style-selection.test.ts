import { describe, expect, it } from "vitest";

import {
  inferCuratedStyleSelectionIntent,
  rankCuratedStyleReferences,
  selectCuratedStyleReference,
  type CuratedStyleSelectionIntent,
} from "@/lib/generation/curated-style-selection";
import { CURATED_STYLE_REFERENCES } from "@/lib/generation/curated-style-catalog";

const intent = (overrides: Partial<CuratedStyleSelectionIntent>): CuratedStyleSelectionIntent => ({
  explicitStyleStrength: "none",
  theme: "unspecified",
  productArchetypes: [],
  interactionArchetypes: [],
  compositionNeeds: [],
  materials: [],
  geometries: [],
  navigation: "unspecified",
  density: "unspecified",
  assetBias: "unspecified",
  colorCharacter: [],
  typographyCharacter: [],
  moods: [],
  mustAvoid: [],
  ...overrides,
});

describe("curated style selection", () => {
  it("keeps catalog ids unique and every reference fully authored", () => {
    const ids = CURATED_STYLE_REFERENCES.map((reference) => reference.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const reference of CURATED_STYLE_REFERENCES) {
      expect(reference.imageUrl).toBeTruthy();
      expect(reference.styleIntent.length).toBeGreaterThan(40);
      expect(reference.selectionProfile.productArchetypes.length).toBeGreaterThan(0);
      expect(reference.selectionProfile.interactionArchetypes.length).toBeGreaterThan(0);
      expect(reference.selectionProfile.compositions.length).toBeGreaterThan(0);
      expect(reference.selectionProfile.materials.length).toBeGreaterThan(0);
      expect(reference.selectionProfile.geometries.length).toBeGreaterThan(0);
      expect(reference.selectionProfile.colorCharacter.length).toBeGreaterThan(0);
      expect(reference.selectionProfile.typographyCharacter.length).toBeGreaterThan(0);
    }
  });

  it("selects the dark health analytics reference for a sleep dashboard", () => {
    const match = selectCuratedStyleReference(intent({
      explicitStyleStrength: "partial",
      theme: "dark",
      productArchetypes: ["health-analytics"],
      interactionArchetypes: ["metric-dashboard", "timeline-history", "status-overview"],
      compositionNeeds: ["data-dense", "dominant-metric-hero"],
      materials: ["high-contrast"],
      density: "dense",
      assetBias: "data",
      moods: ["calm", "clinical"],
      mustAvoid: ["soft-elevated"],
    }));

    expect(match?.reference.id).toBe("fitness-kalo-progress-dark");
  });

  it("selects the photo-led asymmetric storefront for luxury ecommerce", () => {
    const match = selectCuratedStyleReference(intent({
      explicitStyleStrength: "strong",
      theme: "light",
      productArchetypes: ["consumer-commerce"],
      interactionArchetypes: ["catalog-discovery", "product-detail"],
      compositionNeeds: ["asymmetric", "full-bleed-media", "editorial-flow"],
      materials: ["photographic", "layered"],
      assetBias: "product",
      colorCharacter: ["vivid-accent"],
      typographyCharacter: ["display-led"],
      moods: ["premium", "bold"],
      mustAvoid: ["data-dense"],
    }));

    expect(match?.reference.id).toBe("sneaker-ecom-futuristic-light");
  });

  it("selects the intended references for unambiguous product archetypes", () => {
    const crypto = selectCuratedStyleReference(intent({
      explicitStyleStrength: "partial",
      theme: "dark",
      productArchetypes: ["trading"],
      interactionArchetypes: ["transaction-flow", "form-workflow"],
      compositionNeeds: ["split-plane"],
      assetBias: "control",
      moods: ["serious"],
    }));
    const smartHome = selectCuratedStyleReference(intent({
      explicitStyleStrength: "partial",
      theme: "dark",
      productArchetypes: ["device-control"],
      interactionArchetypes: ["control-panel", "status-overview"],
      compositionNeeds: ["bento-grid"],
      materials: ["tactile", "glass"],
      assetBias: "control",
    }));
    const password = selectCuratedStyleReference(intent({
      productArchetypes: ["security-utility"],
      interactionArchetypes: ["status-overview", "monitoring"],
      compositionNeeds: ["dominant-metric-hero", "stacked-list"],
      assetBias: "data",
      moods: ["calm", "trustworthy"],
    }));

    expect(crypto?.reference.id).toBe("crypto-dark-exchange-payment");
    expect(smartHome?.reference.id).toBe("smart-home-iot-tactile-dark");
    expect(password?.reference.id).toBe("security-watchtower-light-score");
  });

  it("returns no image when the library has no confident spatial match", () => {
    const university = selectCuratedStyleReference(intent({
      productArchetypes: ["education"],
      interactionArchetypes: ["schedule", "status-overview"],
      compositionNeeds: ["stacked-list", "data-dense"],
      density: "dense",
      assetBias: "text",
      moods: ["focused", "professional"],
    }));
    const writing = selectCuratedStyleReference(intent({
      productArchetypes: ["editorial-content"],
      interactionArchetypes: ["text-workspace"],
      compositionNeeds: ["editorial-flow", "edge-to-edge"],
      assetBias: "text",
      moods: ["serious", "professional"],
      mustAvoid: ["soft-elevated", "floating-dock"],
    }));
    const music = selectCuratedStyleReference(intent({
      explicitStyleStrength: "partial",
      theme: "dark",
      productArchetypes: ["media"],
      interactionArchetypes: ["media-player"],
      compositionNeeds: ["full-bleed-media", "edge-to-edge"],
      materials: ["atmospheric"],
      assetBias: "mixed",
    }));
    const projectManagement = selectCuratedStyleReference(intent({
      productArchetypes: ["productivity"],
      interactionArchetypes: ["metric-dashboard"],
      compositionNeeds: ["data-dense"],
      density: "dense",
      moods: ["professional"],
    }));

    expect(university).toBeNull();
    expect(writing).toBeNull();
    expect(music).toBeNull();
    expect(projectManagement).toBeNull();
  });

  it("rejects explicit contradictions and never uses a universal fallback", () => {
    const strongDarkEditorial = intent({
      explicitStyleStrength: "strong",
      theme: "dark",
      productArchetypes: ["editorial-content"],
      interactionArchetypes: ["text-workspace"],
      compositionNeeds: ["editorial-flow"],
      materials: ["flat"],
      geometries: ["sharp"],
      assetBias: "text",
      mustAvoid: ["rounded", "soft-elevated", "floating-dock"],
    });
    const ranked = rankCuratedStyleReferences(strongDarkEditorial);

    expect(selectCuratedStyleReference(strongDarkEditorial)).toBeNull();
    expect(ranked.find((candidate) => candidate.reference.id === "finance-light-soft-banking-home")?.score).toBe(0);
  });

  it("keeps realistic natural-language fallback prompts safe", () => {
    const selectPrompt = (prompt: string) => selectCuratedStyleReference(inferCuratedStyleSelectionIntent(prompt));

    expect(selectPrompt("Build a dark sleep tracking app with readiness score, sleep stages timeline, recovery analytics and dense clinical data.")?.reference.id)
      .toBe("fitness-kalo-progress-dark");
    expect(selectPrompt("Build a luxury light ecommerce app with large product photography, editorial asymmetry, bold styling and product discovery.")?.reference.id)
      .toBe("sneaker-ecom-futuristic-light");
    expect(selectPrompt("Create a university student app with classes, exam schedule, assignment deadlines and a focused information-dense home.")).toBeNull();
    expect(selectPrompt("Create a serious editorial writing workspace for professional authors with edge-to-edge text and no cards.")).toBeNull();
  });
});
