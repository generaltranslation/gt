import {
  TranslationRequestConfig,
  TranslationError,
  TranslationResult,
} from '../types';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from 'src/settings/settings';

import { Content } from '../_types/content';
import { EntryMetadata } from '../_types/entry';
import validateConfig from './utils/validateConfig';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';

/**
 * @internal
 **/

// Implementation
export default async function _translate(
  source: Content,
  targetLocale: string,
  metadata: EntryMetadata = {},
  config: TranslationRequestConfig
): Promise<TranslationResult | TranslationError> {
  let response;
  const timeout = Math.min(config.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultRuntimeApiUrl}/v1/translate/${config.projectId}`;

  // Validation
  validateConfig(config);

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
  await validateResponse(response!);

  // Parse the response
  const results = (await response!.json()) as unknown[];
  const result = results[0] as TranslationResult | TranslationError;

  // Return the result
  return result;
}
