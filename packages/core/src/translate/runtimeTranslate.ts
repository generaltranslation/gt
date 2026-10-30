import {
  createApiClient,
  ErrorCode,
  translateContent,
  type JsonObject,
  type JsonValue,
  type RuntimeTranslationResponse,
  type TranslateContentData,
} from '@generaltranslation/api';
import type {
  Content,
  GTProp,
  JsxChildren,
  JsxElement,
} from '@generaltranslation/format/types';
import type { TranslateManyResult, TranslationResult } from '../types';
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
import { hashSource } from '../id';
import { validateModelProvider } from './modelProvider';
import { unwrapApiResult } from './utils/unwrapApiResult';

type RuntimeTranslationResult = RuntimeTranslationResponse[string];

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isGtProp(value: JsonValue | undefined): value is JsonObject & GTProp {
  if (!isJsonObject(value)) return false;
  if (value.t !== undefined && value.t !== 'p' && value.t !== 'b') return false;
  if (
    ['pl', 'ti', 'alt', 'arl', 'arb', 'ard'].some(
      (key) => value[key] !== undefined && typeof value[key] !== 'string'
    )
  ) {
    return false;
  }
  return (
    value.b === undefined ||
    (isJsonObject(value.b) && Object.values(value.b).every(isJsxChildren))
  );
}

function isJsxElement(
  value: JsonValue | undefined
): value is JsonObject & JsxElement {
  if (!isJsonObject(value)) return false;
  return (
    (value.t === undefined || typeof value.t === 'string') &&
    (value.i === undefined || typeof value.i === 'number') &&
    (value.d === undefined || isGtProp(value.d)) &&
    (value.c === undefined || isJsxChildren(value.c))
  );
}

function isJsxChild(
  value: JsonValue | undefined
): value is JsonValue & (string | JsxElement) {
  return typeof value === 'string' || isJsxElement(value);
}

function isJsxChildren(
  value: JsonValue | undefined
): value is JsonValue & JsxChildren {
  return (
    value === null ||
    typeof value === 'boolean' ||
    isJsxChild(value) ||
    (Array.isArray(value) && value.every(isJsxChild))
  );
}

// JsonValue is wider than core's format-specific Content union, so narrow each
// successful translation by dataFormat at the API boundary.
function toTranslationResult(
  result: RuntimeTranslationResult
): TranslationResult {
  if (!result.success) return result;
  if (result.dataFormat === 'JSX' && isJsxChildren(result.translation)) {
    return {
      success: true,
      translation: result.translation,
      dataFormat: result.dataFormat,
      locale: result.locale,
    };
  }
  if (result.dataFormat !== 'JSX' && typeof result.translation === 'string') {
    return {
      success: true,
      translation: result.translation,
      dataFormat: result.dataFormat,
      locale: result.locale,
    };
  }
  return {
    success: false,
    error: 'Invalid translation returned',
    code: ErrorCode.INTERNAL_ERROR,
  };
}

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
  const { translations: runtimeResponse } = unwrapApiResult(result);
  const response: Record<string, TranslationResult> = Object.fromEntries(
    Object.entries(runtimeResponse).map(([hash, translationResult]) => [
      hash,
      toTranslationResult(translationResult),
    ])
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
