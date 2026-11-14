import { ApiError } from './errors';
import {
  createRetryingFetch,
  createTimeoutFetch,
  DEFAULT_TIMEOUT_MS,
  resolveTransportOptions,
} from './transport';

/**
 * Passes `body` through and fails when no chunk arrives for `idleMs`. The
 * request timeout ends with the response headers, and only some runtimes bound
 * a silent body themselves. A slow download that keeps moving is not cut off.
 */
function withIdleTimeout(
  body: ReadableStream<Uint8Array>,
  idleMs: number
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  return new ReadableStream({
    async pull(controller) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const chunk = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error(`File download stalled for ${idleMs}ms`)),
              idleMs
            );
          }),
        ]);
        if (chunk.done) controller.close();
        else controller.enqueue(chunk.value);
      } catch (error) {
        // Releases the connection of a download that is given up on.
        void reader.cancel(error).catch(() => {});
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
    cancel: (reason) => reader.cancel(reason),
  });
}

/**
 * Opens the signed `downloadUrl` that a file content response returns instead
 * of inline `data` for media too large to inline, and returns the file as a
 * stream, so a caller can save it without holding it in memory. The URL
 * authorizes the request, so it carries no API credentials. It works for 15
 * minutes; read the file content again for a new one. Reading the stream fails
 * when the download sends nothing for the request timeout.
 */
export async function fetchFileDownload(
  downloadUrl: string
): Promise<ReadableStream<Uint8Array>> {
  const { fetch, retryPolicy } = resolveTransportOptions({});
  const fetchDownload = createRetryingFetch({
    fetch: createTimeoutFetch({ fetch, timeoutMs: DEFAULT_TIMEOUT_MS }),
    retryPolicy,
  });
  const response = await fetchDownload(downloadUrl);
  if (!response.ok || !response.body) {
    // Releases the connection of a response that is not read.
    void response.body?.cancel();
    throw new ApiError(
      `File download failed with HTTP ${response.status}`,
      response.status
    );
  }
  return withIdleTimeout(response.body, DEFAULT_TIMEOUT_MS);
}
