import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import {
  CheckFileTranslationsOptions,
  CheckFileTranslationsResult,
  FileTranslationQuery,
} from '../types-dir/checkFileTranslations';
import generateRequestHeaders from './utils/generateRequestHeaders';

/**
 * @internal
 * Checks the translation status of files without downloading them.
 * @param data - Object mapping source paths to file information
 * @param options - The options for the API call
 * @param config - The configuration for the API call
 * @returns The file translation status information
 */
export default async function _checkFileTranslations(
  data: FileTranslationQuery[],
  options: CheckFileTranslationsOptions = {},
  config: TranslationRequestConfig
): Promise<CheckFileTranslationsResult> {
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v1/project/translations/files/retrieve`;

  // Request the file status
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: generateRequestHeaders(config),
        body: JSON.stringify({ files: data }),
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
  return result as CheckFileTranslationsResult;
}
