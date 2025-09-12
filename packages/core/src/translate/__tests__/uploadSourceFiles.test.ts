import { describe, it, expect, vi, beforeEach } from 'vitest';
import _uploadSourceFiles from '../uploadSourceFiles';
import { TranslationRequestConfig } from '../../types';
import {
  FileUpload,
  RequiredUploadFilesOptions,
} from '../../types-dir/uploadFiles';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import validateResponse from '../utils/validateResponse';
import handleFetchError from '../utils/handleFetchError';
import generateRequestHeaders from '../utils/generateRequestHeaders';

vi.mock('../utils/fetchWithTimeout');
vi.mock('../utils/validateResponse');
vi.mock('../utils/handleFetchError');
vi.mock('../utils/generateRequestHeaders');

describe('_uploadSourceFiles', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const createMockFileUpload = (
    overrides: Partial<FileUpload> = {}
  ): FileUpload => ({
    content: '{"key": "value"}',
    fileName: 'test.json',
    fileFormat: 'JSON',
    locale: 'en',
    ...overrides,
  });

  const createMockOptions = (
    overrides: Partial<RequiredUploadFilesOptions> = {}
  ): RequiredUploadFilesOptions => ({
    sourceLocale: 'en',
    timeout: 60000,
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

  it('should upload source files successfully', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload({ fileName: 'component.json' }),
      },
      {
        source: createMockFileUpload({
          fileName: 'page.json',
          content: '{"title": "Page"}',
        }),
      },
    ];

    const mockOptions = createMockOptions();

    const mockResponse = {
      success: true,
      uploadedFiles: [
        {
          fileId: 'file-123',
          versionId: 'version-456',
          fileName: 'component.json',
        },
        { fileId: 'file-789', versionId: 'version-012', fileName: 'page.json' },
      ],
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/files/upload-files',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
        body: JSON.stringify({
          data: [
            {
              source: {
                content: Buffer.from('{"key": "value"}').toString('base64'),
                fileName: 'component.json',
                fileFormat: 'JSON',
                locale: 'en',
              },
            },
            {
              source: {
                content: Buffer.from('{"title": "Page"}').toString('base64'),
                fileName: 'page.json',
                fileFormat: 'JSON',
                locale: 'en',
              },
            },
          ],
          sourceLocale: 'en',
        }),
      },
      60000
    );

    expect(validateResponse).toHaveBeenCalledWith(mockFetchResponse);
    expect(result).toEqual(mockResponse);
  });

  it('should handle single source file upload', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload(),
      },
    ];

    const mockOptions = createMockOptions();

    const mockResponse = {
      success: true,
      uploadedFiles: [
        { fileId: 'file-123', versionId: 'version-456', fileName: 'test.json' },
      ],
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(result.uploadedFiles).toHaveLength(1);
    expect(result.uploadedFiles[0].fileName).toBe('test.json');
  });

  it('should handle files with data format', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload({
          fileName: 'flat.json',
          dataFormat: 'flat',
        }),
      },
      {
        source: createMockFileUpload({
          fileName: 'nested.json',
          dataFormat: 'nested',
        }),
      },
    ];

    const mockOptions = createMockOptions();

    const mockResponse = { success: true };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      {
        method: 'POST',
        headers: expect.any(Object),
        body: JSON.stringify({
          data: [
            {
              source: {
                content: Buffer.from('{"key": "value"}').toString('base64'),
                fileName: 'flat.json',
                fileFormat: 'JSON',
                locale: 'en',
                dataFormat: 'flat',
              },
            },
            {
              source: {
                content: Buffer.from('{"key": "value"}').toString('base64'),
                fileName: 'nested.json',
                fileFormat: 'JSON',
                locale: 'en',
                dataFormat: 'nested',
              },
            },
          ],
          sourceLocale: 'en',
        }),
      },
      expect.any(Number)
    );
  });

  it('should handle different file formats', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload({
          fileName: 'component.js',
          fileFormat: 'JS',
          content: 'export const Hello = () => "Hello"',
        }),
      },
      {
        source: createMockFileUpload({
          fileName: 'content.md',
          fileFormat: 'MD',
          content: '# Hello World',
        }),
      },
    ];

    const mockOptions = createMockOptions();

    const mockResponse = { success: true };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      {
        method: 'POST',
        headers: expect.any(Object),
        body: JSON.stringify({
          data: [
            {
              source: {
                content: Buffer.from(
                  'export const Hello = () => "Hello"'
                ).toString('base64'),
                fileName: 'component.js',
                fileFormat: 'JS',
                locale: 'en',
              },
            },
            {
              source: {
                content: Buffer.from('# Hello World').toString('base64'),
                fileName: 'content.md',
                fileFormat: 'MD',
                locale: 'en',
              },
            },
          ],
          sourceLocale: 'en',
        }),
      },
      expect.any(Number)
    );
  });

  it('should use custom timeout when provided', async () => {
    const mockFiles = [{ source: createMockFileUpload() }];
    const mockOptions = createMockOptions({ timeout: 30000 });

    const mockResponse = { success: true };
    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      30000
    );
  });

  it('should limit timeout to maxTimeout', async () => {
    const mockFiles = [{ source: createMockFileUpload() }];
    const mockOptions = createMockOptions({ timeout: 1000000 }); // Very large timeout

    const mockResponse = { success: true };
    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    // Should use maxTimeout (60000) instead of the large provided timeout
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should handle fetch errors', async () => {
    const mockFiles = [{ source: createMockFileUpload() }];
    const mockOptions = createMockOptions();

    const fetchError = new Error('Network error');
    vi.mocked(fetchWithTimeout).mockRejectedValue(fetchError);
    vi.mocked(handleFetchError).mockImplementation(() => {
      throw fetchError;
    });

    await expect(
      _uploadSourceFiles(mockFiles, mockOptions, mockConfig)
    ).rejects.toThrow('Network error');

    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should use default base URL when not provided', async () => {
    const configWithoutBaseUrl = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const mockFiles = [{ source: createMockFileUpload() }];
    const mockOptions = createMockOptions();

    const mockResponse = { success: true };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadSourceFiles(mockFiles, mockOptions, configWithoutBaseUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('api2.gtx.dev/v2/project/files/upload-files'),
      expect.any(Object),
      expect.any(Number)
    );
  });


  it('should handle empty files array', async () => {
    const mockFiles: { source: FileUpload }[] = [];
    const mockOptions = createMockOptions();

    const mockResponse = { success: true, uploadedFiles: [] };
    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      {
        method: 'POST',
        headers: expect.any(Object),
        body: JSON.stringify({
          data: [],
          sourceLocale: 'en',
        }),
      },
      expect.any(Number)
    );

    expect(result.uploadedFiles).toEqual([]);
  });

  it('should handle different source locales', async () => {
    const mockFiles = [{ source: createMockFileUpload({ locale: 'es' }) }];
    const mockOptions = createMockOptions({ sourceLocale: 'es' });

    const mockResponse = { success: true };
    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      {
        method: 'POST',
        headers: expect.any(Object),
        body: JSON.stringify({
          data: [
            {
              source: {
                content: Buffer.from('{"key": "value"}').toString('base64'),
                fileName: 'test.json',
                fileFormat: 'JSON',
                locale: 'es',
              },
            },
          ],
          sourceLocale: 'es',
        }),
      },
      expect.any(Number)
    );
  });
});
