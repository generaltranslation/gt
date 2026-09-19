import { translationTimeoutError } from '../../logging/errors';
import { defaultTimeout } from '../../settings/settings';

/**
 * @internal
 *
 * Wraps a fetch implementation with the runtime translation timeout.
 *
 * @param url - The URL to fetch.
 * @param options - The options to pass to the fetch function.
 * @param timeoutMs - The timeout in milliseconds. Omitted selects `defaultTimeout`,
 * `0` is a literal zero, and `false` disables the runtime-owned timer.
 * @param fetchImplementation - The fetch implementation to call. Defaults to global fetch.
 * @returns The response from the fetch function.
 */
export async function fetchWithTimeout(
  url: string | URL | globalThis.Request,
  options: RequestInit,
  timeoutMs: number | false = defaultTimeout,
  fetchImplementation: typeof fetch = globalThis.fetch
) {
  const controller = new AbortController();
  const signals = [controller.signal];
  if (options.signal) signals.push(options.signal);
  if (url instanceof Request) signals.push(url.signal);
  const signal = AbortSignal.any(signals);

  const timeoutId =
    timeoutMs === false
      ? null
      : setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImplementation(url, { ...options, signal });
    return response;
  } catch (error) {
    if (
      timeoutMs !== false &&
      error instanceof Error &&
      error.name === 'AbortError'
    ) {
      throw translationTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
