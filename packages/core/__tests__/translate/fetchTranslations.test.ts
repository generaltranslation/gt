import { describe, it, expect, vi, beforeEach } from 'vitest';
import _fetchTranslations, {
  FetchTranslationsOptions,
  FetchTranslationsResult,
  RetrievedTranslations,
} from '../../src/translate/fetchTranslations';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import { TranslationRequestConfig } from '../../src/types';

// Mock Response interface for testing
interface MockResponse {
  ok: boolean;
  json: () => Promise<{
    translations: RetrievedTranslations;
    versionId: string;
    projectId: string;
    metadata?: {
      localeCount?: number;
      totalEntries?: number;
    };
  }>;
}

// Mock the fetch utilities and validators
vi.mock('../../src/utils/fetchWithTimeout', () => ({
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

describe('_fetchTranslations function', () => {
  const mockFetch = vi.mocked(fetchWithTimeout);
  const mockConfig: TranslationRequestConfig = {
    projectId: 'test-project',
    apiKey: 'test-key',
    baseUrl: 'https://api.test.com',
    timeout: 5000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    mockFetch.mockClear();
  });

  it('should make correct API call and fetch translations successfully', async () => {
    const mockResult = {
      translations: [
        {
          locale: 'es',
          translation: {
            greeting: 'Hola mundo',
            farewell: 'Adiós mundo',
          },
          metadata: {
            completedAt: '2023-01-01T00:00:00Z',
            status: 'completed',
          },
        },
        {
          locale: 'fr',
          translation: {
            greeting: 'Bonjour le monde',
            farewell: 'Au revoir le monde',
          },
          metadata: {
            completedAt: '2023-01-01T00:00:00Z',
            status: 'completed',
          },
        },
      ],
      versionId: 'version-123',
      projectId: 'test-project',
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const versionId = 'version-123';
    const options: FetchTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
    };

    const result = await _fetchTranslations(versionId, options, mockConfig);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/info/version-123',
      {
        method: 'GET',
        headers: {
          'x-gt-api-key': 'test-key',
          'x-gt-project-id': 'test-project',
        },
      },
      5000
    );

    expect(result).toEqual({
      translations: mockResult.translations,
      versionId: 'version-123',
      projectId: 'test-project',
      localeCount: 2,
      totalEntries: 4, // 2 keys × 2 locales
    });
  });

  it('should handle translations with different data structures', async () => {
    const mockResult = {
      translations: [
        {
          locale: 'es',
          translation: {
            app: {
              title: 'Mi Aplicación',
              buttons: {
                save: 'Guardar',
                cancel: 'Cancelar',
              },
            },
            common: {
              yes: 'Sí',
              no: 'No',
            },
          },
          metadata: {
            status: 'completed',
          },
        },
        {
          locale: 'fr',
          translation: 'Simple string translation',
          metadata: {
            status: 'completed',
          },
        },
      ],
      versionId: 'version-456',
      projectId: 'test-project',
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const versionId = 'version-456';
    const options: FetchTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    const result = await _fetchTranslations(versionId, options, mockConfig);

    expect(result.localeCount).toBe(2);
    expect(result.totalEntries).toBe(5); // 4 nested keys + 1 string
    expect(result.translations).toHaveLength(2);
  });

  it('should handle empty translations array', async () => {
    const mockResult = {
      translations: [],
      versionId: 'version-empty',
      projectId: 'test-project',
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const versionId = 'version-empty';
    const options: FetchTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    const result = await _fetchTranslations(versionId, options, mockConfig);

    expect(result.localeCount).toBe(0);
    expect(result.totalEntries).toBe(0);
    expect(result.translations).toHaveLength(0);
  });

  it('should handle custom timeout configuration', async () => {
    const mockResult = {
      translations: [
        {
          locale: 'es',
          translation: { test: 'prueba' },
          metadata: {},
        },
      ],
      versionId: 'version-123',
      projectId: 'test-project',
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const configWithTimeout: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-key',
      timeout: 15000,
    };

    const versionId = 'version-123';
    const options: FetchTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    await _fetchTranslations(versionId, options, configWithTimeout);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      15000
    );
  });

  it('should handle translations with null/undefined values', async () => {
    const mockResult = {
      translations: [
        {
          locale: 'es',
          translation: null,
          metadata: {
            status: 'empty',
          },
        },
        {
          locale: 'fr',
          translation: undefined,
          metadata: {
            status: 'empty',
          },
        },
      ],
      versionId: 'version-null',
      projectId: 'test-project',
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const versionId = 'version-null';
    const options: FetchTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    const result = await _fetchTranslations(versionId, options, mockConfig);

    expect(result.localeCount).toBe(2);
    expect(result.totalEntries).toBe(2); // Each null/undefined counts as 1
    expect(result.translations).toHaveLength(2);
  });

  it('should throw error when projectId is missing', async () => {
    const versionId = 'version-123';
    const options: FetchTranslationsOptions = {
      // Missing projectId
      apiKey: 'test-key',
    };

    await expect(
      _fetchTranslations(versionId, options, mockConfig)
    ).rejects.toThrow('Project ID is required');
  });

  it('should throw error when apiKey is missing from both options and config', async () => {
    const versionId = 'version-123';
    const options: FetchTranslationsOptions = {
      projectId: 'test-project',
      // Missing apiKey
    };

    const configWithoutApiKey: TranslationRequestConfig = {
      projectId: 'test-project',
      // Missing apiKey
    };

    await expect(
      _fetchTranslations(versionId, options, configWithoutApiKey)
    ).rejects.toThrow('API key is required');
  });

  it('should throw error when versionId is missing', async () => {
    const versionId = '';
    const options: FetchTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    await expect(
      _fetchTranslations(versionId, options, mockConfig)
    ).rejects.toThrow('Version ID is required');
  });

  it('should handle API key from config when not provided in options', async () => {
    const mockResult = {
      translations: [
        {
          locale: 'es',
          translation: { test: 'prueba' },
          metadata: {},
        },
      ],
      versionId: 'version-123',
      projectId: 'test-project',
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const versionId = 'version-123';
    const options: FetchTranslationsOptions = {
      projectId: 'test-project',
      // No apiKey in options
    };

    const result = await _fetchTranslations(versionId, options, mockConfig);

    expect(result.localeCount).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-gt-api-key': 'test-key', // From config
        }),
      }),
      expect.any(Number)
    );
  });

  it('should prioritize options apiKey over config apiKey', async () => {
    const mockResult = {
      translations: [
        {
          locale: 'es',
          translation: { test: 'prueba' },
          metadata: {},
        },
      ],
      versionId: 'version-123',
      projectId: 'test-project',
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const versionId = 'version-123';
    const options: FetchTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'options-key',
    };

    const result = await _fetchTranslations(versionId, options, mockConfig);

    expect(result.localeCount).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-gt-api-key': 'options-key', // From options, not config
        }),
      }),
      expect.any(Number)
    );
  });

  it('should handle network errors', async () => {
    const networkError = new Error('Network error');
    mockFetch.mockRejectedValue(networkError);

    const versionId = 'version-123';
    const options: FetchTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    await expect(
      _fetchTranslations(versionId, options, mockConfig)
    ).rejects.toThrow('Network error');
  });

  it('should handle timeout errors', async () => {
    const timeoutError = new Error('Request timeout');
    timeoutError.name = 'AbortError';
    mockFetch.mockRejectedValue(timeoutError);

    const versionId = 'version-123';
    const options: FetchTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    await expect(
      _fetchTranslations(versionId, options, mockConfig)
    ).rejects.toThrow();
  });
});