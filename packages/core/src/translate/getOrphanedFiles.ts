import { TranslationRequestConfig } from '../types';
import apiRequest from './utils/apiRequest';
import { createBatches } from './utils/batch';

export type OrphanedFile = {
  fileId: string;
  versionId: string;
  fileName: string;
};

export type GetOrphanedFilesResult = {
  orphanedFiles: OrphanedFile[];
};

/**
 * @internal
 * Gets orphaned files for a branch: files that exist on the branch but whose
 * file IDs are not in the provided list. Used for move detection.
 * @param branchId - The branch to check for orphaned files.
 * @param fileIds - Current file IDs that are not orphaned.
 * @param options - The options for the API call.
 * @param config - The configuration for the API call.
 * @returns The orphaned files.
 */
export default async function _getOrphanedFiles(
  branchId: string,
  fileIds: string[],
  options: { timeout?: number } = {},
  config: TranslationRequestConfig
): Promise<GetOrphanedFilesResult> {
  const makeRequest = (batchFileIds: string[]) =>
    apiRequest<GetOrphanedFilesResult>(config, '/v2/project/files/orphaned', {
      body: { branchId, fileIds: batchFileIds },
      timeout: options.timeout,
    });

  // If no file IDs are provided, make a single request.
  if (fileIds.length === 0) {
    return makeRequest([]);
  }

  // Split file IDs into batches of 100.
  const batches = createBatches(fileIds, 100);

  // Each batch returns files not present in that batch's file IDs.
  // True orphans appear in every batch response, so take the intersection.
  const batchResults = await Promise.all(
    batches.map((batch) => makeRequest(batch))
  );

  if (batchResults.length === 1) {
    return batchResults[0];
  }

  // Start the intersection with the first batch's orphaned files.
  const orphanedFileMap = new Map<string, OrphanedFile>();
  for (const orphan of batchResults[0].orphanedFiles) {
    orphanedFileMap.set(orphan.fileId, orphan);
  }

  // Intersect with each subsequent batch.
  for (let i = 1; i < batchResults.length; i++) {
    const batchOrphanIds = new Set(
      batchResults[i].orphanedFiles.map((f) => f.fileId)
    );
    Array.from(orphanedFileMap.keys()).forEach((fileId) => {
      if (!batchOrphanIds.has(fileId)) {
        orphanedFileMap.delete(fileId);
      }
    });
  }

  return {
    orphanedFiles: Array.from(orphanedFileMap.values()),
  };
}
