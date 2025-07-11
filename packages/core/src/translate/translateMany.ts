import { TranslationRequestConfig, TranslateManyResult } from '../types';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from 'src/settings/settings';
import { Entry, EntryMetadata } from 'src/_types/entry';
import validateConfig from './utils/validateConfig';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';

/**
 * @internal
 */
export default async function _translateMany(
  requests: Entry[],
  globalMetadata: { targetLocale: string } & EntryMetadata,
  config: TranslationRequestConfig
): Promise<TranslateManyResult> {
  const timeout = Math.min(config.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultRuntimeApiUrl}/v1/translate/${config.projectId}`;

  // Validation
  validateConfig(config);

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
  await validateResponse(response!);

  // Parse response
  const results = await response!.json();
  return results as TranslateManyResult;
}
