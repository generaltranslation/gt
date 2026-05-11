import { GTFile, TranslationFunctionContext } from '../types';
import { importDocument } from '../translation/importDocument';
import { createStableTranslationKey } from './documentIds';

export interface BatchProcessorOptions<T = unknown, R = unknown> {
  batchSize?: number;
  getConcurrencyKey?: (item: T) => string | undefined;
  onProgress?: (current: number, total: number) => void;
  onItemSuccess?: (item: T, result: R) => void;
  onItemFailure?: (item: T, error: unknown) => void;
}

export interface ImportBatchItem {
  docInfo: GTFile;
  locale: string;
  data: string;
  translationContext: TranslationFunctionContext;
  key: string;
}

export async function processBatch<T, R = unknown>(
  items: T[],
  processor: (item: T) => R | Promise<R>,
  options: BatchProcessorOptions<T, Awaited<R>> = {}
): Promise<{
  successCount: number;
  failureCount: number;
  successfulItems: Awaited<R>[];
  failedItems: { item: T; error: unknown }[];
}> {
  const {
    batchSize = 20,
    getConcurrencyKey,
    onProgress,
    onItemSuccess,
    onItemFailure,
  } = options;

  let successCount = 0;
  let failureCount = 0;
  const successfulItems: Awaited<R>[] = [];
  const failedItems: { item: T; error: unknown }[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const pendingByKey = new Map<string, Promise<void>>();

    const batchPromises: Promise<
      | { success: true; item: T; result: Awaited<R> }
      | { success: false; item: T; error: unknown }
    >[] = batch.map(async (item) => {
      const concurrencyKey = getConcurrencyKey?.(item);
      const pending = concurrencyKey
        ? pendingByKey.get(concurrencyKey)
        : undefined;

      let release: () => void = () => {};
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });

      if (concurrencyKey) {
        pendingByKey.set(concurrencyKey, current);
      }

      try {
        if (pending) {
          await pending;
        }

        const result = await processor(item);
        onItemSuccess?.(item, result);
        return { success: true as const, item, result };
      } catch (error) {
        onItemFailure?.(item, error);
        return { success: false as const, item, error };
      } finally {
        release();
        if (concurrencyKey && pendingByKey.get(concurrencyKey) === current) {
          pendingByKey.delete(concurrencyKey);
        }
      }
    });

    const batchResults = await Promise.all(batchPromises);

    batchResults.forEach((result) => {
      if (result.success) {
        successCount++;
        successfulItems.push(result.result);
      } else {
        failureCount++;
        failedItems.push({ item: result.item, error: result.error });
      }
    });

    onProgress?.(i + batch.length, items.length);
  }

  return { successCount, failureCount, successfulItems, failedItems };
}

export async function processImportBatch(
  items: ImportBatchItem[],
  options: BatchProcessorOptions<ImportBatchItem, string> = {}
): Promise<{
  successCount: number;
  failureCount: number;
  successfulImports: string[];
  failedItems: { item: ImportBatchItem; error: unknown }[];
}> {
  const successfulImports: string[] = [];

  const result = await processBatch(
    items,
    async (item: ImportBatchItem) => {
      await importDocument(
        item.docInfo,
        item.locale,
        item.data,
        item.translationContext,
        false
      );
      return item.key;
    },
    {
      ...options,
      getConcurrencyKey: (item: ImportBatchItem) =>
        createStableTranslationKey(
          undefined,
          item.docInfo.documentId,
          item.locale
        ),
      onItemSuccess: (item: ImportBatchItem, key: string) => {
        successfulImports.push(key);
        options.onItemSuccess?.(item, key);
      },
      onItemFailure: (item: ImportBatchItem, error: unknown) => {
        console.error(
          `Failed to import ${item.docInfo.documentId} (${item.locale}):`,
          error
        );
        options.onItemFailure?.(item, error);
      },
    }
  );

  return {
    ...result,
    successfulImports,
  };
}
