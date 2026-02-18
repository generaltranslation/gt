import { describe, it, expect, vi, beforeEach } from 'vitest';
import _enqueueFiles, { EnqueueOptions } from '../enqueueFiles';
import { TranslationRequestConfig, EnqueueFilesResult } from '../../types';
import { FileReference } from '../../types-dir/api/file';
import apiRequest from '../utils/apiRequest';

vi.mock('../utils/apiRequest');

describe('_enqueueFiles', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const createMockFile = (
    overrides: Partial<FileReference> = {}
  ): FileReference => ({
    branchId: 'branch-123',
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
  });

  it('should enqueue files successfully', async () => {
    const mockFiles = [
      createMockFile({ fileName: 'component.json' }),
      createMockFile({ fileName: 'page.json', fileId: 'file-456' }),
    ];

    const mockOptions = createMockOptions();

    const mockApiResponse: EnqueueFilesResult = {
      jobData: {
        'job-1': {
          sourceFileId: 'source-123',
          fileId: 'file-123',
          versionId: 'version-456',
          branchId: 'branch-123',
          targetLocale: 'es',
          projectId: 'test-project',
          force: true,
          modelProvider: undefined,
        },
      },
      locales: ['es', 'fr'],
      message: 'Successfully enqueued 1 file translation jobs in 1 batch(es)',
    };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    const result = await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v2/project/translations/enqueue',
      {
        body: {
          files: [
            {
              branchId: 'branch-123',
              fileId: 'file-123',
              versionId: 'version-456',
              fileName: 'component.json',
            },
            {
              branchId: 'branch-123',
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
        },
        timeout: undefined,
      }
    );

    expect(result).toEqual(mockApiResponse);
  });

  it('should handle single file enqueueing', async () => {
    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions({ targetLocales: ['es'] });

    const mockApiResponse: EnqueueFilesResult = {
      jobData: {
        'job-1': {
          sourceFileId: 'source-123',
          fileId: 'file-123',
          versionId: 'version-456',
          branchId: 'branch-123',
          targetLocale: 'es',
          projectId: 'test-project',
          force: true,
          modelProvider: undefined,
        },
      },
      message: 'File enqueued successfully',
      locales: ['es'],
    };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    const result = await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    expect(result.locales).toEqual(['es']);
    expect(Object.keys(result.jobData)).toHaveLength(1);
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

    const mockApiResponse: EnqueueFilesResult = {
      jobData: {
        'job-1': {
          sourceFileId: 'source-123',
          fileId: 'file-123',
          versionId: 'version-456',
          branchId: 'branch-123',
          targetLocale: 'es',
          projectId: 'test-project',
          force: true,
          modelProvider: undefined,
        },
      },
      message: 'Files enqueued successfully',
      locales: ['es', 'fr'],
    };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({
          publish: false,
          requireApproval: true,
          modelProvider: 'openai',
          force: true,
        }),
        timeout: 30000,
      })
    );
  });

  it('should use custom timeout when provided', async () => {
    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions({ timeout: 60000 });

    const mockApiResponse: EnqueueFilesResult = {
      jobData: {
        'job-1': {
          sourceFileId: 'source-123',
          fileId: 'file-123',
          versionId: 'version-456',
          branchId: 'branch-123',
          targetLocale: 'es',
          projectId: 'test-project',
          force: true,
          modelProvider: undefined,
        },
      },
      message: 'Files enqueued successfully',
      locales: ['es', 'fr'],
    };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: 60000 })
    );
  });

  it('should handle multiple target locales', async () => {
    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions({
      targetLocales: ['es', 'fr', 'de', 'it', 'pt'],
    });

    const mockApiResponse: EnqueueFilesResult = {
      jobData: {
        'job-1': {
          sourceFileId: 'source-123',
          fileId: 'file-123',
          versionId: 'version-456',
          branchId: 'branch-123',
          targetLocale: 'es',
          projectId: 'test-project',
          force: true,
          modelProvider: undefined,
        },
      },
      message: 'Files enqueued successfully',
      locales: ['es', 'fr', 'de', 'it', 'pt'],
    };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    const result = await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    expect(result.locales).toEqual(['es', 'fr', 'de', 'it', 'pt']);
  });

  it('should handle empty files array', async () => {
    const mockFiles: FileReference[] = [];
    const mockOptions = createMockOptions();

    const result = await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    // With batching, empty array returns early
    expect(result.jobData).toEqual({});
    expect(Object.keys(result.jobData)).toHaveLength(0);
  });

  it('should handle fetch errors', async () => {
    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions();

    const fetchError = new Error('Network error');
    vi.mocked(apiRequest).mockRejectedValue(fetchError);

    await expect(
      _enqueueFiles(mockFiles, mockOptions, mockConfig)
    ).rejects.toThrow('Network error');
  });

  it('should use default base URL when not provided', async () => {
    const configWithoutBaseUrl = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions();

    const mockApiResponse: EnqueueFilesResult = {
      jobData: {
        'job-1': {
          sourceFileId: 'source-123',
          fileId: 'file-123',
          versionId: 'version-456',
          branchId: 'branch-123',
          targetLocale: 'es',
          projectId: 'test-project',
          force: true,
          modelProvider: undefined,
        },
      },
      message: 'Files enqueued successfully',
      locales: ['es', 'fr'],
    };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _enqueueFiles(mockFiles, mockOptions, configWithoutBaseUrl);

    expect(apiRequest).toHaveBeenCalledWith(
      configWithoutBaseUrl,
      '/v2/project/translations/enqueue',
      expect.any(Object)
    );
  });

  it('should handle response with translations', async () => {
    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions();

    const mockApiResponse: EnqueueFilesResult = {
      jobData: {
        'job-1': {
          sourceFileId: 'source-123',
          fileId: 'file-123',
          versionId: 'version-456',
          branchId: 'branch-123',
          targetLocale: 'es',
          projectId: 'test-project',
          force: true,
          modelProvider: undefined,
        },
      },
      message: 'Files enqueued successfully',
      locales: ['es', 'fr'],
    };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    const result = await _enqueueFiles(mockFiles, mockOptions, mockConfig);

    expect(Object.keys(result.jobData)).toHaveLength(1);
  });

  it('should handle validation errors', async () => {
    const mockFiles = [createMockFile()];
    const mockOptions = createMockOptions();

    const validationError = new Error('Invalid request');
    vi.mocked(apiRequest).mockRejectedValue(validationError);

    await expect(
      _enqueueFiles(mockFiles, mockOptions, mockConfig)
    ).rejects.toThrow('Invalid request');
  });
});
