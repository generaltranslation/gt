import { api, overrideConfig } from '../adapter/core';
import { FileProperties } from '../adapter/types';
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
) {
  overrideConfig(secrets);
  let retries = 0;

  while (retries <= maxRetries) {
    try {
      // Download the files
      const { results } = await api.queryFilesContent(
        files.map((file) => ({
          fileId: file.fileId,
          branchId: file.branchId,
          versionId: file.versionId,
          locale: file.locale,
        }))
      );
      // Pending and not-found files are not downloaded yet.
      return results.flatMap((result) =>
        result.status === 'ready' && typeof result.data === 'string'
          ? [{ ...result, data: result.data }]
          : []
      );
    } catch {
      // Increment retry counter and wait before next attempt
      retries++;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return [];
}
