import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import { DownloadFileOptions } from '../types-dir/api/downloadFile';
import generateRequestHeaders from './utils/generateRequestHeaders';
import { decode } from '../utils/base64';

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
  const url = `${baseUrl || defaultBaseUrl}/v2/project/translations/files/${translationId}/download`;

  // Request the file download
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: generateRequestHeaders(config, true),
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  // Validate response
  await validateResponse(response);

  const result = (await response.json()) as { data: string };
  return Buffer.from(result.data, 'base64').buffer;
}

/**
 * @internal
 * Downloads a single translation file content without writing to filesystem.
 * @param file - The file to download
 * @param options - The options for the API call
 * @param config - The configuration for the request
 * @returns The downloaded file content as a UTF-8 string
 */
export async function _downloadFileV2(
  file: {
    fileId: string;
    locale: string;
    versionId?: string;
  },
  options: DownloadFileOptions,
  config: TranslationRequestConfig
): Promise<string> {
  const { baseUrl } = config;
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const searchParams = new URLSearchParams();
  if (file.versionId) {
    searchParams.set('versionId', file.versionId);
  }
  searchParams.set('locale', file.locale);
  const url = `${baseUrl || defaultBaseUrl}/v2/project/files/download/${file.fileId}?${searchParams.toString()}`;

  // Request the file download
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: generateRequestHeaders(config, true),
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  // Validate response
  await validateResponse(response);

  const result = (await response.json()) as { data: string };
  return decode(result.data);
}
