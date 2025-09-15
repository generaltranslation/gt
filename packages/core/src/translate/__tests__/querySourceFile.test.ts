import { describe, it, expect, vi, beforeEach } from 'vitest';
import _querySourceFile from '../querySourceFile';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import validateResponse from '../utils/validateResponse';
import handleFetchError from '../utils/handleFetchError';
import generateRequestHeaders from '../utils/generateRequestHeaders';
import { TranslationRequestConfig } from '../../types';
import {
  FileQuery,
  CheckFileTranslationsOptions,
  FileQueryResult,
} from '../../types-dir/checkFileTranslations';

vi.mock('../utils/fetchWithTimeout');
vi.mock('../utils/validateResponse');
vi.mock('../utils/handleFetchError');
vi.mock('../utils/generateRequestHeaders');

describe.sequential('_querySourceFile', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const mockFileQueryResult: FileQueryResult = {
    sourceFile: {
      id: 'source-123',
      fileId: 'file-123',
      versionId: 'version-456',
      sourceLocale: 'en',
      fileName: 'test-file.json',
      fileFormat: 'json',
      dataFormat: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T12:00:00Z',
      approvalRequiredAt: null,
      locales: ['es', 'fr', 'de'],
    },
    translations: [
      {
        locale: 'es',
        completedAt: '2024-01-01T10:00:00Z',
        approvedAt: '2024-01-01T11:00:00Z',
        publishedAt: '2024-01-01T12:00:00Z',
        createdAt: '2024-01-01T09:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z',
      },
      {
        locale: 'fr',
        completedAt: null,
        approvedAt: null,
        publishedAt: null,
        createdAt: '2024-01-01T09:00:00Z',
        updatedAt: '2024-01-01T09:30:00Z',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateRequestHeaders).mockReturnValue({
      'Content-Type': 'application/json',
      'x-gt-api-key': 'test-api-key',
      'x-gt-project-id': 'test-project',
    });
  });

  it('should query source file successfully', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFileQueryResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {
      timeout: 5000,
    };

    const result = await _querySourceFile(query, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/translations/files/status/file-123?versionId=version-456',
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
    expect(result).toEqual(mockFileQueryResult);
  });

  it('should use config baseUrl when provided', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFileQueryResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {};

    await _querySourceFile(query, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/translations/files/status/file-123?versionId=version-456',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFileQueryResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {};

    await _querySourceFile(query, options, configWithoutUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://api2.gtx.dev/v2/project/translations/files/status/file-123'
      ),
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should use default timeout when not specified', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFileQueryResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {};

    await _querySourceFile(query, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should enforce maximum timeout limit', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFileQueryResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {
      timeout: 99999,
    };

    await _querySourceFile(query, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should handle fetch errors through handleFetchError', async () => {
    const fetchError = new Error('Network error');
    vi.mocked(fetchWithTimeout).mockRejectedValue(fetchError);
    vi.mocked(handleFetchError).mockImplementation(() => {
      throw fetchError;
    });

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {};

    await expect(_querySourceFile(query, options, mockConfig)).rejects.toThrow(
      'Network error'
    );
    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should handle validation errors', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFileQueryResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockImplementationOnce(() => {
      throw new Error('Validation failed');
    });

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {};

    await expect(_querySourceFile(query, options, mockConfig)).rejects.toThrow(
      'Validation failed'
    );
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
  });

  it('should handle query without versionId', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFileQueryResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const query: FileQuery = {
      fileId: 'file-123',
    };
    const options: CheckFileTranslationsOptions = {};

    const result = await _querySourceFile(query, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/translations/files/status/file-123',
      expect.objectContaining({
        method: 'GET',
      }),
      expect.any(Number)
    );
    expect(result).toEqual(mockFileQueryResult);
  });

  it('should properly encode fileId in URL', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFileQueryResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const query: FileQuery = {
      fileId: 'file with spaces & special chars',
      versionId: 'version/with/slashes',
    };

    const options: CheckFileTranslationsOptions = {};

    await _querySourceFile(query, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/translations/files/status/file%20with%20spaces%20%26%20special%20chars?versionId=version%2Fwith%2Fslashes',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should use correct HTTP method and headers', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFileQueryResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {};

    await _querySourceFile(query, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
      },
      expect.any(Number)
    );
  });

  it('should call generateRequestHeaders with correct parameters', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFileQueryResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {
      timeout: 8000,
    };

    await _querySourceFile(query, options, mockConfig);

    expect(generateRequestHeaders).toHaveBeenCalledWith(mockConfig, true);
  });

  it('should handle JSON parsing errors', async () => {
    const mockResponse = {
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {};

    await expect(_querySourceFile(query, options, mockConfig)).rejects.toThrow(
      'Invalid JSON'
    );
  });

  it('should handle empty fileId', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFileQueryResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const query: FileQuery = {
      fileId: '',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {};

    await _querySourceFile(query, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/translations/files/status/?versionId=version-456',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle empty versionId in query string', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFileQueryResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: '',
    };

    const options: CheckFileTranslationsOptions = {};

    await _querySourceFile(query, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/translations/files/status/file-123',
      expect.any(Object),
      expect.any(Number)
    );
  });
});
