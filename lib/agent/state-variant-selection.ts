import type { ScreenStateVariantPlan } from "@/lib/types";

export type StateVariantSelectionProposal = {
  stateVariants?: ScreenStateVariantPlan[] | null;
  selectedStateVariantIds?: string[] | null;
};

export type StateVariantSelectionResult = {
  selectedIds: string[];
  selectedVariants: ScreenStateVariantPlan[];
  invalidIds: string[];
};

export function selectStateVariantsForApproval(
  proposal: StateVariantSelectionProposal,
  selectedStateVariantIds?: string[],
): StateVariantSelectionResult {
  const variants = proposal.stateVariants ?? [];
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const requestedIds = selectedStateVariantIds !== undefined
    ? selectedStateVariantIds
    : proposal.selectedStateVariantIds && proposal.selectedStateVariantIds.length > 0
      ? proposal.selectedStateVariantIds
      : variants.filter((variant) => variant.defaultSelected).map((variant) => variant.id);

  const selectedIds = Array.from(new Set(requestedIds.map((id) => id.trim()).filter(Boolean))).slice(0, 3);
  const invalidIds = selectedIds.filter((id) => !variantById.has(id));
  const selectedVariants = invalidIds.length > 0
    ? []
    : selectedIds.map((id) => variantById.get(id)).filter((variant): variant is ScreenStateVariantPlan => Boolean(variant));

  return {
    selectedIds,
    selectedVariants,
    invalidIds,
  };
}
