import type { ProductPlanning } from "./model";
import type { FunctionalItem } from "./functional-plan";

/** Structural facts for the independent reviewer. A root may be an intentional actor entry. */
export function flowPreflight(state: ProductPlanning, roadmap: FunctionalItem[]) {
  const selectedKeys = state.scope?.outputKeys ?? [];
  const existingKeys = (state.scope?.existingOutputs ?? []).map(output => output.item.stableKey);
  const included = new Set([...selectedKeys, ...existingKeys]);
  const byKey = new Map(roadmap.map(item => [item.stableKey, item]));
  const boundaryKeys = new Set((state.scope?.boundaries ?? []).map(item => item.key));
  const issues: string[] = [];
  const issueDetails: Array<{ id: string; code: string; detail: string }> = [];
  const report = (id: string, code: string, detail: string) => {
    issueDetails.push({ id, code, detail });
    issues.push(detail);
  };
  const inbound = new Set<string>();
  const edges: Array<{ from: string; action: string; to: string }> = [];

  if (!selectedKeys.length) report("selection:empty", "EMPTY_SELECTION", "Select saved screen output keys before reviewing the flow.");
  if (new Set(selectedKeys).size !== selectedKeys.length) report("selection:duplicate", "DUPLICATE_SELECTION", "Selected screen output keys must be unique.");
  for (const key of selectedKeys) {
    const item = byKey.get(key);
    if (!item) {
      report(`selection:missing:${key}`, "MISSING_OUTPUT", `Selected output ${key} is missing from the saved roadmap.`);
      continue;
    }
    for (const action of item.actions) {
      if (!action.destinationKey) continue;
      const destination = action.destinationKey;
      if (!byKey.has(destination) && !boundaryKeys.has(destination)) {
        report(`destination:missing:${key}:${destination}`, "MISSING_DESTINATION", `${key} points to missing destination ${destination}.`);
        continue;
      }
      edges.push({ from: key, action: action.label, to: destination });
      if (included.has(destination)) inbound.add(destination);
    }
  }
  return {
    issues: [...new Set(issues)], issueDetails, selectedKeys, existingKeys, edges,
    independentEntryCandidates: selectedKeys.filter(key => byKey.has(key) && !inbound.has(key)),
  };
}
