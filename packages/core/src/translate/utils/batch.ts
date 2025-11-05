/**
 * Splits an array into batches of a specified size.
 * @param items - The array to split into batches
 * @param batchSize - The maximum size of each batch
 * @returns An array of batches
 */
export function createBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Result of processing batches
 */
export interface BatchList<T> {
  /** The items successfully processed across all batches */
  data: T[];
  /** The total number of items processed */
  count: number;
  /** The number of batches processed */
  batchCount: number;
}

/**
 * Options for batch processing
 */
export interface BatchProcessOptions {
  /** Maximum number of items per batch (default: 100) */
  batchSize?: number;
  /** Whether to process batches in parallel (default: true) */
  parallel?: boolean;
}

/**
 * Processes items in batches using a provided processor function.
 *
 * @param items - The items to process
 * @param processor - Async function that processes a single batch and returns items
 * @param options - Optional configuration for batch processing
 * @returns Promise that resolves to a BatchList containing all processed items
 *
 * @example
 * ```typescript
 * const result = await processBatches(
 *   files,
 *   async (batch) => {
 *     const response = await uploadFiles(batch);
 *     return response.uploadedFiles;
 *   },
 *   { batchSize: 100 }
 * );
 *
 * console.log(result.data); // All items
 * console.log(result.count); // Total count
 * console.log(result.batchCount); // Number of batches processed
 * ```
 */
export async function processBatches<TInput, TOutput>(
  items: TInput[],
  processor: (batch: TInput[]) => Promise<TOutput[]>,
  options: BatchProcessOptions = {}
): Promise<BatchList<TOutput>> {
  const { batchSize = 100, parallel = true } = options;

  if (items.length === 0) {
    return {
      data: [],
      count: 0,
      batchCount: 0,
    };
  }

  const batches = createBatches(items, batchSize);
  const allItems: TOutput[] = [];

  if (parallel) {
    // Process all batches in parallel
    const results = await Promise.all(batches.map((batch) => processor(batch)));
    for (const result of results) {
      if (result) {
        allItems.push(...result);
      }
    }
  } else {
    // Process batches sequentially
    for (const batch of batches) {
      const result = await processor(batch);
      if (result) {
        allItems.push(...result);
      }
    }
  }

  return {
    data: allItems,
    count: allItems.length,
    batchCount: batches.length,
  };
}
