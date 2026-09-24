import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout } from '../fetchWithTimeout.js';
import { defaultTimeout } from '../../../settings/settings.js';

// Mock dependencies
const mockTranslationTimeoutError = vi.hoisted(() => vi.fn());
vi.mock('../../../logging/errors.js', () => ({
  translationTimeoutError: mockTranslationTimeoutError,
}));

vi.mock('../../../settings/settings.js', () => ({
  defaultTimeout: 60000,
}));

// Mock global fetch
const nativeFetch = globalThis.fetch;
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe.sequential('fetchWithTimeout', () => {
  // Common mock data factories
  const createMockResponse = (overrides: Partial<Response> = {}): Response => {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      body: null,
      bodyUsed: false,
      arrayBuffer: vi.fn(),
      blob: vi.fn(),
      clone: vi.fn(),
      formData: vi.fn(),
      json: vi.fn(),
      text: vi.fn(),
      url: 'https://api.example.com/test',
      redirected: false,
      type: 'basic',
      ...overrides,
    } as Response;
  };

  const createAbortError = (): Error => {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    return error;
  };

  // A fetch that never resolves and rejects with the composed signal's reason
  // once it aborts, optionally after a delay like a slow custom fetch.
  const mockSignalDrivenFetch = (rejectDelayMs?: number) =>
    mockFetch.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const rejectWithReason = () => reject(init.signal.reason);
            if (rejectDelayMs === undefined) rejectWithReason();
            else setTimeout(rejectWithReason, rejectDelayMs);
          });
        })
    );

  beforeEach(() => {
    vi.clearAllMocks();
    mockTranslationTimeoutError.mockReturnValue('Mocked timeout error');
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('successful requests', () => {
    it('should make successful fetch request without timeout', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      const result = await fetchWithTimeout('https://api.example.com/test', {
        method: 'GET',
      });

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
        method: 'GET',
        signal: expect.any(AbortSignal),
      });
      expect(result).toBe(mockResponse);
    });

    it('should make successful fetch request with custom timeout', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      const result = await fetchWithTimeout(
        'https://api.example.com/test',
        { method: 'POST', body: 'test data' },
        5000
      );

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
        method: 'POST',
        body: 'test data',
        signal: expect.any(AbortSignal),
      });
      expect(result).toBe(mockResponse);
    });

    it('should handle URL object as input', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);
      const url = new URL('https://api.example.com/test');

      const result = await fetchWithTimeout(url, { method: 'GET' });

      expect(mockFetch).toHaveBeenCalledWith(url, {
        method: 'GET',
        signal: expect.any(AbortSignal),
      });
      expect(result).toBe(mockResponse);
    });

    it('should handle Request object as input', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);
      const request = new Request('https://api.example.com/test', {
        method: 'POST',
      });

      const result = await fetchWithTimeout(request, { method: 'GET' });

      expect(mockFetch).toHaveBeenCalledWith(request, {
        method: 'GET',
        signal: expect.any(AbortSignal),
      });
      expect(result).toBe(mockResponse);
    });
  });

  describe('timeout behavior', () => {
    it('should use defaultTimeout when no timeout provided', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      const result = await fetchWithTimeout('https://api.example.com/test', {
        method: 'GET',
      });

      expect(result).toBe(mockResponse);
    });

    it('should limit timeout to defaultTimeout when provided timeout exceeds it', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      const customTimeout = (defaultTimeout as number) + 10000; // Exceeds defaultTimeout
      const result = await fetchWithTimeout(
        'https://api.example.com/test',
        { method: 'GET' },
        customTimeout
      );

      expect(result).toBe(mockResponse);
    });

    it('throws translationTimeoutError when the numeric timer aborts the fetch', async () => {
      vi.useFakeTimers();
      mockSignalDrivenFetch();

      const rejection = expect(
        fetchWithTimeout(
          'https://api.example.com/test',
          { method: 'GET' },
          3000
        )
      ).rejects.toBe('Mocked timeout error');
      await vi.advanceTimersByTimeAsync(3000);

      await rejection;
      expect(mockTranslationTimeoutError).toHaveBeenCalledWith(3000);
    });

    it('converts the SDK abort reason from native fetch into a timeout', async () => {
      vi.useFakeTimers();
      const pending = fetchWithTimeout(
        'data:text/plain,hello',
        {},
        3000,
        nativeFetch
      );
      const rejection = expect(pending).rejects.toBe('Mocked timeout error');
      // Abort before native fetch's response microtask settles the data URL.
      vi.advanceTimersByTime(3000);

      await rejection;
      expect(mockTranslationTimeoutError).toHaveBeenCalledWith(3000);
    });

    it('throws translationTimeoutError when the default timer aborts the fetch', async () => {
      vi.useFakeTimers();
      mockSignalDrivenFetch();

      const rejection = expect(
        fetchWithTimeout('https://api.example.com/test', { method: 'GET' })
      ).rejects.toBe('Mocked timeout error');
      await vi.advanceTimersByTimeAsync(defaultTimeout);

      await rejection;
      expect(mockTranslationTimeoutError).toHaveBeenCalledWith(defaultTimeout);
    });

    it('propagates a fetch-owned AbortError untouched when the timer has not fired', async () => {
      const abortError = createAbortError();
      mockFetch.mockRejectedValue(abortError);

      await expect(
        fetchWithTimeout(
          'https://api.example.com/test',
          { method: 'GET' },
          3000
        )
      ).rejects.toBe(abortError);
      expect(mockTranslationTimeoutError).not.toHaveBeenCalled();
    });

    it('preserves a private native cancellation through cleanup past the SDK deadline', async () => {
      vi.useFakeTimers();
      const privateController = new AbortController();
      const customFetch: typeof fetch = async (input, init) => {
        const pending = nativeFetch(input, {
          ...init,
          signal: AbortSignal.any([
            privateController.signal,
            new Request(input, init).signal,
          ]),
        });
        privateController.abort();
        try {
          return await pending;
        } finally {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      };

      const pending = fetchWithTimeout(
        'data:text/plain,hello',
        {},
        3000,
        customFetch
      );
      await Promise.all([
        expect(pending).rejects.toBe(privateController.signal.reason),
        vi.advanceTimersByTimeAsync(5000),
      ]);
      expect(mockTranslationTimeoutError).not.toHaveBeenCalled();
    });

    it('propagates a caller abort untouched when the fetch rejects only after the timer fires', async () => {
      vi.useFakeTimers();
      mockSignalDrivenFetch(5000);
      const callerController = new AbortController();
      const callerError = createAbortError();

      const rejection = expect(
        fetchWithTimeout(
          'https://api.example.com/test',
          { method: 'GET', signal: callerController.signal },
          3000
        )
      ).rejects.toBe(callerError);
      callerController.abort(callerError);
      await vi.advanceTimersByTimeAsync(5000);

      await rejection;
      expect(mockTranslationTimeoutError).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should propagate non-AbortError errors', async () => {
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      mockFetch.mockRejectedValue(networkError);

      await expect(
        fetchWithTimeout('https://api.example.com/test', { method: 'GET' })
      ).rejects.toThrow('Network error');

      expect(mockTranslationTimeoutError).not.toHaveBeenCalled();
    });

    it('should handle TypeError (e.g., invalid URL)', async () => {
      const typeError = new TypeError('Invalid URL');
      mockFetch.mockRejectedValue(typeError);

      await expect(
        fetchWithTimeout('invalid-url', { method: 'GET' })
      ).rejects.toThrow('Invalid URL');

      expect(mockTranslationTimeoutError).not.toHaveBeenCalled();
    });

    it('should handle generic Error objects', async () => {
      const genericError = new Error('Generic error');
      genericError.name = 'GenericError';
      mockFetch.mockRejectedValue(genericError);

      await expect(
        fetchWithTimeout('https://api.example.com/test', { method: 'GET' })
      ).rejects.toThrow('Generic error');

      expect(mockTranslationTimeoutError).not.toHaveBeenCalled();
    });

    it('should handle non-Error objects being thrown', async () => {
      const stringError = 'String error';
      mockFetch.mockRejectedValue(stringError);

      await expect(
        fetchWithTimeout('https://api.example.com/test', { method: 'GET' })
      ).rejects.toBe(stringError);

      expect(mockTranslationTimeoutError).not.toHaveBeenCalled();
    });
  });

  describe('request options', () => {
    it('should preserve RequestInit options and add signal', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      const options: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'data' }),
      };

      const result = await fetchWithTimeout(
        'https://api.example.com/test',
        options
      );

      expect(result).toBe(mockResponse);
      // Test that the function completed successfully with the expected response
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
    });

    it('composes the caller signal with its timeout signal', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      const existingController = new AbortController();
      await fetchWithTimeout('https://api.example.com/test', {
        method: 'GET',
        signal: existingController.signal,
      });

      const signal = mockFetch.mock.calls[0][1].signal as AbortSignal;
      expect(signal.aborted).toBe(false);
      existingController.abort();
      expect(signal.aborted).toBe(true);
    });

    it('composes a Request signal with its timeout signal', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      const existingController = new AbortController();
      const request = new Request('https://api.example.com/test', {
        signal: existingController.signal,
      });
      await fetchWithTimeout(request, { method: 'GET' });

      const signal = mockFetch.mock.calls[0][1].signal as AbortSignal;
      expect(signal.aborted).toBe(false);
      existingController.abort();
      expect(signal.aborted).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('treats an explicit timeout of 0 as a literal zero, not the default', async () => {
      vi.useFakeTimers();
      mockSignalDrivenFetch();

      const rejection = expect(
        fetchWithTimeout('https://api.example.com/test', { method: 'GET' }, 0)
      ).rejects.toBe('Mocked timeout error');
      await vi.advanceTimersByTimeAsync(0);

      await rejection;
      expect(mockTranslationTimeoutError).toHaveBeenCalledWith(0);
    });

    it('does not start a timer when the timeout is false', async () => {
      vi.useFakeTimers();
      const mockResponse = createMockResponse();
      mockFetch.mockImplementation(
        (_url, init) =>
          new Promise<Response>((resolve, reject) => {
            init.signal.addEventListener('abort', () =>
              reject(init.signal.reason)
            );
            setTimeout(() => resolve(mockResponse), defaultTimeout * 2);
          })
      );

      const pending = fetchWithTimeout(
        'https://api.example.com/test',
        { method: 'GET' },
        false
      );
      await vi.advanceTimersByTimeAsync(defaultTimeout * 2);

      await expect(pending).resolves.toBe(mockResponse);
      expect(mockTranslationTimeoutError).not.toHaveBeenCalled();
    });

    it('propagates caller cancellation untouched when the timeout is false', async () => {
      const abortError = createAbortError();
      mockFetch.mockRejectedValue(abortError);

      await expect(
        fetchWithTimeout(
          'https://api.example.com/test',
          { method: 'GET' },
          false
        )
      ).rejects.toBe(abortError);
      expect(mockTranslationTimeoutError).not.toHaveBeenCalled();
    });

    it('calls a custom fetch implementation instead of the global fetch', async () => {
      const mockResponse = createMockResponse();
      const customFetch = vi.fn<typeof fetch>().mockResolvedValue(mockResponse);

      const result = await fetchWithTimeout(
        'https://api.example.com/test',
        { method: 'GET' },
        undefined,
        customFetch
      );

      expect(result).toBe(mockResponse);
      expect(customFetch).toHaveBeenCalledWith('https://api.example.com/test', {
        method: 'GET',
        signal: expect.any(AbortSignal),
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle negative timeout values', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      const result = await fetchWithTimeout(
        'https://api.example.com/test',
        { method: 'GET' },
        -1000
      );

      expect(result).toBe(mockResponse);
    });

    it('should handle undefined timeout', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      const result = await fetchWithTimeout(
        'https://api.example.com/test',
        { method: 'GET' },
        undefined
      );

      expect(result).toBe(mockResponse);
    });
  });

  describe('AbortController integration', () => {
    it('should create AbortController and set signal', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      await fetchWithTimeout('https://api.example.com/test', { method: 'GET' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should respect timeout parameter in Math.min calculation', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      // Test with timeout less than defaultTimeout
      const smallTimeout = 5000;
      const result = await fetchWithTimeout(
        'https://api.example.com/test',
        { method: 'GET' },
        smallTimeout
      );

      expect(result).toBe(mockResponse);
    });
  });
});
