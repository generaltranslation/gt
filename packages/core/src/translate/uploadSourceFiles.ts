import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';
import { encode } from '../utils/base64';
import { processBatches } from './utils/batch';

import {
  FileUpload,
  UploadFilesResponse,
  RequiredUploadFilesOptions,
} from '../types-dir/api/uploadFiles';

/**
 * @internal
 * Uploads source files to the General Translation API in batches.
 * @param files - The files to upload
 * @param options - The options for the API call
 * @param config - The configuration for the API call
 * @returns Promise resolving to a BatchList with all uploaded files
 */
export default async function _uploadSourceFiles(
  files: { source: FileUpload }[],
  options: RequiredUploadFilesOptions,
  config: TranslationRequestConfig
) {
  const timeout = options?.timeout ? options?.timeout : maxTimeout;
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/upload-files`;

  return processBatches(
    files,
    async (batch) => {
      const body = {
        data: batch.map(({ source }) => ({
          source: {
            content: encode(source.content),
            fileName: source.fileName,
            fileFormat: source.fileFormat,
            locale: source.locale,
            dataFormat: source.dataFormat,
            formatMetadata: source.formatMetadata,
            fileId: source.fileId,
            versionId: source.versionId,
            branchId: source.branchId,
            incomingBranchId: source.incomingBranchId,
            checkedOutBranchId: source.checkedOutBranchId,
          },
        })),
        sourceLocale: options.sourceLocale,
      };

      let response: Response | undefined;
      try {
        // Request the file uploads
        response = await fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: generateRequestHeaders(config),
            body: JSON.stringify(body),
          },
          timeout
        );
      } catch (err) {
        handleFetchError(err, timeout);
      }

      // Validate response
      await validateResponse(response);
      const batchResult = (await response!.json()) as UploadFilesResponse;

      return batchResult.uploadedFiles || [];
    },
    { batchSize: 100 }
  );
}
