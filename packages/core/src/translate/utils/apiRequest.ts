import { TranslationRequestConfig } from '../../types';
import { defaultBaseUrl } from '../../settings/settingsUrls';
import { defaultTimeout } from '../../settings/settings';
import fetchWithTimeout from './fetchWithTimeout';
import validateResponse from './validateResponse';
import handleFetchError from './handleFetchError';
import generateRequestHeaders from './generateRequestHeaders';

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 500;

type RetryPolicy = 'exponential' | 'linear' | 'none';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(policy: RetryPolicy, attempt: number): number {
  switch (policy) {
    case 'linear':
      return INITIAL_DELAY_MS * (attempt + 1);
    case 'exponential':
      return INITIAL_DELAY_MS * 2 ** attempt;
    default:
      return 0;
  }
}

/**
 * @internal
 *
 * Makes an API request with automatic retry for 5XX errors.
 *
 * Encapsulates URL construction, fetch with timeout, error handling,
 * response validation, and JSON parsing.
 *
 * @param config - The configuration for the API call
 * @param endpoint - The API endpoint path (e.g. '/v2/project/jobs/info')
 * @param options - Optional request options
 * @returns The parsed JSON response
 */
export default async function apiRequest<T>(
  config: TranslationRequestConfig,
  endpoint: string,
  options?: {
    body?: unknown;
    timeout?: number;
    method?: 'GET' | 'POST';
    retryPolicy?: RetryPolicy;
  }
): Promise<T> {
  const timeout = options?.timeout ?? defaultTimeout;
  const url = `${config.baseUrl || defaultBaseUrl}${endpoint}`;
  const method = options?.method ?? 'POST';
  const retryPolicy = options?.retryPolicy ?? 'exponential';
  const maxRetries = retryPolicy === 'none' ? 0 : MAX_RETRIES;

  const requestInit: RequestInit = {
    method,
    headers: generateRequestHeaders(config),
  };
  if (options?.body !== undefined) {
    requestInit.body = JSON.stringify(options.body);
  }

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetchWithTimeout(url, requestInit, timeout);
    } catch (error) {
      if (attempt < maxRetries) {
        await sleep(getRetryDelay(retryPolicy, attempt));
        continue;
      }
      handleFetchError(error, timeout);
    }

    // Retry on 5XX server errors
    if (response!.status >= 500 && attempt < maxRetries) {
      await sleep(getRetryDelay(retryPolicy, attempt));
      continue;
    }

    await validateResponse(response!);
    return (await response!.json()) as T;
  }
}
