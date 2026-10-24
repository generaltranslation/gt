import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { awaitJobs } from '../wrappers/awaitJobs';
import { createBatches, processBatches } from '../wrappers/batch';
import { API_VERSION, createApiClient } from '../wrappers/client';
import { ApiError } from '../wrappers/errors';
import { paginate } from '../wrappers/paginate';
import { listProjects, pluginInfo, queryJobs } from '../generated/sdk.gen';
import { createRetryingFetch, createTimeoutFetch } from '../wrappers/transport';

afterEach(() => {
  vi.useRealTimers();
});

describe('createTimeoutFetch', () => {
  it('aborts the signal handed to fetch after the configured timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async (_input, init) =>
        new Promise<Response>((_, reject) => {
          // Like fetch, reject with the signal's abort reason.
          init?.signal?.addEventListener('abort', () => {
            reject(init.signal?.reason);
          });
        })
    );
    const response = createTimeoutFetch({ fetch: fetchMock, timeoutMs: 10 })(
      'https://example.com/test',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"value":"preserved"}',
      }
    );

    const expectation = expect(response).rejects.toThrow(
      'Request timed out after 10ms'
    );
    await vi.advanceTimersByTimeAsync(10);

    await expectation;
    const [request, init] = fetchMock.mock.calls[0];
    expect(init?.signal?.aborted).toBe(true);
    expect(request).toBeInstanceOf(Request);
    expect((request as Request).method).toBe('POST');
    expect((request as Request).headers.get('content-type')).toBe(
      'application/json'
    );
    await expect((request as Request).text()).resolves.toBe(
      '{"value":"preserved"}'
    );
  });

  it('aborts the request handed to fetch after the configured timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async (input) =>
        new Promise<Response>((_, reject) => {
          const { signal } = input as Request;
          signal.addEventListener('abort', () => reject(signal.reason));
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

  it("keeps a custom fetch's own cancellation error after the timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Promise<Response>((_, reject) => {
          setTimeout(() => reject(new Error('custom fetch cancelled')), 20);
        })
    );
    const response = createTimeoutFetch({ fetch: fetchMock, timeoutMs: 10 })(
      'https://example.com/test'
    );

    const expectation = expect(response).rejects.toThrow(
      'custom fetch cancelled'
    );
    await vi.advanceTimersByTimeAsync(20);

    await expectation;
  });

  it('forwards caller aborts with their original reason', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async (_input, init) =>
        new Promise<Response>((_, reject) => {
          const signal = init!.signal!;
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

  it('allows a custom fetch implementation to own request timeouts', async () => {
    vi.useFakeTimers();
    let resolveFetch: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    const response = createTimeoutFetch({
      fetch: fetchMock,
      timeoutMs: false,
    })('https://example.com/test');

    expect(vi.getTimerCount()).toBe(0);
    resolveFetch(new Response('ok'));

    await expect(response).resolves.toEqual(
      expect.objectContaining({ ok: true })
    );
  });
});

describe('createRetryingFetch', () => {
  it('retries rate limits for non-idempotent methods', async () => {
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
      'https://example.com/test',
      { method: 'POST' }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-idempotent methods after server errors', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('failed', { status: 500 }));

    const response = await createRetryingFetch({ fetch: fetchMock })(
      'https://example.com/test',
      { method: 'POST' }
    );

    expect(response.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not retry non-idempotent methods after network errors', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      createRetryingFetch({ fetch: fetchMock })('https://example.com/test', {
        method: 'POST',
      })
    ).rejects.toThrow('fetch failed');
    expect(fetchMock).toHaveBeenCalledOnce();
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

  it('uses linear backoff when configured', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const attemptTimes: number[] = [];
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
      attemptTimes.push(Date.now());
      return attemptTimes.length === 4
        ? new Response('{}', { status: 200 })
        : new Response('failed', { status: 500 });
    });

    const pendingResponse = createRetryingFetch({
      fetch: fetchMock,
      retryPolicy: 'linear',
    })('https://example.com/test');
    await vi.runAllTimersAsync();

    await expect(pendingResponse).resolves.toMatchObject({ status: 200 });
    expect(attemptTimes).toEqual([0, 500, 1_500, 3_000]);
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

describe('API_VERSION', () => {
  const spec = JSON.parse(
    readFileSync(new URL('../../spec/openapi.json', import.meta.url), 'utf8')
  ) as { components: { schemas: { ApiVersion: { enum: string[] } } } };
  const specVersions = spec.components.schemas.ApiVersion.enum;

  it("is one of the bundled spec's ApiVersion values", () => {
    expect(specVersions).toContain(API_VERSION);
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
    });

    await client.get({ url: '/test' });

    expect(request?.url).toBe('https://example.com/test');
    expect(request?.headers.get('Authorization')).toBe('Bearer api-key');
    expect(request?.headers.has('gt-project-id')).toBe(false);
    expect(request?.headers.get('gt-api-version')).toBe(API_VERSION);
  });

  it('sends the per-call gt-api-version on generated calls, never gt-project-id', async () => {
    const requests: Request[] = [];
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        requests.push(new Request(input));
        return Response.json({ results: [] });
      });
    const client = createApiClient({
      apiVersion: '2026-03-06.v1',
      baseUrl: 'https://example.com',
      fetch: fetchMock,
    });

    await queryJobs({
      body: { jobs: [{ id: 'one' }] },
      client,
      headers: { 'gt-api-version': API_VERSION },
      path: { projectId: 'project-id' },
    });
    await pluginInfo({
      body: { fileName: 'design.fig' },
      client,
      headers: { 'gt-api-version': API_VERSION },
      path: { provider: 'figma' },
    });

    expect(
      requests.map((request) => [
        new URL(request.url).pathname,
        request.headers.get('gt-api-version'),
        request.headers.has('gt-project-id'),
      ])
    ).toEqual([
      ['/v2/projects/project-id/jobs/query', API_VERSION, false],
      ['/v1/integrations/plugins/figma/info', API_VERSION, false],
    ]);
  });

  it('uses a user token when no explicit API key is configured', async () => {
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
      baseUrl: 'https://example.com',
      fetch: fetchMock,
      userTokenProvider: {
        getAccessToken: async () => 'user-access-token',
        refreshAccessToken: vi.fn(),
      },
    });

    await client.get({ url: '/test' });

    expect(request?.headers.get('Authorization')).toBe(
      'Bearer user-access-token'
    );
  });

  it('keeps explicit API keys ahead of user tokens', async () => {
    let request: Request | undefined;
    const getAccessToken = vi.fn().mockReturnValue('user-access-token');
    const client = createApiClient({
      apiKey: 'api-key',
      baseUrl: 'https://example.com',
      fetch: vi.fn<typeof fetch>().mockImplementation(async (input) => {
        request = new Request(input);
        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
      userTokenProvider: {
        getAccessToken,
        refreshAccessToken: vi.fn(),
      },
    });

    await client.get({ url: '/test' });

    expect(request?.headers.get('Authorization')).toBe('Bearer api-key');
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it('leaves a per-request Authorization header alone, even on a 401', async () => {
    const authorizationHeaders: Array<string | null> = [];
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        authorizationHeaders.push(
          new Request(input).headers.get('Authorization')
        );
        return new Response('unauthorized', { status: 401 });
      });
    const getAccessToken = vi.fn().mockReturnValue('user-access-token');
    const refreshAccessToken = vi.fn().mockResolvedValue('refreshed-token');
    const client = createApiClient({
      baseUrl: 'https://example.com',
      fetch: fetchMock,
      retryPolicy: 'none',
      userTokenProvider: { getAccessToken, refreshAccessToken },
    });

    const result = await client.get({
      url: '/test',
      headers: { Authorization: 'Bearer per-request-key' },
    });

    expect(result.response.status).toBe(401);
    expect(authorizationHeaders).toEqual(['Bearer per-request-key']);
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes a user token and retries once after a 401', async () => {
    const authorizationHeaders: Array<string | null> = [];
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        authorizationHeaders.push(
          new Request(input).headers.get('Authorization')
        );
        return authorizationHeaders.length === 1
          ? new Response('unauthorized', { status: 401 })
          : new Response('{}', {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
      });
    const refreshAccessToken = vi.fn().mockResolvedValue('refreshed-token');
    const client = createApiClient({
      baseUrl: 'https://example.com',
      fetch: fetchMock,
      retryPolicy: 'none',
      userTokenProvider: {
        getAccessToken: async () => 'expired-token',
        refreshAccessToken,
      },
    });

    const result = await client.get({ url: '/test' });

    expect(result.response.status).toBe(200);
    expect(authorizationHeaders).toEqual([
      'Bearer expired-token',
      'Bearer refreshed-token',
    ]);
    expect(refreshAccessToken).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('preserves POST method/body and stops after a second 401', async () => {
    const attempts: {
      method: string;
      body: string;
      authorization: string | null;
    }[] = [];
    const refreshAccessToken = vi.fn().mockResolvedValue('refreshed-token');
    const client = createApiClient({
      baseUrl: 'https://example.com',
      retryPolicy: 'none',
      fetch: async (input) => {
        const request = new Request(input);
        attempts.push({
          method: request.method,
          body: await request.text(),
          authorization: request.headers.get('Authorization'),
        });
        return new Response('unauthorized', { status: 401 });
      },
      userTokenProvider: {
        getAccessToken: async () => 'expired-token',
        refreshAccessToken,
      },
    });
    const result = await client.post({
      url: '/test',
      body: { value: 'preserved' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result.response.status).toBe(401);
    expect(attempts).toEqual([
      {
        method: 'POST',
        body: '{"value":"preserved"}',
        authorization: 'Bearer expired-token',
      },
      {
        method: 'POST',
        body: '{"value":"preserved"}',
        authorization: 'Bearer refreshed-token',
      },
    ]);
    expect(refreshAccessToken).toHaveBeenCalledOnce();
  });

  it('times out requests after the configured timeoutMs', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async (_input, init) =>
        new Promise<Response>((_, reject) => {
          // Like fetch, reject with the signal's abort reason.
          init?.signal?.addEventListener('abort', () => {
            reject(init.signal?.reason);
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

describe('createApiClient errors', () => {
  const client = createApiClient({
    baseUrl: 'https://example.com',
    fetch: async () =>
      Response.json({ error: 'Forbidden project' }, { status: 403 }),
    retryPolicy: 'none',
  });

  it('throws an ApiError with the status for throwOnError calls', async () => {
    const error = await client
      .get({ url: '/test', throwOnError: true })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 403, message: 'Forbidden project' });
  });

  it('falls back to the status text for an empty error body', async () => {
    const emptyClient = createApiClient({
      baseUrl: 'https://example.com',
      fetch: async () =>
        new Response(null, { status: 503, statusText: 'Service Unavailable' }),
      retryPolicy: 'none',
    });

    await expect(
      emptyClient.get({ url: '/test', throwOnError: true })
    ).rejects.toMatchObject({ code: 503, message: 'Service Unavailable' });
  });

  it('falls back to the status text for an HTML error page', async () => {
    const htmlClient = createApiClient({
      baseUrl: 'https://example.com',
      fetch: async () =>
        new Response('<html><body>Bad Gateway</body></html>', {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
      retryPolicy: 'none',
    });

    await expect(
      htmlClient.get({ url: '/test', throwOnError: true })
    ).rejects.toMatchObject({ code: 502, message: 'Bad Gateway' });
  });

  it('falls back to the status code for an HTML error page without status text', async () => {
    const htmlClient = createApiClient({
      baseUrl: 'https://example.com',
      fetch: async () =>
        new Response('<html><body>Bad Gateway</body></html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
      retryPolicy: 'none',
    });

    await expect(
      htmlClient.get({ url: '/test', throwOnError: true })
    ).rejects.toMatchObject({ code: 502, message: 'HTTP 502' });
  });

  it('falls back to the status code for an empty error body without status text', async () => {
    const emptyClient = createApiClient({
      baseUrl: 'https://example.com',
      fetch: async () => new Response(null, { status: 503 }),
      retryPolicy: 'none',
    });

    await expect(
      emptyClient.get({ url: '/test', throwOnError: true })
    ).rejects.toMatchObject({ code: 503, message: 'HTTP 503' });
  });

  it('keeps the decoded body in non-throwing results', async () => {
    const result = await client.get({ url: '/test' });

    expect(result.error).toEqual({ error: 'Forbidden project' });
  });
});

describe('batch helpers', () => {
  it('uses chunk-100 by default and preserves item order', async () => {
    const items = Array.from({ length: 205 }, (_, index) => index);
    const batches = createBatches(items);
    const result = await processBatches(items, async (batch) => batch);

    expect(batches.map(({ length }) => length)).toEqual([100, 100, 5]);
    expect(result).toEqual(items);
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
    expect(result).toEqual(items);
  });
});

describe('awaitJobs', () => {
  type JobsQuery = { jobs: Array<{ id: string }> };

  function createJobsClient(
    getResults: (ids: string[]) => Array<{ id: string; status: string }>,
    config: { apiVersion?: '2026-03-06.v1' } = {}
  ) {
    const requests: Request[] = [];
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const request = new Request(input);
        requests.push(request);
        const body = (await request.clone().json()) as JobsQuery;
        return Response.json({
          results: getResults(body.jobs.map(({ id }) => id)),
        });
      });
    const client = createApiClient({
      ...config,
      baseUrl: 'https://example.com',
      fetch: fetchMock,
      retryPolicy: 'none',
    });
    const readBodies = () =>
      Promise.all(
        requests.map(
          async (request) => (await request.clone().json()) as JobsQuery
        )
      );
    return { client, readBodies, requests };
  }

  it('polls queryJobs for the project through a configured client', async () => {
    const { client, readBodies, requests } = createJobsClient((ids) =>
      ids.map((id) => ({ id, status: 'completed' }))
    );

    const result = await awaitJobs(client, 'project-id', ['one']);

    expect(result).toEqual({
      complete: true,
      jobs: [{ id: 'one', status: 'completed' }],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(
      'https://example.com/v2/projects/project-id/jobs/query'
    );
    expect(requests[0].method).toBe('POST');
    expect(requests[0].headers.get('gt-api-version')).toBe(API_VERSION);
    expect(requests[0].headers.has('gt-project-id')).toBe(false);
    expect(await readBodies()).toEqual([{ jobs: [{ id: 'one' }] }]);
  });

  it('polls with the pinned API_VERSION even when the client has another apiVersion', async () => {
    const { client, requests } = createJobsClient(
      (ids) => ids.map((id) => ({ id, status: 'completed' })),
      { apiVersion: '2026-03-06.v1' }
    );

    await awaitJobs(client, 'project-id', ['one']);

    expect(requests[0].headers.get('gt-api-version')).toBe(API_VERSION);
  });

  it('queries more than 100 jobs in batches of 100, in order', async () => {
    const jobIds = Array.from({ length: 205 }, (_, index) => `job-${index}`);
    const { client, readBodies } = createJobsClient((ids) =>
      ids.map((id) => ({ id, status: 'completed' }))
    );

    const result = await awaitJobs(client, 'project-id', jobIds);

    const bodies = await readBodies();
    expect(bodies.map(({ jobs }) => jobs.length)).toEqual([100, 100, 5]);
    expect(bodies.flatMap(({ jobs }) => jobs.map(({ id }) => id))).toEqual(
      jobIds
    );
    expect(result.complete).toBe(true);
    expect(result.jobs.map(({ id }) => id)).toEqual(jobIds);
  });

  it('sends each duplicated job ID once', async () => {
    const { client, readBodies } = createJobsClient((ids) =>
      ids.map((id) => ({ id, status: 'completed' }))
    );

    const result = await awaitJobs(client, 'project-id', ['one', 'one']);

    expect(await readBodies()).toEqual([{ jobs: [{ id: 'one' }] }]);
    expect(result.jobs).toEqual([{ id: 'one', status: 'completed' }]);
  });

  // The first batch of 100 answers; the second (job-100) answers with `failBatch`.
  function createMixedBatchClient(
    failBatch: (request: Request) => Promise<Response>
  ) {
    return createApiClient({
      baseUrl: 'https://example.com',
      fetch: async (input) => {
        const request = new Request(input);
        const { jobs } = (await request.clone().json()) as JobsQuery;
        if (jobs.length < 100) return failBatch(request);
        return Response.json({
          results: jobs.map(({ id }) => ({ id, status: 'completed' })),
        });
      },
      retryPolicy: 'none',
    });
  }
  const jobIds101 = Array.from({ length: 101 }, (_, index) => `job-${index}`);

  it('keeps the statuses of batches that loaded when another batch fails at the deadline', async () => {
    const client = createMixedBatchClient(
      (request) =>
        new Promise((_, reject) => {
          request.signal.addEventListener('abort', () =>
            // Settle after the deadline, not on the timer's edge.
            setTimeout(() => reject(request.signal.reason), 10)
          );
        })
    );

    const onPoll = vi.fn();
    const result = await awaitJobs(client, 'project-id', jobIds101, {
      timeoutSeconds: 0.05,
      onPoll,
    });

    expect(result.complete).toBe(false);
    expect(result.jobs).toEqual([
      ...jobIds101.slice(0, 100).map((id) => ({ id, status: 'completed' })),
      { id: 'job-100', status: 'unknown' },
    ]);
    expect(onPoll.mock.calls).toEqual([
      [jobIds101.slice(0, 100).map((id) => ({ id, status: 'completed' }))],
    ]);
  });

  it('throws an error from one batch while another batch runs into the deadline', async () => {
    const client = createApiClient({
      baseUrl: 'https://example.com',
      fetch: async (input) => {
        const request = new Request(input);
        const { jobs } = (await request.clone().json()) as JobsQuery;
        if (jobs.length < 100) {
          return Response.json({ error: 'boom' }, { status: 500 });
        }
        return new Promise((_, reject) => {
          request.signal.addEventListener('abort', () =>
            setTimeout(() => reject(request.signal.reason), 10)
          );
        });
      },
      retryPolicy: 'none',
    });

    await expect(
      awaitJobs(client, 'project-id', jobIds101, { timeoutSeconds: 0.05 })
    ).rejects.toThrow('boom');
  });

  it('throws when a batch fails before the deadline', async () => {
    const client = createMixedBatchClient(async () =>
      Response.json({ error: 'boom' }, { status: 500 })
    );

    await expect(awaitJobs(client, 'project-id', jobIds101)).rejects.toThrow(
      'boom'
    );
  });

  it('reports each poll through onPoll until every job is terminal', async () => {
    const statuses = ['processing', 'completed'];
    const { client, requests } = createJobsClient((ids) =>
      ids.map((id) => ({ id, status: statuses[requests.length - 1] }))
    );
    const onPoll = vi.fn();

    const result = await awaitJobs(client, 'project-id', ['one'], {
      onPoll,
      pollingIntervalSeconds: 0,
    });

    expect(onPoll.mock.calls).toEqual([
      [[{ id: 'one', status: 'processing' }]],
      [[{ id: 'one', status: 'completed' }]],
    ]);
    expect(result).toEqual({
      complete: true,
      jobs: [{ id: 'one', status: 'completed' }],
    });
  });

  it('treats not_found as terminal', async () => {
    const { client, requests } = createJobsClient((ids) =>
      ids.map((id) => ({ id, status: 'not_found' }))
    );

    const result = await awaitJobs(client, 'project-id', ['one'], {
      pollingIntervalSeconds: 0,
    });

    expect(result).toEqual({
      complete: true,
      jobs: [{ id: 'one', status: 'not_found' }],
    });
    expect(requests).toHaveLength(1);
  });

  it('reports never-polled jobs as unknown when the deadline expires', async () => {
    const { client, requests } = createJobsClient(() => []);

    const result = await awaitJobs(client, 'project-id', ['one'], {
      timeoutSeconds: 0,
    });

    expect(result).toEqual({
      complete: false,
      jobs: [{ id: 'one', status: 'unknown' }],
    });
    expect(requests).toHaveLength(0);
  });

  it('ignores a response that arrives after the deadline', async () => {
    const client = createApiClient({
      baseUrl: 'https://example.com',
      fetch: () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                Response.json({ results: [{ id: 'one', status: 'completed' }] })
              ),
            30
          )
        ),
      retryPolicy: 'none',
    });

    const result = await awaitJobs(client, 'project-id', ['one'], {
      timeoutSeconds: 0.01,
    });

    expect(result).toEqual({
      complete: false,
      jobs: [{ id: 'one', status: 'unknown' }],
    });
  });

  it('throws when the response has no result for a requested job', async () => {
    const { client } = createJobsClient(() => [
      { id: 'one', status: 'completed' },
    ]);

    await expect(
      awaitJobs(client, 'project-id', ['one', 'two'], {
        pollingIntervalSeconds: 0,
      })
    ).rejects.toThrow('Job status response has no result for job IDs: two');
  });

  it('completes without a request for an empty job list', async () => {
    const { client, requests } = createJobsClient(() => []);

    await expect(awaitJobs(client, 'project-id', [])).resolves.toEqual({
      complete: true,
      jobs: [],
    });
    expect(requests).toHaveLength(0);
  });
});

describe('paginate', () => {
  const project = (id: string) => ({ id, name: id, orgId: 'o', orgName: 'O' });

  function createListClient(pages: Record<string, unknown>) {
    const urls: URL[] = [];
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const url = new URL(new Request(input).url);
        urls.push(url);
        return Response.json(pages[url.searchParams.get('cursor') ?? '']);
      });
    const client = createApiClient({
      baseUrl: 'https://example.com',
      fetch: fetchMock,
      retryPolicy: 'none',
    });
    return { client, urls };
  }

  it('follows nextCursor and forwards the other query options', async () => {
    const { client, urls } = createListClient({
      '': { items: [project('p1'), project('p2')], nextCursor: 'c1' },
      c1: { items: [project('p3')], nextCursor: null },
    });
    const ids: string[] = [];

    for await (const item of paginate(listProjects, {
      client,
      query: { limit: 2 },
    })) {
      ids.push(item.id);
    }

    expect(ids).toEqual(['p1', 'p2', 'p3']);
    expect(urls.map((url) => url.search)).toEqual([
      '?limit=2',
      '?limit=2&cursor=c1',
    ]);
  });

  it('resumes from a supplied cursor', async () => {
    const { client, urls } = createListClient({
      c1: { items: [project('p3')], nextCursor: null },
    });
    const ids: string[] = [];

    for await (const item of paginate(listProjects, {
      client,
      query: { cursor: 'c1' },
    })) {
      ids.push(item.id);
    }

    expect(ids).toEqual(['p3']);
    expect(urls.map((url) => url.searchParams.get('cursor'))).toEqual(['c1']);
  });

  it('requests the next page only when iteration continues', async () => {
    const { client, urls } = createListClient({
      '': { items: [project('p1')], nextCursor: 'c1' },
    });

    for await (const item of paginate(listProjects, { client })) {
      expect(item.id).toBe('p1');
      break;
    }

    expect(urls).toHaveLength(1);
  });

  it('throws an ApiError when a page request fails', async () => {
    const client = createApiClient({
      baseUrl: 'https://example.com',
      fetch: async () => Response.json({ error: 'nope' }, { status: 403 }),
      retryPolicy: 'none',
    });

    await expect(paginate(listProjects, { client }).next()).rejects.toEqual(
      new ApiError('nope', 403)
    );
  });
});
