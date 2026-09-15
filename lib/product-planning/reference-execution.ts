import type { ProductPlanning } from "./model";
import type { GenerationReferencePolicy, ReferenceMode, ReferenceSource } from "@/lib/types";
import { planningReferenceContext } from "./reference-context";

// Resolve from durable state, never from a filename or the mere presence of pixels.
export function productReferenceExecution(state: ProductPlanning): {
  policy: GenerationReferencePolicy; mode: ReferenceMode; source: ReferenceSource | null;
  imagePath: string | null; referenceId: string | null; catalogHash: string | null;
} {
  if (state.input.referencePreference?.mode === "none") return { policy: "no_reference", mode: "internal_style", source: null, imagePath: null, referenceId: null, catalogHash: null };
  const context = planningReferenceContext(state);
  const curated = context.source === "curated";
  return {
    policy: curated ? "curated_evidence" : context.hasUserUpload ? "user_upload" : "curated_fallback",
    mode: curated ? "curated_style" : context.mode === "recreate" ? "user_recreate" : context.hasUserUpload ? "user_style" : "internal_style",
    source: curated ? "curated" : context.hasUserUpload ? "user_upload" : null,
    imagePath: state.input.imagePath, referenceId: curated ? state.experience?.referenceId ?? null : null,
    catalogHash: curated ? state.experience?.catalogHash ?? null : null,
  };
}
