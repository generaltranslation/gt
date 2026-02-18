import { describe, it, expect, vi, beforeEach } from 'vitest';
import _setupProject, { SetupProjectResult } from '../setupProject';
import { TranslationRequestConfig } from '../../types';
import { FileReference } from '../../types-dir/api/file';
import apiRequest from '../utils/apiRequest';

vi.mock('../utils/apiRequest');

describe('_setupProject', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should setup project successfully', async () => {
    const mockFiles = [
      createMockFile({ fileName: 'component.json' }),
      createMockFile({ fileName: 'page.json', fileId: 'file-456' }),
    ];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-789',
      status: 'queued',
    };

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    const result = await _setupProject(mockFiles, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v2/project/setup/generate',
      {
        body: {
          files: [
            {
              branchId: 'branch-123',
              fileId: 'file-123',
              versionId: 'version-456',
            },
            {
              branchId: 'branch-123',
              fileId: 'file-456',
              versionId: 'version-456',
            },
          ],
          locales: undefined,
          force: undefined,
        },
        timeout: undefined,
      }
    );

    expect(result).toEqual(mockResponse);
    expect(result.status).toBe('queued');
    // @ts-expect-error - setupJobId is not defined in the type
    expect(result.setupJobId).toBe('setup-job-789');
  });

  it('should handle single file setup', async () => {
    const mockFiles = [createMockFile()];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-123',
      status: 'queued',
    };

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    const result = await _setupProject(mockFiles, mockConfig);

    expect(result.status).toBe('queued');
    // @ts-expect-error - setupJobId is not defined in the type
    expect(result.setupJobId).toBe('setup-job-123');
  });

  it('should use custom timeout when provided', async () => {
    const mockFiles = [createMockFile()];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-456',
      status: 'queued',
    };

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    await _setupProject(mockFiles, mockConfig, { timeoutMs: 45000 });

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: 45000 })
    );
  });

  it('should handle files with data format', async () => {
    const mockFiles = [
      createMockFile({
        fileName: 'data.json',
        fileFormat: 'JSON',
        dataFormat: 'flat',
      }),
      createMockFile({
        fileName: 'nested.json',
        fileFormat: 'JSON',
        dataFormat: 'nested',
        fileId: 'file-456',
      }),
    ];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-789',
      status: 'queued',
    };

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    await _setupProject(mockFiles, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: {
          files: [
            {
              branchId: 'branch-123',
              fileId: 'file-123',
              versionId: 'version-456',
            },
            {
              branchId: 'branch-123',
              fileId: 'file-456',
              versionId: 'version-456',
            },
          ],
          locales: undefined,
          force: undefined,
        },
      })
    );
  });

  it('should handle files without data format', async () => {
    const mockFiles = [createMockFile()];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-789',
      status: 'queued',
    };

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    await _setupProject(mockFiles, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: {
          files: [
            {
              branchId: 'branch-123',
              fileId: 'file-123',
              versionId: 'version-456',
            },
          ],
          locales: undefined,
          force: undefined,
        },
      })
    );
  });

  it('should include locales in request body when provided', async () => {
    const mockFiles = [createMockFile()];
    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-locales',
      status: 'queued',
    };

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    const locales = ['es', 'fr-CA'];
    await _setupProject(mockFiles, mockConfig, { locales });

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v2/project/setup/generate',
      {
        body: {
          files: [
            {
              branchId: 'branch-123',
              fileId: 'file-123',
              versionId: 'version-456',
            },
          ],
          locales,
          force: undefined,
        },
        timeout: undefined,
      }
    );
  });

  it('should handle different file formats', async () => {
    const mockFiles = [
      createMockFile({ fileName: 'component.js', fileFormat: 'JS' }),
      createMockFile({
        fileName: 'styles.css',
        fileFormat: 'HTML',
        fileId: 'file-456',
      }),
      createMockFile({
        fileName: 'content.md',
        fileFormat: 'MD',
        fileId: 'file-789',
      }),
      createMockFile({
        fileName: 'template.tsx',
        fileFormat: 'TS',
        fileId: 'file-012',
      }),
    ];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-789',
      status: 'queued',
    };

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    await _setupProject(mockFiles, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: {
          files: [
            {
              branchId: 'branch-123',
              fileId: 'file-123',
              versionId: 'version-456',
            },
            {
              branchId: 'branch-123',
              fileId: 'file-456',
              versionId: 'version-456',
            },
            {
              branchId: 'branch-123',
              fileId: 'file-789',
              versionId: 'version-456',
            },
            {
              branchId: 'branch-123',
              fileId: 'file-012',
              versionId: 'version-456',
            },
          ],
          locales: undefined,
          force: undefined,
        },
      })
    );
  });

  it('should handle empty files array', async () => {
    const mockFiles: FileReference[] = [];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-empty',
      status: 'queued',
    };

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    const result = await _setupProject(mockFiles, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: {
          files: [],
          locales: undefined,
          force: undefined,
        },
      })
    );

    expect(result.status).toBe('queued');
    // @ts-expect-error - setupJobId is not defined in the type
    expect(result.setupJobId).toBe('setup-job-empty');
  });

  it('should handle fetch errors', async () => {
    const mockFiles = [createMockFile()];

    const fetchError = new Error('Network error');
    vi.mocked(apiRequest).mockRejectedValue(fetchError);

    await expect(_setupProject(mockFiles, mockConfig)).rejects.toThrow(
      'Network error'
    );
  });

  it('should use default base URL when not provided', async () => {
    const configWithoutBaseUrl = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const mockFiles = [createMockFile()];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-456',
      status: 'queued',
    };

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    await _setupProject(mockFiles, configWithoutBaseUrl);

    expect(apiRequest).toHaveBeenCalledWith(
      configWithoutBaseUrl,
      '/v2/project/setup/generate',
      expect.any(Object)
    );
  });

  it('should use default timeout when not provided', async () => {
    const mockFiles = [createMockFile()];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-456',
      status: 'queued',
    };

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    await _setupProject(mockFiles, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: undefined })
    );
  });
});
