import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { defaultTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import {
  DownloadFileBatchOptions,
  DownloadFileBatchRequest,
  DownloadFileBatchResult,
} from '../types-dir/api/downloadFileBatch';
import generateRequestHeaders from './utils/generateRequestHeaders';
import { decode } from '../utils/base64';
import { processBatches } from './utils/batch';

/**
 * @internal
 * Downloads multiple translation files in batches.
 * @param files - Array of files to download
 * @param options - The options for the API call
 * @param config - The configuration for the request
 * @returns Promise resolving to a BatchList with all downloaded files
 */
export default async function _downloadFileBatch(
  requests: DownloadFileBatchRequest,
  options: DownloadFileBatchOptions,
  config: TranslationRequestConfig
) {
  const timeout = options.timeout ? options.timeout : defaultTimeout;
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/download`;

  return processBatches(
    requests,
    async (batch) => {
      // Request the batch download
      let response;
      try {
        response = await fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: generateRequestHeaders(config),
            body: JSON.stringify(batch),
          },
          timeout
        );
      } catch (error) {
        handleFetchError(error, timeout);
      }

      // Validate response
      await validateResponse(response);

      // Parse response
      const result = (await response.json()) as DownloadFileBatchResult;

      // convert from base64 to string
      const files = result.files.map((file) => ({
        ...file,
        data: decode(file.data),
      }));

      return files;
    },
    { batchSize: 100 }
  );
}
