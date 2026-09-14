import type { TranslationRequestConfig } from '../../types';
import { fetchWithTimeout } from './fetchWithTimeout';

export function fetchAuthenticated(
  config: TranslationRequestConfig,
  input: string | URL | Request,
  init: RequestInit,
  timeout?: number
): Promise<Response> {
  if (config.apiKey || !config.userTokenProvider) {
    return fetchWithTimeout(input, init, timeout);
  }
  return fetchWithUserToken(config, input, init, timeout);
}

async function fetchWithUserToken(
  config: TranslationRequestConfig,
  input: string | URL | Request,
  init: RequestInit,
  timeout?: number
): Promise<Response> {
  const provider = config.userTokenProvider;
  if (!provider) return fetchWithTimeout(input, init, timeout);

  const headers = new Headers(init.headers);
  const accessToken = await provider.getAccessToken();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetchWithTimeout(input, { ...init, headers }, timeout);
  if (response.status !== 401) return response;

  const refreshedAccessToken = await provider.refreshAccessToken();
  if (!refreshedAccessToken) return response;

  await response.body?.cancel();
  headers.set('Authorization', `Bearer ${refreshedAccessToken}`);
  return fetchWithTimeout(input, { ...init, headers }, timeout);
}
