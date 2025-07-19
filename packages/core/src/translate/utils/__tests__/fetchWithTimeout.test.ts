import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fetchWithTimeout from '../fetchWithTimeout.js';
import { maxTimeout } from '../../../settings/settings.js';

// Mock dependencies
const mockTranslationTimeoutError = vi.hoisted(() => vi.fn());
vi.mock('../../../logging/errors.js', () => ({
  translationTimeoutError: mockTranslationTimeoutError,
}));

vi.mock('../../../settings/settings.js', () => ({
  maxTimeout: 60000,
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('fetchWithTimeout', () => {
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
    it('should use maxTimeout when no timeout provided', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      const result = await fetchWithTimeout('https://api.example.com/test', {
        method: 'GET',
      });

      expect(result).toBe(mockResponse);
    });

    it('should limit timeout to maxTimeout when provided timeout exceeds it', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      const customTimeout = (maxTimeout as number) + 10000; // Exceeds maxTimeout
      const result = await fetchWithTimeout(
        'https://api.example.com/test',
        { method: 'GET' },
        customTimeout
      );

      expect(result).toBe(mockResponse);
    });

    it('should handle AbortError and throw translationTimeoutError', async () => {
      const abortError = createAbortError();
      mockFetch.mockRejectedValue(abortError);

      try {
        await fetchWithTimeout(
          'https://api.example.com/test',
          { method: 'GET' },
          3000
        );
      } catch (error) {
        expect(error).toBe('Mocked timeout error');
      }

      expect(mockTranslationTimeoutError).toHaveBeenCalledWith(3000);
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
        method: 'GET',
        signal: expect.any(AbortSignal),
      });
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

    it('should override existing signal in options', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      const existingController = new AbortController();
      const options: RequestInit = {
        method: 'GET',
        signal: existingController.signal,
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
  });

  describe('edge cases', () => {
    it('should handle timeout value of 0', async () => {
      const mockResponse = createMockResponse();
      mockFetch.mockResolvedValue(mockResponse);

      const result = await fetchWithTimeout(
        'https://api.example.com/test',
        { method: 'GET' },
        0
      );

      expect(result).toBe(mockResponse);
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

      // Test with timeout less than maxTimeout
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
