import { describe, it, expect, vi, beforeEach } from 'vitest';
import _checkFileTranslations, {
  FileTranslationCheck,
  CheckFileTranslationsOptions,
  CheckFileTranslationsResult,
} from '../../src/translate/checkFileTranslations';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import { TranslationRequestConfig } from '../../src/types';

// Mock Response interface for testing
interface MockResponse {
  ok: boolean;
  json: () => Promise<{
    files: Array<{
      translationId: string;
      locale: string;
      fileName: string;
      status: 'ready' | 'processing' | 'failed';
      downloadUrl?: string;
    }>;
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

describe('_checkFileTranslations function', () => {
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

  it('should make correct API call with file translation checks', async () => {
    const mockResult = {
      files: [
        {
          translationId: 'trans-1',
          locale: 'es',
          fileName: 'test.json',
          status: 'ready' as const,
          downloadUrl: 'https://example.com/download/trans-1',
        },
        {
          translationId: 'trans-2',
          locale: 'fr',
          fileName: 'test.json',
          status: 'processing' as const,
        },
      ],
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const testData: { [key: string]: FileTranslationCheck } = {
      'src/test.json': {
        versionId: 'version-123',
        fileName: 'test.json',
      },
    };

    const options: CheckFileTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
      locales: ['es', 'fr'],
    };

    const result = await _checkFileTranslations(testData, options, mockConfig);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/files/retrieve',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-key',
        },
        body: JSON.stringify({
          data: testData,
          locales: ['es', 'fr'],
          projectId: 'test-project',
        }),
      },
      5000
    );

    expect(result).toEqual({
      files: mockResult.files,
      allReady: false,
      readyCount: 1,
      totalCount: 2,
    });
  });

  it('should handle all files ready scenario', async () => {
    const mockResult = {
      files: [
        {
          translationId: 'trans-1',
          locale: 'es',
          fileName: 'test.json',
          status: 'ready' as const,
          downloadUrl: 'https://example.com/download/trans-1',
        },
        {
          translationId: 'trans-2',
          locale: 'fr',
          fileName: 'test.json',
          status: 'ready' as const,
          downloadUrl: 'https://example.com/download/trans-2',
        },
      ],
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const testData: { [key: string]: FileTranslationCheck } = {
      'src/test.json': {
        versionId: 'version-123',
        fileName: 'test.json',
      },
    };

    const options: CheckFileTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      locales: ['es', 'fr'],
    };

    const result = await _checkFileTranslations(testData, options, mockConfig);

    expect(result.allReady).toBe(true);
    expect(result.readyCount).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  it('should handle multiple files with mixed statuses', async () => {
    const mockResult = {
      files: [
        {
          translationId: 'trans-1',
          locale: 'es',
          fileName: 'app.json',
          status: 'ready' as const,
          downloadUrl: 'https://example.com/download/trans-1',
        },
        {
          translationId: 'trans-2',
          locale: 'fr',
          fileName: 'app.json',
          status: 'processing' as const,
        },
        {
          translationId: 'trans-3',
          locale: 'es',
          fileName: 'common.json',
          status: 'failed' as const,
        },
        {
          translationId: 'trans-4',
          locale: 'fr',
          fileName: 'common.json',
          status: 'ready' as const,
          downloadUrl: 'https://example.com/download/trans-4',
        },
      ],
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const testData: { [key: string]: FileTranslationCheck } = {
      'src/app.json': {
        versionId: 'version-123',
        fileName: 'app.json',
      },
      'src/common.json': {
        versionId: 'version-123',
        fileName: 'common.json',
      },
    };

    const options: CheckFileTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      locales: ['es', 'fr'],
    };

    const result = await _checkFileTranslations(testData, options, mockConfig);

    expect(result.allReady).toBe(false);
    expect(result.readyCount).toBe(2);
    expect(result.totalCount).toBe(4);
    expect(result.files).toHaveLength(4);
  });

  it('should handle timeout configuration from config', async () => {
    const mockResult = {
      files: [
        {
          translationId: 'trans-1',
          locale: 'es',
          fileName: 'test.json',
          status: 'ready' as const,
        },
      ],
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
      timeout: 10000,
    };

    const testData: { [key: string]: FileTranslationCheck } = {
      'src/test.json': {
        versionId: 'version-123',
        fileName: 'test.json',
      },
    };

    const options: CheckFileTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      locales: ['es'],
    };

    await _checkFileTranslations(testData, options, configWithTimeout);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      10000
    );
  });

  it('should handle empty data object', async () => {
    const mockResult = {
      files: [],
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const testData: { [key: string]: FileTranslationCheck } = {};

    const options: CheckFileTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      locales: ['es'],
    };

    const result = await _checkFileTranslations(testData, options, mockConfig);

    expect(result.allReady).toBe(true);
    expect(result.readyCount).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.files).toHaveLength(0);
  });

  it('should throw error when projectId is missing', async () => {
    const testData: { [key: string]: FileTranslationCheck } = {
      'src/test.json': {
        versionId: 'version-123',
        fileName: 'test.json',
      },
    };

    const options: CheckFileTranslationsOptions = {
      // Missing projectId
      locales: ['es'],
    };

    await expect(
      _checkFileTranslations(testData, options, mockConfig)
    ).rejects.toThrow('Project ID is required');
  });

  it('should throw error when apiKey is missing from both options and config', async () => {
    const testData: { [key: string]: FileTranslationCheck } = {
      'src/test.json': {
        versionId: 'version-123',
        fileName: 'test.json',
      },
    };

    const options: CheckFileTranslationsOptions = {
      projectId: 'test-project',
      // Missing apiKey
      locales: ['es'],
    };

    const configWithoutApiKey: TranslationRequestConfig = {
      projectId: 'test-project',
      // Missing apiKey
    };

    await expect(
      _checkFileTranslations(testData, options, configWithoutApiKey)
    ).rejects.toThrow('API key is required');
  });

  it('should throw error when locales are missing', async () => {
    const testData: { [key: string]: FileTranslationCheck } = {
      'src/test.json': {
        versionId: 'version-123',
        fileName: 'test.json',
      },
    };

    const options: CheckFileTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      // Missing locales
    };

    await expect(
      _checkFileTranslations(testData, options, mockConfig)
    ).rejects.toThrow('Target locales are required');
  });

  it('should handle network errors', async () => {
    const networkError = new Error('Network error');
    mockFetch.mockRejectedValue(networkError);

    const testData: { [key: string]: FileTranslationCheck } = {
      'src/test.json': {
        versionId: 'version-123',
        fileName: 'test.json',
      },
    };

    const options: CheckFileTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      locales: ['es'],
    };

    await expect(
      _checkFileTranslations(testData, options, mockConfig)
    ).rejects.toThrow('Network error');
  });

  it('should handle timeout errors', async () => {
    const timeoutError = new Error('Request timeout');
    timeoutError.name = 'AbortError';
    mockFetch.mockRejectedValue(timeoutError);

    const testData: { [key: string]: FileTranslationCheck } = {
      'src/test.json': {
        versionId: 'version-123',
        fileName: 'test.json',
      },
    };

    const options: CheckFileTranslationsOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      locales: ['es'],
    };

    await expect(
      _checkFileTranslations(testData, options, mockConfig)
    ).rejects.toThrow();
  });
});