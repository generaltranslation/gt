import { SanityDocument } from 'sanity';
import { Secrets, TranslationFunctionContext } from '../types';
import { downloadTranslations } from '../translation/downloadTranslations';
import { processImportBatch, ImportBatchItem } from './batchProcessor';
import type { FileProperties, TranslationStatus } from '../adapter/types';

export interface ImportResult {
  successCount: number;
  failureCount: number;
  successfulImports: string[];
}

export interface ImportOptions {
  filterReadyFiles?: (key: string, status: TranslationStatus) => boolean;
  onProgress?: (current: number, total: number) => void;
  onImportSuccess?: (key: string) => void;
}

export async function getReadyFilesForImport(
  translationStatuses: Map<string, TranslationStatus>,
  options: ImportOptions = {}
): Promise<FileProperties[]> {
  const { filterReadyFiles = () => true } = options;
  const readyFiles: FileProperties[] = [];

  for (const [key, status] of translationStatuses.entries()) {
    if (status.isReady && filterReadyFiles(key, status)) {
      readyFiles.push({
        fileId: status.fileData.fileId,
        versionId: status.fileData.versionId,
        branchId: status.fileData.branchId,
        locale: status.fileData.locale,
      });
    }
  }

  return readyFiles;
}

export async function importTranslations(
  readyFiles: FileProperties[],
  secrets: Secrets,
  translationContext: TranslationFunctionContext,
  options: ImportOptions = {}
): Promise<ImportResult> {
  if (readyFiles.length === 0) {
    return { successCount: 0, failureCount: 0, successfulImports: [] };
  }

  const downloadedFiles = await downloadTranslations(readyFiles, secrets);

  const importItems: ImportBatchItem[] = downloadedFiles.map((file) => ({
    docInfo: {
      documentId: file.fileId,
      versionId: file.versionId,
    },
    locale: file.locale!,
    data: file.data,
    translationContext,
    key: `${file.branchId}:${file.fileId}:${file.versionId}:${file.locale}`,
  }));

  const result = await processImportBatch(importItems, {
    onProgress: options.onProgress,
    onItemSuccess: (item, key) => {
      options.onImportSuccess?.(key);
    },
  });

  return {
    successCount: result.successCount,
    failureCount: result.failureCount,
    successfulImports: result.successfulImports,
  };
}
