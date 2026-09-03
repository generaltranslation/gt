import { createClient as createGeneratedClient } from '../generated/client';
import type { Client } from '../generated/client';
import type { GetProjectInfoData } from '../generated/types.gen';
import { createRetryingFetch, createTimeoutFetch } from './transport';
import type { RetryPolicy } from './transport';

export type ApiVersion = NonNullable<
  NonNullable<GetProjectInfoData['headers']>['gt-api-version']
>;

export const API_VERSION: ApiVersion = '2026-03-06.v1';

export type UserTokenProvider = {
  getAccessToken: () => Promise<string | undefined> | string | undefined;
  refreshAccessToken: () => Promise<string | undefined>;
};

export type ApiClientConfig = {
  apiKey?: string;
  apiVersion?: ApiVersion;
  baseUrl: string;
  fetch?: typeof fetch;
  projectId?: string;
  retryPolicy?: RetryPolicy;
  timeoutMs?: number;
  userTokenProvider?: UserTokenProvider;
};

function createUserTokenFetch(
  fetchImplementation: typeof fetch,
  provider: UserTokenProvider
): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const accessToken = await provider.getAccessToken();
    if (accessToken && !request.headers.has('Authorization')) {
      request.headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await fetchImplementation(request.clone());
    if (response.status !== 401) return response;

    const refreshedAccessToken = await provider.refreshAccessToken();
    if (!refreshedAccessToken) return response;
    await response.body?.cancel();
    request.headers.set('Authorization', `Bearer ${refreshedAccessToken}`);
    return fetchImplementation(request);
  };
}

export function createApiClient(config: ApiClientConfig): Client {
  const headers = new Headers({
    'gt-api-version': config.apiVersion ?? API_VERSION,
  });
  if (config.apiKey) headers.set('Authorization', `Bearer ${config.apiKey}`);
  if (config.projectId) headers.set('gt-project-id', config.projectId);

  const transportFetch = createRetryingFetch({
    // Timeout applies per attempt, inside the retry loop.
    fetch: createTimeoutFetch({
      fetch: config.fetch,
      timeoutMs: config.timeoutMs,
    }),
    retryPolicy: config.retryPolicy,
  });

  return createGeneratedClient({
    baseUrl: config.baseUrl,
    fetch:
      config.apiKey || !config.userTokenProvider
        ? transportFetch
        : createUserTokenFetch(transportFetch, config.userTokenProvider),
    headers,
  });
}
