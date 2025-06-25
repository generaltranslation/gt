/**
 * Fetch with abort.
 *
 * This function is a wrapper around the fetch function that adds a timeout.
 * If the timeout is reached, the request is aborted.
 *
 * @param url - The URL to fetch.
 * @param options - The options to pass to the fetch function.
 * @param timeout - The timeout in milliseconds.
 * @returns The response from the fetch function.
 */
export async function fetchWithAbort(
  url: string,
  options: RequestInit | undefined,
  timeout: number | undefined
) {
  const controller = new AbortController();
  const timeoutId =
    timeout === undefined
      ? undefined
      : setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
