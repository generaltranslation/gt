import { afterEach, describe, expect, it, vi } from 'vitest';

import { awaitJobs } from '../awaitJobs';
import {
  decodeBase64,
  decodeFileContent,
  encodeBase64,
  encodeFileContent,
} from '../base64';
import {
  createBatches,
  DEFAULT_BATCH_SIZE,
  FONT_BATCH_SIZE,
  processBatches,
} from '../batch';
import { API_VERSION, createApiClient } from '../client';
import { createRetryingFetch, createTimeoutFetch } from '../transport';

afterEach(() => vi.useRealTimers());

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
});

describe('batch helpers', () => {
  it('uses chunk-100 by default and exposes the font limit', async () => {
    const items = Array.from({ length: 205 }, (_, index) => index);
    const batches = createBatches(items);
    const result = await processBatches(items, async (batch) => batch);

    expect(DEFAULT_BATCH_SIZE).toBe(100);
    expect(FONT_BATCH_SIZE).toBe(50);
    expect(batches.map(({ length }) => length)).toEqual([100, 100, 5]);
    expect(result).toEqual({ data: items, count: 205, batchCount: 3 });
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

  it('completes immediately for an empty job list', async () => {
    const getJobStatuses = vi.fn();

    await expect(awaitJobs([], getJobStatuses)).resolves.toEqual({
      complete: true,
      jobs: [],
    });
    expect(getJobStatuses).not.toHaveBeenCalled();
  });
});
