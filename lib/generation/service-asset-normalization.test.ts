import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeScreenAssetNeeds } from "@/lib/generation/service";

describe("planner asset need recovery", () => {
  it("salvages malformed planner categories, reuse policies, booleans, and missing ids", () => {
    const needs = normalizeScreenAssetNeeds("Product Cabinet", [{
      role: "product image",
      subject: "Luxury skincare cleanser and serum photography",
      asset_type: "photograph",
      source_preference: "curated library",
      desired_aspect_ratio: "square",
      transparent_background: "false",
      placement_hint: "Product catalog thumbnails",
      priority: "required",
      semantic_category: "skincare-products",
      semantic_tags: "skincare, cleanser, serum",
      reuse_policy: "unique images",
    }]);

    expect(needs).toHaveLength(1);
    expect(needs[0]).toMatchObject({
      screenName: "Product Cabinet",
      role: "product_photo",
      assetType: "photo",
      sourcePreference: "internal_library",
      desiredAspectRatio: "1:1",
      transparentBackground: false,
      priority: "critical",
      semanticCategory: "beauty",
      semanticTags: ["skincare", "cleanser", "serum"],
      reusePolicy: "distinct",
      origin: "planner_inferred",
    });
    expect(needs[0].id).toContain("product-cabinet-product-photo");
  });

  it("drops natively rendered emoji and icon needs before they reach asset resolution", () => {
    const needs = normalizeScreenAssetNeeds("Mood Input", [
      {
        role: "product_cutout",
        subject: "set of 3D rendered expressive emojis",
        asset_type: "illustration",
        source_preference: "stock",
        desired_aspect_ratio: "1:1",
        transparent_background: true,
        placement_hint: "Mood chips",
        priority: "supporting",
      },
      {
        role: "decorative_object",
        subject: "navigation symbol set",
        asset_type: "icon",
        source_preference: "stock",
        desired_aspect_ratio: "1:1",
        transparent_background: true,
        placement_hint: "Tab bar",
        priority: "supporting",
      },
      {
        role: "hero_cutout",
        subject: "calm meditation scene at sunrise",
        asset_type: "photo",
        source_preference: "stock",
        desired_aspect_ratio: "16:9",
        transparent_background: false,
        placement_hint: "Hero banner",
        priority: "critical",
      },
    ]);

    expect(needs).toHaveLength(1);
    expect(needs[0].subject).toBe("calm meditation scene at sunrise");
  });

  it("keeps an emoji need the user supplied themselves", () => {
    const needs = normalizeScreenAssetNeeds("Mood Input", [{
      role: "product_cutout",
      subject: "custom emoji pack",
      asset_type: "transparent_png",
      source_preference: "user_upload",
      desired_aspect_ratio: "1:1",
      transparent_background: true,
      placement_hint: "Mood chips",
      priority: "critical",
    }]);

    expect(needs).toHaveLength(1);
    expect(needs[0].sourcePreference).toBe("user_upload");
  });
});
