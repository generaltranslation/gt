import { describe, it, expect, vi, beforeEach } from 'vitest';
import _enqueueTranslationEntries, {
  Updates,
  ApiOptions,
  EnqueueTranslationEntriesResult,
} from '../../src/translate/enqueueTranslationEntries';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import { TranslationRequestConfig } from '../../src/types';

// Mock Response interface for testing
interface MockResponse {
  ok: boolean;
  json: () => Promise<EnqueueTranslationEntriesResult>;
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

describe('_enqueueTranslationEntries function', () => {
  const mockFetch = vi.mocked(fetchWithTimeout);
  const mockConfig: TranslationRequestConfig = {
    projectId: 'test-project',
    apiKey: 'test-key',
    baseUrl: 'https://api.test.com',
    timeout: 5000,
  };

  const mockResult: EnqueueTranslationEntriesResult = {
    versionId: 'version-123',
    locales: ['es', 'fr'],
    message: 'Updates enqueued successfully',
    projectSettings: {
      cdnEnabled: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    mockFetch.mockClear();
  });

  it('should make correct API call with basic options', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const testUpdates: Updates = [
      {
        source: 'Hello world',
        dataFormat: 'ICU',
        metadata: {
          id: 'test-id',
          hash: 'test-hash',
          context: 'greeting',
        },
      },
    ];

    const options: ApiOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
      locales: ['es', 'fr'],
      defaultLocale: 'en',
    };

    const result = await _enqueueTranslationEntries(
      testUpdates,
      options,
      'test-library',
      mockConfig
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/update',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-key',
        },
        body: JSON.stringify({
          updates: testUpdates,
          locales: ['es', 'fr'],
          metadata: {
            projectId: 'test-project',
            sourceLocale: 'en',
          },
        }),
      },
      5000
    );

