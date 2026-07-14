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
});
