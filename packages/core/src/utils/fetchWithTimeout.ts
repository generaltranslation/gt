import { translationTimeoutError } from '../logging/errors';
import { maxTimeout } from '../settings/settings';

/**
 * @internal
 *
 * Wraps the fetch function with a timeout.
 *
 * @param url - The URL to fetch.
 * @param options - The options to pass to the fetch function.
 * @param timeout - The timeout in milliseconds.
 * @returns The response from the fetch function.
 */
export default async function fetchWithTimeout(
  url: string | URL | globalThis.Request,
  options: RequestInit,
  timeout?: number
) {
  const controller = new AbortController();
  const signal = controller.signal;

  timeout = Math.min(timeout || maxTimeout, maxTimeout);
  if (timeout) setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...options, signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw translationTimeoutError(timeout);
    }
    throw error;
  }
}
