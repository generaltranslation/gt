import { TranslationRequestConfig, TranslateManyResult } from '../types';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import { Entry, EntryMetadata, SharedMetadata } from '../types-dir/api/entry';
import apiRequest from './utils/apiRequest';
import { Content } from '../types-dir/jsx/content';
import { hashSource } from '../id';

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
  globalMetadata: {
    targetLocale: string;
    sourceLocale: string;
    timeout?: number;
  } & SharedMetadata,
  config: TranslationRequestConfig
): Promise<TranslateManyResult> {
  // map from requests array to requests object
  const requestsObject = requests.reduce(
    (acc, request) => {
      acc[
        request.metadata?.hash ??
          hashSource({
            source: request.source,
            dataFormat: request.metadata?.dataFormat ?? 'JSX',
            ...request.metadata,
          })
      ] = { source: request.source, metadata: request.metadata };
      return acc;
    },
    {} as Record<string, { source: Content; metadata?: EntryMetadata }>
  );
  return apiRequest<TranslateManyResult>(
    { ...config, baseUrl: config.baseUrl || defaultRuntimeApiUrl },
    `/v2/translate`,
    {
      body: {
        requests: requestsObject,
        targetLocale: globalMetadata.targetLocale,
        sourceLocale: globalMetadata.sourceLocale,
        metadata: globalMetadata,
      },
      timeout: globalMetadata.timeout,
      retryPolicy: 'none',
    }
  );
}
