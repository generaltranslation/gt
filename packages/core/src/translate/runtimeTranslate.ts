import {
  createApiClient,
  ErrorCode,
  translateContent,
  type TranslateContentData,
} from '@generaltranslation/api';
import type { Content } from '@generaltranslation/format';
import type { TranslateManyResult } from '../types-dir/api/translateMany';
import type { TranslationResult } from '../types-dir/api/translate';
import type {
  EntryMetadata,
  TranslateManyEntry,
  TranslateOptions,
} from '../types-dir/api/entry';
import type { GTRuntime } from '../runtime';
import { apiVersionHeaders, resolveServiceLocale } from '../apiClient';
import { libraryDefaultLocale } from '../settings/settings';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import { noTargetLocaleProvidedError } from '../logging/errors';
import { hashSource } from '../id/hashSource';
import { validateModelProvider } from './modelProvider';
import { unwrapApiResult } from './utils/unwrapApiResult';

/**
 * @internal
 * Translates entries for a `GTRuntime` in one request.
 */
export async function translateEntries(
  runtime: GTRuntime,
  functionName: 'translate' | 'translateMany',
  requests: TranslateManyEntry[] | Record<string, TranslateManyEntry>,
  options: string | TranslateOptions,
  timeoutMs?: number
): Promise<TranslateManyResult | Record<string, TranslationResult>> {
  const globalMetadata =
    typeof options === 'string' ? { targetLocale: options } : options;
  if (!globalMetadata?.targetLocale) {
    throw new Error(noTargetLocaleProvidedError(functionName));
  }
  validateModelProvider(globalMetadata.modelProvider);
  const { customMapping, defaultLocale } = runtime.localeConfig;

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
        ...(metadata?.fileFormat && { fileFormat: metadata.fileFormat }),
        dataFormat: metadata?.dataFormat ?? 'STRING',
      });
    hashOrder?.push(hash);
    requestsObject[hash] = {
      source,
      metadata: metadata,
    };
  }

  const client = createApiClient({
    apiKey: runtime.apiKey,
    userTokenProvider: runtime.userTokenProvider,
    baseUrl: runtime.baseUrl || defaultRuntimeApiUrl,
    // Translation requests are not retried.
    retryPolicy: 'none',
    timeoutMs,
  });
  const body = {
    requests: requestsObject,
    targetLocale: resolveServiceLocale(
      globalMetadata.targetLocale,
      customMapping
    ),
    sourceLocale: resolveServiceLocale(
      globalMetadata.sourceLocale || defaultLocale || libraryDefaultLocale,
      customMapping
    ),
    metadata: { modelProvider: globalMetadata.modelProvider },
  } satisfies TranslateContentData['body'];
  const result = await translateContent({
    body,
    client,
    headers: apiVersionHeaders(),
    path: { projectId: runtime.projectId },
  });
  // The generated schema types translations as JsonValue; the service returns
  // the content type matching each entry's dataFormat.
  const response = unwrapApiResult(result).translations as Record<
    string,
    TranslationResult
  >;

  // If input was an array, map the record response back to an array in input order
  if (hashOrder) {
    return hashOrder.map(
      (hash) =>
        response[hash] ?? {
          success: false,
          error: 'No translation returned',
          code: ErrorCode.INTERNAL_ERROR,
        }
    );
  }

  // If input was a record, return the record response directly
  return response;
}
