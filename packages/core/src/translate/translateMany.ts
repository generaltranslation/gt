import { TranslationRequestConfig, TranslateManyResult } from '../types';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from 'src/settings/settings';
import { GTRequest, GTRequestMetadata } from 'src/types/GTRequest';
import validateConfig from './utils/validateConfig';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';

/**
 * @internal
 */
export default async function _translateMany(
  requests: GTRequest[],
  globalMetadata: { targetLocale: string } & GTRequestMetadata,
  config: TranslationRequestConfig
): Promise<TranslateManyResult> {
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
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'x-gt-api-key': config.apiKey }),
        },
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
