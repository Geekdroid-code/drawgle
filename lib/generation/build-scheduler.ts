export function buildFirstScreenPriorityBatches<T>(items: readonly T[], concurrency = 2): T[][] {
  if (items.length === 0) return [];
  const width = Math.max(1, Math.floor(concurrency));
  const batches: T[][] = [[items[0]]];
  for (let index = 1; index < items.length; index += width) {
    batches.push(items.slice(index, index + width));
  }
  return batches;
}
