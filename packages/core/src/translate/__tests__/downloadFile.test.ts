import { describe, it, expect, vi, beforeEach } from 'vitest';
import _downloadFile, { _downloadFileV2 } from '../downloadFile';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import validateResponse from '../utils/validateResponse';
import handleFetchError from '../utils/handleFetchError';
import generateRequestHeaders from '../utils/generateRequestHeaders';
import { TranslationRequestConfig } from '../../types';
import { DownloadFileOptions } from '../../types-dir/downloadFile';
import { decode } from '../../utils/base64';

vi.mock('../utils/fetchWithTimeout');
vi.mock('../utils/validateResponse');
vi.mock('../utils/handleFetchError');
vi.mock('../utils/generateRequestHeaders');

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
    const mockData = Buffer.from('test-data').toString('base64');
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: mockData }),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const translationId = 'test-translation-id';
    const options: DownloadFileOptions = {
      timeout: 5000,
    };

    const result = await _downloadFile(translationId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/translations/files/test-translation-id/download',
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
    expect(result).toStrictEqual(Buffer.from(mockData, 'base64').buffer);
  });

  it('should use default timeout when not specified', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: '' }),
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
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: '' }),
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
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: '' }),
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
        'https://api2.gtx.dev/v2/project/translations/files/test-translation-id/download'
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
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: '' }),
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
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: '' }),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const translationId = 'my-special-translation-123';
    const options: DownloadFileOptions = {};

    await _downloadFile(translationId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/translations/files/my-special-translation-123/download',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle empty ArrayBuffer response', async () => {
    const mockArrayBuffer = new ArrayBuffer(0);
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: '' }),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const translationId = 'test-translation-id';
    const options: DownloadFileOptions = {};

    const result = await _downloadFile(translationId, options, mockConfig);

    expect(result).toStrictEqual(mockArrayBuffer);
    expect(result.byteLength).toBe(0);
  });
});

describe.sequential('_downloadFileV2', () => {
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
    const mockData = Buffer.from('test-data').toString('base64');
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: mockData }),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const file = {
      fileId: 'test-file-id',
      versionId: 'test-version-id',
      locale: 'en-US',
    };
    const options: DownloadFileOptions = {
      timeout: 5000,
    };

    const result = await _downloadFileV2(file, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/files/download/test-file-id/test-version-id?locale=en-US',
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
    expect(result).toStrictEqual(decode(mockData));
  });

  it('should construct correct URL with file parameters', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: '' }),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const file = {
      fileId: 'my-file-123',
      versionId: 'v2.1.0',
      locale: 'fr-CA',
    };
    const options: DownloadFileOptions = {};

    await _downloadFileV2(file, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/files/download/my-file-123/v2.1.0?locale=fr-CA',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should use default timeout when not specified', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: '' }),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const file = {
      fileId: 'test-file-id',
      versionId: 'test-version-id',
      locale: 'en-US',
    };
    const options: DownloadFileOptions = {};

    await _downloadFileV2(file, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should enforce maximum timeout limit', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: '' }),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const file = {
      fileId: 'test-file-id',
      versionId: 'test-version-id',
      locale: 'en-US',
    };
    const options: DownloadFileOptions = {
      timeout: 99999,
    };

    await _downloadFileV2(file, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: '' }),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const file = {
      fileId: 'test-file-id',
      versionId: 'test-version-id',
      locale: 'en-US',
    };
    const options: DownloadFileOptions = {};

    await _downloadFileV2(file, options, configWithoutUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://api2.gtx.dev/v2/project/files/download/test-file-id/test-version-id?locale=en-US'
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

    const file = {
      fileId: 'test-file-id',
      versionId: 'test-version-id',
      locale: 'en-US',
    };
    const options: DownloadFileOptions = {};

    await expect(_downloadFileV2(file, options, mockConfig)).rejects.toThrow(
      'Network error'
    );
    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should handle validation errors', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: '' }),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockImplementationOnce(() => {
      throw new Error('Validation failed');
    });

    const file = {
      fileId: 'test-file-id',
      versionId: 'test-version-id',
      locale: 'en-US',
    };
    const options: DownloadFileOptions = {};

    await expect(_downloadFileV2(file, options, mockConfig)).rejects.toThrow(
      'Validation failed'
    );
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
  });

  it('should handle locale with special characters', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: '' }),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const file = {
      fileId: 'test-file-id',
      versionId: 'test-version-id',
      locale: 'zh-Hans-CN',
    };
    const options: DownloadFileOptions = {};

    await _downloadFileV2(file, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/files/download/test-file-id/test-version-id?locale=zh-Hans-CN',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle empty ArrayBuffer response', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ data: '' }),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const file = {
      fileId: 'test-file-id',
      versionId: 'test-version-id',
      locale: 'en-US',
    };
    const options: DownloadFileOptions = {};

    const result = await _downloadFileV2(file, options, mockConfig);

    expect(result).toStrictEqual('');
  });
});
