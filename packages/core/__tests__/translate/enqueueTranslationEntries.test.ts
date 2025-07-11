import { describe, it, expect, vi, beforeEach } from 'vitest';
import _enqueueEntries from '../../src/translate/enqueueEntries';
import { Updates } from '../../src/types-dir/enqueue';
import { EnqueueEntriesOptions } from '../../src/types-dir/enqueue';
import { EnqueueEntriesResult } from '../../src/types-dir/enqueue';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import { TranslationRequestConfig } from '../../src/types';

// Mock Response interface for testing
interface MockResponse {
  ok: boolean;
  json: () => Promise<EnqueueEntriesResult>;
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

describe('_enqueueEntries function', () => {
  const mockFetch = vi.mocked(fetchWithTimeout);
  const mockConfig: TranslationRequestConfig = {
    projectId: 'test-project',
    apiKey: 'test-key',
    baseUrl: 'https://api.test.com',
    timeout: 5000,
  };

  const mockResult: EnqueueEntriesResult = {
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

    const options: EnqueueEntriesOptions = {
      targetLocales: ['es', 'fr'],
      sourceLocale: 'en',
    };

    const result = await _enqueueEntries(testUpdates, options, mockConfig);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/project/translations/update'),
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
      expect.any(Number)
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

    const options: EnqueueEntriesOptions = {
      locales: ['es'],
      sourceLocale: 'en',
      dataFormat: 'JSX',
    };

    const result = await _enqueueEntries(jsxUpdates, options, mockConfig);

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

    const options: EnqueueEntriesOptions = {
      targetLocales: ['es', 'fr', 'de'],
      sourceLocale: 'en',
      description: 'Mixed format test',
      requireApproval: false,
    };

    const result = await _enqueueEntries(mixedUpdates, options, mockConfig);

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

    const options: EnqueueEntriesOptions = {
      locales: ['es'],
      sourceLocale: 'en',
      version: 'custom-version-123',
      description: 'Custom version test',
      requireApproval: true,
    };

    await _enqueueEntries(testUpdates, options, mockConfig);

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

    const options: EnqueueEntriesOptions = {
      locales: ['es'],
    };

    await _enqueueEntries(testUpdates, options, configWithTimeout);

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

    const options: EnqueueEntriesOptions = {
      locales: ['es'],
      sourceLocale: 'en',
    };

    const result = await _enqueueEntries(emptyUpdates, options, mockConfig);

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

    const options: EnqueueEntriesOptions = {
      locales: ['es'],
    };

    await expect(
      _enqueueEntries(testUpdates, options, mockConfig)
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

    const options: EnqueueEntriesOptions = {
      locales: ['es'],
    };

    await expect(
      _enqueueEntries(testUpdates, options, mockConfig)
    ).rejects.toThrow();
  });
});
