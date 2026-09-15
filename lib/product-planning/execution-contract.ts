import { createHash } from "node:crypto";
import { assertExperienceReady, type ProductPlanning } from "./model";
import type { PromptImagePayload } from "@/lib/types";
import { validateNewOutputPolicy } from "./output-policy";

export function validateExecutionProduct(state?: ProductPlanning | null, image?: PromptImagePayload | null) {
  if (!state?.scope?.manifest?.length) return;
  if (state.scope.status !== "approved") throw new Error("Generation requires an approved product scope.");
  if (state.experience?.requirementsKey !== undefined) {
    assertExperienceReady(state);
    if (state.input.imagePath && (!image || createHash("sha256").update(image.data).digest("hex") !== state.experience.referenceHash)) throw new Error("Approved reference evidence changed. Restore the saved source before retrying.");
  }
  const recreate = Boolean(state.input.imagePath && state.input.imageReferenceMode === "recreate");
  if (state.scope.outputPolicy === "manual_states_v1") validateNewOutputPolicy(state.scope.manifest, recreate);
  if (recreate && (!image || !state.experience || createHash("sha256").update(image.data).digest("hex") !== state.experience.referenceHash)) throw new Error("Approved recreation reference could not be verified. Restore the original source before retrying.");
}

export function approvedOutputKind(state: ProductPlanning | null | undefined, stableKey: string): "screen" | "state" {
  return state?.scope?.manifest?.find(item => item.stableKey === stableKey)?.kind ?? "screen";
}
