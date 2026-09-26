/** Tool calls in one model response are a batch, not an instruction to save scope before its dependencies. */
const order: Record<string, number> = {
  read_product: 0,
  read_functional_plan: 0,
  set_reference_preference: 1,
  update_product: 2,
  update_functional_plan: 3,
  inspect_reference: 4,
  set_design_scope: 5,
  propose_scope: 6,
};

export function orderDesignerCalls<T extends { name?: string }>(calls: T[]): T[] {
  return calls.map((call, index) => ({ call, index }))
    .sort((a, b) => (order[a.call.name ?? ""] ?? 4) - (order[b.call.name ?? ""] ?? 4) || a.index - b.index)
    .map(entry => entry.call);
}
