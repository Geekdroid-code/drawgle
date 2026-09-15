export function buildFirstScreenPriorityBatches<T>(items: readonly T[], concurrency = 2): T[][] {
  if (items.length === 0) return [];
  const width = Math.max(1, Math.floor(concurrency));
  const batches: T[][] = [[items[0]]];
  for (let index = 1; index < items.length; index += width) {
    batches.push(items.slice(index, index + width));
  }
  return batches;
}

// A completed slot immediately takes the next item; slow siblings do not hold
// an entire wave. Establish the anchor before admitting parallel siblings.
export async function runRollingBuilds<T>(items: readonly T[], build: (item: T) => Promise<void>, options: {
  concurrency?: number; anchorFirst?: boolean; canStart?: () => Promise<boolean>;
} = {}) {
  let next = 0;
  const canStart = options.canStart ?? (async () => true);
  if (options.anchorFirst && items.length) {
    if (!await canStart()) return;
    next = 1; await build(items[0]);
  }
  const width = Math.max(1, Math.min(items.length, Math.floor(options.concurrency ?? 2)));
  const consume = async () => {
    while (next < items.length) {
      const index = next++;
      if (!await canStart()) return;
      await build(items[index]);
    }
  };
  await Promise.all(Array.from({ length: width }, consume));
}
