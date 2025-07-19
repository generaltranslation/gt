import { describe, it, expect, vi, beforeEach } from 'vitest';
import _checkFileTranslations from '../checkFileTranslations';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import validateResponse from '../utils/validateResponse';
import handleFetchError from '../utils/handleFetchError';
import generateRequestHeaders from '../utils/generateRequestHeaders';
import { TranslationRequestConfig } from '../../types';
import {
  FileTranslationQuery,
  CheckFileTranslationsOptions,
  CheckFileTranslationsResult,
} from '../../types-dir/checkFileTranslations';

vi.mock('../utils/fetchWithTimeout');
vi.mock('../utils/validateResponse');
vi.mock('../utils/handleFetchError');
vi.mock('../utils/generateRequestHeaders');

describe.sequential('_checkFileTranslations', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const mockCheckFileTranslationsResult: CheckFileTranslationsResult = {
    translations: [
      {
        isReady: true,
        fileName: 'src/components/Button.json',
        locale: 'es',
        id: 'translation-1',
        fileId: 'file-1',
        versionId: 'version-1',
        metadata: {},
        downloadUrl: 'https://example.com/download/1',
      },
      {
        isReady: false,
        fileName: 'src/pages/Home.json',
        locale: 'fr',
        id: 'translation-2',
        fileId: 'file-2',
        versionId: 'version-2',
        metadata: {},
        downloadUrl: 'https://example.com/download/2',
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

  it('should check file translation status successfully', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockCheckFileTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const data: FileTranslationQuery[] = [
      {
        versionId: 'version-1',
        fileName: 'src/components/Button.json',
        locale: 'es',
      },
      {
        versionId: 'version-2',
        fileName: 'src/pages/Home.json',
        locale: 'fr',
      },
    ];

    const options: CheckFileTranslationsOptions = {
      timeout: 5000,
    };

    const result = await _checkFileTranslations(data, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/files/retrieve',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
        body: JSON.stringify({ files: data }),
      },
      5000
    );
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
    expect(result).toEqual(mockCheckFileTranslationsResult);
  });

  it('should use config baseUrl when provided', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockCheckFileTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const data: FileTranslationQuery[] = [
      {
        versionId: 'version-1',
        fileName: 'test.json',
        locale: 'es',
      },
    ];

    const options: CheckFileTranslationsOptions = {};

    await _checkFileTranslations(data, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/files/retrieve',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockCheckFileTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const data: FileTranslationQuery[] = [
      {
        versionId: 'version-1',
        fileName: 'test.json',
        locale: 'es',
      },
    ];

    const options: CheckFileTranslationsOptions = {};

    await _checkFileTranslations(data, options, configWithoutUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://api2.gtx.dev/v1/project/translations/files/retrieve'
      ),
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should use default timeout when not specified', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockCheckFileTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const data: FileTranslationQuery[] = [
      {
        versionId: 'version-1',
        fileName: 'test.json',
        locale: 'es',
      },
    ];

    const options: CheckFileTranslationsOptions = {};

    await _checkFileTranslations(data, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should enforce maximum timeout limit', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockCheckFileTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const data: FileTranslationQuery[] = [
      {
        versionId: 'version-1',
        fileName: 'test.json',
        locale: 'es',
      },
    ];

    const options: CheckFileTranslationsOptions = {
      timeout: 99999,
    };

    await _checkFileTranslations(data, options, mockConfig);

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

    const data: FileTranslationQuery[] = [
      {
        versionId: 'version-1',
        fileName: 'test.json',
        locale: 'es',
      },
    ];

    const options: CheckFileTranslationsOptions = {};

    await expect(
      _checkFileTranslations(data, options, mockConfig)
    ).rejects.toThrow('Network error');
    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should handle validation errors', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockCheckFileTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockImplementationOnce(() => {
      throw new Error('Validation failed');
    });

    const data: FileTranslationQuery[] = [
      {
        versionId: 'version-1',
        fileName: 'test.json',
        locale: 'es',
      },
    ];

    const options: CheckFileTranslationsOptions = {};

    await expect(
      _checkFileTranslations(data, options, mockConfig)
    ).rejects.toThrow('Validation failed');
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
  });

  it('should handle empty data array', async () => {
    const emptyResult: CheckFileTranslationsResult = {
      translations: [],
    };

    const mockResponse = {
      json: vi.fn().mockResolvedValue(emptyResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const data: FileTranslationQuery[] = [];
    const options: CheckFileTranslationsOptions = {};

    const result = await _checkFileTranslations(data, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ files: [] }),
      }),
      expect.any(Number)
    );
    expect(result).toEqual(emptyResult);
  });

  it('should include files in request body', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockCheckFileTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const data: FileTranslationQuery[] = [
      {
        versionId: 'version-1',
        fileName: 'file1.json',
        locale: 'es',
      },
      {
        versionId: 'version-2',
        fileName: 'file2.json',
        locale: 'fr',
      },
    ];

    const options: CheckFileTranslationsOptions = {};

    await _checkFileTranslations(data, options, mockConfig);

    const requestBody = JSON.parse(
      vi.mocked(fetchWithTimeout).mock.calls[0][1].body as string
    );
    expect(requestBody).toEqual({
      files: data,
    });
  });

  it('should handle single file query', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockCheckFileTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const data: FileTranslationQuery[] = [
      {
        versionId: 'version-1',
        fileName: 'test.json',
        locale: 'es',
      },
    ];

    const options: CheckFileTranslationsOptions = {};

    await _checkFileTranslations(data, options, mockConfig);

    const requestBody = JSON.parse(
      vi.mocked(fetchWithTimeout).mock.calls[0][1].body as string
    );
    expect(requestBody.files).toHaveLength(1);
    expect(requestBody.files[0]).toEqual({
      versionId: 'version-1',
      fileName: 'test.json',
      locale: 'es',
    });
  });

  it('should handle multiple locales for different files', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockCheckFileTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const data: FileTranslationQuery[] = [
      {
        versionId: 'version-1',
        fileName: 'components.json',
        locale: 'es',
      },
      {
        versionId: 'version-1',
        fileName: 'components.json',
        locale: 'fr',
      },
      {
        versionId: 'version-2',
        fileName: 'pages.json',
        locale: 'de',
      },
    ];

    const options: CheckFileTranslationsOptions = {
      timeout: 8000,
    };

    const result = await _checkFileTranslations(data, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ files: data }),
      }),
      8000
    );
    expect(result).toEqual(mockCheckFileTranslationsResult);
  });

  it('should handle JSON parsing errors', async () => {
    const mockResponse = {
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const data: FileTranslationQuery[] = [
      {
        versionId: 'version-1',
        fileName: 'test.json',
        locale: 'es',
      },
    ];

    const options: CheckFileTranslationsOptions = {};

    await expect(
      _checkFileTranslations(data, options, mockConfig)
    ).rejects.toThrow('Invalid JSON');
  });
});
