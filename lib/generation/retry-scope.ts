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

export function determineGenerationRetryScope({
  sourceGenerationRunId,
  plannedScreens,
  stateVariants,
  selectedStateVariantIds,
  screens,
}: {
  sourceGenerationRunId: string;
  plannedScreens: ScreenPlan[] | null;
  stateVariants: ScreenStateVariantPlan[];
  selectedStateVariantIds: string[];
  screens: RetryScreenRow[];
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
  const missingPlans = plannedScreens.filter((plan) => !readyBaseNames.has(normalizedName(plan.name)));

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
      },
      plannedScreens: missingPlans,
      stateVariants: missingPlans.length === 1
        ? stateVariants.filter((variant) => selectedIds.has(variant.id))
        : [],
      hasWork: true,
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
