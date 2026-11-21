export const DEFAULT_BATCH_SIZE = 100;

/** The API rejects a request body over 4MB. */
export const MAX_REQUEST_BODY_BYTES = 4_000_000;
// Room for the key a request wraps its batch in.
const DEFAULT_MAX_BATCH_BYTES = MAX_REQUEST_BODY_BYTES - 64;

export type BatchOptions<T = unknown> = {
  batchSize?: number;
  /** The most bytes a batch takes as a JSON array: by default the request body limit, less the key the request wraps the batch in. */
  maxBytes?: number;
  /** What an item takes of `maxBytes`: its JSON, unless the request sends it in another form. */
  byteLength?: (item: T) => number;
  parallel?: boolean;
};

export function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

/** An item over `maxBytes` on its own gets a batch to itself, which the API rejects. */
export function createBatches<T>(
  items: readonly T[],
  batchSize: number,
  maxBytes?: number,
  byteLength: (item: T) => number = jsonByteLength
): T[][] {
  const batches: T[][] = [];
  // The array's brackets.
  let bytes = 2;
  for (const item of items) {
    // Each item adds its bytes and a separating comma.
    const itemBytes = maxBytes === undefined ? 0 : byteLength(item) + 1;
    const batch = batches[batches.length - 1];
    if (
      batch &&
      batch.length < batchSize &&
      (maxBytes === undefined || bytes + itemBytes <= maxBytes)
    ) {
      batch.push(item);
      bytes += itemBytes;
    } else {
      batches.push([item]);
      bytes = 2 + itemBytes;
    }
  }
  return batches;
}

export async function processBatches<TInput, TOutput>(
  items: readonly TInput[],
  processBatch: (batch: TInput[]) => Promise<TOutput[]>,
  {
    batchSize = DEFAULT_BATCH_SIZE,
    maxBytes = DEFAULT_MAX_BATCH_BYTES,
    byteLength,
    parallel = true,
  }: BatchOptions<TInput> = {}
): Promise<TOutput[]> {
  const batches = createBatches(items, batchSize, maxBytes, byteLength);
  if (parallel) {
    return (await Promise.all(batches.map(processBatch))).flat();
  }
  const results: TOutput[][] = [];
  for (const batch of batches) results.push(await processBatch(batch));
  return results.flat();
}
