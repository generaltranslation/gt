import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';
import {
  FileUpload,
  RequiredUploadFilesOptions,
  UploadData,
} from '../types-dir/uploadFiles';

/**
 * @internal
 * Uploads multiple files to the General Translation API.
 * @param files - The files to translate
 * @param options - The options for the API call
 * @param config - The configuration for the API call
 * @returns The result of the API call
 */
export default async function _uploadFiles(
  files: {
    source: FileUpload;
    translations: FileUpload[];
  }[],
  options: RequiredUploadFilesOptions,
  config: TranslationRequestConfig
): Promise<any> {
  const timeout = Math.min(options?.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v1/project/files/upload`;

  const uploadData: UploadData = {
    data: files.map((file) => ({
      source: file.source,
      translations: file.translations,
    })),
    sourceLocale: options.sourceLocale,
    ...(options.modelProvider && { modelProvider: options.modelProvider }),
  };

  // Request the file uploads
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: generateRequestHeaders(config, false),
        body: JSON.stringify(uploadData),
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  // Validate response
  await validateResponse(response);

  // Parse response
  const responseData = await response.json();
  return responseData as any;
}
