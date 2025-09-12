import { describe, it, expect, vi, beforeEach } from 'vitest';
import _enqueueFiles, { EnqueueOptions } from '../enqueueFiles';
import { TranslationRequestConfig, EnqueueFilesResult } from '../../types';
import { FileUploadRef } from '../../types-dir/uploadFiles';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import validateResponse from '../utils/validateResponse';
import handleFetchError from '../utils/handleFetchError';
import generateRequestHeaders from '../utils/generateRequestHeaders';

vi.mock('../utils/fetchWithTimeout');
vi.mock('../utils/validateResponse');
vi.mock('../utils/handleFetchError');
vi.mock('../utils/generateRequestHeaders');

describe('_enqueueFiles', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const createMockFile = (
    overrides: Partial<FileUploadRef> = {}
  ): FileUploadRef => ({
    fileId: 'file-123',
    versionId: 'version-456',
    fileName: 'test.json',
    fileFormat: 'JSON',
    ...overrides,
  });

  const createMockOptions = (
    overrides: Partial<EnqueueOptions> = {}
  ): EnqueueOptions => ({
    sourceLocale: 'en',
    targetLocales: ['es', 'fr'],
    publish: true,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchWithTimeout).mockReset();
    vi.mocked(validateResponse).mockReset();
    vi.mocked(handleFetchError).mockReset();
    vi.mocked(generateRequestHeaders).mockReset();

    vi.mocked(generateRequestHeaders).mockReturnValue({
      'Content-Type': 'application/json',
      'x-gt-api-key': 'test-api-key',
      'x-gt-project-id': 'test-project',
    });
  });

  it('should enqueue files successfully', async () => {
    const mockFiles = [
      createMockFile({ fileName: 'component.json' }),
      createMockFile({ fileName: 'page.json', fileId: 'file-456' }),
    ];

    const mockOptions = createMockOptions();

    const mockResponse: EnqueueFilesResult = {
      data: {
        'component.json': {
          versionId: 'version-456',
          fileName: 'component.json',
        },
        'page.json': { versionId: 'version-789', fileName: 'page.json' },
      },
      message: 'Files enqueued successfully',
      locales: ['es', 'fr'],
      translations: [],
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/translations/enqueue',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
        body: JSON.stringify({
          files: [
            {
              fileId: 'file-123',
              versionId: 'version-456',
              fileName: 'component.json',
            },
            {
              fileId: 'file-456',
              versionId: 'version-456',
              fileName: 'page.json',
            },
          ],
          targetLocales: ['es', 'fr'],
          sourceLocale: 'en',
          publish: true,
          requireApproval: undefined,
          modelProvider: undefined,
          force: undefined,
        }),
      },
      60000
    );

    expect(validateResponse).toHaveBeenCalledWith(mockFetchResponse);
    expect(result).toEqual(mockResponse);
  });

  it('should handle single file enqueueing', async () => {
    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions({ targetLocales: ['es'] });

    const mockResponse: EnqueueFilesResult = {
      data: {
        'test.json': { versionId: 'version-456', fileName: 'test.json' },
      },
      message: 'File enqueued successfully',
      locales: ['es'],
      translations: [],
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    expect(result.locales).toEqual(['es']);
    expect(Object.keys(result.data)).toHaveLength(1);
  });

  it('should handle all optional parameters', async () => {
    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions({
      publish: false,
      requireApproval: true,
      modelProvider: 'openai',
      force: true,
      timeout: 30000,
    });

    const mockResponse: EnqueueFilesResult = {
      data: {
        'test.json': { versionId: 'version-456', fileName: 'test.json' },
      },
      message: 'Files enqueued successfully',
      locales: ['es', 'fr'],
      translations: [],
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      {
        method: 'POST',
        headers: expect.any(Object),
        body: JSON.stringify({
          files: [
            {
              fileId: 'file-123',
              versionId: 'version-456',
              fileName: 'test.json',
            },
          ],
          targetLocales: ['es', 'fr'],
          sourceLocale: 'en',
          publish: false,
          requireApproval: true,
          modelProvider: 'openai',
          force: true,
        }),
      },
      30000
    );
  });

  it('should use custom timeout when provided', async () => {
    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions({ timeout: 60000 });

    const mockResponse: EnqueueFilesResult = {
      data: {
        'test.json': { versionId: 'version-456', fileName: 'test.json' },
      },
      message: 'Files enqueued successfully',
      locales: ['es', 'fr'],
      translations: [],
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should limit timeout to maxTimeout', async () => {
    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions({ timeout: 1000000 }); // Very large timeout

    const mockResponse: EnqueueFilesResult = {
      data: {
        'test.json': { versionId: 'version-456', fileName: 'test.json' },
      },
      message: 'Files enqueued successfully',
      locales: ['es', 'fr'],
      translations: [],
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    // Should use maxTimeout (60000) instead of the large provided timeout
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should handle multiple target locales', async () => {
    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions({
      targetLocales: ['es', 'fr', 'de', 'it', 'pt'],
    });

    const mockResponse: EnqueueFilesResult = {
      data: {
        'test.json': { versionId: 'version-456', fileName: 'test.json' },
      },
      message: 'Files enqueued successfully',
      locales: ['es', 'fr', 'de', 'it', 'pt'],
      translations: [],
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    expect(result.locales).toEqual(['es', 'fr', 'de', 'it', 'pt']);
  });

  it('should handle empty files array', async () => {
    const mockFiles: FileUploadRef[] = [];
    const mockOptions = createMockOptions();

    const mockResponse: EnqueueFilesResult = {
      data: {},
      message: 'No files to enqueue',
      locales: ['es', 'fr'],
      translations: [],
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    expect(result.data).toEqual({});
    expect(Object.keys(result.data)).toHaveLength(0);
  });

  it('should handle fetch errors', async () => {
    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions();

    const fetchError = new Error('Network error');
    vi.mocked(fetchWithTimeout).mockRejectedValue(fetchError);
    vi.mocked(handleFetchError).mockImplementation(() => {
      throw fetchError;
    });

    await expect(
      _enqueueFiles(mockFiles, mockOptions, mockConfig)
    ).rejects.toThrow('Network error');

    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should use default base URL when not provided', async () => {
    const configWithoutBaseUrl = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions();

    const mockResponse: EnqueueFilesResult = {
      data: {
        'test.json': { versionId: 'version-456', fileName: 'test.json' },
      },
      message: 'Files enqueued successfully',
      locales: ['es', 'fr'],
      translations: [],
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _enqueueFiles(mockFiles, mockOptions, configWithoutBaseUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('api2.gtx.dev/v2/project/translations/enqueue'),
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle response with translations', async () => {
    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions();

    const mockResponse: EnqueueFilesResult = {
      data: {
        'test.json': { versionId: 'version-456', fileName: 'test.json' },
      },
      message: 'Files enqueued successfully',
      locales: ['es', 'fr'],
      translations: [
        {
          locale: 'es',
          metadata: {
            context: 'test',
            id: 'test-id',
            sourceLocale: 'en',
            actionType: 'standard',
          },
          fileId: 'file-123',
          fileName: 'test.json',
          versionId: 'version-456',
          id: 'translation-1',
          isReady: false,
          downloadUrl: null,
        },
      ],
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    expect(result.translations).toHaveLength(1);
    expect(result.translations[0].locale).toBe('es');
    expect(result.translations[0].isReady).toBe(false);
  });

  it('should handle validation errors', async () => {
    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions();

    const mockFetchResponse = {
      json: vi.fn(),
    } as unknown as Response;

    const validationError = new Error('Invalid request');
    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockRejectedValue(validationError);

    await expect(
      _enqueueFiles(mockFiles, mockOptions, mockConfig)
    ).rejects.toThrow('Invalid request');

    expect(validateResponse).toHaveBeenCalledWith(mockFetchResponse);
  });
});
