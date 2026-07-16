import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { planVisualAssets } from "@/lib/generation/visual-assets";
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
});