    expect(result).toEqual(mockResult);
  });

  it('should handle JSX updates correctly', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const jsxUpdates: Updates = [
      {
        source: ['Hello ', { t: 'strong', c: ['world'] }],
        dataFormat: 'JSX',
        metadata: {
          id: 'jsx-test',
          hash: 'jsx-hash',
          context: 'jsx-greeting',
        },
      },
    ];

    const options: ApiOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      locales: ['es'],
      defaultLocale: 'en',
      dataFormat: 'JSX',
    };

    const result = await _enqueueTranslationEntries(
      jsxUpdates,
      options,
      'test-library',
      mockConfig
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          updates: jsxUpdates,
          locales: ['es'],
          metadata: {
            projectId: 'test-project',
            sourceLocale: 'en',
          },
          dataFormat: 'JSX',
        }),
      }),
      expect.any(Number)
    );

    expect(result).toEqual(mockResult);
  });

  it('should handle multiple updates with mixed data formats', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const mixedUpdates: Updates = [
      {
        source: 'Simple text',
        dataFormat: 'ICU',
        metadata: { id: 'id1', hash: 'hash1' },
      },
      {
        source: 'Text with {variable}',
        dataFormat: 'ICU',
        metadata: { id: 'id2', hash: 'hash2' },
      },
      {
        source: ['JSX ', { t: 'em', c: ['content'] }],
        dataFormat: 'JSX',
        metadata: { id: 'id3', hash: 'hash3' },
      },
    ];

    const options: ApiOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      locales: ['es', 'fr', 'de'],
      defaultLocale: 'en',
      description: 'Mixed format test',
      requireApproval: false,
    };

    const result = await _enqueueTranslationEntries(
      mixedUpdates,
      options,
      'test-library',
      mockConfig
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/update',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-key',
        },
        body: JSON.stringify({
          updates: mixedUpdates,
          locales: ['es', 'fr', 'de'],
          metadata: {
            projectId: 'test-project',
            sourceLocale: 'en',
          },
          description: 'Mixed format test',
          requireApproval: false,
        }),
      },
      5000
    );

    expect(result).toEqual(mockResult);
  });

  it('should handle version ID and description options', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const testUpdates: Updates = [
      {
        source: 'Version test content',
        dataFormat: 'ICU',
        metadata: { id: 'version-test', hash: 'version-hash' },
      },
    ];

    const options: ApiOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      locales: ['es'],
      defaultLocale: 'en',
      version: 'custom-version-123',
      description: 'Custom version test',
      requireApproval: true,
    };

    await _enqueueTranslationEntries(
      testUpdates,
      options,
      'test-library',
      mockConfig
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          updates: testUpdates,
          locales: ['es'],
          metadata: {
            projectId: 'test-project',
            sourceLocale: 'en',
          },
          versionId: 'custom-version-123',
          description: 'Custom version test',
          requireApproval: true,
        }),
      }),
      expect.any(Number)
    );
  });

  it('should handle timeout configuration from config', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const configWithTimeout: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-key',
      timeout: 10000,
    };

    const testUpdates: Updates = [
      {
        source: 'Timeout test',
        dataFormat: 'ICU',
        metadata: { id: 'timeout-test', hash: 'timeout-hash' },
      },
    ];

    const options: ApiOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      locales: ['es'],
    };

    await _enqueueTranslationEntries(
      testUpdates,
      options,
      'test-library',
      configWithTimeout
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      10000
    );
  });

  it('should handle empty updates array', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const emptyUpdates: Updates = [];

    const options: ApiOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      locales: ['es'],
      defaultLocale: 'en',
    };

    const result = await _enqueueTranslationEntries(
      emptyUpdates,
      options,
      'test-library',
      mockConfig
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          updates: emptyUpdates,
          locales: ['es'],
          metadata: {
            projectId: 'test-project',
            sourceLocale: 'en',
          },
        }),
      }),
      expect.any(Number)
    );

    expect(result).toEqual(mockResult);
  });

  it('should throw error when projectId is missing', async () => {
    const testUpdates: Updates = [
      {
        source: 'Test',
        dataFormat: 'ICU',
        metadata: { id: 'test', hash: 'hash' },
      },
    ];

    const options: ApiOptions = {
      // Missing projectId
      apiKey: 'test-key',
      locales: ['es'],
    };

    await expect(
      _enqueueTranslationEntries(testUpdates, options, 'test-library', mockConfig)
    ).rejects.toThrow('Project ID is required');
  });

  it('should throw error when apiKey is missing from both options and config', async () => {
    const testUpdates: Updates = [
      {
        source: 'Test',
        dataFormat: 'ICU',
        metadata: { id: 'test', hash: 'hash' },
      },
    ];

    const options: ApiOptions = {
      projectId: 'test-project',
      // Missing apiKey
      locales: ['es'],
    };

    const configWithoutApiKey: TranslationRequestConfig = {
      projectId: 'test-project',
      // Missing apiKey
    };

    await expect(
      _enqueueTranslationEntries(
        testUpdates,
        options,
        'test-library',
        configWithoutApiKey
      )
    ).rejects.toThrow('API key is required');
  });

  it('should handle network errors', async () => {
    const networkError = new Error('Network error');
    mockFetch.mockRejectedValue(networkError);

    const testUpdates: Updates = [
      {
        source: 'Test',
        dataFormat: 'ICU',
        metadata: { id: 'test', hash: 'hash' },
      },
    ];

    const options: ApiOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      locales: ['es'],
    };

    await expect(
      _enqueueTranslationEntries(testUpdates, options, 'test-library', mockConfig)
    ).rejects.toThrow('Network error');
  });

  it('should handle timeout errors', async () => {
    const timeoutError = new Error('Request timeout');
    timeoutError.name = 'AbortError';
    mockFetch.mockRejectedValue(timeoutError);

    const testUpdates: Updates = [
      {
        source: 'Test',
        dataFormat: 'ICU',
        metadata: { id: 'test', hash: 'hash' },
      },
    ];

    const options: ApiOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      locales: ['es'],
    };

    await expect(
      _enqueueTranslationEntries(testUpdates, options, 'test-library', mockConfig)
    ).rejects.toThrow();
  });
});