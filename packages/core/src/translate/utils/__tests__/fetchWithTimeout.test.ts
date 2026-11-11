import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout } from '../fetchWithTimeout';
import { translationTimeoutError } from '../../../logging/errors';
import { defaultTimeout } from '../../../settings/settings';

const url = 'https://api.example.com/test';
const nativeFetch = globalThis.fetch;
const mockFetch = vi.fn();

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

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('requests', () => {
    it.each([
      ['a string', url],
      ['a URL', new URL(url)],
      ['a Request', new Request(url, { method: 'POST' })],
    ])('passes %s and its options to global fetch', async (_name, input) => {
      const response = new Response();
      mockFetch.mockResolvedValue(response);
      const options = { method: 'POST', body: 'test data' };

      await expect(fetchWithTimeout(input, options, 5000)).resolves.toBe(
        response
      );
      expect(mockFetch).toHaveBeenCalledWith(input, {
        ...options,
        signal: expect.any(AbortSignal),
      });
    });

    it('calls a custom fetch implementation instead of the global fetch', async () => {
      const response = new Response();
      const customFetch = vi.fn<typeof fetch>().mockResolvedValue(response);

      await expect(
        fetchWithTimeout(url, { method: 'GET' }, undefined, customFetch)
      ).resolves.toBe(response);
      expect(customFetch).toHaveBeenCalledWith(url, {
        method: 'GET',
        signal: expect.any(AbortSignal),
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it.each([
      ['the options', (signal: AbortSignal) => [url, { signal }] as const],
      [
        'a Request',
        (signal: AbortSignal) => [new Request(url, { signal }), {}] as const,
      ],
    ])('composes the caller signal from %s', async (_name, args) => {
      mockFetch.mockResolvedValue(new Response());
      const caller = new AbortController();

      await fetchWithTimeout(...args(caller.signal));

      const signal = mockFetch.mock.calls[0][1].signal as AbortSignal;
      expect(signal.aborted).toBe(false);
      caller.abort();
      expect(signal.aborted).toBe(true);
    });

    it.each([
      ['an Error', new TypeError('Invalid URL')],
      ['a non-Error value', 'String error'],
    ])('propagates %s rejected by fetch untouched', async (_name, error) => {
      mockFetch.mockRejectedValue(error);

      await expect(fetchWithTimeout(url, { method: 'GET' })).rejects.toBe(
        error
      );
    });
  });

  describe('timeouts', () => {
    it.each([
      ['a numeric timeout', 3000, 3000],
      ['the default timeout', undefined, defaultTimeout],
      ['a literal zero, not the default', 0, 0],
    ])(
      'rejects with a timeout error after %s',
      async (_name, timeoutMs, elapsed) => {
        vi.useFakeTimers();
        mockSignalDrivenFetch();

        const rejection = expect(
          fetchWithTimeout(url, { method: 'GET' }, timeoutMs)
        ).rejects.toBe(translationTimeoutError(elapsed));
        await vi.advanceTimersByTimeAsync(elapsed);

        await rejection;
      }
    );

    it('converts the SDK abort reason from native fetch into a timeout', async () => {
      vi.useFakeTimers();
      const rejection = expect(
        fetchWithTimeout('data:text/plain,hello', {}, 3000, nativeFetch)
      ).rejects.toBe(translationTimeoutError(3000));
      // Abort before native fetch's response microtask settles the data URL.
      vi.advanceTimersByTime(3000);

      await rejection;
    });

    it('does not start a timer when the timeout is false', async () => {
      vi.useFakeTimers();
      const response = new Response();
      mockFetch.mockImplementation(
        (_url, init) =>
          new Promise<Response>((resolve, reject) => {
            init.signal.addEventListener('abort', () =>
              reject(init.signal.reason)
            );
            setTimeout(() => resolve(response), defaultTimeout * 2);
          })
      );

      const pending = fetchWithTimeout(url, { method: 'GET' }, false);
      await vi.advanceTimersByTimeAsync(defaultTimeout * 2);

      await expect(pending).resolves.toBe(response);
    });
  });

  describe('cancellations that are not timeouts', () => {
    it.each([3000, false] as const)(
      'propagates a fetch-owned AbortError untouched with timeout %s',
      async (timeoutMs) => {
        const abortError = createAbortError();
        mockFetch.mockRejectedValue(abortError);

        await expect(
          fetchWithTimeout(url, { method: 'GET' }, timeoutMs)
        ).rejects.toBe(abortError);
      }
    );

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
    });

    it('propagates a caller abort untouched when the fetch rejects only after the timer fires', async () => {
      vi.useFakeTimers();
      mockSignalDrivenFetch(5000);
      const callerController = new AbortController();
      const callerError = createAbortError();

      const rejection = expect(
        fetchWithTimeout(
          url,
          { method: 'GET', signal: callerController.signal },
          3000
        )
      ).rejects.toBe(callerError);
      callerController.abort(callerError);
      await vi.advanceTimersByTimeAsync(5000);

      await rejection;
    });
  });
});
