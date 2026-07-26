import { describe, expect, it } from "vitest";

import {
  filterPendingGenerationPreview,
  readGenerationPreview,
} from "@/lib/generation-preview";
import type { GenerationPreviewMetadata, ScreenData } from "@/lib/types";

const preview: GenerationPreviewMetadata = {
  version: 1,
  stage: "asset_resolution",
  screens: [
    { stableKey: "home", roadmapItemId: "roadmap-home", name: "Home", type: "root", index: 0 },
    { stableKey: "details", roadmapItemId: "roadmap-details", name: "Product Details", type: "detail", index: 1 },
  ],
  updatedAt: "2026-07-26T00:00:00.000Z",
};

const screen = (input: Partial<ScreenData> & Pick<ScreenData, "name">): ScreenData => ({
  id: input.id ?? "screen-1",
  projectId: "project-1",
  userId: "user-1",
  generationRunId: input.generationRunId ?? "run-1",
  name: input.name,
  code: "",
  prompt: "",
  roadmapItemId: input.roadmapItemId ?? null,
  x: 0,
  y: 0,
  createdAt: "2026-07-26T00:00:00.000Z",
  updatedAt: "2026-07-26T00:00:00.000Z",
});

describe("generation canvas preview", () => {
  it("parses only backward-compatible version-one previews in display order", () => {
    const parsed = readGenerationPreview({
      ...preview,
      screens: [preview.screens[1], preview.screens[0]],
    });

    expect(parsed?.screens.map((item) => item.name)).toEqual(["Home", "Product Details"]);
    expect(readGenerationPreview({ ...preview, version: 2 })).toBeNull();
    expect(readGenerationPreview({ ...preview, stage: "complete" })).toBeNull();
  });

  it("removes a ghost as soon as its roadmap row appears", () => {
    const pending = filterPendingGenerationPreview(
      preview,
      [screen({ name: "Renamed Home", roadmapItemId: "roadmap-home" })],
      "run-1",
    );

    expect(pending?.screens.map((item) => item.name)).toEqual(["Product Details"]);
  });

  it("uses run-scoped normalized names only as a fallback", () => {
    const sameRun = filterPendingGenerationPreview(
      preview,
      [screen({ name: "Product details", roadmapItemId: null })],
      "run-1",
    );
    const differentRun = filterPendingGenerationPreview(
      preview,
      [screen({ name: "Product details", roadmapItemId: null, generationRunId: "run-2" })],
      "run-1",
    );

    expect(sameRun?.screens.map((item) => item.name)).toEqual(["Home"]);
    expect(differentRun?.screens).toHaveLength(2);
    expect(filterPendingGenerationPreview(preview, [], null)).toBeNull();
  });
});
