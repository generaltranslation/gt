import { describe, it, expect, vi, beforeEach } from 'vitest';
import _enqueueFiles from '../enqueueFiles';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import validateResponse from '../utils/validateResponse';
import handleFetchError from '../utils/handleFetchError';
import generateRequestHeaders from '../utils/generateRequestHeaders';
import { TranslationRequestConfig } from '../../types';
import {
  FileToTranslate,
  EnqueueFilesResult,
  RequiredEnqueueFilesOptions,
} from '../../types-dir/enqueueFiles';

vi.mock('../utils/fetchWithTimeout');
vi.mock('../utils/validateResponse');
vi.mock('../utils/handleFetchError');
vi.mock('../utils/generateRequestHeaders');

describe.sequential('_enqueueFiles', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const mockEnqueueFilesResult: EnqueueFilesResult = {
    translations: [
      {
        locale: 'es',
        metadata: {},
        fileId: 'file-1',
        fileName: 'test.json',
        versionId: 'version-123',
        id: 'translation-1',
        isReady: true,
        downloadUrl: 'https://example.com/download/1',
      },
    ],
    data: {
      'test.json': {
        fileName: 'test.json',
        versionId: 'version-123',
      },
    },
    locales: ['es', 'fr'],
    message: 'Files uploaded successfully',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateRequestHeaders).mockReturnValue({
      'Content-Type': 'application/json',
      'x-gt-api-key': 'test-api-key',
      'x-gt-project-id': 'test-project',
    });
  });

  it('should upload files successfully', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueFilesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: FileToTranslate[] = [
      {
        fileName: 'test.json',
        content: '{"hello": "world"}',
        fileFormat: 'JSON',
      },
    ];

    const options: RequiredEnqueueFilesOptions = {
      sourceLocale: 'en',
      targetLocales: ['es', 'fr'],
      publish: true,
      version: 'version-123',
      description: 'Test upload',
      timeout: 5000,
    };

    const result = await _enqueueFiles(files, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/translations/files/upload',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
        body: expect.any(String),
      },
      5000
    );

    // Verify the JSON body structure
    const fetchCall = vi.mocked(fetchWithTimeout).mock.calls[0];
    const bodyJson = JSON.parse(fetchCall[1].body as string);
    expect(bodyJson).toEqual({
      files: [
        {
          content: Buffer.from('{"hello": "world"}').toString('base64'),
          fileName: 'test.json',
          fileFormat: 'JSON',
          fileDataFormat: undefined,
          formatMetadata: undefined,
        },
      ],
      sourceLocale: 'en',
      targetLocales: ['es', 'fr'],
      projectId: 'test-project',
      publish: true,
      requireApproval: undefined,
      version: 'version-123',
      modelProvider: undefined,
    });

    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
    expect(result).toEqual(mockEnqueueFilesResult);
  });

  it('should handle multiple files', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueFilesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: FileToTranslate[] = [
      {
        fileName: 'test1.json',
        content: '{"hello": "world"}',
        fileFormat: 'JSON',
        dataFormat: 'JSX',
      },
      {
        fileName: 'test2.yaml',
        content: 'hello: world',
        fileFormat: 'YAML',
        dataFormat: 'ICU',
      },
    ];

    const options: RequiredEnqueueFilesOptions = {
      sourceLocale: 'en',
      targetLocales: ['es'],
      publish: false,
      version: 'version-123',
      description: 'Multi-file upload',
    };

    await _enqueueFiles(files, options, mockConfig);

    const fetchCall = vi.mocked(fetchWithTimeout).mock.calls[0];
    const bodyJson = JSON.parse(fetchCall[1].body as string);

    // Verify JSON body contains correct files array
    expect(bodyJson.files).toHaveLength(2);

    // Verify file metadata is properly set
    expect(bodyJson.files[0].fileName).toBe('test1.json');
    expect(bodyJson.files[1].fileName).toBe('test2.yaml');
    expect(bodyJson.files[0].fileFormat).toBe('JSON');
    expect(bodyJson.files[1].fileFormat).toBe('YAML');
    expect(bodyJson.files[0].fileDataFormat).toBe('JSX');
    expect(bodyJson.files[1].fileDataFormat).toBe('ICU');

    // Verify files contain base64 encoded content
    expect(bodyJson.files[0].content).toBe(
      Buffer.from('{"hello": "world"}').toString('base64')
    );
    expect(bodyJson.files[1].content).toBe(
      Buffer.from('hello: world').toString('base64')
    );
  });

  it('should use default timeout when not specified', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueFilesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: FileToTranslate[] = [
      {
        fileName: 'test.json',
        content: '{}',
        fileFormat: 'JSON',
      },
    ];

    const options: RequiredEnqueueFilesOptions = {
      sourceLocale: 'en',
      targetLocales: ['es'],
      publish: false,
      version: 'version-123',
      description: 'Test',
    };

    await _enqueueFiles(files, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should enforce maximum timeout limit', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueFilesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: FileToTranslate[] = [
      {
        fileName: 'test.json',
        content: '{}',
        fileFormat: 'JSON',
      },
    ];

    const options: RequiredEnqueueFilesOptions = {
      sourceLocale: 'en',
      targetLocales: ['es'],
      publish: false,
      version: 'version-123',
      description: 'Test',
      timeout: 99999,
    };

    await _enqueueFiles(files, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueFilesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const files: FileToTranslate[] = [
      {
        fileName: 'test.json',
        content: '{}',
        fileFormat: 'JSON',
      },
    ];

    const options: RequiredEnqueueFilesOptions = {
      sourceLocale: 'en',
      targetLocales: ['es'],
      publish: false,
      version: 'version-123',
      description: 'Test',
    };

    await _enqueueFiles(files, options, configWithoutUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://api2.gtx.dev/v2/project/translations/files/upload'
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

    const files: FileToTranslate[] = [
      {
        fileName: 'test.json',
        content: '{}',
        fileFormat: 'JSON',
      },
    ];

    const options: RequiredEnqueueFilesOptions = {
      sourceLocale: 'en',
      targetLocales: ['es'],
      publish: false,
      version: 'version-123',
      description: 'Test',
    };

    await expect(_enqueueFiles(files, options, mockConfig)).rejects.toThrow(
      'Network error'
    );
    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should handle validation errors', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueFilesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockImplementationOnce(() => {
      throw new Error('Validation failed');
    });

    const files: FileToTranslate[] = [
      {
        fileName: 'test.json',
        content: '{}',
        fileFormat: 'JSON',
      },
    ];

    const options: RequiredEnqueueFilesOptions = {
      sourceLocale: 'en',
      targetLocales: ['es'],
      publish: false,
      version: 'version-123',
      description: 'Test',
    };

    await expect(_enqueueFiles(files, options, mockConfig)).rejects.toThrow(
      'Validation failed'
    );
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
  });

  it('should handle files without dataFormat', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueFilesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: FileToTranslate[] = [
      {
        fileName: 'test.md',
        content: '# Hello World',
        fileFormat: 'MD',
      },
    ];

    const options: RequiredEnqueueFilesOptions = {
      sourceLocale: 'en',
      targetLocales: ['es'],
      publish: false,
      version: 'version-123',
      description: 'Test',
    };

    await _enqueueFiles(files, options, mockConfig);

    const fetchCall = vi.mocked(fetchWithTimeout).mock.calls[0];
    const bodyJson = JSON.parse(fetchCall[1].body as string);

    // When dataFormat is not provided, it should be undefined
    expect(bodyJson.files[0].fileDataFormat).toBe(undefined);
    expect(bodyJson.files[0].fileFormat).toBe('MD');
    expect(bodyJson.files[0].fileName).toBe('test.md');
  });

  it('should handle empty files array', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue({
        ...mockEnqueueFilesResult,
        data: { ...(mockEnqueueFilesResult.data as any), uploadedFiles: [] },
      }),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: FileToTranslate[] = [];

    const options: RequiredEnqueueFilesOptions = {
      sourceLocale: 'en',
      targetLocales: ['es'],
      publish: false,
      version: 'version-123',
      description: 'Empty test',
    };

    const result = await _enqueueFiles(files, options, mockConfig);

    const fetchCall = vi.mocked(fetchWithTimeout).mock.calls[0];
    const bodyJson = JSON.parse(fetchCall[1].body as string);
    expect(bodyJson.files).toHaveLength(0);
    expect((result.data as any).uploadedFiles).toEqual([]);
  });
});
