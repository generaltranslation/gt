import {
  createApiClient,
  ErrorCode,
  translateContent,
  type TranslateContentData,
  type TranslateContentResponse,
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
import { apiVersionHeaders, resolveServiceLocale } from '../client/apiClient';
import { defaultDefaultLocale } from '../settings/settings';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import { noTargetLocaleProvidedError } from '../logging/errors';
import { hashSource } from '../id/hashSource';
import { validateModelProvider } from './modelProvider';
import { unwrapApiResult } from './utils/unwrapApiResult';

type RuntimeTranslationResult = TranslateContentResponse['results'][number];
type RuntimeRequest = TranslateContentData['body']['requests'][number];
// A request with the hash its result is returned under.
type HashedRequest = [hash: string, request: RuntimeRequest];

// The API rejects translate request bodies over 4MB.
const MAX_REQUEST_BYTES = 4_000_000;

const byteLength = (value: TranslateContentData['body'] | RuntimeRequest) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

/**
 * Splits `requests` into groups whose request body, `envelope` plus the
 * group's entries, stays within the API's limit. An entry too large on its own
 * is sent alone, and the API rejects it.
 */
function splitRequests(
  requests: HashedRequest[],
  envelope: Omit<TranslateContentData['body'], 'requests'>
): HashedRequest[][] {
  const emptyBytes = byteLength({ ...envelope, requests: [] });
  const groups: HashedRequest[][] = [];
  let group: HashedRequest[] = [];
  let groupBytes = emptyBytes;
  for (const entry of requests) {
    // Each entry adds its JSON and a separating comma.
    const entryBytes = byteLength(entry[1]) + 1;
    if (groupBytes + entryBytes > MAX_REQUEST_BYTES && group.length > 0) {
      groups.push(group);
      group = [];
      groupBytes = emptyBytes;
    }
    group.push(entry);
    groupBytes += entryBytes;
  }
  groups.push(group);
  return groups;
}

// The generated schema types translations as JsonValue; the service returns
// the content type matching each entry's dataFormat.
function toTranslationResult(
  result: RuntimeTranslationResult
): TranslationResult {
  const { status, ...rest } = result;
  return { ...rest, success: status === 'succeeded' } as TranslationResult;
}

/**
 * @internal
 * Translates entries for a `GTRuntime`, in as many requests as the API's
 * request size limit needs.
 */
export function translateEntries(
  runtime: GTRuntime,
  functionName: 'translate' | 'translateMany',
  requests: TranslateManyEntry[],
  options: string | TranslateOptions,
  timeoutMs?: number
): Promise<TranslateManyResult>;
export function translateEntries(
  runtime: GTRuntime,
  functionName: 'translate' | 'translateMany',
  requests: TranslateManyEntry[] | Record<string, TranslateManyEntry>,
  options: string | TranslateOptions,
  timeoutMs?: number
): Promise<TranslateManyResult | Record<string, TranslationResult>>;
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
  const envelope = {
    targetLocale: resolveServiceLocale(
      globalMetadata.targetLocale,
      customMapping
    ),
    sourceLocale: resolveServiceLocale(
      globalMetadata.sourceLocale || defaultLocale || defaultDefaultLocale,
      customMapping
    ),
    metadata: { modelProvider: globalMetadata.modelProvider },
  } satisfies Omit<TranslateContentData['body'], 'requests'>;
  // The API returns one result per request, in request order.
  const responses = await Promise.all(
    splitRequests(Object.entries(requestsObject), envelope).map(
      async (group) => {
        const { results } = unwrapApiResult(
          await translateContent({
            body: {
              ...envelope,
              requests: group.map(([, request]) => request),
            },
            client,
            headers: apiVersionHeaders(),
            path: { projectId: runtime.projectId },
          })
        );
        return results.map(
          (result, index) =>
            [group[index][0], toTranslationResult(result)] as const
        );
      }
    )
  );
  const response: Record<string, TranslationResult> = Object.fromEntries(
    responses.flat()
  );

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
