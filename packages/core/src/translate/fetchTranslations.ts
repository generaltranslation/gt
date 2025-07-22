import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import {
  FetchTranslationsOptions,
  FetchTranslationsResult,
} from '../types-dir/fetchTranslations';
import generateRequestHeaders from './utils/generateRequestHeaders';

/**
 * @internal
 * Fetches translation metadata and information without downloading files.
 * @param versionId - The version ID to fetch translations for
 * @param options - The options for the API call
 * @param config - The configuration for the request
 * @returns The translation metadata and information
 */
export default async function _fetchTranslations(
  versionId: string,
  options: FetchTranslationsOptions,
  config: TranslationRequestConfig
): Promise<FetchTranslationsResult> {
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v1/project/translations/info/${versionId}`;

  // Request the translation info
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: generateRequestHeaders(config),
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
  return result as FetchTranslationsResult;
}
