import { ApiError } from './errors';
import { createRetryingFetch, createTimeoutFetch } from './transport';

/**
 * Opens the signed `downloadUrl` that a file content response returns instead
 * of inline `data` for media too large to inline, and returns the file as a
 * stream, so a caller can save it without holding it in memory. The URL
 * authorizes the request, so it carries no API credentials. It works for 15
 * minutes; read the file content again for a new one.
 */
export async function fetchFileDownload(
  downloadUrl: string
): Promise<ReadableStream<Uint8Array>> {
  const fetchDownload = createRetryingFetch({ fetch: createTimeoutFetch() });
  const response = await fetchDownload(downloadUrl);
  if (!response.ok || !response.body) {
    // Releases the connection of a response that is not read.
    void response.body?.cancel();
    throw new ApiError(
      `File download failed with HTTP ${response.status}`,
      response.status
    );
  }
  return response.body;
}
