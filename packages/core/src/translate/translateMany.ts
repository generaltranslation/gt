import { TranslationRequestConfig, TranslateManyResult } from '../types';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import { Entry, EntryMetadata } from '../types-dir/api/entry';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';

/**
 * @internal
 *
 * Translates multiple entries in a single API request for better performance.
 * This function batches multiple translation requests together and sends them
 * to the GT translation API in one call.
 *
 * @param requests - The entries to translate.
 * @param globalMetadata - The metadata for the translation.
 * @param config - The configuration for the translation.
 * @returns The results of the translation.
 */
export default async function _translateMany(
  requests: Entry[],
  globalMetadata: { targetLocale: string } & EntryMetadata,
  config: TranslationRequestConfig
): Promise<TranslateManyResult> {
  const timeout = Math.min(globalMetadata.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultRuntimeApiUrl}/v1/translate/${config.projectId}`;

  // Request the translation
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: generateRequestHeaders(config),
        body: JSON.stringify({
          requests,
          targetLocale: globalMetadata.targetLocale,
          metadata: globalMetadata,
        }),
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  // Validate response
  await validateResponse(response);

  // Parse response
  const results = await response.json();
  return results as TranslateManyResult;
}
