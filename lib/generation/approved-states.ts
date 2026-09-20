import type { ScreenPlan, ScreenStateVariantPlan } from "@/lib/types";

/** Model suggestions are not approval. Apply this before roadmap writes or billing. */
export function retainApprovedStates(screens: ScreenPlan[], approved?: ScreenStateVariantPlan[] | null): ScreenPlan[] {
  const selected = new Map((approved ?? []).map(variant => [variant.id, variant]));
  return screens.map(screen => ({ ...screen, stateVariants: (screen.stateVariants ?? [])
    .flatMap(variant => selected.has(variant.id) ? [selected.get(variant.id)!] : []) }));
}
