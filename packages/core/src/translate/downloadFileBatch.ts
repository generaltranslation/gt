import { TranslationRequestConfig } from '../types';
import {
  DownloadFileBatchOptions,
  DownloadFileBatchRequest,
  DownloadFileBatchResult,
} from '../types-dir/api/downloadFileBatch';
import { apiRequest } from './utils/apiRequest';
import { decode } from '../utils/base64';
import { isBinaryFileFormat } from '../types-dir/api/file';
import { processBatches } from './utils/batch';

/**
 * @internal
 * Downloads multiple translation files in batches.
 * @param files - Array of files to download
 * @param options - The options for the API call.
 * @param config - The configuration for the request.
 * @returns Promise resolving to a BatchList with all downloaded files
 */
export async function _downloadFileBatch(
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

      // convert from base64 to string, except binary formats (e.g. LOTTIE zip
      // bundles) which stay base64 so their bytes survive to the writer.
      const files = result.files.map((file) => ({
        ...file,
        data: isBinaryFileFormat(file.fileFormat)
          ? file.data
          : decode(file.data),
      }));

      return files;
    },
    { batchSize: 100 }
  );
}
