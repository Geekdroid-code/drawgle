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

  it("carries the user's own identity as its own origin, and treats sample people and pets as ordinary needs", () => {
    const avatar = (extra: Record<string, unknown>) => normalizeScreenAssetNeeds("Profile", [{
      role: "avatar", subject: "Profile photo", asset_type: "photo", source_preference: "stock", desired_aspect_ratio: "1:1",
      placement_hint: "Round avatar", priority: "supporting", semantic_category: "person", ...extra,
    }])[0];

    expect(avatar({ user_identity: true }).origin).toBe("user_specified");
    expect(avatar({ userIdentity: "yes" }).origin).toBe("user_specified");
    expect(avatar({ origin: "user_specified" }).origin).toBe("user_specified");
    // a sample person or pet is planned like any other photo
    expect(avatar({}).origin).toBe("planner_inferred");
    expect(avatar({ user_identity: false }).origin).toBe("planner_inferred");
    expect(avatar({ user_identity: "maybe" }).origin).toBe("planner_inferred");
    // the flag itself does not travel on the requirement
    expect(avatar({ user_identity: true })).not.toHaveProperty("userIdentity");
  });
});
