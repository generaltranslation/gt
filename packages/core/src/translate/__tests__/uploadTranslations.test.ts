import { describe, it, expect, vi, beforeEach } from 'vitest';
import _uploadTranslations from '../uploadTranslations';
import { TranslationRequestConfig } from '../../types';
import {
  FileUpload,
  RequiredUploadFilesOptions,
} from '../../types-dir/api/uploadFiles';
import apiRequest from '../utils/apiRequest';

vi.mock('../utils/apiRequest');

describe('_uploadTranslations', () => {
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

  it('should upload translations successfully', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload({ fileName: 'component.json' }),
        translations: [
          createMockFileUpload({
            fileName: 'component.es.json',
            content: '{"key": "valor"}',
            locale: 'es',
          }),
          createMockFileUpload({
            fileName: 'component.fr.json',
            content: '{"key": "valeur"}',
            locale: 'fr',
          }),
        ],
      },
    ];

    const mockOptions = createMockOptions();

    const mockApiResponse = {
      success: true,
      uploadedFiles: [
        {
          translationId: 'trans-123',
          locale: 'es',
          fileName: 'component.es.json',
        },
        {
          translationId: 'trans-456',
          locale: 'fr',
          fileName: 'component.fr.json',
        },
      ],
    };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    const result = await _uploadTranslations(
      mockFiles,
      mockOptions,
      mockConfig
    );

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v2/project/files/upload-translations',
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
              translations: [
                {
                  content: Buffer.from('{"key": "valor"}').toString('base64'),
                  fileName: 'component.es.json',
                  fileFormat: 'JSON',
                  locale: 'es',
                },
                {
                  content: Buffer.from('{"key": "valeur"}').toString('base64'),
                  fileName: 'component.fr.json',
                  fileFormat: 'JSON',
                  locale: 'fr',
                },
              ],
            },
          ],
          sourceLocale: 'en',
        },
        timeout: 60000,
      }
    );

    expect(result.data).toEqual(mockApiResponse.uploadedFiles || []);
    expect(result.batchCount).toBe(1);
  });

  it('should handle single translation per source', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload({ fileName: 'test.json' }),
        translations: [
          createMockFileUpload({
            fileName: 'test.es.json',
            content: '{"key": "valor"}',
            locale: 'es',
          }),
        ],
      },
    ];

    const mockOptions = createMockOptions();

    const mockApiResponse = { success: true };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _uploadTranslations(mockFiles, mockOptions, mockConfig);

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
                locale: 'en',
              },
              translations: [
                {
                  content: Buffer.from('{"key": "valor"}').toString('base64'),
                  fileName: 'test.es.json',
                  fileFormat: 'JSON',
                  locale: 'es',
                },
              ],
            },
          ],
          sourceLocale: 'en',
        },
      })
    );
  });

  it('should handle translations with data format', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload({
          fileName: 'data.json',
          dataFormat: 'JSX',
        }),
        translations: [
          createMockFileUpload({
            fileName: 'data.es.json',
            content: '{"key": "valor"}',
            locale: 'es',
            dataFormat: 'JSX',
          }),
        ],
      },
    ];

    const mockOptions = createMockOptions();

    const mockApiResponse = { success: true };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _uploadTranslations(mockFiles, mockOptions, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: {
          data: [
            {
              source: {
                content: Buffer.from('{"key": "value"}').toString('base64'),
                fileName: 'data.json',
                fileFormat: 'JSON',
                locale: 'en',
                dataFormat: 'JSX',
              },
              translations: [
                {
                  content: Buffer.from('{"key": "valor"}').toString('base64'),
                  fileName: 'data.es.json',
                  fileFormat: 'JSON',
                  locale: 'es',
                  dataFormat: 'JSX',
                },
              ],
            },
          ],
          sourceLocale: 'en',
        },
      })
    );
  });

  it('should handle multiple source files with translations', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload({ fileName: 'component1.json' }),
        translations: [
          createMockFileUpload({
            fileName: 'component1.es.json',
            locale: 'es',
          }),
        ],
      },
      {
        source: createMockFileUpload({ fileName: 'component2.json' }),
        translations: [
          createMockFileUpload({
            fileName: 'component2.es.json',
            locale: 'es',
          }),
          createMockFileUpload({
            fileName: 'component2.fr.json',
            locale: 'fr',
          }),
        ],
      },
    ];

    const mockOptions = createMockOptions();

    const mockApiResponse = { success: true };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _uploadTranslations(mockFiles, mockOptions, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              source: expect.objectContaining({
                fileName: 'component1.json',
              }),
            }),
            expect.objectContaining({
              source: expect.objectContaining({
                fileName: 'component2.json',
              }),
            }),
          ]),
        }),
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
        translations: [
          createMockFileUpload({
            fileName: 'component.es.js',
            fileFormat: 'JS',
            content: 'export const Hello = () => "Hola"',
            locale: 'es',
          }),
        ],
      },
    ];

    const mockOptions = createMockOptions();

    const mockApiResponse = { success: true };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _uploadTranslations(mockFiles, mockOptions, mockConfig);

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
              translations: [
                {
                  content: Buffer.from(
                    'export const Hello = () => "Hola"'
                  ).toString('base64'),
                  fileName: 'component.es.js',
                  fileFormat: 'JS',
                  locale: 'es',
                },
              ],
            },
          ],
          sourceLocale: 'en',
        },
      })
    );
  });

  it('should handle fetch errors', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload(),
        translations: [createMockFileUpload({ locale: 'es' })],
      },
    ];
    const mockOptions = createMockOptions();

    const fetchError = new Error('Network error');
    vi.mocked(apiRequest).mockRejectedValue(fetchError);

    await expect(
      _uploadTranslations(mockFiles, mockOptions, mockConfig)
    ).rejects.toThrow('Network error');
  });

  it('should handle empty translations array', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload(),
        translations: [],
      },
    ];

    const mockOptions = createMockOptions();

    const mockApiResponse = { success: true };

    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _uploadTranslations(mockFiles, mockOptions, mockConfig);

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
                locale: 'en',
              },
              translations: [],
            },
          ],
          sourceLocale: 'en',
        },
      })
    );
  });

  it('should handle different source locales', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload({ locale: 'de' }),
        translations: [createMockFileUpload({ locale: 'en' })],
      },
    ];
    const mockOptions = createMockOptions({ sourceLocale: 'de' });

    const mockApiResponse = { success: true };
    vi.mocked(apiRequest).mockResolvedValue(mockApiResponse);

    await _uploadTranslations(mockFiles, mockOptions, mockConfig);

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
                locale: 'de',
              },
              translations: [
                {
                  content: Buffer.from('{"key": "value"}').toString('base64'),
                  fileName: 'test.json',
                  fileFormat: 'JSON',
                  locale: 'en',
                },
              ],
            },
          ],
          sourceLocale: 'de',
        },
      })
    );
  });
});
