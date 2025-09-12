import { describe, it, expect, vi, beforeEach } from 'vitest';
import _uploadTranslations from '../uploadTranslations';
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
    vi.mocked(generateRequestHeaders).mockReturnValue({
      'Content-Type': 'application/json',
      'x-gt-api-key': 'test-api-key',
      'x-gt-project-id': 'test-project',
    });
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

    const mockResponse = {
      success: true,
      translations: [
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

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _uploadTranslations(
      mockFiles,
      mockOptions,
      mockConfig
    );

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/files/upload-translations',
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
        }),
      },
      60000
    );

    expect(validateResponse).toHaveBeenCalledWith(mockFetchResponse);
    expect(result).toEqual(mockResponse);
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

    const mockResponse = { success: true };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadTranslations(mockFiles, mockOptions, mockConfig);

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
        }),
      },
      expect.any(Number)
    );
  });

  it('should handle translations with data format', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload({
          fileName: 'data.json',
          dataFormat: 'flat',
        }),
        translations: [
          createMockFileUpload({
            fileName: 'data.es.json',
            content: '{"key": "valor"}',
            locale: 'es',
            dataFormat: 'flat',
          }),
        ],
      },
    ];

    const mockOptions = createMockOptions();

    const mockResponse = { success: true };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadTranslations(mockFiles, mockOptions, mockConfig);

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
                fileName: 'data.json',
                fileFormat: 'JSON',
                locale: 'en',
                dataFormat: 'flat',
              },
              translations: [
                {
                  content: Buffer.from('{"key": "valor"}').toString('base64'),
                  fileName: 'data.es.json',
                  fileFormat: 'JSON',
                  locale: 'es',
                  dataFormat: 'flat',
                },
              ],
            },
          ],
          sourceLocale: 'en',
        }),
      },
      expect.any(Number)
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

    const mockResponse = { success: true };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadTranslations(mockFiles, mockOptions, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      {
        method: 'POST',
        headers: expect.any(Object),
        body: expect.stringContaining('component1.json'),
      },
      expect.any(Number)
    );
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      {
        method: 'POST',
        headers: expect.any(Object),
        body: expect.stringContaining('component2.json'),
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

    const mockResponse = { success: true };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadTranslations(mockFiles, mockOptions, mockConfig);

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
        }),
      },
      expect.any(Number)
    );
  });

  it('should use custom timeout when provided', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload(),
        translations: [createMockFileUpload({ locale: 'es' })],
      },
    ];
    const mockOptions = createMockOptions({ timeout: 30000 });

    const mockResponse = { success: true };
    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadTranslations(mockFiles, mockOptions, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      30000
    );
  });

  it('should limit timeout to maxTimeout', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload(),
        translations: [createMockFileUpload({ locale: 'es' })],
      },
    ];
    const mockOptions = createMockOptions({ timeout: 1000000 }); // Very large timeout

    const mockResponse = { success: true };
    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadTranslations(mockFiles, mockOptions, mockConfig);

    // Should use maxTimeout (60000) instead of the large provided timeout
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
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
    vi.mocked(fetchWithTimeout).mockRejectedValue(fetchError);
    vi.mocked(handleFetchError).mockImplementation(() => {
      throw fetchError;
    });

    await expect(
      _uploadTranslations(mockFiles, mockOptions, mockConfig)
    ).rejects.toThrow('Network error');

    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should use default base URL when not provided', async () => {
    const configWithoutBaseUrl = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const mockFiles = [
      {
        source: createMockFileUpload(),
        translations: [createMockFileUpload({ locale: 'es' })],
      },
    ];

    const mockOptions = createMockOptions();

    const mockResponse = { success: true };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadTranslations(mockFiles, mockOptions, configWithoutBaseUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining(
        'api2.gtx.dev/v2/project/files/upload-translations'
      ),
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle validation errors', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload(),
        translations: [createMockFileUpload({ locale: 'es' })],
      },
    ];

    const mockOptions = createMockOptions();

    const mockFetchResponse = {
      json: vi.fn(),
    } as unknown as Response;

    const validationError = new Error('Invalid request');
    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockRejectedValue(validationError);

    await expect(
      _uploadTranslations(mockFiles, mockOptions, mockConfig)
    ).rejects.toThrow('Invalid request');

    expect(validateResponse).toHaveBeenCalledWith(mockFetchResponse);
  });

  it('should handle empty translations array', async () => {
    const mockFiles = [
      {
        source: createMockFileUpload(),
        translations: [],
      },
    ];

    const mockOptions = createMockOptions();

    const mockResponse = { success: true };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadTranslations(mockFiles, mockOptions, mockConfig);

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
                locale: 'en',
              },
              translations: [],
            },
          ],
          sourceLocale: 'en',
        }),
      },
      expect.any(Number)
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

    const mockResponse = { success: true };
    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _uploadTranslations(mockFiles, mockOptions, mockConfig);

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
        }),
      },
      expect.any(Number)
    );
  });
});
