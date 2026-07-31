import type { GenerationRetryContext, ScreenPlan, ScreenStateVariantPlan } from "@/lib/types";

type RetryScreenRow = {
  id: string;
  name: string;
  status: "queued" | "building" | "ready" | "failed";
  parent_screen_id: string | null;
  state_key: string | null;
};

export type GenerationRetryScope = {
  context: GenerationRetryContext;
  plannedScreens: ScreenPlan[] | null;
  stateVariants: ScreenStateVariantPlan[];
  hasWork: boolean;
};

const normalizedName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const uniqueNormalizedNames = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = normalizedName(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
};

/**
 * Decide which screens/state variants remain retryable from a previous generation.
 *
 * Supports:
 * - full missing/failed set (default)
 * - explicit screen name subset (per-screen retry)
 * - state-variant only retries when all base screens are ready
 */
export function determineGenerationRetryScope({
  sourceGenerationRunId,
  plannedScreens,
  stateVariants,
  selectedStateVariantIds,
  screens,
  targetScreenNames,
}: {
  sourceGenerationRunId: string;
  plannedScreens: ScreenPlan[] | null;
  stateVariants: ScreenStateVariantPlan[];
  selectedStateVariantIds: string[];
  screens: RetryScreenRow[];
  /** Optional explicit subset of screen names to retry. */
  targetScreenNames?: string[] | null;
}): GenerationRetryScope {
  if (!plannedScreens?.length) {
    return {
      context: { sourceGenerationRunId, mode: "full_pipeline" },
      plannedScreens: null,
      stateVariants: [],
      hasWork: true,
    };
  }

  const baseScreens = screens.filter((screen) => !screen.parent_screen_id);
  const readyBaseNames = new Set(
    baseScreens.filter((screen) => screen.status === "ready").map((screen) => normalizedName(screen.name)),
  );
  const requestedTargets = uniqueNormalizedNames(targetScreenNames ?? []);
  const requestedTargetSet = new Set(requestedTargets);

  // Default: everything that is not ready yet.
  // Explicit targets: only those names (even if already failed rows exist).
  let missingPlans = plannedScreens.filter((plan) => !readyBaseNames.has(normalizedName(plan.name)));
  if (requestedTargets.length > 0) {
    const knownPlans = plannedScreens.filter((plan) => requestedTargetSet.has(normalizedName(plan.name)));
    // Only retry non-ready targets; ignore ready ones silently.
    missingPlans = knownPlans.filter((plan) => !readyBaseNames.has(normalizedName(plan.name)));
  }

  if (missingPlans.length > 0) {
    const retryPlanNames = new Set(missingPlans.map((plan) => normalizedName(plan.name)));
    const reuseScreenIdsByName = Object.fromEntries(
      baseScreens
        .filter((screen) => screen.status !== "ready" && retryPlanNames.has(normalizedName(screen.name)))
        .map((screen) => [normalizedName(screen.name), screen.id]),
    );
    const selectedIds = new Set(selectedStateVariantIds);
    return {
      context: {
        sourceGenerationRunId,
        mode: "missing_screens",
        reuseScreenIdsByName,
        targetScreenNames: requestedTargets.length > 0
          ? missingPlans.map((plan) => plan.name)
          : undefined,
      },
      plannedScreens: missingPlans,
      stateVariants: missingPlans.length === 1
        ? stateVariants.filter((variant) => selectedIds.has(variant.id))
        : [],
      hasWork: true,
    };
  }

  // No base screens missing. Optionally retry failed/missing state variants.
  // Skip state-variant retries when caller asked for explicit base screen names
  // that are already ready (nothing left to do).
  if (requestedTargets.length > 0) {
    return {
      context: { sourceGenerationRunId, mode: "missing_screens" },
      plannedScreens: [],
      stateVariants: [],
      hasWork: false,
    };
  }

  if (plannedScreens.length === 1 && stateVariants.length > 0) {
    const selectedIds = new Set(selectedStateVariantIds);
    const selectedVariants = stateVariants.filter((variant) => selectedIds.has(variant.id));
    const parent = baseScreens.find((screen) =>
      screen.status === "ready" && normalizedName(screen.name) === normalizedName(plannedScreens[0].name),
    );

    if (parent && selectedVariants.length > 0) {
      const childScreens = screens.filter((screen) => screen.parent_screen_id === parent.id);
      const readyStateKeys = new Set(
        childScreens.filter((screen) => screen.status === "ready" && screen.state_key).map((screen) => screen.state_key!),
      );
      const missingVariants = selectedVariants.filter((variant) => !readyStateKeys.has(variant.stateKey));
      const missingStateKeys = new Set(missingVariants.map((variant) => variant.stateKey));
      const reuseStateVariantIdsByKey = Object.fromEntries(
        childScreens
          .filter((screen) => screen.status !== "ready" && screen.state_key && missingStateKeys.has(screen.state_key))
          .map((screen) => [screen.state_key!, screen.id]),
      );

      return {
        context: {
          sourceGenerationRunId,
          mode: "state_variants",
          parentScreenId: parent.id,
          reuseStateVariantIdsByKey,
        },
        plannedScreens,
        stateVariants: missingVariants,
        hasWork: missingVariants.length > 0,
      };
    }
  }

  return {
    context: { sourceGenerationRunId, mode: "missing_screens" },
    plannedScreens: [],
    stateVariants: [],
    hasWork: false,
  };
}

/** True when a terminal run still has failed/missing outputs worth retrying. */
export function generationRunHasRetryableWork({
  runStatus,
  screens,
  requestedScreenCount,
}: {
  runStatus: string;
  screens: Array<{ status: string; parent_screen_id?: string | null; parentScreenId?: string | null }>;
  requestedScreenCount?: number | null;
}): boolean {
  const baseScreens = screens.filter((screen) => !(screen.parent_screen_id ?? screen.parentScreenId));
  const failedCount = baseScreens.filter((screen) => screen.status === "failed").length;
  const readyCount = baseScreens.filter((screen) => screen.status === "ready").length;
  const buildingCount = baseScreens.filter((screen) => screen.status === "building" || screen.status === "queued").length;
  if (buildingCount > 0) return false;
  if (failedCount > 0) return true;
  if (runStatus === "failed" || runStatus === "canceled") return true;
  if (typeof requestedScreenCount === "number" && requestedScreenCount > readyCount) return true;
  return false;
}
