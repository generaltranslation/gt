import { TranslationRequestConfig } from '../../types';
import { defaultBaseUrl } from '../../settings/settingsUrls';
import { defaultTimeout } from '../../settings/settings';
import fetchWithTimeout from './fetchWithTimeout';
import validateResponse from './validateResponse';
import handleFetchError from './handleFetchError';
import generateRequestHeaders from './generateRequestHeaders';

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  }
): Promise<T> {
  const timeout = options?.timeout ?? defaultTimeout;
  const url = `${config.baseUrl || defaultBaseUrl}${endpoint}`;
  const method = options?.method ?? 'POST';

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
      if (attempt < MAX_RETRIES) {
        await sleep(INITIAL_DELAY_MS * 2 ** attempt);
        continue;
      }
      handleFetchError(error, timeout);
    }

    // Retry on 5XX server errors
    if (response!.status >= 500 && attempt < MAX_RETRIES) {
      await sleep(INITIAL_DELAY_MS * 2 ** attempt);
      continue;
    }

    await validateResponse(response!);
    return (await response!.json()) as T;
  }
}
