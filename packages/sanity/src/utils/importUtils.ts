import { SanityDocument } from 'sanity';
import { GTFile, Secrets, TranslationFunctionContext } from '../types';
import {
  downloadTranslations,
  BatchedFiles,
} from '../translation/downloadTranslations';
import { processImportBatch, ImportBatchItem } from './batchProcessor';

export interface TranslationStatus {
  progress: number;
  isReady: boolean;
  translationId?: string;
}

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
  documents: SanityDocument[],
  translationStatuses: Map<string, TranslationStatus>,
  options: ImportOptions = {}
): Promise<BatchedFiles> {
  const { filterReadyFiles = () => true } = options;
  const readyFiles: BatchedFiles = [];

  for (const [key, status] of translationStatuses.entries()) {
    if (
      status.isReady &&
      status.translationId &&
      filterReadyFiles(key, status)
    ) {
      const [documentId, locale] = key.split(':');
      const document = documents.find(
        (doc) => (doc._id?.replace('drafts.', '') || doc._id) === documentId
      );

      if (document) {
        readyFiles.push({
          documentId,
          versionId: document._rev,
          translationId: status.translationId,
          locale,
        });
      }
    }
  }

  return readyFiles;
}

export async function importTranslations(
  readyFiles: BatchedFiles,
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
      documentId: file.docData.documentId,
      versionId: file.docData.versionId,
    },
    locale: file.docData.locale,
    data: file.data,
    translationContext,
    key: `${file.docData.documentId}:${file.docData.locale}`,
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
