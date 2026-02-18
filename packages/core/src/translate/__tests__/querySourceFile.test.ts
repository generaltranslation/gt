import { describe, it, expect, vi, beforeEach } from 'vitest';
import _querySourceFile from '../querySourceFile';
import apiRequest from '../utils/apiRequest';
import { TranslationRequestConfig } from '../../types';
import {
  FileQuery,
  CheckFileTranslationsOptions,
  FileQueryResult,
} from '../../types-dir/api/checkFileTranslations';

vi.mock('../utils/apiRequest');

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
  });

  it('should query source file successfully', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockFileQueryResult);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {
      timeout: 5000,
    };

    const result = await _querySourceFile(query, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v2/project/translations/files/status/file-123?versionId=version-456',
      {
        method: 'GET',
        timeout: 5000,
      }
    );
    expect(result).toEqual(mockFileQueryResult);
  });

  it('should use config baseUrl when provided', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockFileQueryResult);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {};

    await _querySourceFile(query, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v2/project/translations/files/status/file-123?versionId=version-456',
      expect.any(Object)
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockFileQueryResult);

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

    expect(apiRequest).toHaveBeenCalledWith(
      configWithoutUrl,
      expect.stringContaining('/v2/project/translations/files/status/file-123'),
      expect.any(Object)
    );
  });

  it('should use default timeout when not specified', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockFileQueryResult);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {};

    await _querySourceFile(query, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: undefined })
    );
  });

  it('should respect custom timeout', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockFileQueryResult);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {
      timeout: 99999,
    };

    await _querySourceFile(query, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: 99999 })
    );
  });

  it('should handle fetch errors', async () => {
    const fetchError = new Error('Network error');
    vi.mocked(apiRequest).mockRejectedValue(fetchError);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {};

    await expect(_querySourceFile(query, options, mockConfig)).rejects.toThrow(
      'Network error'
    );
  });

  it('should handle validation errors', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Validation failed'));

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {};

    await expect(_querySourceFile(query, options, mockConfig)).rejects.toThrow(
      'Validation failed'
    );
  });

  it('should handle query without versionId', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockFileQueryResult);

    const query: FileQuery = {
      fileId: 'file-123',
    };
    const options: CheckFileTranslationsOptions = {};

    const result = await _querySourceFile(query, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      '/v2/project/translations/files/status/file-123?',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toEqual(mockFileQueryResult);
  });

  it('should properly encode fileId in URL', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockFileQueryResult);

    const query: FileQuery = {
      fileId: 'file with spaces & special chars',
      versionId: 'version/with/slashes',
    };

    const options: CheckFileTranslationsOptions = {};

    await _querySourceFile(query, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      '/v2/project/translations/files/status/file%20with%20spaces%20%26%20special%20chars?versionId=version%2Fwith%2Fslashes',
      expect.any(Object)
    );
  });

  it('should use GET method', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockFileQueryResult);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {};

    await _querySourceFile(query, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should handle JSON parsing errors', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Invalid JSON'));

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
    vi.mocked(apiRequest).mockResolvedValue(mockFileQueryResult);

    const query: FileQuery = {
      fileId: '',
      versionId: 'version-456',
    };

    const options: CheckFileTranslationsOptions = {};

    await _querySourceFile(query, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      '/v2/project/translations/files/status/?versionId=version-456',
      expect.any(Object)
    );
  });

  it('should handle empty versionId in query string', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockFileQueryResult);

    const query: FileQuery = {
      fileId: 'file-123',
      versionId: '',
    };

    const options: CheckFileTranslationsOptions = {};

    await _querySourceFile(query, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      '/v2/project/translations/files/status/file-123?',
      expect.any(Object)
    );
  });
});
