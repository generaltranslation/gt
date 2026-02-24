import {
  TranslationRequestConfig,
  TranslateManyResult,
  TranslationResult,
} from '../types';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import { TranslateManyEntry, SharedMetadata } from '../types-dir/api/entry';
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
 * @param requests - The entries to translate. Each entry can be a plain string or an object with source and metadata.
 * @param globalMetadata - The metadata for the translation.
 * @param config - The configuration for the translation.
 * @returns The results of the translation, in the same order as the input entries.
 */
export default async function _translateMany(
  requests: TranslateManyEntry[],
  globalMetadata: {
    targetLocale: string;
    sourceLocale: string;
  } & SharedMetadata,
  config: TranslationRequestConfig,
  timeout?: number
): Promise<TranslateManyResult> {
  // normalize and map from requests array to requests record
  const hashOrder: string[] = [];
  const requestsObject: Record<
    string,
    { source: Content; metadata?: Record<string, unknown> }
  > = {};
  for (const request of requests) {
    const normalized =
      typeof request === 'string' ? { source: request } : request;
    const { source, ...metadata } = normalized;
    const hash =
      metadata.hash ??
      hashSource({
        source,
        dataFormat: metadata.dataFormat ?? 'STRING',
        ...metadata,
      });
    hashOrder.push(hash);
    requestsObject[hash] = {
      source,
      ...(Object.keys(metadata).length > 0 && { metadata }),
    };
  }

  const response = await apiRequest<Record<string, TranslationResult>>(
    { ...config, baseUrl: config.baseUrl || defaultRuntimeApiUrl },
    `/v2/translate`,
    {
      body: {
        requests: requestsObject,
        targetLocale: globalMetadata.targetLocale,
        sourceLocale: globalMetadata.sourceLocale,
        metadata: globalMetadata,
      },
      timeout: timeout,
      retryPolicy: 'none',
    }
  );

  // Map the record response back to an array in input order
  return hashOrder.map((hash) => response[hash]);
}
