import type { ProductPlanning } from "./model";

/** Product mode is application state, never a model classification. */
export function planningReferenceContext(state: Pick<ProductPlanning, "input" | "experience">) {
  const source = !state.input.imagePath ? "none"
    : state.input.referenceSource === "curated"
      || (state.experience?.referencePath === state.input.imagePath && state.experience.referenceId)
      ? "curated" : "user";
  return {
    source,
    mode: source === "user" ? (state.input.imageReferenceMode === "recreate" ? "recreate" : "style") : "prompt",
    assessmentMode: source === "user" && state.input.imageReferenceMode === "recreate" ? "recreate" : "product",
    hasUserUpload: source === "user",
  } as const;
}

export function normalizePlanningInput(state: Pick<ProductPlanning, "input" | "experience">): ProductPlanning["input"] {
  const context = planningReferenceContext(state);
  return { ...state.input, referenceSource: context.source,
    imageReferenceMode: context.assessmentMode === "recreate" ? "recreate" : "style" };
}
