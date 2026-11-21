import {
  createApiClient,
  createBatches,
  ErrorCode,
  jsonByteLength,
  MAX_REQUEST_BODY_BYTES,
  translateContent,
  type ModelProvider,
  type UserTokenProvider,
  type TranslateContentData,
  type TranslateContentResponse,
} from '@generaltranslation/api';
import type { Content } from '@generaltranslation/format';
import type { TranslateManyResult } from '../types-dir/api/translateMany';
import type { TranslationResult } from '../types-dir/api/translate';
import type { EntryMetadata, TranslateManyEntry } from '../types-dir/api/entry';
import { apiVersionHeaders } from '../client/apiClient';
import { hashSource } from '../id/hashSource';
import { unwrapApiResult } from './utils/unwrapApiResult';

type RuntimeTranslationResult = TranslateContentResponse['results'][number];
type RuntimeRequest = TranslateContentData['body']['requests'][number];
// A request with the hash its result is returned under.
type HashedRequest = [hash: string, request: RuntimeRequest];

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
 * One runtime translation call, as `GTRuntime` resolved it from the call's
 * options and its own configuration. The locales are service locales.
 */
export type RuntimeTranslateCall = {
  apiKey: string | undefined;
  userTokenProvider: UserTokenProvider | undefined;
  projectId: string;
  baseUrl: string;
  targetLocale: string;
  sourceLocale: string;
  modelProvider: ModelProvider | undefined;
  timeoutMs: number;
};

/**
 * @internal
 * Translates entries for a `GTRuntime`, in as many requests as the API's
 * request size limit needs.
 */
export function translateEntries(
  call: RuntimeTranslateCall,
  requests: TranslateManyEntry[]
): Promise<TranslateManyResult>;
export function translateEntries(
  call: RuntimeTranslateCall,
  requests: TranslateManyEntry[] | Record<string, TranslateManyEntry>
): Promise<TranslateManyResult | Record<string, TranslationResult>>;
export async function translateEntries(
  call: RuntimeTranslateCall,
  requests: TranslateManyEntry[] | Record<string, TranslateManyEntry>
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
    apiKey: call.apiKey,
    userTokenProvider: call.userTokenProvider,
    baseUrl: call.baseUrl,
    // Translation requests are not retried.
    retryPolicy: 'none',
    timeoutMs: call.timeoutMs,
  });
  const envelope = {
    targetLocale: call.targetLocale,
    sourceLocale: call.sourceLocale,
    metadata: { modelProvider: call.modelProvider },
  } satisfies Omit<TranslateContentData['body'], 'requests'>;
  const groups = createBatches<HashedRequest>(
    Object.entries(requestsObject),
    Infinity,
    MAX_REQUEST_BODY_BYTES - jsonByteLength({ ...envelope, requests: [] }),
    ([, request]) => jsonByteLength(request)
  );
  // The API returns one result per request, in request order. A call with no entries still sends its one request.
  const responses = await Promise.all(
    (groups.length > 0 ? groups : [[]]).map(async (group) => {
      const { results } = unwrapApiResult(
        await translateContent({
          body: {
            ...envelope,
            requests: group.map(([, request]) => request),
          },
          client,
          headers: apiVersionHeaders(),
          path: { projectId: call.projectId },
        })
      );
      return results.map(
        (result, index) =>
          [group[index][0], toTranslationResult(result)] as const
      );
    })
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
