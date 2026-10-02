import type { FlowApproval, FlowFulfillment } from "@/lib/agent/flow-build";
import type { GenerationPreviewMetadata, GenerationRunData, ScreenData } from "@/lib/types";

/** The canvas gap between neighbouring screens' left edges (reserve_screen_slots). */
export const CANVAS_SLOT_WIDTH = 450;
const DEFAULT_SLOT = { x: 4800, y: 4600 };

export type FlowPlaceholderStatus = "queued" | "designing";

export type FlowPlaceholder = {
  key: string;
  name: string;
  kind: "screen" | "state";
  status: FlowPlaceholderStatus;
  /** What a screen being designed is doing, in the person's words, when its batch has said. */
  detail: string | null;
  x: number;
  y: number;
};

const sameName = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

const PREVIEW_STAGE: Record<GenerationPreviewMetadata["stage"], string> = {
  screen_briefs: "Writing the brief",
  asset_resolution: "Finding images",
  building: "Waiting to build",
};

/**
 * While an approved flow builds, a phone for every approved screen and state that isn't on the canvas yet, in the
 * approved order, in the slots the coordinator will give them: from the moment of approval the whole flow is on the
 * canvas, and each phone gives way to its screen as the screen lands. A paused or stopped flow leaves no phones
 * behind (its chat block offers Resume). Nothing is written; this reads the approval, its claims and the current
 * batch's preview.
 */
export function flowPlaceholders({
  approval,
  run,
  fulfillments,
  screens,
  preview,
  nextSlot,
}: {
  approval: FlowApproval | null;
  run: Pick<GenerationRunData, "status"> | null;
  fulfillments: FlowFulfillment[] | null;
  screens: Array<Pick<ScreenData, "name" | "x" | "y" | "generationRunId" | "roadmapItemId">>;
  preview?: GenerationPreviewMetadata | null;
  /** The project's next free slot, when known (projects.next_screen_x and screen_origin_y). */
  nextSlot?: { x?: number | null; y?: number | null } | null;
}): FlowPlaceholder[] {
  if (!approval || !run || !fulfillments) return [];
  const live = run.status === "queued" || run.status === "planning" || run.status === "building";
  // After Stop the screens in progress still finish; nothing new starts.
  const stopping = run.status === "canceled" && fulfillments.some((claim) => claim.status === "claimed");
  if (!live && !stopping) return [];
  const claims = new Map(fulfillments.map((claim) => [claim.outputKey, claim]));
  const existing = new Set(approval.existingKeys);
  const previewByKey = new Map((preview?.screens ?? []).map((screen) => [screen.stableKey, screen]));
  const roadmapIds = new Set(screens.map((screen) => screen.roadmapItemId).filter(Boolean));

  // An output already has its frame when a screen row of its batch carries its name or its roadmap item.
  const hasFrame = (name: string, claim: FlowFulfillment) => {
    if (claim.screenId) return true;
    const planned = previewByKey.get(claim.outputKey);
    if (planned?.roadmapItemId && roadmapIds.has(planned.roadmapItemId)) return true;
    return screens.some((screen) => screen.generationRunId === claim.generationRunId && sameName(screen.name, name));
  };

  const pending = [...approval.outputs].sort((left, right) => left.sequence - right.sequence).flatMap((output): Array<Omit<FlowPlaceholder, "x" | "y">> => {
    if (existing.has(output.stableKey)) return [];
    const base = { key: output.stableKey, name: output.name, kind: output.kind };
    const claim = claims.get(output.stableKey);
    if (!claim || claim.status === "failed" || claim.status === "blocked") {
      // Not started yet, or waiting for its one automatic retry.
      return live ? [{ ...base, status: "queued" as const, detail: null }] : [];
    }
    if (claim.status === "ready" || hasFrame(output.name, claim)) return [];
    const stage = previewByKey.has(output.stableKey) && preview ? PREVIEW_STAGE[preview.stage] : "Starting";
    return [{ ...base, status: "designing" as const, detail: stage }];
  });
  if (!pending.length) return [];

  // The next free slot: the project's own counter, or just past the rightmost screen when the counter is behind.
  const rightmost = screens.length ? Math.max(...screens.map((screen) => screen.x)) + CANVAS_SLOT_WIDTH : DEFAULT_SLOT.x;
  const x = Math.max(nextSlot?.x ?? DEFAULT_SLOT.x, rightmost);
  const y = nextSlot?.y ?? screens[0]?.y ?? DEFAULT_SLOT.y;
  return pending.map((placeholder, index) => ({ ...placeholder, x: x + index * CANVAS_SLOT_WIDTH, y }));
}
