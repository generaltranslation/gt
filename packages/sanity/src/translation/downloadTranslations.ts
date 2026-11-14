import { projectFor } from '../adapter/core';
import { FileProperties } from '../adapter/types';
import type { Secrets } from '../types';

/**
 * Downloads multiple translation files in a single batch request
 * @param files - Array of files to download with their output paths
 * @returns The ready files; throws when the request fails
 */
export async function downloadTranslations(
  files: FileProperties[],
  secrets: Secrets
) {
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
}
