import { isTransientApiError } from 'generaltranslation/api';
import { projectFor } from '../adapter/core';
import { FileProperties } from '../adapter/types';
import type { Secrets } from '../types';

/**
 * Downloads multiple translation files in a single batch request
 * @param files - Array of files to download with their output paths
 * @param maxRetries - Maximum number of retries after a transient failure
 * @param retryDelay - Delay between retries in milliseconds
 * @returns The ready files; throws a permanent failure, or the last transient one
 */
export async function downloadTranslations(
  files: FileProperties[],
  secrets: Secrets,
  maxRetries = 3,
  retryDelay = 1000
) {
  for (let retries = 0; ; retries++) {
    try {
      // Download the files
      const { results } = await projectFor(secrets).queryFilesContent(
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
    } catch (error) {
      if (retries >= maxRetries || !isTransientApiError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}
