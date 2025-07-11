import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import { DownloadFileOptions } from '../types-dir/downloadFile';
import generateRequestHeaders from './utils/generateRequestHeaders';

/**
 * @internal
 * Downloads a single translation file content without writing to filesystem.
 * @param translationId - The ID of the translation to download
 * @param options - The options for the API call
 * @param config - The configuration for the request
 * @returns The downloaded file content as an ArrayBuffer
 */
export default async function _downloadFile(
  translationId: string,
  options: DownloadFileOptions,
  config: TranslationRequestConfig
): Promise<ArrayBuffer> {
  const { baseUrl } = config;
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const url = `${baseUrl || defaultRuntimeApiUrl}/v1/project/translations/files/${translationId}/download`;

  // Request the file download
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: generateRequestHeaders(config),
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  // Validate response
  await validateResponse(response);

  const result = await response.arrayBuffer();
  return result as ArrayBuffer;
}
