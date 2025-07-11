import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import {
  BatchDownloadFile,
  DownloadFileBatchOptions,
  DownloadFileBatchResult,
} from '../types/downloadFileBatch';
import generateRequestHeaders from './utils/generateRequestHeaders';

/**
 * @internal
 * Downloads multiple translation files in a single batch request.
 * @param files - Array of files to download
 * @param options - The options for the API call
 * @param config - The configuration for the request
 * @returns The batch download results with success/failure tracking
 */
export default async function _downloadFileBatch(
  files: BatchDownloadFile[],
  options: DownloadFileBatchOptions,
  config: TranslationRequestConfig
): Promise<DownloadFileBatchResult> {
  const { projectId, baseUrl } = config;
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const url = `${baseUrl || defaultRuntimeApiUrl}/v1/project/translations/files/batch-download`;

  // Build request body
  const body = {
    files: files.map((file) => ({
      translationId: file.translationId,
      fileName: file.fileName,
    })),
    projectId,
  };

  // Request the batch download
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

  // Validate response
  await validateResponse(response);

  // Parse response
  const result = await response.json();
  return result as DownloadFileBatchResult;
}
