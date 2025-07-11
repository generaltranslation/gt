import { describe, it, expect, vi, beforeEach } from 'vitest';
import _downloadFile, {
  DownloadFileOptions,
  DownloadFileResult,
} from '../../src/translate/downloadFile';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import { TranslationRequestConfig } from '../../src/types';

// Mock Response interface for testing
interface MockResponse {
  ok: boolean;
  text: () => Promise<string>;
  headers: {
    get: (key: string) => string | null;
  };
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

describe('_downloadFile function', () => {
  const mockFetch = vi.mocked(fetchWithTimeout);
  const mockConfig: TranslationRequestConfig = {
    projectId: 'test-project',
    apiKey: 'test-key',
    baseUrl: 'https://api.test.com',
    timeout: 5000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should make correct API call and download file successfully', async () => {
    const mockFileContent = JSON.stringify({ greeting: 'Hello world' });
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(mockFileContent),
      headers: {
        get: vi.fn((key: string) => {
          if (key === 'content-type') return 'application/json';
          if (key === 'content-disposition') return 'attachment; filename="test.json"';
          return null;
        }),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const translationId = 'trans-123';
    const options: DownloadFileOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
    };

    const result = await _downloadFile(translationId, options, mockConfig);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/files/trans-123/download',
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
      success: true,
      content: mockFileContent,
      contentType: 'application/json',
      fileName: 'test.json',
      translationId: 'trans-123',
    });
  });

  it('should handle file without content-disposition header', async () => {
    const mockFileContent = 'Hello world';
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(mockFileContent),
      headers: {
        get: vi.fn((key: string) => {
          if (key === 'content-type') return 'text/plain';
          return null;
        }),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const translationId = 'trans-123';
    const options: DownloadFileOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    const result = await _downloadFile(translationId, options, mockConfig);

    expect(result).toEqual({
      success: true,
      content: mockFileContent,
      contentType: 'text/plain',
      fileName: undefined,
      translationId: 'trans-123',
    });
  });

  it('should handle custom timeout configuration', async () => {
    const mockFileContent = 'Test content';
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(mockFileContent),
      headers: {
        get: vi.fn(() => null),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const configWithTimeout: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-key',
      timeout: 10000,
    };

    const translationId = 'trans-123';
    const options: DownloadFileOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    await _downloadFile(translationId, options, configWithTimeout);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      10000
    );
  });

  it('should retry on failure and eventually succeed', async () => {
    // Create fresh mocks for this test
    const mockFileContent = 'Success after retry';
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(mockFileContent),
      headers: {
        get: vi.fn(() => null),
      },
    };

    // Set up the mock sequence
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockResponse as MockResponse as any);

    const translationId = 'trans-retry-123';
    const options: DownloadFileOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      maxRetries: 2,
      retryDelay: 10, // Short delay for testing
    };

    const result = await _downloadFile(translationId, options, mockConfig);

    expect(result.success).toBe(true);
    expect(result.content).toBe(mockFileContent);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should fail after max retries', async () => {
    const networkError = new Error('Network error');
    
    // Set up the mock for this test
    mockFetch.mockRejectedValue(networkError);

    const translationId = 'trans-fail-123';
    const options: DownloadFileOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
      maxRetries: 2,
      retryDelay: 10, // Short delay for testing
    };

    const result = await _downloadFile(translationId, options, mockConfig);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
    expect(result.translationId).toBe('trans-fail-123');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should handle different content types', async () => {
    const mockFileContent = '<html><body>Hello</body></html>';
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(mockFileContent),
      headers: {
        get: vi.fn((key: string) => {
          if (key === 'content-type') return 'text/html';
          if (key === 'content-disposition') return 'attachment; filename="page.html"';
          return null;
        }),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const translationId = 'trans-html';
    const options: DownloadFileOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    const result = await _downloadFile(translationId, options, mockConfig);

    expect(result.success).toBe(true);
    expect(result.contentType).toBe('text/html');
    expect(result.fileName).toBe('page.html');
  });

  it('should throw error when projectId is missing', async () => {
    const translationId = 'trans-123';
    const options: DownloadFileOptions = {
      // Missing projectId
      apiKey: 'test-key',
    };

    await expect(
      _downloadFile(translationId, options, mockConfig)
    ).rejects.toThrow('Project ID is required');
  });

  it('should throw error when apiKey is missing from both options and config', async () => {
    const translationId = 'trans-123';
    const options: DownloadFileOptions = {
      projectId: 'test-project',
      // Missing apiKey
    };

    const configWithoutApiKey: TranslationRequestConfig = {
      projectId: 'test-project',
      // Missing apiKey
    };

    await expect(
      _downloadFile(translationId, options, configWithoutApiKey)
    ).rejects.toThrow('API key is required');
  });

  it('should throw error when translationId is missing', async () => {
    const translationId = '';
    const options: DownloadFileOptions = {
      projectId: 'test-project',
      apiKey: 'test-key',
    };

    await expect(
      _downloadFile(translationId, options, mockConfig)
    ).rejects.toThrow('Translation ID is required');
  });

  it('should handle API key from config when not provided in options', async () => {
    const mockFileContent = 'Test content';
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(mockFileContent),
      headers: {
        get: vi.fn(() => null),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const translationId = 'trans-123';
    const options: DownloadFileOptions = {
      projectId: 'test-project',
      // No apiKey in options
    };

    const result = await _downloadFile(translationId, options, mockConfig);

    expect(result.success).toBe(true);
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
    const mockFileContent = 'Test content';
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(mockFileContent),
      headers: {
        get: vi.fn(() => null),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const translationId = 'trans-123';
    const options: DownloadFileOptions = {
      projectId: 'test-project',
      apiKey: 'options-key',
    };

    const result = await _downloadFile(translationId, options, mockConfig);

    expect(result.success).toBe(true);
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