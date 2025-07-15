import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import {
  CheckTranslationStatusOptions,
  TranslationStatusResult,
} from '../types-dir/translationStatus';
import generateRequestHeaders from './utils/generateRequestHeaders';

/**
 * @internal
 * Checks the translation status of a version.
 * @param versionId - The ID of the version to check
 * @param options - The options for the API call
 * @param config - The configuration for the request
 * @returns The translation status of the version
 */
export default async function _checkTranslationStatus(
  versionId: string,
  options: CheckTranslationStatusOptions,
  config: TranslationRequestConfig
): Promise<TranslationStatusResult> {
  const { baseUrl } = config;
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const url = `${baseUrl || defaultBaseUrl}/v1/project/translations/status/${encodeURIComponent(versionId)}`;

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

  const result = await response.json();
  return result as TranslationStatusResult;
}
