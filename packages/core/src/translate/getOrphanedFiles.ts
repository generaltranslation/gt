import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { defaultTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import generateRequestHeaders from './utils/generateRequestHeaders';

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
  const timeout = options.timeout ? options.timeout : defaultTimeout;
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/orphaned?branchId=${encodeURIComponent(branchId)}`;

  const body = {
    fileIds,
  };

  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: generateRequestHeaders(config),
        body: JSON.stringify(body),
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  await validateResponse(response);

  const result = await response.json();
  return result as GetOrphanedFilesResult;
}
