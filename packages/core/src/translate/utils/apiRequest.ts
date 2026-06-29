import { TranslationRequestConfig } from '../../types';
import { defaultBaseUrl } from '../../settings/settingsUrls';
import { defaultTimeout } from '../../settings/settings';
import { fetchWithTimeout } from './fetchWithTimeout';
import { validateResponse } from './validateResponse';
import { handleFetchError } from './handleFetchError';
import { generateRequestHeaders } from './generateRequestHeaders';

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 500;
const RATE_LIMIT_RETRY_DELAY_MS = 60_000;
const MS_PER_SECOND = 1000;

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

function parseDelayMs(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value.split(',')[0].split(';')[0].trim());
  if (!Number.isFinite(seconds) || seconds < 0) {
    return undefined;
  }

  return seconds * MS_PER_SECOND;
}

function parseRetryAfter(value: string | null): number | undefined {
  const delayMs = parseDelayMs(value);
  if (delayMs !== undefined) {
    return delayMs;
  }

  if (!value) {
    return undefined;
  }

  const retryDate = Date.parse(value);
  if (Number.isNaN(retryDate)) {
    return undefined;
  }

  return Math.max(retryDate - Date.now(), 0);
}

function getRateLimitRetryDelay(response: Response): number {
  return (
    parseRetryAfter(response.headers.get('Retry-After')) ??
    parseDelayMs(response.headers.get('RateLimit-Reset')) ??
    RATE_LIMIT_RETRY_DELAY_MS
  );
}

function getResponseRetryDelay(
  response: Response,
  policy: RetryPolicy,
  attempt: number
): number {
  if (response.status === 429) {
    return getRateLimitRetryDelay(response);
  }

  return getRetryDelay(policy, attempt);
}

/**
 * @internal
 *
 * Makes an API request with automatic retry for 429 and 5XX errors.
 *
 * Encapsulates URL construction, fetch with timeout, error handling,
 * response validation, and JSON parsing.
 *
 * @param config - The configuration for the API call.
 * @param endpoint - The API endpoint path (e.g. '/v2/project/jobs/info')
 * @param options - Optional request options.
 * @returns The parsed JSON response.
 */
export async function apiRequest<T>(
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

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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

    // Retry on rate limits and 5XX server errors.
    if (
      (response!.status === 429 || response!.status >= 500) &&
      attempt < maxRetries
    ) {
      await sleep(getResponseRetryDelay(response!, retryPolicy, attempt));
      continue;
    }

    await validateResponse(response!);
    return (await response!.json()) as T;
  }

  throw new Error('Max retries exceeded');
}
