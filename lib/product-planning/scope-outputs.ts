import type { ProductPlanning } from "./model";
import { functionalBrief, type FunctionalItem } from "./functional-plan";
import { SCREEN_GENERATION_CREDIT_COST, STATE_GENERATION_CREDIT_COST } from "@/lib/generation/pricing";

export function scopeQuote(state: ProductPlanning) {
  const manifest = state.scope?.manifest;
  const parents = manifest ? manifest.filter(item => item.kind === "screen").length : Math.min(state.scope?.surfaceIds.length ?? 0, 5);
  const states = manifest?.filter(item => item.kind === "state").length ?? 0;
  return { parents, states, credits: parents * SCREEN_GENERATION_CREDIT_COST + states * STATE_GENERATION_CREDIT_COST };
}
// Execution keys select work from the frozen approval; they never replace it.
export function executionOutputs(state: ProductPlanning, keys?: string[]) {
  const manifest = state.scope?.manifest ?? [];
  if (!keys) return manifest;
  if (!keys.length || new Set(keys).size !== keys.length || keys.some(key => !manifest.some(item => item.stableKey === key))) {
    throw new Error("Execution must select unique outputs from the approved manifest.");
  }
  return manifest.filter(item => keys.includes(item.stableKey));
}
export function scopeParents(state: ProductPlanning, keys?: string[]) {
  const outputs = executionOutputs(state, keys);
  const all = [...(state.scope?.manifest ?? []), ...(state.scope?.existingOutputs ?? []).map(output => output.item)];
  const parentKeys = new Set(outputs.map(item => item.kind === "screen" ? item.stableKey : item.parentStableKey));
  return all.filter(item => item.kind === "screen" && parentKeys.has(item.stableKey));
}
export function outputPrompt(items: FunctionalItem[]) {
  return items.filter(item => item.kind === "screen").map((item, index) => `${index + 1}. ${item.name}\n${functionalBrief(item)}`).join("\n\n");
}
