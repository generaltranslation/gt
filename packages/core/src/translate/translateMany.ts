import {
  createApiClient,
  translate,
  type JsonObject,
  type JsonValue,
  type RuntimeTranslationResponse,
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
import type {
  Content,
  GTProp,
  JsxChildren,
  JsxElement,
} from '@generaltranslation/format/types';
import { hashSource } from '../id';
import { fetchWithTimeout } from './utils/fetchWithTimeout';
import { hasDecodedError, unwrapApiResult } from './utils/unwrapApiResult';
import { validateResponse } from './utils/validateResponse';
import {
  isModelProvider,
  supportedModelProviders,
} from '../adapter/modelProvider';
import { createDiagnosticMessage } from '../logging/diagnostics';

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
    code: 500,
  };
}

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

  if (
    globalMetadata.modelProvider !== undefined &&
    !isModelProvider(globalMetadata.modelProvider)
  ) {
    throw new Error(
      createDiagnosticMessage({
        source: 'generaltranslation',
        severity: 'Error',
        whatHappened: 'The configured model provider is not supported',
        details: String(globalMetadata.modelProvider),
        fix: `Use one of: ${supportedModelProviders.join(', ')}`,
      })
    );
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
    metadata: {
      ...globalMetadata,
      modelProvider: globalMetadata.modelProvider,
    },
  } satisfies TranslateData['body'];
  const result = await translate({ body, client });

  // The generated client only decodes JSON errors, so non-JSON response bodies
  // must be re-read here to preserve legacy ApiError details.
  if (
    result.data === undefined &&
    result.response &&
    !hasDecodedError(result)
  ) {
    await validateResponse(result.response);
    throw result.error;
  }

  const runtimeResponse = unwrapApiResult(result);
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
          code: 500,
        }
    );
  }

  // If input was a record, return the record response directly
  return response;
}
