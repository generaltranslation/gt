// Max files a postprocess pass reads or writes at once. Unbounded
// Promise.all over every translated file opens a descriptor per file and
// fails with EMFILE on large projects.
export const FILE_IO_CONCURRENCY = 512;

/**
 * Keeps up to `batchSize` items in flight and returns results in input order.
 * Mirrors `batchProcess` in gt-cloud's `packages/node/src/utils`.
 * @param items - The items to process
 * @param processor - Processes one item
 * @param batchSize - The maximum number of items in flight at once
 * @returns The processor results, in input order
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  batchSize: number = 25
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }
  const results = Array.from({ length: items.length }) as R[];
  const executing = new Set<Promise<void>>();

  for (let i = 0; i < items.length; i++) {
    const promise = processor(items[i], i).then((result) => {
      results[i] = result;
      executing.delete(promise);
    });

    executing.add(promise);

    if (executing.size >= batchSize) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);

  return results;
}
