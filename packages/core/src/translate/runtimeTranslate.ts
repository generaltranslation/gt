import {
  createApiClient,
  ErrorCode,
  translateContent,
  type TranslateContentData,
} from '@generaltranslation/api';
import type { Content } from '@generaltranslation/format/types';
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

type RuntimeRequests = TranslateContentData['body']['requests'];

// The API rejects translate request bodies over 4MB.
const MAX_REQUEST_BYTES = 4_000_000;

const byteLength = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

/**
 * Splits `requests` into groups whose request body, `envelope` plus the
 * group's entries, stays within the API's limit. An entry too large on its own
 * is sent alone, and the API rejects it.
 */
function splitRequests(
  requests: RuntimeRequests,
  envelope: Omit<TranslateContentData['body'], 'requests'>
): RuntimeRequests[] {
  const emptyBytes = byteLength({ ...envelope, requests: {} });
  const groups: RuntimeRequests[] = [];
  let group: RuntimeRequests = {};
  let groupBytes = emptyBytes;
  for (const [hash, request] of Object.entries(requests)) {
    // Each entry adds `"hash":{...}` and a separating comma.
    const entryBytes = byteLength({ [hash]: request }) - 2 + 1;
    if (
      groupBytes + entryBytes > MAX_REQUEST_BYTES &&
      Object.keys(group).length > 0
    ) {
      groups.push(group);
      group = {};
      groupBytes = emptyBytes;
    }
    group[hash] = request;
    groupBytes += entryBytes;
  }
  groups.push(group);
  return groups;
}

/**
 * @internal
 * Translates entries for a `GTRuntime`, in as many requests as the API's
 * request size limit needs.
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
  const envelope = {
    targetLocale: resolveServiceLocale(
      globalMetadata.targetLocale,
      customMapping
    ),
    sourceLocale: resolveServiceLocale(
      globalMetadata.sourceLocale || defaultLocale || libraryDefaultLocale,
      customMapping
    ),
    metadata: { modelProvider: globalMetadata.modelProvider },
  } satisfies Omit<TranslateContentData['body'], 'requests'>;
  const responses = await Promise.all(
    splitRequests(requestsObject, envelope).map(async (requests) =>
      unwrapApiResult(
        await translateContent({
          body: { ...envelope, requests },
          client,
          headers: apiVersionHeaders(),
          path: { projectId: runtime.projectId },
        })
      )
    )
  );
  // The generated schema types translations as JsonValue; the service returns
  // the content type matching each entry's dataFormat.
  const response = Object.assign(
    {},
    ...responses.map(({ translations }) => translations)
  ) as Record<string, TranslationResult>;

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
