import { describe, expect, it } from "vitest";

import {
  isSemanticallyCompatible,
  normalizePlannerReusePolicy,
  normalizePlannerSemanticCategory,
} from "@/lib/generation/asset-semantics";
import type { AssetRequirement } from "@/lib/types";

const requirement = (input: Partial<AssetRequirement> = {}): AssetRequirement => ({
  id: "asset-need",
  screenName: "Screen",
  role: "product_cutout",
  subject: "berry fruit",
  assetType: "transparent_png",
  sourcePreference: "internal_library",
  desiredAspectRatio: "1:1",
  transparentBackground: true,
  placementHint: "inside compatible cards",
  priority: "supporting",
  reuseKey: "product-cutout-food-berry",
  semanticCategory: "food",
  semanticTags: ["berry", "fruit"],
  slotCount: 1,
  reusePolicy: "repeat",
  ...input,
});

const compatible = (need: AssetRequirement, asset: {
  role?: string;
  category?: string;
  subject: string;
  tags: string[];
  exactReuseKey?: boolean;
}) => isSemanticallyCompatible({
  requirement: need,
  assetRole: asset.role ?? "product_cutout",
  assetCategory: asset.category ?? "food",
  assetSubject: asset.subject,
  assetTags: asset.tags,
  exactReuseKey: asset.exactReuseKey,
});

describe("deterministic visual asset semantics", () => {
  it("normalizes planner vocabulary instead of rejecting the complete screen plan", () => {
    expect(normalizePlannerSemanticCategory("skincare-products")).toBe("beauty");
    expect(normalizePlannerSemanticCategory("cosmetics")).toBe("beauty");
    expect(normalizePlannerSemanticCategory("catalog-product")).toBe("generic_product");
    expect(normalizePlannerSemanticCategory("unknown-domain-label")).toBeUndefined();
    expect(normalizePlannerReusePolicy("different image for every card")).toBe("distinct");
    expect(normalizePlannerReusePolicy("shared across cards")).toBe("repeat");
    expect(normalizePlannerReusePolicy(undefined)).toBe("repeat");
  });

  it("accepts berry for berry or fruit requirements", () => {
    const berry = { subject: "Berry", tags: ["berry", "fruit", "produce"] };
    expect(compatible(requirement(), berry)).toBe(true);
    expect(compatible(requirement({ subject: "grocery produce", semanticTags: ["grocery"] }), berry)).toBe(true);
  });

  it("rejects berry for bakery, workout, avatar, electronics, and finance usage", () => {
    const berry = { subject: "Berry", tags: ["berry", "fruit", "produce"] };
    expect(compatible(requirement({ subject: "chocolate cookie bakery", semanticTags: ["cookie", "bakery"] }), berry)).toBe(false);
    expect(compatible(requirement({ role: "hero_cutout", subject: "muscle workout torso", semanticCategory: "fitness", semanticTags: ["muscle", "torso"] }), berry)).toBe(false);
    expect(compatible(requirement({ role: "avatar", subject: "user portrait", semanticCategory: "person", semanticTags: ["portrait"] }), berry)).toBe(false);
    expect(compatible(requirement({ subject: "headphones", semanticCategory: "electronics", semanticTags: ["headphones"] }), berry)).toBe(false);
    expect(compatible(requirement({ subject: "finance chart", semanticCategory: "other", semanticTags: ["finance"] }), berry)).toBe(false);
  });

  it("does not treat every electronics asset as interchangeable", () => {
    const headphones = { category: "electronics", subject: "JBL headphones", tags: ["audio", "headphones"] };
    expect(compatible(requirement({ subject: "wireless headphones", semanticCategory: "electronics", semanticTags: ["headphones"] }), headphones)).toBe(true);
    expect(compatible(requirement({ subject: "smart speaker", semanticCategory: "electronics", semanticTags: ["smart", "speaker"] }), headphones)).toBe(false);
  });

  it("requires an exact key before generic products can use curated assets", () => {
    const generic = requirement({ subject: "store product", semanticCategory: "generic_product", semanticTags: [] });
    expect(compatible(generic, { category: "generic_product", subject: "Unrelated product", tags: [] })).toBe(false);
    expect(compatible(generic, { category: "generic_product", subject: "Exact product", tags: [], exactReuseKey: true })).toBe(true);
  });

  it("allows portraits only through the avatar role", () => {
    const portrait = { role: "avatar", category: "person", subject: "Woman portrait", tags: ["portrait", "woman"] };
    expect(compatible(requirement({ role: "avatar", subject: "woman portrait", semanticCategory: "person", semanticTags: ["portrait"] }), portrait)).toBe(true);
    expect(compatible(requirement({ role: "product_cutout", subject: "fashion product", semanticCategory: "person", semanticTags: ["portrait"] }), portrait)).toBe(false);
  });
});
