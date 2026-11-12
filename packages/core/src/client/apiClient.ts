import {
  API_VERSION,
  ApiError,
  DEFAULT_TIMEOUT_MS,
  ErrorCode,
  processBatches,
  type ApiVersion,
  type BatchWriteSummary,
} from '@generaltranslation/api';
import {
  resolveCanonicalLocale,
  standardizeLocale,
  type CustomMapping,
} from '@generaltranslation/format';
import { defaultBaseUrl } from '../settings/settingsUrls';
import type {
  GTAccountConfig,
  GTCredentials,
  GTProjectConfig,
} from './clientConfig';

/** @internal What the management API clients of one `GeneralTranslation` share. */
export type ApiClientSettings = GTCredentials & {
  baseUrl: string;
  timeoutMs: number;
};

/** @internal Resolves the management base URL and timeout, once, in the constructor of a class that builds API clients. */
export function resolveApiClientSettings({
  projectId: _projectId,
  localeConfig: _localeConfig,
  baseUrl,
  ...credentials
}: GTProjectConfig | GTAccountConfig): ApiClientSettings {
  return {
    ...credentials,
    baseUrl: baseUrl || defaultBaseUrl,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

/**
 * @internal
 * Canonical operations type-require gt-api-version per call, and per-call
 * headers override the client's.
 */
export function apiVersionHeaders(): { 'gt-api-version': ApiVersion } {
  return { 'gt-api-version': API_VERSION };
}

/**
 * @internal
 * Mapping resolves aliases; standardization also canonicalizes configured
 * spellings such as en-us before they cross the service boundary.
 */
export function resolveServiceLocale(
  locale: string,
  customMapping: CustomMapping | undefined
): string {
  return standardizeLocale(resolveCanonicalLocale(locale, customMapping));
}

type BatchWriteResponse<Result> = {
  summary: BatchWriteSummary;
  results: Result[];
};

/** @internal Why a whole batch failed, in the shape of a failed result. */
export type BatchFailure = { error: string; code?: ErrorCode };

const errorCodes = new Set<string>(Object.values(ErrorCode));

function batchFailure(reason: unknown): BatchFailure {
  const code =
    reason instanceof ApiError && errorCodes.has(reason.code ?? '')
      ? (reason.code as ErrorCode)
      : undefined;
  return {
    error: reason instanceof Error ? reason.message : String(reason),
    ...(code && { code }),
  };
}

/**
 * @internal
 * Sends `items` in batches of at most `batchSize`, concurrently unless
 * `parallel` is false; summaries add up and results keep request order. The
 * API saves the batches that succeed, so when only some batches fail, each
 * item of a failed batch is reported through `failed(item, failure)`; the
 * error is thrown only when every batch fails.
 */
export async function writeInBatches<Item, Result>(
  items: readonly Item[],
  batchSize: number,
  write: (batch: Item[]) => Promise<BatchWriteResponse<Result>>,
  failed: (item: Item, failure: BatchFailure) => Result[],
  { parallel }: { parallel?: boolean } = {}
): Promise<BatchWriteResponse<Result>> {
  const settled = await processBatches(
    items,
    async (batch) => [
      await write(batch).then(
        (response) => ({ response }),
        (reason: unknown) => ({ batch, reason })
      ),
    ],
    { batchSize, parallel }
  );
  const rejected = settled.flatMap((outcome) =>
    'reason' in outcome ? [outcome] : []
  );
  if (rejected.length > 0 && rejected.length === settled.length) {
    throw rejected[0].reason;
  }
  const responses = settled.map((outcome): BatchWriteResponse<Result> => {
    if ('response' in outcome) return outcome.response;
    const failure = batchFailure(outcome.reason);
    const results = outcome.batch.flatMap((item) => failed(item, failure));
    return {
      summary: { total: results.length, succeeded: 0, failed: results.length },
      results,
    };
  });
  const total = (key: keyof BatchWriteSummary) =>
    responses.reduce((sum, response) => sum + response.summary[key], 0);
  return {
    summary: {
      total: total('total'),
      succeeded: total('succeeded'),
      failed: total('failed'),
    },
    results: responses.flatMap((response) => response.results),
  };
}
