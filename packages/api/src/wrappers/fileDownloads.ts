import { ApiError } from './errors';
import {
  createRetryingFetch,
  createTimeoutFetch,
  type RetryPolicy,
} from './transport';

// A signed download URL works for 15 minutes, so no attempt can outlive it.
const DOWNLOAD_URL_LIFETIME_MS = 900_000;

/**
 * Reads a file's bytes from a signed `downloadUrl` that a file content
 * response returns instead of inline `data`. The URL authorizes the request,
 * so it carries no API credentials. Each attempt's timeout defaults to the
 * URL's 15-minute lifetime.
 */
export async function fetchFileDownload(
  downloadUrl: string,
  options: { timeoutMs?: number | false; retryPolicy?: RetryPolicy } = {}
): Promise<Uint8Array<ArrayBuffer>> {
  const fetch = createRetryingFetch({
    fetch: createTimeoutFetch({
      fetch: fetchWithBody,
      timeoutMs: options.timeoutMs ?? DOWNLOAD_URL_LIFETIME_MS,
    }),
    retryPolicy: options.retryPolicy,
  });
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new ApiError(
      `File download failed with HTTP ${response.status}`,
      response.status
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

// Reads the body inside the attempt, so the timeout covers it and a dropped
// connection mid-body is retried like one before the headers.
const fetchWithBody: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (!response.ok) return response;
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
