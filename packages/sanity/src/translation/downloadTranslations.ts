import { gt, overrideConfig } from '../adapter/core';
import type { Secrets } from '../types';

export type BatchedFiles = Array<{
  documentId: string;
  versionId: string;
  translationId: string;
  locale: string;
}>;

export type DownloadedFile = {
  docData: {
    documentId: string;
    versionId: string;
    translationId: string;
    locale: string;
  };
  data: string;
};
/**
 * Downloads multiple translation files in a single batch request
 * @param files - Array of files to download with their output paths
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelay - Delay between retries in milliseconds
 * @returns Object containing successful and failed file IDs
 */
export async function downloadTranslations(
  files: BatchedFiles,
  secrets: Secrets,
  maxRetries = 3,
  retryDelay = 1000
): Promise<DownloadedFile[]> {
  overrideConfig(secrets);
  let retries = 0;
  const fileIds = files.map((file) => file.translationId);

  const map = new Map(files.map((file) => [file.translationId, file]));
  const result = [] as DownloadedFile[];

  while (retries <= maxRetries) {
    try {
      // Download the files
      const responseData = await gt.downloadFileBatch(fileIds);
      const downloadedFiles = responseData.files || [];

      // Process each file in the response
      for (const file of downloadedFiles) {
        const documentData = map.get(file.id);
        if (!documentData) {
          continue;
        }

        result.push({
          docData: documentData,
          data: file.data,
        });
      }

      return result;
    } catch (error) {
      // Increment retry counter and wait before next attempt
      retries++;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return result;
}
