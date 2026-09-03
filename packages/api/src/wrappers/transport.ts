const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 500;
const RATE_LIMIT_RETRY_DELAY_MS = 60_000;
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);
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

export function createTimeoutFetch({
  fetch: fetchImplementation = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: TimeoutFetchOptions = {}): typeof fetch {
  return async (input, init) => {
    if (timeoutMs === false) {
      return fetchImplementation(input, init);
    }

    const request = new Request(input, init);
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(request.signal.reason);
    if (request.signal.aborted) forwardAbort();
    else request.signal.addEventListener('abort', forwardAbort, { once: true });
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetchImplementation(
        new Request(request, { signal: controller.signal })
      );
    } catch (error) {
      if (controller.signal.aborted && !request.signal.aborted) {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      request.signal.removeEventListener('abort', forwardAbort);
    }
  };
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

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

function retryDelay(
  response: Response | undefined,
  attempt: number,
  retryPolicy: RetryPolicy
): number {
  if (response?.status === 429) {
    return (
      parseRetryAfter(response.headers.get('Retry-After')) ??
      parseDelayMs(response.headers.get('RateLimit-Reset')) ??
      RATE_LIMIT_RETRY_DELAY_MS
    );
  }
  return (
    INITIAL_DELAY_MS * (retryPolicy === 'linear' ? attempt + 1 : 2 ** attempt)
  );
}

export function createRetryingFetch({
  fetch: fetchImplementation = globalThis.fetch,
  retryPolicy = 'exponential',
}: RetryingFetchOptions = {}): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const maxRetries = retryPolicy === 'none' ? 0 : MAX_RETRIES;
    const isIdempotent = IDEMPOTENT_METHODS.has(request.method);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let response: Response | undefined;
      try {
        response = await fetchImplementation(request.clone());
      } catch (error) {
        if (request.signal.aborted || attempt === maxRetries || !isIdempotent) {
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
      if (request.signal.aborted) {
        if (response) return response;
        throw request.signal.reason;
      }

      // Drain the discarded 429/5xx body so undici can release the socket.
      void response?.body?.cancel();
      await sleep(retryDelay(response, attempt, retryPolicy));
    }

    throw new Error('Max retries exceeded');
  };
}
