import type { ScreenPlan } from "@/lib/types";
import type { ProductPlanning } from "./model";
import { functionalStateVariant } from "./functional-plan";
import { executionOutputs, scopeParents } from "./scope-outputs";
import { outputRendering } from "./output-policy";

export function bindApprovedScreenPlans(state: ProductPlanning, keys: string[] | undefined, screens: ScreenPlan[], observedFrameCount = 0) {
  const manifest = executionOutputs(state, keys);
  const expected = scopeParents(state, keys);
  const recreate = state.input.imageReferenceMode === "recreate" && Boolean(state.input.imagePath);
  if (screens.length !== expected.length || new Set(screens.map(screen => screen.name)).size !== screens.length
    || expected.some(item => !screens.some(screen => screen.name === item.name))) {
    throw new Error("Detailed screen planning changed the approved output identities. Review the plan before generation.");
  }
  return expected.map(item => {
    const screen = screens.find(screen => screen.name === item.name)!;
    if (recreate && (item.referenceScreenIndex == null || (observedFrameCount > 0 && item.referenceScreenIndex > observedFrameCount))) {
      throw new Error(`${item.name} does not map to an observed source frame.`);
    }
    return { ...screen, roadmapStableKey: item.stableKey,
      referenceScreenIndex: recreate ? item.referenceScreenIndex : null,
      referenceScreenCount: recreate ? Math.max(observedFrameCount, ...state.scope!.manifest!.map(output => output.referenceScreenIndex ?? 0)) : null,
      stateVariants: manifest.filter(output => output.parentStableKey === item.stableKey && outputRendering(output, recreate) === "derived_state").map(functionalStateVariant),
    };
  });
}
