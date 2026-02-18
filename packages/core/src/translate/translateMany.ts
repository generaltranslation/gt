import { TranslationRequestConfig, TranslateManyResult } from '../types';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import { Entry, EntryMetadata } from '../types-dir/api/entry';
import apiRequest from './utils/apiRequest';

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
  return apiRequest<TranslateManyResult>(
    { ...config, baseUrl: config.baseUrl || defaultRuntimeApiUrl },
    `/v1/translate/${config.projectId}`,
    {
      body: {
        requests,
        targetLocale: globalMetadata.targetLocale,
        metadata: globalMetadata,
      },
      timeout: globalMetadata.timeout,
      retryPolicy: 'none',
    }
  );
}
