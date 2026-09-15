import type { FunctionalItem } from "./functional-plan";

export type OutputRendering = "product_screen" | "reference_frame" | "derived_state";

// Relationship controls canvas grouping and historical pricing, not the renderer.
// Infer missing strategy for historical approvals without rewriting their scope.
export function outputRendering(item: FunctionalItem, recreate: boolean): OutputRendering {
  if (recreate && item.referenceScreenIndex != null) return "reference_frame";
  return item.kind === "state" ? "derived_state" : "product_screen";
}

export function validateNewOutputPolicy(items: FunctionalItem[], recreate: boolean) {
  for (const item of items) {
    if (item.kind === "state" && !recreate) {
      throw new Error(`${item.name}: additional state frames are created from the canvas Create state control. Put ordinary behavior in the parent's inlineStates and actions. Keep substantial user tasks in the main flow; do not rename a cosmetic variant as a main screen.`);
    }
    if (!recreate && item.referenceScreenIndex != null) throw new Error(`${item.name}: source frame indices apply only to exact recreation. A style reference does not supply product screens.`);
    if (recreate && item.referenceScreenIndex == null) throw new Error(`${item.name}: each supplied frame, including a state frame, needs its source index.`);
    const expected = outputRendering(item, recreate);
    if (item.rendering && item.rendering !== expected) throw new Error(`${item.name}: rendering must be ${expected} for this project mode.`);
  }
  if (recreate && new Set(items.map(item => item.referenceScreenIndex)).size !== items.length) throw new Error("Each requested source frame must be mapped once.");
}
