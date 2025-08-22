import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFiles, FileUpload, UploadData } from '../uploadFiles.js';
import { createSpinner, exit, logMessage } from '../../console/logging.js';
import { SpinnerResult } from '@clack/prompts';
import { Settings } from '../../types/index.js';
import { FileFormat, DataFormat } from '../../types/data.js';

// Mock dependencies
vi.mock('../../console/logging.js', () => ({
  createSpinner: vi.fn(),
  exit: vi.fn(),
  logMessage: vi.fn(),
}));

global.fetch = vi.fn();

describe('uploadFiles', () => {
  const mockSpinner = {
    start: vi.fn(),
    stop: vi.fn(),
  };

  // Common mock data factories
  const createMockFileUpload = (
    overrides: Partial<FileUpload> = {}
  ): FileUpload => ({
    fileName: 'test.json',
    content: '{"key": "value"}',
    fileFormat: 'JSON' as FileFormat,
    locale: 'en',
    ...overrides,
  });

  const createMockFiles = (
    count: number = 1,
    sourceOverrides: Partial<FileUpload> = {},
    translationOverrides: Partial<FileUpload> = {}
  ) => {
    return Array.from({ length: count }, (_, i) => ({
      source: createMockFileUpload({
        fileName: `file${i}.json`,
        content: `{"key${i}": "value${i}"}`,
        locale: 'en',
        ...sourceOverrides,
      }),
      translations: [
        createMockFileUpload({
          fileName: `file${i}.es.json`,
          content: `{"key${i}": "valor${i}"}`,
          locale: 'es',
          ...translationOverrides,
        }),
      ],
    }));
  };

  const createMockSettings = (overrides: Partial<Settings> = {}): Settings => ({
    publish: true,
    defaultLocale: 'en',
    locales: ['es', 'fr'],
    config: '/path/to/config.json',
    baseUrl: 'https://api.generaltranslation.com',
    dashboardUrl: 'https://dashboard.generaltranslation.com',
    configDirectory: '/path/to/.gt',
    apiKey: '1234567890',
    projectId: '1234567890',
    stageTranslations: false,
    src: ['src'],
    files: {
      resolvedPaths: {},
      placeholderPaths: {},
      transformPaths: {},
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSpinner).mockReturnValue(
      mockSpinner as unknown as SpinnerResult
    );
  });

  it('should upload files successfully', async () => {
    const mockFiles = [
      {
        source: {
          fileName: 'component.json',
          content: '{"hello": "world"}',
          fileFormat: 'JSON' as FileFormat,
          locale: 'en',
        },
        translations: [
          {
            fileName: 'component.es.json',
            content: '{"hello": "mundo"}',
            fileFormat: 'JSON' as FileFormat,
            locale: 'es',
          },
        ],
      },
    ];

    const mockSettings = createMockSettings();
    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
    });

    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await uploadFiles(mockFiles, mockSettings);

    expect(logMessage).toHaveBeenCalledWith(
      expect.stringContaining('Files to upload:')
    );

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Uploading 1 file to General Translation...'
    );

    expect(fetch).toHaveBeenCalledWith(
      'https://api.generaltranslation.com/v1/project/files/upload',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': '1234567890',
          'x-gt-project-id': '1234567890',
        },
        body: JSON.stringify({
          data: mockFiles,
          sourceLocale: 'en',
        }),
      })
    );

    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Files uploaded successfully')
    );

    expect(result).toBe(mockResponse);
  });

  it('should handle multiple files upload', async () => {
    const mockFiles = createMockFiles(3);
    const mockSettings = createMockSettings();
    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
    });

    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await uploadFiles(mockFiles, mockSettings);

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Uploading 3 files to General Translation...'
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          data: mockFiles,
          sourceLocale: 'en',
        }),
      })
    );
  });

  it('should handle single file upload', async () => {
    const mockFiles = createMockFiles(1);
    const mockSettings = createMockSettings();
    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
    });

    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await uploadFiles(mockFiles, mockSettings);

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Uploading 1 file to General Translation...'
    );
  });

  it('should include model provider when specified', async () => {
    const mockFiles = createMockFiles(1);
    const mockSettings = createMockSettings({
      modelProvider: 'openai',
    });
    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
    });

    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await uploadFiles(mockFiles, mockSettings);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          data: mockFiles,
          sourceLocale: 'en',
          modelProvider: 'openai',
        }),
      })
    );
  });

  it('should handle API errors', async () => {
    const mockFiles = createMockFiles(1);
    const mockSettings = createMockSettings();
    const mockResponse = new Response('Bad Request', {
      status: 400,
      statusText: 'Bad Request',
    });

    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await uploadFiles(mockFiles, mockSettings);

    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining(
        'An unexpected error occurred while uploading files'
      )
    );

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('should handle network errors', async () => {
    const mockFiles = createMockFiles(1);
    const mockSettings = createMockSettings();

    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    await uploadFiles(mockFiles, mockSettings);

    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining(
        'An unexpected error occurred while uploading files'
      )
    );

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('should handle different file formats', async () => {
    const mockFiles = [
      {
        source: {
          fileName: 'component.js',
          content: 'export const Hello = () => <div>Hello</div>',
          fileFormat: 'JS' as FileFormat,
          locale: 'en',
        },
        translations: [
          {
            fileName: 'component.es.js',
            content: 'export const Hello = () => <div>Hola</div>',
            fileFormat: 'JS' as FileFormat,
            locale: 'es',
          },
        ],
      },
    ];

    const mockSettings = createMockSettings();
    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
    });

    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await uploadFiles(mockFiles, mockSettings);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          data: mockFiles,
          sourceLocale: 'en',
        }),
      })
    );
  });

  it('should handle files with data format', async () => {
    const mockFiles = [
      {
        source: {
          fileName: 'data.json',
          content: '{"key": "value"}',
          fileFormat: 'JSON' as FileFormat,
          dataFormat: 'flat' as DataFormat,
          locale: 'en',
        },
        translations: [
          {
            fileName: 'data.es.json',
            content: '{"key": "valor"}',
            fileFormat: 'JSON' as FileFormat,
            dataFormat: 'flat' as DataFormat,
            locale: 'es',
          },
        ],
      },
    ];

    const mockSettings = createMockSettings();
    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
    });

    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await uploadFiles(mockFiles, mockSettings);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          data: mockFiles,
          sourceLocale: 'en',
        }),
      })
    );
  });

  it('should handle multiple translations per source file', async () => {
    const mockFiles = [
      {
        source: {
          fileName: 'messages.json',
          content: '{"welcome": "Welcome"}',
          fileFormat: 'JSON' as FileFormat,
          locale: 'en',
        },
        translations: [
          {
            fileName: 'messages.es.json',
            content: '{"welcome": "Bienvenido"}',
            fileFormat: 'JSON' as FileFormat,
            locale: 'es',
          },
          {
            fileName: 'messages.fr.json',
            content: '{"welcome": "Bienvenue"}',
            fileFormat: 'JSON' as FileFormat,
            locale: 'fr',
          },
        ],
      },
    ];

    const mockSettings = createMockSettings();
    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
    });

    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await uploadFiles(mockFiles, mockSettings);

    expect(logMessage).toHaveBeenCalledWith(
      expect.stringContaining('messages.json -> es, fr')
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          data: mockFiles,
          sourceLocale: 'en',
        }),
      })
    );
  });

  it('should handle custom base URL', async () => {
    const mockFiles = createMockFiles(1);
    const mockSettings = createMockSettings({
      baseUrl: 'https://custom-api.example.com',
    });
    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
    });

    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await uploadFiles(mockFiles, mockSettings);

    expect(fetch).toHaveBeenCalledWith(
      'https://custom-api.example.com/v1/project/files/upload',
      expect.any(Object)
    );
  });
});
