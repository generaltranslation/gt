export const DEFAULT_BATCH_SIZE = 100;

export type BatchOptions = {
  batchSize?: number;
  parallel?: boolean;
};

export function createBatches<T>(
  items: readonly T[],
  batchSize = DEFAULT_BATCH_SIZE
): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
}

export async function processBatches<TInput, TOutput>(
  items: readonly TInput[],
  processBatch: (batch: TInput[]) => Promise<TOutput[]>,
  { batchSize = DEFAULT_BATCH_SIZE, parallel = true }: BatchOptions = {}
): Promise<TOutput[]> {
  const batches = createBatches(items, batchSize);
  if (parallel) {
    return (await Promise.all(batches.map(processBatch))).flat();
  }
  const results: TOutput[][] = [];
  for (const batch of batches) results.push(await processBatch(batch));
  return results.flat();
}
