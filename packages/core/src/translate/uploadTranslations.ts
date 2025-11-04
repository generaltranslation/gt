import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';

import {
  FileUpload,
  UploadFilesResponse,
  RequiredUploadFilesOptions,
} from '../types-dir/api/uploadFiles';
import { encode } from '../utils/base64';

/**
 * @internal
 * Uploads multiple translations to the General Translation API.
 * @param files - Translations to upload with their source
 * @param options - The options for the API call
 * @param config - The configuration for the API call
 * @returns The result of the API call
 */
export default async function _uploadTranslations(
  files: {
    source: FileUpload;
    translations: FileUpload[];
  }[],
  options: RequiredUploadFilesOptions,
  config: TranslationRequestConfig
): Promise<UploadFilesResponse> {
  const timeout = Math.min(options?.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/upload-translations`;

  const body = {
    data: files.map(({ source, translations }) => ({
      source: {
        content: encode(source.content),
        fileName: source.fileName,
        fileFormat: source.fileFormat,
        locale: source.locale,
        dataFormat: source.dataFormat,
        fileId: source.fileId,
        versionId: source.versionId,
        branchId: source.branchId,
      },
      translations: translations.map((t) => ({
        content: encode(t.content),
        fileName: t.fileName,
        fileFormat: t.fileFormat,
        locale: t.locale,
        dataFormat: t.dataFormat,
        fileId: t.fileId,
        versionId: t.versionId,
        branchId: t.branchId,
      })),
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
