import type { FunctionalItem } from "./functional-plan";

export type ProductFulfillment = { output_key: string; generation_run_id: string; status: "claimed" | "ready" | "failed" | "blocked"; screen_id: string | null };

/**
 * How many frames the source image showed, as the analyses of the flow's earlier batches counted them, or null
 * before any batch was analysed. Each batch of an Image to UI flow records its count on its run.
 */
export function sourceFramesSeen(runMetadata: ReadonlyArray<unknown>): number | null {
  const counts = runMetadata
    .map((metadata) => Number((metadata as { referenceAnalysisDiagnostics?: { screenReferenceCount?: unknown } } | null)
      ?.referenceAnalysisDiagnostics?.screenReferenceCount))
    .filter((count) => Number.isFinite(count) && count > 0);
  return counts.length > 0 ? Math.max(...counts) : null;
}

/**
 * Whether the approved flow maps a step to a frame the source image does not have. Such a flow cannot be copied:
 * the first live one was a single screenshot with a request for a four-step flow, and steps 2 to 4 failed on every
 * retry. Its remaining screens are designed in the image's style instead.
 */
export const mapsBeyondSourceFrames = (manifest: readonly FunctionalItem[], framesSeen: number | null) =>
  framesSeen !== null && manifest.some((item) => item.referenceScreenIndex != null && item.referenceScreenIndex > framesSeen);

// The complete manifest has no batch-size target. This selects only the next
// bounded execution chunk, prioritizing states whose parent is already ready.
export function nextProductBatch(manifest: FunctionalItem[], claims: ProductFulfillment[], capacity = 8, existingKeys: string[] = [], recreate = false) {
  const byKey = new Map(claims.map(claim => [claim.output_key, claim]));
  const outstanding = claims.find(claim => claim.status === "claimed");
  if (outstanding) return manifest.filter(item => byKey.get(item.stableKey)?.generation_run_id === outstanding.generation_run_id);
  const ready = new Set([...existingKeys, ...claims.filter(claim => claim.status === "ready").map(claim => claim.output_key)]);
  const pending = manifest.filter(item => !byKey.has(item.stableKey)).sort((a, b) => a.sequence - b.sequence);
  if (recreate) return pending.filter(item => item.referenceScreenIndex != null).slice(0, capacity);
  const dependenciesReady = (item: FunctionalItem) => item.dependencyKeys.every(key => ready.has(key));
  const state = pending.find(item => item.kind === "state" && ready.has(item.parentStableKey!) && dependenciesReady(item));
  if (state) return pending.filter(item => item.kind === "state" && item.parentStableKey === state.parentStableKey && dependenciesReady(item)).slice(0, capacity);
  const parent = pending.find(item => item.kind === "screen" && dependenciesReady(item));
  if (!parent) return [];
  const batch: FunctionalItem[] = [];
  for (const candidate of pending.filter(item => item.kind === "screen" && dependenciesReady(item))) {
    if (batch.length >= capacity) break;
    batch.push(candidate);
    batch.push(...pending.filter(item => item.kind === "state" && item.parentStableKey === candidate.stableKey
      && item.dependencyKeys.every(key => key === candidate.stableKey || ready.has(key))).slice(0, capacity - batch.length));
  }
  return batch;
}

export function productExecutionProgress(manifest: FunctionalItem[], claims: ProductFulfillment[]) {
  const delivered = new Set(claims.filter(item => item.status === "ready").map(item => item.output_key));
  const failed = new Set(claims.filter(item => item.status === "failed").map(item => item.output_key));
  const blocked = new Set(claims.filter(item => item.status === "blocked").map(item => item.output_key));
  for (let pass = 0; pass < manifest.length; pass++) {
    const before = blocked.size;
    for (const item of manifest) {
      if (delivered.has(item.stableKey) || failed.has(item.stableKey)) continue;
      if ([...item.dependencyKeys, ...(item.parentStableKey ? [item.parentStableKey] : [])].some(key => failed.has(key) || blocked.has(key))) blocked.add(item.stableKey);
    }
    if (before === blocked.size) break;
  }
  return { total: manifest.length, delivered: delivered.size, failed: failed.size, blocked: blocked.size,
    pending: Math.max(0, manifest.length - delivered.size - failed.size - blocked.size) };
}
