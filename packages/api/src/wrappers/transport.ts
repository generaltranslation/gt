const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 500;
const RATE_LIMIT_RETRY_DELAY_MS = 60_000;
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);
export const DEFAULT_TIMEOUT_MS = 60_000;

export type RetryPolicy = 'exponential' | 'linear' | 'none';

/** How a request is sent, with every default filled in. */
export type TransportOptions = {
  fetch: typeof fetch;
  retryPolicy: RetryPolicy;
  /** `false` when a custom fetch implementation owns request timeouts. */
  timeoutMs: number | false;
};

/**
 * Fills in the transport defaults. Each public function that sends requests
 * calls it once; the fetch factories below take resolved options only.
 */
export function resolveTransportOptions({
  fetch = globalThis.fetch,
  retryPolicy = 'exponential',
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: Partial<TransportOptions>): TransportOptions {
  return { fetch, retryPolicy, timeoutMs };
}

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
  fetch: fetchImplementation,
  timeoutMs,
}: Pick<TransportOptions, 'fetch' | 'timeoutMs'>): typeof fetch {
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

export function createRetryingFetch({
  fetch: fetchImplementation,
  retryPolicy,
}: Pick<TransportOptions, 'fetch' | 'retryPolicy'>): typeof fetch {
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
