import { createClient as createGeneratedClient } from '../generated/client';
import type { Client } from '../generated/client';
import type { ApiVersion } from '../generated/types.gen';
import { ApiError } from './errors';
import {
  callerSignal,
  createCompressingFetch,
  createRetryingFetch,
  createTimeoutFetch,
  resolveTransportOptions,
} from './transport';
import type { TransportOptions } from './transport';

export const API_VERSION = '2026-10-08.v1' satisfies ApiVersion;

export type UserTokenProvider = {
  getAccessToken: () => Promise<string>;
  refreshAccessToken: () => Promise<string | undefined>;
};

export type ApiClientConfig = Partial<TransportOptions> & {
  apiKey?: string;
  baseUrl: string;
  /**
   * Gzips request bodies of 32 KiB or more. Defaults to true; set false
   * when a custom fetch or proxy must read plain request bodies.
   */
  compression?: boolean;
  userTokenProvider?: UserTokenProvider;
};

/** Attaches the user's bearer token and retries once with a refreshed token after a 401. */
function createUserTokenFetch(
  fetchImplementation: typeof fetch,
  provider: UserTokenProvider
): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const signal = callerSignal(input, init) ?? request.signal;
    if (request.headers.has('Authorization'))
      return fetchImplementation(request, { signal });
    request.headers.set(
      'Authorization',
      `Bearer ${await provider.getAccessToken()}`
    );

    const response = await fetchImplementation(request.clone(), { signal });
    if (response.status !== 401) return response;

    const refreshedAccessToken = await provider.refreshAccessToken();
    if (!refreshedAccessToken) return response;
    await response.body?.cancel();
    request.headers.set('Authorization', `Bearer ${refreshedAccessToken}`);
    return fetchImplementation(request, { signal });
  };
}

export function createApiClient(config: ApiClientConfig): Client {
  const headers = new Headers({
    'gt-api-version': API_VERSION,
  });
  if (config.apiKey) headers.set('Authorization', `Bearer ${config.apiKey}`);

  const { fetch, retryPolicy, timeoutMs } = resolveTransportOptions(config);
  const transportFetch = createRetryingFetch({
    // Timeout applies per attempt, inside the retry loop.
    fetch: createTimeoutFetch({ fetch, timeoutMs }),
    retryPolicy,
  });

  const authFetch =
    config.apiKey || !config.userTokenProvider
      ? transportFetch
      : createUserTokenFetch(transportFetch, config.userTokenProvider);

  const client = createGeneratedClient({
    baseUrl: config.baseUrl,
    // Outermost, so retries and the 401 refresh resend the compressed bytes.
    fetch:
      config.compression === false
        ? authFetch
        : createCompressingFetch(authFetch),
    headers,
  });
  // Only thrown errors change; `{ data, error }` results keep the decoded body.
  // `response` is undefined when fetch itself throws (timeout, abort, network).
  client.interceptors.error.use((error, response, _request, options) =>
    options.throwOnError && response
      ? ApiError.fromResponse(error, response)
      : error
  );
  return client;
}
