import {
  API_VERSION,
  createApiClient,
  processBatches,
  type ApiVersion,
  type BatchWriteSummary,
} from '@generaltranslation/api';
import {
  resolveCanonicalLocale,
  standardizeLocale,
} from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import { defaultBaseUrl } from './settings/settingsUrls';
import type { GTAccountConfig, GTProjectConfig } from './clientConfig';

/** @internal The API client for a `GT` configuration; a timeout gets its own client. */
export function createGtApiClient(
  {
    projectId: _projectId,
    localeConfig: _localeConfig,
    baseUrl,
    ...credentials
  }: GTProjectConfig | GTAccountConfig,
  timeoutMs?: number
): ReturnType<typeof createApiClient> {
  return createApiClient({
    ...credentials,
    baseUrl: baseUrl || defaultBaseUrl,
    ...(timeoutMs !== undefined && { timeoutMs }),
  });
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

/** @internal Sends `items` in batches of at most `batchSize`; summaries add up and results keep request order. */
export async function writeInBatches<Item, Result>(
  items: readonly Item[],
  batchSize: number,
  write: (batch: Item[]) => Promise<BatchWriteResponse<Result>>
): Promise<BatchWriteResponse<Result>> {
  const responses = await processBatches(
    items,
    async (batch) => [await write(batch)],
    { batchSize }
  );
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
