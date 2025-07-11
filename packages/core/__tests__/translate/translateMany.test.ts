import { describe, it, expect, vi, beforeEach } from 'vitest';
import _translateMany from '../../src/translate/translateMany';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import { TranslationRequestConfig, TranslateManyResult } from '../../src/types';
import { GTRequestMetadata, GTRequest } from '../../src/types/GTRequest';

// Mock Response interface for testing
interface MockResponse {
  ok: boolean;
  json: () => Promise<
    TranslateManyResult | { translations: []; reference: [] }
  >;
}

// Mock the fetch utilities and validators
vi.mock('../../src/utils/fetchWithTimeout', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/translate/utils/validateConfig', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/translate/utils/validateResponse', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/translate/utils/handleFetchError', () => ({
  default: vi.fn((error: unknown) => {
    throw error;
  }),
}));

describe('_translateMany function', () => {
  const mockFetch = vi.mocked(fetchWithTimeout);
  const mockConfig: TranslationRequestConfig = {
    projectId: 'test-project',
    apiKey: 'test-key',
    baseUrl: 'https://api.test.com',
    timeout: 5000,
  };

  const mockTranslateManyResult: TranslateManyResult = {
    translations: [
      {
        translation: 'Hola mundo',
        reference: {
          id: 'test-id-1',
          key: 'test-key-1',
        },
      },
      {
        translation: 'Adiós mundo',
        reference: {
          id: 'test-id-2',
          key: 'test-key-2',
        },
      },
    ],
    reference: [
      {
        id: 'test-id-1',
        key: 'test-key-1',
      },
      {
        id: 'test-id-2',
        key: 'test-key-2',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should make correct API call with multiple requests', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockTranslateManyResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const requests = [
      {
        source: 'Hello world',
        metadata: { context: 'greeting' },
      },
      {
        source: 'Goodbye world',
        metadata: { context: 'farewell' },
      },
    ];

    const globalMetadata: { targetLocale: string } & GTRequestMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    const result = await _translateMany(requests, globalMetadata, mockConfig);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/translate/test-project',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-key',
        },
        body: JSON.stringify({
          requests,
          targetLocale: 'es',
          metadata: globalMetadata,
        }),
      },
      5000
    );

    expect(result).toEqual(mockTranslateManyResult);
  });

  it('should handle JSX and ICU mixed requests', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockTranslateManyResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const requests = [
      {
        source: ['Hello ', { t: 'strong', c: ['world'] }],
        metadata: { context: 'greeting', dataFormat: 'JSX' },
      },
      {
        source: 'Hello {name}',
        metadata: { context: 'greeting', dataFormat: 'ICU' },
      },
    ];

    const globalMetadata: { targetLocale: string } & GTRequestMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    const result = await _translateMany(requests, globalMetadata, mockConfig);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/translate/test-project',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-key',
        },
        body: JSON.stringify({
          requests,
          targetLocale: 'es',
          metadata: globalMetadata,
        }),
      },
      5000
    );

    expect(result).toEqual(mockTranslateManyResult);
  });

  it('should handle timeout configuration', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockTranslateManyResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const configWithTimeout: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-key',
      timeout: 10000,
    };

    const requests = [
      {
        source: 'Hello world',
        metadata: { context: 'greeting' },
      },
    ];

    await _translateMany(requests, { targetLocale: 'es' }, configWithTimeout);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      10000
    );
  });

  it('should handle network errors', async () => {
    const networkError = new Error('Network error');
    mockFetch.mockRejectedValue(networkError);

    const requests = [
      {
        source: 'Hello world',
        metadata: { context: 'greeting' },
      },
    ];

    await expect(
      _translateMany(requests, { targetLocale: 'es' }, mockConfig)
    ).rejects.toThrow('Network error');
  });

  it('should handle timeout errors', async () => {
    const timeoutError = new Error('Request timeout');
    timeoutError.name = 'AbortError';
    mockFetch.mockRejectedValue(timeoutError);

    const requests = [
      {
        source: 'Hello world',
        metadata: { context: 'greeting' },
      },
    ];

    await expect(
      _translateMany(requests, { targetLocale: 'es' }, mockConfig)
    ).rejects.toThrow();
  });

  it('should handle empty requests array', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ translations: [], reference: [] }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const requests = [];

    const result = await _translateMany(
      requests,
      { targetLocale: 'es' },
      mockConfig
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          requests: [],
          targetLocale: 'es',
          metadata: { targetLocale: 'es' },
        }),
      }),
      expect.any(Number)
    );

    expect(result).toEqual({ translations: [], reference: [] });
  });
});
