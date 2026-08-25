import { afterEach, describe, expect, it, vi } from 'vitest';

import { awaitJobs } from '../awaitJobs';
import {
  decodeBase64,
  decodeFileContent,
  encodeBase64,
  encodeFileContent,
} from '../base64';
import { createBatches, processBatches } from '../batch';
import { API_VERSION, createApiClient } from '../client';
import { createRetryingFetch, createTimeoutFetch } from '../transport';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('createTimeoutFetch', () => {
  it('aborts requests after the configured timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async (input) =>
        new Promise<Response>((_, reject) => {
          new Request(input).signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );
    const response = createTimeoutFetch({ fetch: fetchMock, timeoutMs: 10 })(
      'https://example.com/test'
    );

    const expectation = expect(response).rejects.toThrow(
      'Request timed out after 10ms'
    );
    await vi.advanceTimersByTimeAsync(10);

    await expectation;
  });

  it('forwards caller aborts with their original reason', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async (input) =>
        new Promise<Response>((_, reject) => {
          const { signal } = new Request(input);
          signal.addEventListener('abort', () => reject(signal.reason));
        })
    );
    const controller = new AbortController();
    const response = createTimeoutFetch({ fetch: fetchMock })(
      'https://example.com/test',
      { signal: controller.signal }
    );

    controller.abort(new Error('caller gave up'));

    await expect(response).rejects.toThrow('caller gave up');
  });
});

describe('createRetryingFetch', () => {
  it('retries rate limits', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('rate limited', {
          status: 429,
          headers: { 'Retry-After': '0' },
        })
      )
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const response = await createRetryingFetch({ fetch: fetchMock })(
      'https://example.com/test'
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('honors Retry-After HTTP dates and RateLimit-Reset fallbacks', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('rate limited', {
          status: 429,
          headers: { 'Retry-After': new Date(Date.now() - 1000).toUTCString() },
        })
      )
      .mockResolvedValueOnce(
        new Response('rate limited', {
          status: 429,
          headers: { 'RateLimit-Reset': '0' },
        })
      )
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const response = await createRetryingFetch({ fetch: fetchMock })(
      'https://example.com/test'
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries server errors with exponential backoff', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('failed', { status: 500 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const pendingResponse = createRetryingFetch({ fetch: fetchMock })(
      'https://example.com/test'
    );
    await vi.runAllTimersAsync();

    await expect(pendingResponse).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns the last server error after exhausting retries', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('failed', { status: 500 }));

    const pendingResponse = createRetryingFetch({ fetch: fetchMock })(
      'https://example.com/test'
    );
    await vi.runAllTimersAsync();

    await expect(pendingResponse).resolves.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('propagates a network error on the final attempt', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('fetch failed'));

    const pendingResponse = createRetryingFetch({ fetch: fetchMock })(
      'https://example.com/test'
    );
    const expectation = expect(pendingResponse).rejects.toThrow('fetch failed');
    await vi.runAllTimersAsync();

    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('surfaces caller aborts instead of sleeping through them', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
      controller.abort(new Error('caller gave up'));
      throw controller.signal.reason;
    });

    // Real timers: without the abort check this would sleep 500ms+ retrying.
    await expect(
      createRetryingFetch({ fetch: fetchMock })('https://example.com/test', {
        signal: controller.signal,
      })
    ).rejects.toThrow('caller gave up');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('returns a retryable response without sleeping when the caller aborts', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
      controller.abort();
      return new Response('rate limited', { status: 429 });
    });

    // Real timers: without the abort check this would sleep 60s on the 429.
    const response = await createRetryingFetch({ fetch: fetchMock })(
      'https://example.com/test',
      { signal: controller.signal }
    );

    expect(response.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not retry when retryPolicy is none', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('failed', { status: 500 }));

    const response = await createRetryingFetch({
      fetch: fetchMock,
      retryPolicy: 'none',
    })('https://example.com/test');

    expect(response.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('createApiClient', () => {
  it('configures the generated client URL and auth headers', async () => {
    let request: Request | undefined;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        request = new Request(input);
        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });
    const client = createApiClient({
      apiKey: 'api-key',
      baseUrl: 'https://example.com',
      fetch: fetchMock,
      projectId: 'project-id',
    });

    await client.get({ url: '/test' });

    expect(request?.url).toBe('https://example.com/test');
    expect(request?.headers.get('Authorization')).toBe('Bearer api-key');
    expect(request?.headers.get('gt-project-id')).toBe('project-id');
    expect(request?.headers.get('gt-api-version')).toBe(API_VERSION);
  });

  it('times out requests after the configured timeoutMs', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async (input) =>
        new Promise<Response>((_, reject) => {
          new Request(input).signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );
    const client = createApiClient({
      baseUrl: 'https://example.com',
      fetch: fetchMock,
      retryPolicy: 'none',
      timeoutMs: 10,
    });

    const pendingResponse = client.get({ url: '/test', throwOnError: true });
    const expectation = expect(pendingResponse).rejects.toThrow(
      'Request timed out after 10ms'
    );
    await vi.advanceTimersByTimeAsync(10);

    await expectation;
  });
});

describe('batch helpers', () => {
  it('uses chunk-100 by default and preserves item order', async () => {
    const items = Array.from({ length: 205 }, (_, index) => index);
    const batches = createBatches(items);
    const result = await processBatches(items, async (batch) => batch);

    expect(batches.map(({ length }) => length)).toEqual([100, 100, 5]);
    expect(result).toEqual({ data: items, count: 205, batchCount: 3 });
  });

  it('runs batches sequentially when parallel is false', async () => {
    const items = Array.from({ length: 5 }, (_, index) => index);
    let inFlight = 0;
    let maxInFlight = 0;

    const result = await processBatches(
      items,
      async (batch) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 0));
        inFlight -= 1;
        return batch;
      },
      { batchSize: 2, parallel: false }
    );

    expect(maxInFlight).toBe(1);
    expect(result).toEqual({ data: items, count: 5, batchCount: 3 });
  });
});

