import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  planVisualAssets,
  rankStockCandidates,
  resolveProjectAssets,
  shouldQueryPixabayFallback,
  stockSearchQuery,
} from "@/lib/generation/visual-assets";
import type { AssetRequirement, ScreenPlan } from "@/lib/types";

const requirement = (screenName: string, id: string, slotCount = 1): AssetRequirement => ({
  id,
  screenName,
  role: "product_photo",
  subject: "chocolate chip cookie",
  assetType: "photo",
  sourcePreference: "stock",
  desiredAspectRatio: "1:1",
  transparentBackground: false,
  placementHint: "Cookie product cards",
  priority: "supporting",
  reuseKey: "cookie-card-photo",
  semanticCategory: "food",
  semanticTags: ["cookie", "bakery"],
  slotCount,
  reusePolicy: "repeat",
});

describe("visual asset planning groups", () => {
  it("reports monotonic global resolution progress without changing requirement order", async () => {
    const requirements = [
      { ...requirement("Home", "home-photo"), sourcePreference: "user_upload" as const },
      { ...requirement("Details", "details-photo"), sourcePreference: "user_upload" as const },
    ];
    const progress: Array<{ completed: number; total: number; placeholders: number; failures: number }> = [];

    const manifest = await resolveProjectAssets({
      admin: {} as never,
      ownerId: "owner-1",
      projectId: "project-1",
      generationRunId: "run-1",
      requirements,
      onProgress: (update) => {
        progress.push({
          completed: update.completed,
          total: update.total,
          placeholders: update.placeholders,
          failures: update.failures,
        });
      },
    });

    expect(manifest.requirements.map((item) => item.id)).toEqual(["home-photo", "details-photo"]);
    expect(progress).toEqual([
      { completed: 1, total: 2, placeholders: 1, failures: 1 },
      { completed: 2, total: 2, placeholders: 2, failures: 2 },
    ]);
  });

  it("keeps an eight-card repeat group as one resolution requirement", async () => {
    const screens: ScreenPlan[] = [{
      name: "Bakery",
      type: "root",
      description: "Eight cookie cards",
      assetNeeds: [requirement("Bakery", "cookie-grid", 8)],
    }];

    const planned = await planVisualAssets({ prompt: "Bakery", screens });

    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({ id: "cookie-grid", slotCount: 8, reusePolicy: "repeat" });
  });

  it("does not starve screens after the old project-wide eight requirement limit", async () => {
    const screens: ScreenPlan[] = Array.from({ length: 10 }, (_, index) => ({
      name: `Screen ${index + 1}`,
      type: index === 0 ? "root" as const : "detail" as const,
      description: "Cookie collection",
      assetNeeds: [requirement(`Screen ${index + 1}`, `cookie-${index + 1}`)],
    }));

    const planned = await planVisualAssets({ prompt: "Cookie collection", screens });

    expect(planned).toHaveLength(10);
    expect(planned.at(-1)?.screenName).toBe("Screen 10");
  });

  it("recovers explicit photography requirements when planner asset needs are missing", async () => {
    const planned = await planVisualAssets({
      prompt: "Create a luxury skincare app with sharp photography and an off-white background.",
      screens: [
        {
          name: "Daily Protocol",
          type: "root",
          description: "Use full-bleed hero photography with a structured skincare routine below it.",
          assetNeeds: [],
        },
        {
          name: "Product Cabinet",
          type: "root",
          description: "Show product thumbnail photography for cleansers and serums.",
          assetNeeds: [],
        },
      ],
      charter: {
        originalPrompt: "Luxury skincare app",
        appType: "Luxury skincare",
        targetAudience: "Skincare customers",
        navigationModel: "Tabs",
        keyFeatures: ["Routine", "Products"],
        designRationale: "Photography-led editorial experience",
      },
    });

    expect(planned).toHaveLength(2);
    expect(planned[0]).toMatchObject({
      screenName: "Daily Protocol",
      role: "background_photo",
      semanticCategory: "beauty",
      origin: "user_explicit",
    });
    expect(planned[1]).toMatchObject({
      screenName: "Product Cabinet",
      role: "product_photo",
      semanticCategory: "beauty",
      origin: "user_explicit",
    });
  });

  it("does not invent photography when the user explicitly rejects it", async () => {
    const planned = await planVisualAssets({
      prompt: "Create a skincare tracker with no photography or product images.",
      charter: {
        originalPrompt: "Skincare tracker",
        appType: "Skincare",
        targetAudience: "Consumers",
        navigationModel: "Tabs",
        keyFeatures: ["Routine"],
        designRationale: "A visual product",
        creativeDirection: {
          conceptName: "Photo journal",
          styleEssence: "Photography-led skincare journal",
          colorStory: "Neutral",
          typographyMood: "Editorial",
          surfaceLanguage: "Flat",
          iconographyStyle: "Thin",
          compositionPrinciples: ["Full width"],
          signatureMoments: ["Full-bleed photography"],
          motionTone: "Quiet",
          avoid: ["Clutter"],
        },
      },
      screens: [{
        name: "Routine",
        type: "root",
        description: "Use a typographic list with no photography.",
        assetNeeds: [],
      }],
    });

    expect(planned).toEqual([]);
  });

  it("normalizes explicit skincare photography into critical domain-specific distinct assets", async () => {
    const planned = await planVisualAssets({
      prompt: "Use sharp editorial skincare photography throughout the luxury routine app.",
      screens: [{
        name: "Product Library",
        type: "root",
        description: "A shelf of four different skincare products with full-width product photography.",
        assetNeeds: [{
          id: "product-shelf-items",
          screenName: "Product Library",
          role: "section_photo",
          subject: "Minimalist skincare bottles with white labels",
          assetType: "photo",
          sourcePreference: "stock",
          desiredAspectRatio: "1:1",
          transparentBackground: false,
          placementHint: "Four square product image blocks",
          priority: "supporting",
          reuseKey: "skincare-product-shots",
          semanticCategory: "generic_product",
          semanticTags: ["luxury", "packaging"],
          slotCount: 4,
          reusePolicy: "repeat",
          origin: "planner_inferred",
        }],
      }],
    });

    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({
      semanticCategory: "beauty",
      reusePolicy: "distinct",
      slotCount: 4,
      priority: "critical",
      origin: "user_explicit",
    });
  });

  it("treats an explicitly requested image grid as user-owned imagery", async () => {
    const planned = await planVisualAssets({
      prompt: "Show my saved plants as a 2-column image grid.",
      screens: [{
        name: "Home",
        type: "root",
        description: "A two-column collection of plant images.",
        assetNeeds: [{
          id: "plant-grid",
          screenName: "Home",
          role: "product_cutout",
          subject: "Indoor plants in ceramic pots",
          assetType: "transparent_png",
          sourcePreference: "stock",
          desiredAspectRatio: "1:1",
          transparentBackground: false,
          placementHint: "Inside the image grid cards",
          priority: "supporting",
          reuseKey: "plant-grid",
          semanticCategory: "nature",
          semanticTags: ["plants", "indoor"],
          slotCount: 4,
          reusePolicy: "distinct",
          origin: "planner_inferred",
        }],
      }],
    });

    expect(planned[0]).toMatchObject({ origin: "user_explicit", priority: "critical" });
  });

  it("normalizes an opaque full-bleed hero photo into a background role", async () => {
    const planned = await planVisualAssets({
      prompt: "Use sharp hero photography.",
      screens: [{
        name: "Daily Protocol",
        type: "root",
        description: "A full-bleed photographic header.",
        assetNeeds: [{
          ...requirement("Daily Protocol", "hero"),
          role: "hero_cutout",
          subject: "Luxury skincare serum bottle",
          placementHint: "Full-bleed header with object-cover",
          desiredAspectRatio: "16:9",
          priority: "critical",
          semanticCategory: "beauty",
        }],
      }],
    });

    expect(planned[0]).toMatchObject({
      role: "background_photo",
      origin: "user_explicit",
      priority: "critical",
    });
  });

  it("builds a short domain-focused stock query and rejects generic bottle matches", () => {
    const skincare: AssetRequirement = {
      ...requirement("Products", "skincare-products"),
      role: "product_photo",
      subject: "Luxury skincare serum bottle",
      semanticCategory: "beauty",
      semanticTags: ["skincare", "serum"],
    };
    const query = stockSearchQuery(skincare);
    const ranked = rankStockCandidates(skincare, [
      {
        provider: "pexels",
        providerAssetId: "perfume",
        imageUrl: "https://images.example/perfume.jpg",
        sourceUrl: null,
        description: "Close-up photo of water drops on a bottle",
        tags: ["bottle", "water"],
        attribution: null,
        license: "Pexels",
        width: 1200,
        height: 900,
      },
      {
        provider: "pixabay",
        providerAssetId: "serum",
        imageUrl: "https://images.example/serum.jpg",
        sourceUrl: null,
        description: "Skincare serum cosmetic product bottle",
        tags: ["skincare", "serum", "cosmetic"],
        attribution: null,
        license: "Pixabay",
        width: 1200,
        height: 1200,
      },
    ]);

    expect(query.length).toBeLessThanOrEqual(100);
    expect(query).toContain("skincare");
    expect(ranked.map((candidate) => candidate.providerAssetId)).toEqual(["serum"]);
  });

  it("does not require commerce vocabulary for a nature cutout", () => {
    const plant: AssetRequirement = {
      ...requirement("Home", "plant-grid"),
      role: "product_cutout",
      subject: "Monstera plant in a ceramic pot",
      semanticCategory: "nature",
      semanticTags: ["monstera", "plant", "indoor"],
    };

    const ranked = rankStockCandidates(plant, [{
      provider: "pexels",
      providerAssetId: "monstera",
      imageUrl: "https://images.example/monstera.jpg",
      sourceUrl: null,
      description: "Green monstera house plant in a ceramic pot",
      tags: ["monstera", "plant", "nature", "indoor"],
      attribution: null,
      license: "Pexels",
      width: 1200,
      height: 1200,
    }]);

    expect(ranked.map((candidate) => candidate.providerAssetId)).toEqual(["monstera"]);
  });

  it("uses Pixabay only when qualified Pexels results cannot fill the requirement", () => {
    expect(shouldQueryPixabayFallback(4, 4)).toBe(false);
    expect(shouldQueryPixabayFallback(2, 4)).toBe(true);
  });
});
