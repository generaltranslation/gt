const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 500;
const RATE_LIMIT_RETRY_DELAY_MS = 60_000;
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);
const COMPRESSION_THRESHOLD_BYTES = 32 * 1024;
export const DEFAULT_TIMEOUT_MS = 60_000;

export type RetryPolicy = 'exponential' | 'linear' | 'none';

export type RetryingFetchOptions = {
  fetch?: typeof fetch;
  retryPolicy?: RetryPolicy;
};

export type TimeoutFetchOptions = {
  fetch?: typeof fetch;
  timeoutMs?: number | false;
};

/**
 * The abort signal of the request the caller holds. A Request copy follows its
 * source's signal only while the source stays reachable, so wrappers listen on
 * this signal and pass it on in `init` instead of reading their copies'.
 */
export function callerSignal(
  input: RequestInfo | URL,
  init: RequestInit | undefined
): AbortSignal | undefined {
  return init?.signal ?? (input instanceof Request ? input.signal : undefined);
}

export function createTimeoutFetch({
  fetch: fetchImplementation = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: TimeoutFetchOptions = {}): typeof fetch {
  return async (input, init) => {
    if (timeoutMs === false) {
      return fetchImplementation(input, init);
    }

    const request = new Request(input, init);
    const signal = callerSignal(input, init);
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(signal?.reason);
    if (signal?.aborted) forwardAbort();
    else signal?.addEventListener('abort', forwardAbort, { once: true });
    // fetch rejects with the abort reason, so only our own timeout reads as one.
    const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
    const timeoutId = setTimeout(
      () => controller.abort(timeoutError),
      timeoutMs
    );

    try {
      // Custom fetches may read only request.signal; the signal in init is the reliable one.
      const timedRequest = new Request(request, { signal: controller.signal });
      return await fetchImplementation(timedRequest, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', forwardAbort);
    }
  };
}

/** Resolves after `ms`, or as soon as `signal` aborts. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const wake = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', wake);
      resolve();
    };
    const timer = setTimeout(wake, ms);
    signal.addEventListener('abort', wake, { once: true });
  });
}

function parseDelayMs(value: string | null): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value.split(',')[0].split(';')[0].trim());
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

function parseRetryAfter(value: string | null): number | undefined {
  const delayMs = parseDelayMs(value);
  if (delayMs !== undefined) return delayMs;
  if (!value) return undefined;

  const retryDate = Date.parse(value);
  return Number.isNaN(retryDate)
    ? undefined
    : Math.max(retryDate - Date.now(), 0);
}

/** How long a 429 response asks the client to wait before trying again. */
export function rateLimitDelayMs(response: Response): number {
  return (
    parseRetryAfter(response.headers.get('Retry-After')) ??
    parseDelayMs(response.headers.get('RateLimit-Reset')) ??
    RATE_LIMIT_RETRY_DELAY_MS
  );
}

function retryDelay(
  response: Response | undefined,
  attempt: number,
  retryPolicy: RetryPolicy
): number {
  if (response?.status === 429) return rateLimitDelayMs(response);
  return (
    INITIAL_DELAY_MS * (retryPolicy === 'linear' ? attempt + 1 : 2 ** attempt)
  );
}

/**
 * Gzips request bodies of at least 32 KiB. If the server rejects the encoding
 * (415, or 400 `invalid_content_encoding`), resends the uncompressed request once.
 */
export function createCompressingFetch(
  fetchImplementation: typeof fetch
): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    // Wrappers below read the caller's signal from init (see callerSignal).
    const signal = callerSignal(input, init) ?? request.signal;
    if (
      request.body === null ||
      request.headers.has('Content-Encoding') ||
      typeof globalThis.CompressionStream !== 'function'
    ) {
      return fetchImplementation(request, { signal });
    }
    signal.throwIfAborted();
    const bytes = await request.clone().arrayBuffer();
    if (bytes.byteLength < COMPRESSION_THRESHOLD_BYTES) {
      return fetchImplementation(request, { signal });
    }

    const body = await new Response(
      new Blob([bytes])
        .stream()
        .pipeThrough(new CompressionStream('gzip'), { signal })
    ).arrayBuffer();
    const headers = new Headers(request.headers);
    headers.set('Content-Encoding', 'gzip');
    // A caller-set length describes the uncompressed body; undici rejects it.
    headers.delete('Content-Length');
    const response = await fetchImplementation(
      new Request(request, { method: request.method, body, headers }),
      { signal }
    );

    if (response.status !== 415 && response.status !== 400) return response;
    if (response.status === 400) {
      const error: { code?: unknown } | undefined = await response
        .clone()
        .json()
        .catch(() => undefined);
      if (error?.code !== 'invalid_content_encoding') return response;
    }
    await response.body?.cancel();
    return fetchImplementation(request, { signal });
  };
}

export function createRetryingFetch({
  fetch: fetchImplementation = globalThis.fetch,
  retryPolicy = 'exponential',
}: RetryingFetchOptions = {}): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const signal = callerSignal(input, init) ?? request.signal;
    const maxRetries = retryPolicy === 'none' ? 0 : MAX_RETRIES;
    const isIdempotent = IDEMPOTENT_METHODS.has(request.method);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let response: Response | undefined;
      try {
        response = await fetchImplementation(request.clone(), { signal });
      } catch (error) {
        if (signal.aborted || attempt === maxRetries || !isIdempotent) {
          throw error;
        }
      }

      if (
        response &&
        response.status !== 429 &&
        (response.status < 500 || !isIdempotent)
      ) {
        return response;
      }
      if (response && attempt === maxRetries) return response;
      // Caller gave up (e.g. a poll deadline); don't sleep through the abort.
      if (signal.aborted) {
        if (response) return response;
        throw signal.reason;
      }

      await sleep(retryDelay(response, attempt, retryPolicy), signal);
      // As before the sleep: the caller sees the last response, not a
      // cancellation, so it can tell a rate limit from its own timeout.
      if (signal.aborted) {
        if (response) return response;
        throw signal.reason;
      }
      // Drain the discarded 429/5xx body so undici can release the socket.
      void response?.body?.cancel();
    }

    throw new Error('Max retries exceeded');
  };
}
