export const DEFAULT_BATCH_SIZE = 100;
export const FONT_BATCH_SIZE = 50;

export type BatchResult<T> = {
  data: T[];
  count: number;
  batchCount: number;
};

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
): Promise<BatchResult<TOutput>> {
  const batches = createBatches(items, batchSize);
  const results: TOutput[][] = [];
  if (parallel) {
    results.push(...(await Promise.all(batches.map(processBatch))));
  } else {
    for (const batch of batches) results.push(await processBatch(batch));
  }
  const data = results.flat();

  return { data, count: data.length, batchCount: batches.length };
}
