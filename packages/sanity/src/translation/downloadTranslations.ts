import { gt, overrideConfig } from '../adapter/core';
import { FileProperties } from '../adapter/types';
import { DownloadedFile } from 'generaltranslation/types';
import type { Secrets } from '../types';

/**
 * Downloads multiple translation files in a single batch request
 * @param files - Array of files to download with their output paths
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelay - Delay between retries in milliseconds
 * @returns Object containing successful and failed file IDs
 */
export async function downloadTranslations(
  files: FileProperties[],
  secrets: Secrets,
  maxRetries = 3,
  retryDelay = 1000
): Promise<DownloadedFile[]> {
  overrideConfig(secrets);
  let retries = 0;

  while (retries <= maxRetries) {
    try {
      // Download the files
      const responseData = await gt.downloadFileBatch(
        files.map((file) => ({
          fileId: file.fileId,
          branchId: file.branchId,
          versionId: file.versionId,
          locale: file.locale,
        }))
      );
      const downloadedFiles = responseData.files || [];
      return downloadedFiles;
    } catch (error) {
      // Increment retry counter and wait before next attempt
      retries++;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return [];
}
