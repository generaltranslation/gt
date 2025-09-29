import { GTFile, TranslationFunctionContext } from '../types';
import { importDocument } from '../translation/importDocument';

export interface BatchProcessorOptions {
  batchSize?: number;
  onProgress?: (current: number, total: number) => void;
  onItemSuccess?: (item: any, result: any) => void;
  onItemFailure?: (item: any, error: any) => void;
}

export interface ImportBatchItem {
  docInfo: GTFile;
  locale: string;
  data: any;
  translationContext: TranslationFunctionContext;
  key: string;
}

export async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<any>,
  options: BatchProcessorOptions = {}
): Promise<{
  successCount: number;
  failureCount: number;
  successfulItems: any[];
  failedItems: { item: T; error: any }[];
}> {
  const { batchSize = 20, onProgress, onItemSuccess, onItemFailure } = options;

  let successCount = 0;
  let failureCount = 0;
  const successfulItems: any[] = [];
  const failedItems: { item: T; error: any }[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const batchPromises = batch.map(async (item) => {
      try {
        const result = await processor(item);
        onItemSuccess?.(item, result);
        return { success: true, item, result };
      } catch (error) {
        onItemFailure?.(item, error);
        return { success: false, item, error };
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
  options: BatchProcessorOptions = {}
): Promise<{
  successCount: number;
  failureCount: number;
  successfulImports: string[];
  failedItems: { item: ImportBatchItem; error: any }[];
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
      onItemSuccess: (item: ImportBatchItem, key: string) => {
        successfulImports.push(key);
        options.onItemSuccess?.(item, key);
      },
      onItemFailure: (item: ImportBatchItem, error: any) => {
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
