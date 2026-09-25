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
  it("uses an intentional avatar placeholder when no person's image was supplied", async () => {
    const manifest = await resolveProjectAssets({ admin: {} as never, ownerId: "owner", projectId: "project",
      generationRunId: "run", requirements: [{ ...requirement("Today", "leo-avatar"), role: "avatar",
        subject: "Leo's profile portrait", semanticCategory: "person", semanticTags: ["child", "portrait"] }] });
    expect(manifest.assetsByScreen.Today[0]).toMatchObject({ source: "placeholder", placeholder: true });
    expect(manifest.diagnostics?.[0].rejectionCode).toBe("identity_requires_supplied_image");
  });
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

  it("resolves independent requirements concurrently while keeping the manifest in input order", async () => {
    let active = 0;
    let peak = 0;
    const admin = { from: () => {
      let assetId = "";
      const query = {
        select: () => query,
        eq: (field: string, value: string) => { if (field === "id") assetId = value; return query; },
        maybeSingle: async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise(resolve => setTimeout(resolve, assetId.endsWith("1") ? 25 : 5));
          active -= 1;
          return { data: null, error: null };
        },
      };
      return query;
    } };
    const requirements = Array.from({ length: 6 }, (_, index) => ({
      ...requirement("Gallery", `asset-${index + 1}`), sourcePreference: "user_upload" as const,
      userAssetId: `00000000-0000-4000-8000-00000000000${index + 1}`,
    }));
    const progress: number[] = [];
    const manifest = await resolveProjectAssets({ admin: admin as never, ownerId: "owner", projectId: "project",
      generationRunId: "run", requirements, onProgress: update => { progress.push(update.completed); } });
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(4);
    expect(manifest.assetsByScreen.Gallery.map(asset => asset.requirementId)).toEqual(requirements.map(item => item.id));
    expect(manifest.diagnostics?.map(item => item.requirementId)).toEqual(requirements.map(item => item.id));
    expect(progress).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("releases a screen's ordered assets before another screen finishes resolving", async () => {
    const admin = { from: () => {
      let assetId = "";
      const query = {
        select: () => query,
        eq: (field: string, value: string) => { if (field === "id") assetId = value; return query; },
        maybeSingle: async () => {
          await new Promise(resolve => setTimeout(resolve, assetId.endsWith("1") ? 35 : 2));
          return { data: null, error: null };
        },
      };
      return query;
    } };
    const requirements = [
      { ...requirement("Slow", "slow"), sourcePreference: "user_upload" as const, userAssetId: "00000000-0000-4000-8000-000000000001" },
      { ...requirement("Fast", "fast"), sourcePreference: "user_upload" as const, userAssetId: "00000000-0000-4000-8000-000000000002" },
    ];
    const ready: string[] = [];
    const manifest = await resolveProjectAssets({ admin: admin as never, ownerId: "owner", projectId: "project",
      generationRunId: "run", requirements, onScreenReady: (name, assets) => {
        ready.push(name);
        expect(assets[0].requirementId).toBe(name.toLowerCase());
      } });
    expect(ready).toEqual(["Fast", "Slow"]);
    expect(manifest.requirements).toEqual(requirements);
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

  it("uses Pixabay only when qualified Pexels results cannot fill the requirement", () => {
    expect(shouldQueryPixabayFallback(4, 4)).toBe(false);
    expect(shouldQueryPixabayFallback(2, 4)).toBe(true);
  });
});
