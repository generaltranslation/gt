import { describe, it, expect, vi, beforeEach } from 'vitest';
import _setupProject, { SetupProjectResult } from '../setupProject';
import { TranslationRequestConfig } from '../../types';
import { FileUploadRef } from '../../types-dir/uploadFiles';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import validateResponse from '../utils/validateResponse';
import handleFetchError from '../utils/handleFetchError';
import generateRequestHeaders from '../utils/generateRequestHeaders';

vi.mock('../utils/fetchWithTimeout');
vi.mock('../utils/validateResponse');
vi.mock('../utils/handleFetchError');
vi.mock('../utils/generateRequestHeaders');

describe('_setupProject', () => {
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

  it('should setup project successfully', async () => {
    const mockFiles = [
      createMockFile({ fileName: 'component.json' }),
      createMockFile({ fileName: 'page.json', fileId: 'file-456' }),
    ];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-789',
      status: 'queued',
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _setupProject(mockFiles, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/setup/generate',
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
              fileFormat: 'JSON',
            },
            {
              fileId: 'file-456',
              versionId: 'version-456',
              fileName: 'page.json',
              fileFormat: 'JSON',
            },
          ],
        }),
      },
      60000
    );

    expect(validateResponse).toHaveBeenCalledWith(mockFetchResponse);
    expect(result).toEqual(mockResponse);
    expect(result.status).toBe('queued');
    expect(result.setupJobId).toBe('setup-job-789');
  });

  it('should handle single file setup', async () => {
    const mockFiles = [createMockFile()];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-123',
      status: 'queued',
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _setupProject(mockFiles, mockConfig);

    expect(result.setupJobId).toBe('setup-job-123');
    expect(result.status).toBe('queued');
  });

  it('should use custom timeout when provided', async () => {
    const mockFiles = [createMockFile()];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-456',
      status: 'queued',
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _setupProject(mockFiles, mockConfig, { timeoutMs: 45000 });

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      45000
    );
  });

  it('should limit timeout to maxTimeout', async () => {
    const mockFiles = [createMockFile()];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-456',
      status: 'queued',
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _setupProject(mockFiles, mockConfig, { timeoutMs: 1000000 }); // Very large timeout

    // Should use maxTimeout (60000) instead of the large provided timeout
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
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

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _setupProject(mockFiles, mockConfig);

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
              fileName: 'data.json',
              fileFormat: 'JSON',
              dataFormat: 'flat',
            },
            {
              fileId: 'file-456',
              versionId: 'version-456',
              fileName: 'nested.json',
              fileFormat: 'JSON',
              dataFormat: 'nested',
            },
          ],
        }),
      },
      expect.any(Number)
    );
  });

  it('should handle files without data format', async () => {
    const mockFiles = [createMockFile()];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-789',
      status: 'queued',
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _setupProject(mockFiles, mockConfig);

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
              fileFormat: 'JSON',
            },
          ],
        }),
      },
      expect.any(Number)
    );
  });

  it('should include locales in request body when provided', async () => {
    const mockFiles = [createMockFile()];
    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-locales',
      status: 'queued',
    };
    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const locales = ['es', 'fr-CA'];
    await _setupProject(mockFiles, mockConfig, { locales });

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/setup/generate',
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
              fileName: 'test.json',
              fileFormat: 'JSON',
            },
          ],
          locales,
        }),
      },
      60000
    );
  });

  it('should handle different file formats', async () => {
    const mockFiles = [
      createMockFile({ fileName: 'component.js', fileFormat: 'JS' }),
      createMockFile({
        fileName: 'styles.css',
        fileFormat: 'CSS',
        fileId: 'file-456',
      }),
      createMockFile({
        fileName: 'content.md',
        fileFormat: 'MD',
        fileId: 'file-789',
      }),
      createMockFile({
        fileName: 'template.tsx',
        fileFormat: 'TSX',
        fileId: 'file-012',
      }),
    ];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-789',
      status: 'queued',
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _setupProject(mockFiles, mockConfig);

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
              fileName: 'component.js',
              fileFormat: 'JS',
            },
            {
              fileId: 'file-456',
              versionId: 'version-456',
              fileName: 'styles.css',
              fileFormat: 'CSS',
            },
            {
              fileId: 'file-789',
              versionId: 'version-456',
              fileName: 'content.md',
              fileFormat: 'MD',
            },
            {
              fileId: 'file-012',
              versionId: 'version-456',
              fileName: 'template.tsx',
              fileFormat: 'TSX',
            },
          ],
        }),
      },
      expect.any(Number)
    );
  });

  it('should handle empty files array', async () => {
    const mockFiles: FileUploadRef[] = [];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-empty',
      status: 'queued',
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _setupProject(mockFiles, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      {
        method: 'POST',
        headers: expect.any(Object),
        body: JSON.stringify({
          files: [],
        }),
      },
      expect.any(Number)
    );

    expect(result.setupJobId).toBe('setup-job-empty');
  });

  it('should handle fetch errors', async () => {
    const mockFiles = [createMockFile()];

    const fetchError = new Error('Network error');
    vi.mocked(fetchWithTimeout).mockRejectedValue(fetchError);
    vi.mocked(handleFetchError).mockImplementation(() => {
      throw fetchError;
    });

    await expect(_setupProject(mockFiles, mockConfig)).rejects.toThrow(
      'Network error'
    );

    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
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

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _setupProject(mockFiles, configWithoutBaseUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('api2.gtx.dev/v2/project/setup/generate'),
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should use default timeout when not provided', async () => {
    const mockFiles = [createMockFile()];

    const mockResponse: SetupProjectResult = {
      setupJobId: 'setup-job-456',
      status: 'queued',
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _setupProject(mockFiles, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000 // default maxTimeout
    );
  });
});
