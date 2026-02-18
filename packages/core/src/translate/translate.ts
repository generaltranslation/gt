import {
  TranslationRequestConfig,
  TranslationError,
  TranslationResult,
} from '../types';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import { Content } from '../types-dir/jsx/content';
import { EntryMetadata } from '../types-dir/api/entry';
import apiRequest from './utils/apiRequest';

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
  const results = await apiRequest<unknown[]>(
    { ...config, baseUrl: config.baseUrl || defaultRuntimeApiUrl },
    `/v1/translate/${config.projectId}`,
    {
      body: {
        requests: [{ source }],
        targetLocale,
        metadata,
      },
      timeout: metadata.timeout,
    }
  );
  return results[0] as TranslationResult | TranslationError;
}
