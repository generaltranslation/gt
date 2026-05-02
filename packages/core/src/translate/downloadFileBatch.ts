import { TranslationRequestConfig } from '../types';
import {
  DownloadFileBatchOptions,
  DownloadFileBatchRequest,
  DownloadFileBatchResult,
} from '../types-dir/api/downloadFileBatch';
import apiRequest from './utils/apiRequest';
import { decode } from '../utils/base64';
import { processBatches } from './utils/batch';

/**
 * @internal
 * Downloads multiple translation files in batches.
 * @param requests - The file requests to download.
 * @param options - The options for the API call.
 * @param config - The configuration for the request.
 * @returns A BatchList with all downloaded files.
 */
export default async function _downloadFileBatch(
  requests: DownloadFileBatchRequest,
  options: DownloadFileBatchOptions,
  config: TranslationRequestConfig
) {
  return processBatches(
    requests,
    async (batch) => {
      const result = await apiRequest<DownloadFileBatchResult>(
        config,
        '/v2/project/files/download',
        { body: batch, timeout: options.timeout }
      );

      // Decode file data from base64.
      const files = result.files.map((file) => ({
        ...file,
        data: decode(file.data),
      }));

      return files;
    },
    { batchSize: 100 }
  );
}
