import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from '../apiRequest';
import { fetchWithTimeout } from '../fetchWithTimeout';
import { validateResponse } from '../validateResponse';
import { defaultTimeout } from '../../../settings/settings';
import { API_VERSION } from '../../api';

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

  it('does not retry failed organization-scoped requests', async () => {
    const serverErrorResponse = createResponse({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    const serverError = new Error('server error');

    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(serverErrorResponse);
    vi.mocked(validateResponse).mockRejectedValueOnce(serverError);

    await expect(
      apiRequest(
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'gtx-org-test-key',
        },
        '/v2/projects',
        {
          body: { name: 'Customer Portal', defaultLocale: 'en-US' },
          retryPolicy: 'none',
        }
      )
    ).rejects.toThrow(serverError);

    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/projects',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer gtx-org-test-key',
          'gt-api-version': API_VERSION,
        },
        body: JSON.stringify({
          name: 'Customer Portal',
          defaultLocale: 'en-US',
        }),
      },
      defaultTimeout
    );
    expect(validateResponse).toHaveBeenCalledWith(serverErrorResponse);
  });

  it('does not retry organization-scoped requests after response loss', async () => {
    const networkError = new Error('response lost');
    vi.mocked(fetchWithTimeout).mockRejectedValueOnce(networkError);

    await expect(
      apiRequest(
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'gtx-org-test-key',
        },
        '/v2/projects',
        {
          body: { name: 'Customer Portal', defaultLocale: 'en-US' },
          retryPolicy: 'none',
        }
      )
    ).rejects.toThrow(networkError);

    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(validateResponse).not.toHaveBeenCalled();
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
