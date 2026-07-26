import type { GenerationPreviewMetadata, GenerationPreviewScreen, ScreenData } from "@/lib/types";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const readPreviewScreen = (value: unknown, fallbackIndex: number): GenerationPreviewScreen | null => {
  const screen = asRecord(value);
  if (!screen) return null;
  if (typeof screen.stableKey !== "string" || typeof screen.name !== "string") return null;
  if (screen.type !== "root" && screen.type !== "detail") return null;
  return {
    stableKey: screen.stableKey,
    roadmapItemId: typeof screen.roadmapItemId === "string" ? screen.roadmapItemId : null,
    name: screen.name,
    type: screen.type,
    index: typeof screen.index === "number" && Number.isFinite(screen.index)
      ? Math.max(0, Math.floor(screen.index))
      : fallbackIndex,
  };
};

export function readGenerationPreview(value: unknown): GenerationPreviewMetadata | null {
  const preview = asRecord(value);
  if (!preview || preview.version !== 1 || !Array.isArray(preview.screens)) return null;
  if (preview.stage !== "screen_briefs" && preview.stage !== "asset_resolution" && preview.stage !== "building") {
    return null;
  }
  const screens = preview.screens
    .map(readPreviewScreen)
    .filter((screen): screen is GenerationPreviewScreen => Boolean(screen))
    .sort((left, right) => left.index - right.index);
  if (screens.length === 0) return null;
  return {
    version: 1,
    stage: preview.stage,
    screens,
    updatedAt: typeof preview.updatedAt === "string" ? preview.updatedAt : new Date(0).toISOString(),
  };
}

const identity = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");

export function filterPendingGenerationPreview(
  preview: GenerationPreviewMetadata | null,
  screens: ScreenData[],
  generationRunId: string | null,
): GenerationPreviewMetadata | null {
  if (!preview || !generationRunId) return null;
  const pending = preview.screens.filter((planned) => !screens.some((screen) => {
    if (planned.roadmapItemId && screen.roadmapItemId === planned.roadmapItemId) return true;
    return screen.generationRunId === generationRunId && identity(screen.name) === identity(planned.name);
  }));
  return pending.length > 0 ? { ...preview, screens: pending } : null;
}
