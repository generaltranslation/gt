import {
  TranslationRequestConfig,
  TranslateManyResult,
  TranslationResult,
} from '../types';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import {
  TranslateManyEntry,
  TranslateOptions,
  EntryMetadata,
} from '../types-dir/api/entry';
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
 * @param requests - The entries to translate. Can be an array (entries are hashed and results returned in order) or a record keyed by hash (skips hash calculation, returns a record).
 * @param globalMetadata - The metadata for the translation.
 * @param config - The configuration for the translation.
 * @returns The results of the translation. An array if requests was an array, a record if requests was a record.
 */
export default async function _translateMany<
  T extends TranslateManyEntry[] | Record<string, TranslateManyEntry>,
>(
  requests: T,
  globalMetadata: {
    targetLocale: string;
    sourceLocale: string;
  } & TranslateOptions,
  config: TranslationRequestConfig,
  timeout?: number
): Promise<
  T extends TranslateManyEntry[]
    ? TranslateManyResult
    : Record<string, TranslationResult>
>;
export default async function _translateMany(
  requests: TranslateManyEntry[] | Record<string, TranslateManyEntry>,
  globalMetadata: {
    targetLocale: string;
    sourceLocale: string;
  } & TranslateOptions,
  config: TranslationRequestConfig,
  timeout?: number
): Promise<TranslateManyResult | Record<string, TranslationResult>> {
  const isArray = Array.isArray(requests);

  // normalize and map from requests to requests record
  const hashOrder: string[] | undefined = isArray ? [] : undefined;
  const requestsObject: Record<
    string,
    { source: Content; metadata?: EntryMetadata }
  > = {};

  const entries: [string | undefined, TranslateManyEntry][] = isArray
    ? requests.map((r) => [undefined, r])
    : Object.entries(requests);

  for (const [key, request] of entries) {
    const normalized =
      typeof request === 'string' ? { source: request } : request;
    const { source, metadata } = normalized;
    const hash =
      key ??
      metadata?.hash ??
      hashSource({
        source,
        dataFormat: metadata?.dataFormat ?? 'STRING',
        ...(metadata ?? {}),
      });
    hashOrder?.push(hash);
    requestsObject[hash] = {
      source,
      metadata: metadata,
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

  // If input was an array, map the record response back to an array in input order
  if (hashOrder) {
    return hashOrder.map(
      (hash) =>
        response[hash] ?? {
          success: false,
          error: 'No translation returned',
          code: 500,
        }
    );
  }

  // If input was a record, return the record response directly
  return response;
}
