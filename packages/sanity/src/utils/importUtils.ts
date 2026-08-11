import { Secrets, TranslationFunctionContext } from '../types';
import { downloadTranslations } from '../translation/downloadTranslations';
import { processImportBatch, ImportBatchItem } from './batchProcessor';
import type { FileProperties, TranslationStatus } from '../adapter/types';
import { createStableTranslationKey, getPublishedId } from './documentIds';

export interface ImportResult {
  successCount: number;
  failureCount: number;
  successfulImports: string[];
}

/** A status that has passed the ready check, so its `fileData` is present. */
export type ReadyTranslationStatus = TranslationStatus & {
  fileData: FileProperties;
};

export interface ImportOptions {
  filterReadyFiles?: (key: string, status: ReadyTranslationStatus) => boolean;
  onProgress?: (current: number, total: number) => void;
  onImportSuccess?: (key: string) => void;
}

export async function getReadyFilesForImport(
  translationStatuses: Map<string, TranslationStatus>,
  options: ImportOptions = {}
): Promise<FileProperties[]> {
  const { filterReadyFiles = () => true } = options;
  const readyFilesByDocumentLocale = new Map<string, FileProperties>();

  for (const [key, status] of translationStatuses.entries()) {
    const readyStatus =
      status.isReady && status.fileData
        ? ({ ...status, fileData: status.fileData } as ReadyTranslationStatus)
        : null;
    if (readyStatus && filterReadyFiles(key, readyStatus)) {
      const fileData = {
        fileId: getPublishedId(readyStatus.fileData.fileId),
        versionId: readyStatus.fileData.versionId,
        branchId: readyStatus.fileData.branchId,
        locale: readyStatus.fileData.locale,
      };
      readyFilesByDocumentLocale.set(
        createStableTranslationKey(
          fileData.branchId,
          fileData.fileId,
          fileData.locale
        ),
        fileData
      );
    }
  }

  return Array.from(readyFilesByDocumentLocale.values());
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

  const importItems: ImportBatchItem[] = downloadedFiles.map((file) => {
    const data =
      typeof file.data === 'string'
        ? file.data
        : JSON.stringify(file.data ?? '');
    return {
      docInfo: {
        documentId: file.fileId,
        versionId: file.versionId,
      },
      locale: file.locale!,
      data,
      translationContext,
      key: `${file.branchId}:${file.fileId}:${file.versionId}:${file.locale}`,
    };
  });

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
