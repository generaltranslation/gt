import { describe, it, expect, vi, beforeEach } from 'vitest';
import _downloadFile from '../../src/translate/downloadFile';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import validateResponse from '../../src/translate/utils/validateResponse';
import handleFetchError from '../../src/translate/utils/handleFetchError';
import generateRequestHeaders from '../../src/translate/utils/generateRequestHeaders';
import { TranslationRequestConfig } from '../../src/types';
import { DownloadFileOptions } from '../../src/types-dir/downloadFile';

vi.mock('../../src/utils/fetchWithTimeout');
vi.mock('../../src/translate/utils/validateResponse');
vi.mock('../../src/translate/utils/handleFetchError');
vi.mock('../../src/translate/utils/generateRequestHeaders');

describe.sequential('_downloadFile', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateRequestHeaders).mockReturnValue({
      'Content-Type': 'application/json',
      'x-gt-api-key': 'test-api-key',
      'x-gt-project-id': 'test-project',
    });
  });

  it('should download file content successfully', async () => {
    const mockArrayBuffer = new ArrayBuffer(8);
    const mockResponse = {
      arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const translationId = 'test-translation-id';
    const options: DownloadFileOptions = {
      timeout: 5000,
    };

    const result = await _downloadFile(translationId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/files/test-translation-id/download',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
      },
      5000
    );
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
    expect(result).toBe(mockArrayBuffer);
  });

  it('should use default timeout when not specified', async () => {
    const mockArrayBuffer = new ArrayBuffer(8);
    const mockResponse = {
      arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const translationId = 'test-translation-id';
    const options: DownloadFileOptions = {};

    await _downloadFile(translationId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should enforce maximum timeout limit', async () => {
    const mockArrayBuffer = new ArrayBuffer(8);
    const mockResponse = {
      arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const translationId = 'test-translation-id';
    const options: DownloadFileOptions = {
      timeout: 99999,
    };

    await _downloadFile(translationId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    const mockArrayBuffer = new ArrayBuffer(8);
    const mockResponse = {
      arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const translationId = 'test-translation-id';
    const options: DownloadFileOptions = {};

    await _downloadFile(translationId, options, configWithoutUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://api2.gtx.dev/v1/project/translations/files/test-translation-id/download'
      ),
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle fetch errors through handleFetchError', async () => {
    const fetchError = new Error('Network error');
    vi.mocked(fetchWithTimeout).mockRejectedValue(fetchError);
    vi.mocked(handleFetchError).mockImplementation(() => {
      throw fetchError;
    });

    const translationId = 'test-translation-id';
    const options: DownloadFileOptions = {};

    await expect(
      _downloadFile(translationId, options, mockConfig)
    ).rejects.toThrow('Network error');
    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should handle validation errors', async () => {
    const mockArrayBuffer = new ArrayBuffer(8);
    const mockResponse = {
      arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockImplementationOnce(() => {
      throw new Error('Validation failed');
    });

    const translationId = 'test-translation-id';
    const options: DownloadFileOptions = {};

    await expect(
      _downloadFile(translationId, options, mockConfig)
    ).rejects.toThrow('Validation failed');
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
  });

  it('should construct correct URL with translation ID', async () => {
    const mockArrayBuffer = new ArrayBuffer(8);
    const mockResponse = {
      arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const translationId = 'my-special-translation-123';
    const options: DownloadFileOptions = {};

    await _downloadFile(translationId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/files/my-special-translation-123/download',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle empty ArrayBuffer response', async () => {
    const mockArrayBuffer = new ArrayBuffer(0);
    const mockResponse = {
      arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const translationId = 'test-translation-id';
    const options: DownloadFileOptions = {};

    const result = await _downloadFile(translationId, options, mockConfig);

    expect(result).toBe(mockArrayBuffer);
    expect(result.byteLength).toBe(0);
  });
});
