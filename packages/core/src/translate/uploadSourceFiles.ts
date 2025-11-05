import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';
import { encode } from '../utils/base64';

import {
  FileUpload,
  UploadFilesResponse,
  RequiredUploadFilesOptions,
} from '../types-dir/api/uploadFiles';

/**
 * @internal
 * Uploads source files to the General Translation API.
 * @param files - The files to upload
 * @param options - The options for the API call
 * @param config - The configuration for the API call
 * @returns The result of the API call
 */
export default async function _uploadSourceFiles(
  files: { source: FileUpload }[],
  options: RequiredUploadFilesOptions,
  config: TranslationRequestConfig
): Promise<UploadFilesResponse> {
  const timeout = Math.min(options?.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/upload-files`;

  const body = {
    data: files.map(({ source }) => ({
      source: {
        content: encode(source.content),
        fileName: source.fileName,
        fileFormat: source.fileFormat,
        locale: source.locale,
        dataFormat: source.dataFormat,
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
        headers: generateRequestHeaders(config, false),
        body: JSON.stringify(body),
      },
      timeout
    );
  } catch (err) {
    handleFetchError(err, timeout);
  }

  // Validate response
  await validateResponse(response);
  return (await response!.json()) as UploadFilesResponse;
}
