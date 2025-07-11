import { describe, it, expect, vi, beforeEach } from 'vitest';
import _downloadFileBatch, {
  BatchDownloadFile,
  DownloadFileBatchOptions,
  DownloadFileBatchResult,
} from '../../src/translate/downloadFileBatch';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import { TranslationRequestConfig } from '../../src/types';

// Mock Response interface for testing
interface MockResponse {
  ok: boolean;
  json: () => Promise<{
    results: Array<{
      translationId: string;
      fileName?: string;
      success: boolean;
      content?: string;
      contentType?: string;
      error?: string;
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

describe('_downloadFileBatch function', () => {
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

  it('should make correct API call and download batch successfully', async () => {
    const mockResult = {
      results: [
        {
          translationId: 'trans-1',
          fileName: 'app.json',
          success: true,
          content: JSON.stringify({ greeting: 'Hello world' }),
          contentType: 'application/json',
        },
        {
          translationId: 'trans-2',
          fileName: 'common.json',
          success: true,
          content: JSON.stringify({ welcome: 'Welcome' }),
          contentType: 'application/json',
        },
      ],
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const files: BatchDownloadFile[] = [
      { translationId: 'trans-1', fileName: 'app.json' },
      { translationId: 'trans-2', fileName: 'common.json' },
    ];

    const options: DownloadFileBatchOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
    };

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/files/batch-download',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-key',
          'x-gt-project-id': 'test-project',
        },
        body: JSON.stringify({
          files: [
            { translationId: 'trans-1', fileName: 'app.json' },
            { translationId: 'trans-2', fileName: 'common.json' },
          ],
          projectId: 'test-project',
        }),
      },
      5000
    );

    expect(result).toEqual({
      results: mockResult.results,
      successful: mockResult.results,
      failed: [],
      successCount: 2,
      failureCount: 0,
    });
  });

  it('should handle mixed success and failure results', async () => {
    const mockResult = {
      results: [
        {
          translationId: 'trans-1',
          fileName: 'app.json',
          success: true,
          content: JSON.stringify({ greeting: 'Hello world' }),
          contentType: 'application/json',
        },
        {
          translationId: 'trans-2',
          fileName: 'common.json',
          success: false,
          error: 'File not found',
        },
        {
          translationId: 'trans-3',
          fileName: 'errors.json',
          success: true,
          content: JSON.stringify({ error: 'Error message' }),
          contentType: 'application/json',
        },
      ],
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const files: BatchDownloadFile[] = [
      { translationId: 'trans-1', fileName: 'app.json' },
      { translationId: 'trans-2', fileName: 'common.json' },
      { translationId: 'trans-3', fileName: 'errors.json' },
    ];

    const options: DownloadFileBatchOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(1);
    expect(result.successful).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toBe('File not found');
  });

  it('should handle files without fileName', async () => {
    const mockResult = {
      results: [
        {
          translationId: 'trans-1',
          success: true,
          content: 'Hello world',
          contentType: 'text/plain',
        },
      ],
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const files: BatchDownloadFile[] = [
      { translationId: 'trans-1' }, // No fileName
    ];

    const options: DownloadFileBatchOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(result.successCount).toBe(1);
    expect(result.successful[0].fileName).toBeUndefined();
  });

  it('should handle custom timeout configuration', async () => {
    const mockResult = {
      results: [
        {
          translationId: 'trans-1',
          success: true,
          content: 'Test content',
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
      timeout: 15000,
    };

    const files: BatchDownloadFile[] = [
      { translationId: 'trans-1' },
    ];

    const options: DownloadFileBatchOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    await _downloadFileBatch(files, options, configWithTimeout);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      15000
    );
  });

  it('should retry on failure and eventually succeed', async () => {
    const mockResult = {
      results: [
        {
          translationId: 'trans-1',
          success: true,
          content: 'Success after retry',
        },
      ],
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // First call fails, second succeeds
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockResponse as MockResponse as any);

    const files: BatchDownloadFile[] = [
      { translationId: 'trans-1' },
    ];

    const options: DownloadFileBatchOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      maxRetries: 2,
      retryDelay: 10, // Short delay for testing
    };

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(result.successCount).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should fail after max retries', async () => {
    const networkError = new Error('Network error');
    mockFetch.mockRejectedValue(networkError);

    const files: BatchDownloadFile[] = [
      { translationId: 'trans-1', fileName: 'app.json' },
      { translationId: 'trans-2', fileName: 'common.json' },
    ];

    const options: DownloadFileBatchOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      maxRetries: 2,
      retryDelay: 10, // Short delay for testing
    };

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(2);
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0].error).toBe('Network error');
    expect(result.failed[1].error).toBe('Network error');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should handle empty files array', async () => {
    const mockResult = {
      results: [],
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const files: BatchDownloadFile[] = [];

    const options: DownloadFileBatchOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    await expect(
      _downloadFileBatch(files, options, mockConfig)
    ).rejects.toThrow('Files array is required and must not be empty');
  });

  it('should throw error when projectId is missing', async () => {
    const files: BatchDownloadFile[] = [
      { translationId: 'trans-1' },
    ];

    const options: DownloadFileBatchOptions = {
      // Missing projectId
      apiKey: 'test-key',
    };

    await expect(
      _downloadFileBatch(files, options, mockConfig)
    ).rejects.toThrow('Project ID is required');
  });

  it('should throw error when apiKey is missing from both options and config', async () => {
    const files: BatchDownloadFile[] = [
      { translationId: 'trans-1' },
    ];

    const options: DownloadFileBatchOptions = {
      projectId: 'test-project',
      // Missing apiKey
    };

    const configWithoutApiKey: TranslationRequestConfig = {
      projectId: 'test-project',
      // Missing apiKey
    };

    await expect(
      _downloadFileBatch(files, options, configWithoutApiKey)
    ).rejects.toThrow('API key is required');
  });

  it('should handle API key from config when not provided in options', async () => {
    const mockResult = {
      results: [
        {
          translationId: 'trans-1',
          success: true,
          content: 'Test content',
        },
      ],
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const files: BatchDownloadFile[] = [
      { translationId: 'trans-1' },
    ];

    const options: DownloadFileBatchOptions = {
      projectId: 'test-project',
      // No apiKey in options
    };

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(result.successCount).toBe(1);
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
      results: [
        {
          translationId: 'trans-1',
          success: true,
          content: 'Test content',
        },
      ],
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const files: BatchDownloadFile[] = [
      { translationId: 'trans-1' },
    ];

    const options: DownloadFileBatchOptions = {
      projectId: 'test-project',
      apiKey: 'options-key',
    };

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(result.successCount).toBe(1);
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
});