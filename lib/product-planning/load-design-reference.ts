import "server-only";
import type { ProductPlanning } from "./model";
import type { PlanningStore } from "./store";
import { planningReferenceContext } from "./reference-context";
import { loadPlanningReference } from "./references";
import { ProductToolError } from "./tool-failure";

/** Only Drawgle's speculative curated selection may be replaced. A supplied
 * image or an established project's visual source remains required. */
export async function loadDesignReference(admin: PlanningStore, ownerId: string, state: ProductPlanning,
  onTrace?: (event: { stage: string; elapsedMs: number; errorCode: string }) => void) {
  if (state.input.referencePreference?.mode === "none") return null;
  const context = planningReferenceContext(state);
  const optional = context.source === "curated" && state.phase === "discovery" && !state.screenReference;
  let image;
  try {
    image = await loadPlanningReference(admin, state.input.imagePath, ownerId);
  } catch (error) {
    if (!optional) throw error;
    image = null;
  }
  if (state.input.imagePath && !image) {
    if (!optional) throw new ProductToolError("The saved reference is unavailable. Restore or replace it before approving designs.", "USER_REFERENCE_UNAVAILABLE");
    onTrace?.({ stage: "reference_optional_load", elapsedMs: 0, errorCode: "OPTIONAL_REFERENCE_UNAVAILABLE" });
  }
  return image;
}
