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
 * Gets orphaned files for a branch - files that exist on the branch
 * but whose fileIds are not in the provided list.
 * Used for move detection.
 * @param branchId - The branch to check for orphaned files
 * @param fileIds - List of current file IDs (files that are NOT orphaned)
 * @param options - The options for the API call
 * @param config - The configuration for the API call
 * @returns The orphaned files
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

  // If no fileIds, make a single request
  if (fileIds.length === 0) {
    return makeRequest([]);
  }

  // Split fileIds into batches of 100
  const batches = createBatches(fileIds, 100);

  // Process batches in parallel
  // Each batch returns files NOT in that batch's fileIds
  // True orphans are files that appear in ALL batch responses (intersection)
  const batchResults = await Promise.all(
    batches.map((batch) => makeRequest(batch))
  );

  if (batchResults.length === 1) {
    return batchResults[0];
  }

  // Find intersection of orphaned files across all batches
  // A file is truly orphaned only if it's not in ANY of our fileId batches
  // Start with first batch's orphans
  const orphanedFileMap = new Map<string, OrphanedFile>();
  for (const orphan of batchResults[0].orphanedFiles) {
    orphanedFileMap.set(orphan.fileId, orphan);
  }

  // Intersect with each subsequent batch
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
