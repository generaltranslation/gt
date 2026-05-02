import { API_VERSION } from 'generaltranslation';

/**
 * @internal
 *
 * Makes an API request to the General Translation API.
 *
 * Encapsulates URL construction, headers, and JSON parsing.
 */
export default async function apiRequest(
  baseUrl: string,
  endpoint: string,
  options?: {
    body?: unknown;
    method?: 'GET' | 'POST' | 'DELETE';
  }
): Promise<Response> {
  const method = options?.method ?? 'POST';

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'gt-api-version': API_VERSION,
    },
  };

  if (options?.body !== undefined) {
    requestInit.body = JSON.stringify(options.body);
  }

  return fetch(`${baseUrl}${endpoint}`, requestInit);
}
