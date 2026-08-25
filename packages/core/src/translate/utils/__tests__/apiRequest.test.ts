import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, translate } from '@generaltranslation/api';

import { apiRequest } from '../apiRequest';
import { fetchWithTimeout } from '../fetchWithTimeout';
import { validateResponse } from '../validateResponse';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  createApiClient: vi.fn(),
  translate: vi.fn(),
}));
vi.mock('../fetchWithTimeout');
vi.mock('../validateResponse');

const config = {
  projectId: 'project-id',
  apiKey: 'api-key',
};

function createResponse(overrides: Partial<Response> = {}): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: vi.fn().mockResolvedValue({ success: true }),
    text: vi.fn(),
    ...overrides,
  } as unknown as Response;
}

describe.sequential('apiRequest', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(validateResponse).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('routes runtime translation through the SDK without retries', async () => {
    const client = {} as ReturnType<typeof createApiClient>;
    vi.mocked(createApiClient).mockReturnValue(client);
    vi.mocked(translate).mockResolvedValue({
      data: { hash: { success: false, error: 'failed', code: 500 } },
      request: {} as Request,
      response: createResponse(),
    });

    await expect(
      apiRequest(
        { ...config, baseUrl: 'https://runtime.example.com' },
        '/v2/translate',
        {
          body: {
            requests: {},
            sourceLocale: 'en',
            targetLocale: 'es',
            metadata: {},
          },
          retryPolicy: 'none',
        }
      )
    ).resolves.toHaveProperty('hash');

    expect(createApiClient).toHaveBeenCalledWith({
      apiKey: 'api-key',
      baseUrl: 'https://runtime.example.com',
      fetch: expect.any(Function),
      projectId: 'project-id',
      retryPolicy: 'none',
    });
    expect(translate).toHaveBeenCalledWith(
      expect.objectContaining({ client, body: expect.any(Object) })
    );
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  it('preserves runtime translation API error details', async () => {
    vi.mocked(createApiClient).mockReturnValue(
      {} as ReturnType<typeof createApiClient>
    );
    vi.mocked(translate).mockResolvedValue({
      data: undefined,
      error: { error: 'invalid translation request' },
      request: {} as Request,
      response: createResponse({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      }),
    });

    await expect(
      apiRequest(config, '/v2/translate', { body: {} })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 400,
        message: 'invalid translation request',
      })
    );
    expect(validateResponse).not.toHaveBeenCalled();
  });

  it('retries 429 responses after the rate limit window', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const rateLimitedResponse = createResponse({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });
    const successResponse = createResponse();

    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(rateLimitedResponse)
      .mockResolvedValueOnce(successResponse);

    const request = apiRequest(config, '/test');

    await Promise.resolve();

    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);

    await vi.runOnlyPendingTimersAsync();
    await expect(request).resolves.toEqual({ success: true });

    expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
    expect(validateResponse).toHaveBeenCalledWith(successResponse);
    expect(validateResponse).not.toHaveBeenCalledWith(rateLimitedResponse);
  });

  it('uses RateLimit-Reset as the 429 retry delay when present', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const rateLimitedResponse = createResponse({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers({ 'RateLimit-Reset': '12' }),
    });
    const successResponse = createResponse();

    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(rateLimitedResponse)
      .mockResolvedValueOnce(successResponse);

    const request = apiRequest(config, '/test');

    await Promise.resolve();

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 12_000);

    await vi.runOnlyPendingTimersAsync();
    await expect(request).resolves.toEqual({ success: true });
  });

  it('uses Retry-After before RateLimit-Reset for 429 retry timing', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const rateLimitedResponse = createResponse({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers({
        'RateLimit-Reset': '12',
        'Retry-After': '8',
      }),
    });
    const successResponse = createResponse();

    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(rateLimitedResponse)
      .mockResolvedValueOnce(successResponse);

    const request = apiRequest(config, '/test');

    await Promise.resolve();

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 8_000);

    await vi.runOnlyPendingTimersAsync();
    await expect(request).resolves.toEqual({ success: true });
  });

  it('falls back to the rate limit window for invalid 429 retry headers', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const rateLimitedResponse = createResponse({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers({
        'RateLimit-Reset': 'later',
        'Retry-After': 'later',
      }),
    });
    const successResponse = createResponse();

    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(rateLimitedResponse)
      .mockResolvedValueOnce(successResponse);

    const request = apiRequest(config, '/test');

    await Promise.resolve();

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);

    await vi.runOnlyPendingTimersAsync();
    await expect(request).resolves.toEqual({ success: true });
  });

  it('does not retry 429 responses when retries are disabled', async () => {
    const rateLimitedResponse = createResponse({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });
    const rateLimitError = new Error('rate limited');

    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(rateLimitedResponse);
    vi.mocked(validateResponse).mockRejectedValueOnce(rateLimitError);

    await expect(
      apiRequest(config, '/test', { retryPolicy: 'none' })
    ).rejects.toThrow(rateLimitError);

    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(validateResponse).toHaveBeenCalledWith(rateLimitedResponse);
  });

  it('surfaces the final 429 validation error after exhausting retries', async () => {
    vi.useFakeTimers();

    const rateLimitedResponses = Array.from({ length: 4 }, () =>
      createResponse({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      })
    );
    const rateLimitError = new Error('rate limited');

    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(rateLimitedResponses[0])
      .mockResolvedValueOnce(rateLimitedResponses[1])
      .mockResolvedValueOnce(rateLimitedResponses[2])
      .mockResolvedValueOnce(rateLimitedResponses[3]);
    vi.mocked(validateResponse).mockRejectedValueOnce(rateLimitError);

    const request = apiRequest(config, '/test');
    const expectation = expect(request).rejects.toThrow(rateLimitError);

    await vi.runAllTimersAsync();
    await expectation;

    expect(fetchWithTimeout).toHaveBeenCalledTimes(4);
    expect(validateResponse).toHaveBeenCalledTimes(1);
    expect(validateResponse).toHaveBeenCalledWith(rateLimitedResponses[3]);
  });
});
