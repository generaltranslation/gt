import { describe, it, expect, vi, beforeEach } from 'vitest';
import _enqueueFiles from '../../src/translate/enqueueFiles';
import { FileToTranslate } from '../../src/types-dir/enqueue';
import { EnqueueFilesOptions } from '../../src/types-dir/enqueue';
import { EnqueueFilesResult } from '../../src/types-dir/enqueue';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import { TranslationRequestConfig } from '../../src/types';

// Mock Response interface for testing
interface MockResponse {
  ok: boolean;
  json: () => Promise<{
    data: unknown;
    message?: string;
    locales: string[];
    translations?: unknown;
  }>;
}

// Mock the fetch utilities and validators
vi.mock('../../src/utils/fetchWithTimeout', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/translate/utils/validateResponse', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/translate/utils/handleFetchError', () => ({
  default: vi.fn((error: unknown) => {
    throw error;
  }),
}));

// Mock FormData and Blob for Node.js environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).FormData = class FormData {
  private data: Map<string, unknown> = new Map();

  append(key: string, value: unknown) {
    this.data.set(key, value);
  }

  get(key: string) {
    return this.data.get(key);
  }

  has(key: string) {
    return this.data.has(key);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Blob = class Blob {
  constructor(public content: string[]) {}
};

describe('_enqueueFiles function', () => {
  const mockFetch = vi.mocked(fetchWithTimeout);
  const mockConfig: TranslationRequestConfig = {
    projectId: 'test-project',
    apiKey: 'test-key',
    baseUrl: 'https://api.test.com',
    timeout: 5000,
  };

  const mockResult: EnqueueFilesResult = {
    data: { uploadId: 'upload-123' },
    locales: ['es', 'fr'],
    message: 'Files uploaded successfully',
    translations: { status: 'processing' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should make correct API call with basic file upload', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const testFiles: FileToTranslate[] = [
      {
        content: JSON.stringify({ greeting: 'Hello world' }),
        fileName: 'test.json',
        fileFormat: 'JSON',
        dataFormat: 'I18NEXT',
      },
    ];

    const options: EnqueueFilesOptions = {
      targetLocales: ['es', 'fr'],
      sourceLocale: 'en',
      publish: false,
    };

    const result = await _enqueueFiles(testFiles, options, mockConfig);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/files/upload',
      {
        method: 'POST',
        headers: {
          'x-gt-api-key': 'test-key',
        },
        // eslint-disable-next-line no-undef
        body: expect.any(FormData),
      },
      5000
    );

    expect(result).toEqual(mockResult);
  });

  it('should handle JSON files correctly', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const jsonFile: FileToTranslate = {
      content: JSON.stringify({
        welcome: 'Welcome to our application',
        buttons: { submit: 'Submit', cancel: 'Cancel' },
      }),
      fileName: 'app.json',
      fileFormat: 'JSON',
      dataFormat: 'I18NEXT',
    };

    const options: EnqueueFilesOptions = {
      targetLocales: ['es'],
      sourceLocale: 'en',
      publish: false,
    };

    const result = await _enqueueFiles([jsonFile], options, mockConfig);

    expect(result).toEqual(mockResult);
  });

  it('should handle Markdown files correctly', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const mdFile: FileToTranslate = {
      content: `# Welcome

This is a test markdown file with content.
`,
      fileName: 'test.md',
      fileFormat: 'MD',
      dataFormat: 'ICU',
    };

    const options: EnqueueFilesOptions = {
      targetLocales: ['fr'],
      sourceLocale: 'en',
      publish: false,
    };

    const result = await _enqueueFiles([mdFile], options, mockConfig);

    expect(result).toEqual(mockResult);
  });

  it('should handle multiple files with different formats', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const multipleFiles: FileToTranslate[] = [
      {
        content: JSON.stringify({ title: 'Multi-file test' }),
        fileName: 'test1.json',
        fileFormat: 'JSON',
        dataFormat: 'I18NEXT',
      },
      {
        content: `# Multi-file Test\n\nThis is a markdown file.`,
        fileName: 'test2.md',
        fileFormat: 'MD',
        dataFormat: 'ICU',
      },
      {
        content: `title: Multi-file YAML test\ndescription: Testing YAML`,
        fileName: 'test3.yaml',
        fileFormat: 'YAML',
        dataFormat: 'ICU',
      },
    ];

    const options: EnqueueFilesOptions = {
      targetLocales: ['es', 'fr', 'de'],
      sourceLocale: 'en',
      publish: false,
      description: 'Multi-format test',
    };

    const result = await _enqueueFiles(multipleFiles, options, mockConfig);

    expect(result).toEqual(mockResult);
  });

  it('should handle publish option correctly', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const testFile: FileToTranslate = {
      content: JSON.stringify({ publishTest: 'This is a publish test' }),
      fileName: 'publish.json',
      fileFormat: 'JSON',
      dataFormat: 'I18NEXT',
    };

    const options: EnqueueFilesOptions = {
      targetLocales: ['es'],
      sourceLocale: 'en',
      publish: true,
      description: 'Publish test',
    };

    await _enqueueFiles([testFile], options, mockConfig);

    // Verify that the FormData was created and passed to fetch
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'x-gt-api-key': 'test-key',
        },
        // eslint-disable-next-line no-undef
        body: expect.any(FormData),
      }),
      expect.any(Number)
    );
  });

  it('should handle version ID and description options', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const testFile: FileToTranslate = {
      content: JSON.stringify({ versionTest: 'This is a version test' }),
      fileName: 'version.json',
      fileFormat: 'JSON',
      dataFormat: 'I18NEXT',
    };

    const options: EnqueueFilesOptions = {
      targetLocales: ['es'],
      sourceLocale: 'en',
      publish: false,
      versionId: 'custom-version-123',
      description: 'Custom version test',
    };

    await _enqueueFiles([testFile], options, mockConfig);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        // eslint-disable-next-line no-undef
        body: expect.any(FormData),
      }),
      expect.any(Number)
    );
  });

  it('should handle timeout configuration from config', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const configWithTimeout: TranslationRequestConfig = {
      apiKey: 'test-key',
      timeout: 10000,
    };

    const testFile: FileToTranslate = {
      content: JSON.stringify({ timeoutTest: 'Timeout test' }),
      fileName: 'timeout.json',
      fileFormat: 'JSON',
      dataFormat: 'I18NEXT',
    };

    const options: EnqueueFilesOptions = {
      targetLocales: ['es'],
      sourceLocale: 'en',
      publish: false,
    };

    await _enqueueFiles([testFile], options, configWithTimeout);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      10000
    );
  });

  it('should handle empty files array', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const emptyFiles: FileToTranslate[] = [];

    const options: EnqueueFilesOptions = {
      targetLocales: ['es'],
      sourceLocale: 'en',
      publish: false,
    };

    const result = await _enqueueFiles(emptyFiles, options, mockConfig);

    expect(result).toEqual(mockResult);
  });

  it('should handle all file formats', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const allFormatFiles: FileToTranslate[] = [
      {
        content: JSON.stringify({ test: 'JSON test' }),
        fileName: 'test.json',
        fileFormat: 'JSON',
        dataFormat: 'I18NEXT',
      },
      {
        content: `# GTJSON Test\n\nThis is a GTJSON file.`,
        fileName: 'test.gtjson',
        fileFormat: 'GTJSON',
        dataFormat: 'JSX',
      },
      {
        content: `test: YAML test\ndescription: Testing YAML`,
        fileName: 'test.yaml',
        fileFormat: 'YAML',
        dataFormat: 'ICU',
      },
      {
        content: `# MDX Test\n\nThis is an MDX file.`,
        fileName: 'test.mdx',
        fileFormat: 'MDX',
        dataFormat: 'JSX',
      },
      {
        content: `# Markdown Test\n\nThis is a markdown file.`,
        fileName: 'test.md',
        fileFormat: 'MD',
        dataFormat: 'ICU',
      },
      {
        content: `export const test = 'TypeScript test';`,
        fileName: 'test.ts',
        fileFormat: 'TS',
        dataFormat: 'ICU',
      },
      {
        content: `const test = 'JavaScript test';`,
        fileName: 'test.js',
        fileFormat: 'JS',
        dataFormat: 'ICU',
      },
    ];

    const options: EnqueueFilesOptions = {
      targetLocales: ['es', 'fr'],
      sourceLocale: 'en',
      publish: false,
      description: 'All formats test',
    };

    const result = await _enqueueFiles(allFormatFiles, options, mockConfig);

    expect(result).toEqual(mockResult);
  });

  it('should handle network errors', async () => {
    const networkError = new Error('Network error');
    mockFetch.mockRejectedValue(networkError);

    const testFile: FileToTranslate = {
      content: JSON.stringify({ test: 'Test' }),
      fileName: 'test.json',
      fileFormat: 'JSON',
      dataFormat: 'I18NEXT',
    };

    const options: EnqueueFilesOptions = {
      targetLocales: ['es'],
      sourceLocale: 'en',
      publish: false,
    };

    await expect(
      _enqueueFiles([testFile], options, mockConfig)
    ).rejects.toThrow('Network error');
  });

  it('should handle timeout errors', async () => {
    const timeoutError = new Error('Request timeout');
    timeoutError.name = 'AbortError';
    mockFetch.mockRejectedValue(timeoutError);

    const testFile: FileToTranslate = {
      content: JSON.stringify({ test: 'Test' }),
      fileName: 'test.json',
      fileFormat: 'JSON',
      dataFormat: 'I18NEXT',
    };

    const options: EnqueueFilesOptions = {
      targetLocales: ['es'],
      sourceLocale: 'en',
      publish: false,
    };

    await expect(
      _enqueueFiles([testFile], options, mockConfig)
    ).rejects.toThrow();
  });

  it('should handle missing source locale', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockResolvedValue(mockResponse as MockResponse as any);

    const testFile: FileToTranslate = {
      content: JSON.stringify({ test: 'Test' }),
      fileName: 'test.json',
      fileFormat: 'JSON',
      dataFormat: 'I18NEXT',
    };

    const options: EnqueueFilesOptions = {
      targetLocales: ['es'],
      // sourceLocale is optional
      publish: false,
    };

    const result = await _enqueueFiles([testFile], options, mockConfig);

    expect(result).toEqual(mockResult);
  });
});