describe('base64 helpers', () => {
  it('round trips UTF-8 and preserves binary-format payloads', () => {
    const text = 'こんにちは';
    const encoded = encodeBase64(text);

    expect(decodeBase64(encoded)).toBe(text);
    expect(decodeFileContent(encodeFileContent(text, 'JSON'), 'JSON')).toBe(
      text
    );
    expect(encodeFileContent('already-base64', 'LOTTIE')).toBe(
      'already-base64'
    );
    expect(decodeFileContent('already-base64', 'LOTTIE')).toBe(
      'already-base64'
    );
  });

  it('round trips UTF-8 through the browser fallback path', () => {
    vi.stubGlobal('Buffer', undefined);
    const text = 'こんにちは 👋';

    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });
});

describe('awaitJobs', () => {
  it('polls pending jobs until they reach terminal states', async () => {
    const getJobStatuses = vi
      .fn()
      .mockResolvedValueOnce([{ jobId: 'one', status: 'processing' }])
      .mockResolvedValueOnce([{ jobId: 'one', status: 'completed' }]);

    const result = await awaitJobs(['one'], getJobStatuses, {
      pollingIntervalSeconds: 0,
    });

    expect(result).toEqual({
      complete: true,
      jobs: [{ jobId: 'one', status: 'completed' }],
    });
    expect(getJobStatuses).toHaveBeenCalledTimes(2);
  });

  it('reports incomplete unknown jobs when the deadline expires', async () => {
    const getJobStatuses = vi.fn();

    const result = await awaitJobs(['one'], getJobStatuses, {
      timeoutSeconds: 0,
    });

    expect(result).toEqual({
      complete: false,
      jobs: [{ jobId: 'one', status: 'unknown' }],
    });
    expect(getJobStatuses).not.toHaveBeenCalled();
  });

  it('marks jobs missing from the response as unknown', async () => {
    const getJobStatuses = vi.fn().mockResolvedValue([]);

    const result = await awaitJobs(['one'], getJobStatuses, {
      pollingIntervalSeconds: 0,
    });

    expect(result).toEqual({
      complete: true,
      jobs: [{ jobId: 'one', status: 'unknown' }],
    });
    expect(getJobStatuses).toHaveBeenCalledOnce();
  });

  it('propagates status-loader errors before the deadline', async () => {
    const getJobStatuses = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(awaitJobs(['one'], getJobStatuses)).rejects.toThrow('boom');
  });

  it('completes immediately for an empty job list', async () => {
    const getJobStatuses = vi.fn();

    await expect(awaitJobs([], getJobStatuses)).resolves.toEqual({
      complete: true,
      jobs: [],
    });
    expect(getJobStatuses).not.toHaveBeenCalled();
  });
});
