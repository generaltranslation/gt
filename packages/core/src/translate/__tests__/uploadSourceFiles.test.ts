import { describe, it, expect, vi, beforeEach } from 'vitest';
import { _uploadSourceFiles } from '../uploadSourceFiles';
import { TranslationRequestConfig } from '../../types';
import {
  FileUpload,
  RequiredUploadFilesOptions,
} from '../../types-dir/api/uploadFiles';
import { apiRequest } from '../utils/apiRequest';

vi.mock('../utils/apiRequest');

describe.sequential('_uploadSourceFiles', () => {
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

    const mockApiResponse = {
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

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    const result = await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v2/project/files/upload-files',
      {
        body: {
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
        },
        timeout: 60000,
      }
    );

    expect(result.data).toEqual(mockApiResponse.uploadedFiles);
    expect(result.count).toBe(2);
    expect(result.batchCount).toBe(1);
  });

  it('should handle single source file upload', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload(),
      },
    ];

    const mockOptions = createMockOptions();

    const mockApiResponse = {
      success: true,
      uploadedFiles: [
        { fileId: 'file-123', versionId: 'version-456', fileName: 'test.json' },
      ],
    };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    const result = await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].fileName).toBe('test.json');
  });

  it('should handle files with data format', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload({
          fileName: 'flat.json',
        }),
      },
      {
        source: createMockFileUpload({
          fileName: 'nested.json',
        }),
      },
    ];

    const mockOptions = createMockOptions();

    const mockApiResponse = { success: true };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: {
          data: [
            {
              source: {
                content: Buffer.from('{"key": "value"}').toString('base64'),
                fileName: 'flat.json',
                fileFormat: 'JSON',
                locale: 'en',
              },
            },
            {
              source: {
                content: Buffer.from('{"key": "value"}').toString('base64'),
                fileName: 'nested.json',
                fileFormat: 'JSON',
                locale: 'en',
              },
            },
          ],
          sourceLocale: 'en',
        },
      })
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

    const mockApiResponse = { success: true };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: {
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
        },
      })
    );
  });

  it('should pass binary (LOTTIE) content through without re-encoding', async () => {
    // Binary formats arrive already base64-encoded; re-encoding would corrupt
    // the bytes. The content must reach the API verbatim.
    const zipBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x10]); // "PK\x03\x04" zip magic + non-UTF8 bytes
    const base64Content = zipBytes.toString('base64');
    const mockFiles = [
      {
        source: createMockFileUpload({
          fileName: 'animation.lottie',
          fileFormat: 'LOTTIE',
          content: base64Content,
        }),
      },
    ];

    vi.mocked(apiRequest).mockResolvedValue({ success: true });

    await _uploadSourceFiles(mockFiles, createMockOptions(), mockConfig);

    const sentContent =
      vi.mocked(apiRequest).mock.calls[0][2].body.data[0].source.content;
    // Verbatim passthrough — NOT encode(base64Content).
    expect(sentContent).toBe(base64Content);
    expect(sentContent).not.toBe(
      Buffer.from(base64Content, 'utf8').toString('base64')
    );
    // Round-trips back to the original bytes.
    expect(Buffer.from(sentContent, 'base64')).toEqual(zipBytes);
  });

  it('should upload PO and POT source files', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload({
          fileName: 'messages.pot',
          fileFormat: 'POT',
          transformFormat: 'PO',
          content: 'msgid "Save"\nmsgstr ""\n',
        }),
      },
      {
        source: createMockFileUpload({
          fileName: 'en.po',
          fileFormat: 'PO',
          content: 'msgid "Save"\nmsgstr "Save"\n',
        }),
      },
    ];

    const mockOptions = createMockOptions();
    vi.mocked(apiRequest).mockResolvedValue({ success: true });

    await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: {
          data: [
            {
              source: expect.objectContaining({
                content: Buffer.from('msgid "Save"\nmsgstr ""\n').toString(
                  'base64'
                ),
                fileName: 'messages.pot',
                fileFormat: 'POT',
                locale: 'en',
              }),
            },
            {
              source: expect.objectContaining({
                content: Buffer.from('msgid "Save"\nmsgstr "Save"\n').toString(
                  'base64'
                ),
                fileName: 'en.po',
                fileFormat: 'PO',
                locale: 'en',
              }),
            },
          ],
          sourceLocale: 'en',
        },
      })
    );
  });

  it('should use custom timeout when provided', async () => {
    const mockFiles = [{ source: createMockFileUpload() }];
    const mockOptions = createMockOptions({ timeout: 30000 });

    const mockApiResponse = { success: true };
    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: 30000 })
    );
  });

  it('should pass through large timeout values', async () => {
    const mockFiles = [{ source: createMockFileUpload() }];
    const mockOptions = createMockOptions({ timeout: 1000000 });

    const mockApiResponse = { success: true };
    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: 1000000 })
    );
  });

  it('should handle fetch errors', async () => {
    const mockFiles = [{ source: createMockFileUpload() }];
    const mockOptions = createMockOptions();

    const fetchError = new Error('Network error');
    vi.mocked(apiRequest).mockRejectedValue(fetchError);

    await expect(
      _uploadSourceFiles(mockFiles, mockOptions, mockConfig)
    ).rejects.toThrow('Network error');
  });

  it('should use default base URL when not provided', async () => {
    const configWithoutBaseUrl = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const mockFiles = [{ source: createMockFileUpload() }];
    const mockOptions = createMockOptions();

    const mockApiResponse = { success: true, uploadedFiles: [] };
    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _uploadSourceFiles(mockFiles, mockOptions, configWithoutBaseUrl);

    expect(apiRequest).toHaveBeenCalledWith(
      configWithoutBaseUrl,
      '/v2/project/files/upload-files',
      expect.any(Object)
    );
  });

  it('should handle empty files array', async () => {
    const mockFiles: { source: FileUpload }[] = [];
    const mockOptions = createMockOptions();

    const result = await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    // With batching, empty array returns early without making any API calls
    expect(apiRequest).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
    expect(result.batchCount).toBe(0);
  });

  it('should handle different source locales', async () => {
    const mockFiles = [{ source: createMockFileUpload({ locale: 'es' }) }];
    const mockOptions = createMockOptions({ sourceLocale: 'es' });

    const mockApiResponse = { success: true };
    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: {
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
        },
      })
    );
  });

  it('should batch files when uploading more than 100 files', async () => {
    // Create 150 mock files
    const mockFiles = Array.from({ length: 150 }, (_, i) => ({
      source: createMockFileUpload({ fileName: `file-${i}.json` }),
    }));

    const mockOptions = createMockOptions();

    const mockResponse1 = {
      success: true,
      uploadedFiles: Array.from({ length: 100 }, (_, i) => ({
        fileId: `file-${i}`,
        versionId: `version-${i}`,
        fileName: `file-${i}.json`,
      })),
    };

    const mockResponse2 = {
      success: true,
      uploadedFiles: Array.from({ length: 50 }, (_, i) => ({
        fileId: `file-${i + 100}`,
        versionId: `version-${i + 100}`,
        fileName: `file-${i + 100}.json`,
      })),
    };

    vi.mocked(apiRequest)
      .mockResolvedValueOnce(mockResponse1)
      .mockResolvedValueOnce(mockResponse2);

    const result = await _uploadSourceFiles(mockFiles, mockOptions, mockConfig);

    // Should make 2 batch calls
    expect(apiRequest).toHaveBeenCalledTimes(2);

    // Result should contain all 150 files
    expect(result.data).toHaveLength(150);
    expect(result.count).toBe(150);
    expect(result.batchCount).toBe(2);
  });
});
