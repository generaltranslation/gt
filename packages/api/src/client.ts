import { createClient as createGeneratedClient } from './generated/client';
import type { Client } from './generated/client';
import type { GetProjectInfoData } from './generated/types.gen';
import { createRetryingFetch } from './transport';
import type { RetryPolicy } from './transport';

export const API_VERSION = '2026-03-06.v1';

export type ApiVersion = NonNullable<
  NonNullable<GetProjectInfoData['headers']>['gt-api-version']
>;

export type ApiClientConfig = {
  apiKey?: string;
  apiVersion?: ApiVersion;
  baseUrl: string;
  fetch?: typeof fetch;
  projectId?: string;
  retryPolicy?: RetryPolicy;
};

export function createApiClient(config: ApiClientConfig): Client {
  const headers = new Headers({
    'gt-api-version': config.apiVersion ?? API_VERSION,
  });
  if (config.apiKey) headers.set('Authorization', `Bearer ${config.apiKey}`);
  if (config.projectId) headers.set('gt-project-id', config.projectId);

  return createGeneratedClient({
    baseUrl: config.baseUrl,
    fetch: createRetryingFetch({
      fetch: config.fetch,
      retryPolicy: config.retryPolicy,
    }),
    headers,
  });
}
