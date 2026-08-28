import {
  createApiClient,
  translate,
  type TranslateData,
} from '@generaltranslation/api';
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
import type { Content } from '@generaltranslation/format/types';
import { hashSource } from '../id';
import { fetchWithTimeout } from './utils/fetchWithTimeout';
import { isErrorResult, unwrapApiResult } from './utils/unwrapApiResult';
import { validateResponse } from './utils/validateResponse';

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
export async function _translateMany<
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
export async function _translateMany(
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
        ...(metadata?.context && { context: metadata.context }),
        ...(metadata?.maxChars != null && { maxChars: metadata.maxChars }),
        dataFormat: metadata?.dataFormat ?? 'STRING',
      });
    hashOrder?.push(hash);
    requestsObject[hash] = {
      source,
      metadata: metadata,
    };
  }

  const client = createApiClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl || defaultRuntimeApiUrl,
    fetch: (input, init) => fetchWithTimeout(input, init ?? {}, timeout),
    projectId: config.projectId,
    retryPolicy: 'none',
  });
  const body = {
    requests: requestsObject,
    targetLocale: globalMetadata.targetLocale,
    sourceLocale: globalMetadata.sourceLocale,
    // Core intentionally accepts custom model-provider strings beyond the
    // OpenAPI ANTHROPIC|OPENAI|XAI|GOOGLE enum; preserve the pre-migration
    // wire behavior at this boundary.
    metadata: globalMetadata as TranslateData['body']['metadata'],
  } satisfies TranslateData['body'];
  const result = await translate({ body, client });

  // Preserve validation for non-JSON/HTML runtime API error bodies.
  if (
    result.data === undefined &&
    result.response &&
    !isErrorResult(result.error)
  ) {
    await validateResponse(result.response);
    throw result.error;
  }

  const runtimeResponse = unwrapApiResult(result);
  // OpenAPI exposes successful translations as unknown, while core's public
  // result type preserves the format-specific Content union.
  const response = runtimeResponse as Record<string, TranslationResult>;

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
