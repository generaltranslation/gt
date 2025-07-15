import {
  TranslationRequestConfig,
  TranslationError,
  TranslationResult,
} from '../types';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';

import { Content } from '../types-dir/content';
import { EntryMetadata } from '../types-dir/entry';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';

/**
 * @internal
 *
 * Translates a single entry in a single API request.
 *
 * @param source - The source content to translate.
 * @param targetLocale - The target locale to translate to.
 * @param metadata - The metadata for the translation.
 * @param config - The configuration for the translation.
 * @returns The result of the translation.
 */
export default async function _translate(
  source: Content,
  targetLocale: string,
  metadata: EntryMetadata = {},
  config: TranslationRequestConfig
): Promise<TranslationResult | TranslationError> {
  let response;
  const timeout = Math.min(metadata.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultRuntimeApiUrl}/v1/translate/${config.projectId}`;

  // Request the translation
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: generateRequestHeaders(config),
        body: JSON.stringify({
          requests: [{ source }],
          targetLocale,
          metadata,
        }),
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  // Validate response
  await validateResponse(response);

  // Parse the response
  const results = (await response.json()) as unknown[];
  return results[0] as TranslationResult | TranslationError;
}
