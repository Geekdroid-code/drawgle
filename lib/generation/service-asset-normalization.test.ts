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
});
