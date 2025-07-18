import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiOptions, sendFiles, SendFilesResult } from '../sendFiles.js';
import { gt } from '../../utils/gt.js';
import {
  createSpinner,
  logMessage,
  logSuccess,
} from '../../console/logging.js';
import { SpinnerResult } from '@clack/prompts';
import { EnqueueFilesResult, FileToTranslate } from 'generaltranslation/types';

// Mock dependencies
vi.mock('../../utils/gt.js', () => ({
  gt: {
    enqueueFiles: vi.fn(),
  },
}));

vi.mock('../../console/logging.js', () => ({
  createSpinner: vi.fn(),
  logMessage: vi.fn(),
  logSuccess: vi.fn(),
}));

describe('sendFiles', () => {
  const mockSpinner = {
    start: vi.fn(),
    stop: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSpinner).mockReturnValue(
      mockSpinner as unknown as SpinnerResult
    );
  });

  it('should send files successfully', async () => {
    const mockFiles: FileToTranslate[] = [
      {
        fileName: 'component.json',
        content: '{"hello": "world"}',
        fileFormat: 'JSON' as const,
      },
      {
        fileName: 'page.json',
        content: '{"title": "Welcome"}',
        fileFormat: 'JSON' as const,
      },
    ];

    const mockOptions: ApiOptions = {
      publish: true,
      wait: false,
      description: 'Test upload',
      defaultLocale: 'en',
      locales: ['es', 'fr'],
      _versionId: 'version-123',
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse: EnqueueFilesResult = {
      data: {
        'component.json': {
          versionId: 'version-456',
          fileName: 'component.json',
        },
        'page.json': { versionId: 'version-456', fileName: 'page.json' },
      },
      message: 'Files uploaded successfully',
      locales: ['es', 'fr'],
      translations: [],
    };

    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockResponse);

    const result = await sendFiles(mockFiles, mockOptions);

    expect(logMessage).toHaveBeenCalledWith(
      expect.stringContaining('Files to translate:')
    );
    expect(logMessage).toHaveBeenCalledWith(
      expect.stringContaining('component.json')
    );
    expect(logMessage).toHaveBeenCalledWith(
      expect.stringContaining('page.json')
    );

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Sending 2 files to General Translation API...'
    );

    expect(gt.enqueueFiles).toHaveBeenCalledWith(mockFiles, {
      publish: true,
      description: 'Test upload',
      sourceLocale: 'en',
      targetLocales: ['es', 'fr'],
      _versionId: 'version-123',
    });

    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Files for translation uploaded successfully')
    );

    expect(logSuccess).toHaveBeenCalledWith('Files uploaded successfully');

    expect(result).toEqual<SendFilesResult>({
      data: {
        'component.json': {
          fileName: 'component.json',
          versionId: 'version-456',
        },
        'page.json': { fileName: 'page.json', versionId: 'version-456' },
      },
      locales: ['es', 'fr'],
      translations: [],
    });
  });

  it('should handle single file upload', async () => {
    const mockFiles: FileToTranslate[] = [
      {
        fileName: 'component.json',
        content: '{"hello": "world"}',
        fileFormat: 'JSON' as const,
      },
    ];

    const mockOptions: ApiOptions = {
      publish: false,
      wait: false,
      description: 'Test upload',
      defaultLocale: 'en',
      locales: ['es'],
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse: EnqueueFilesResult = {
      data: {
        'component.json': {
          versionId: 'version-456',
          fileName: 'component.json',
        },
      },
      message: 'File uploaded successfully',
      locales: ['es'],
      translations: [],
    };

    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockResponse);

    const result = await sendFiles(mockFiles, mockOptions);

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Sending 1 file to General Translation API...'
    );

    expect(gt.enqueueFiles).toHaveBeenCalledWith(mockFiles, {
      publish: false,
      description: 'Test upload',
      sourceLocale: 'en',
      targetLocales: ['es'],
      _versionId: undefined,
    });

    expect(result).toEqual<SendFilesResult>({
      data: {
        'component.json': {
          versionId: 'version-456',
          fileName: 'component.json',
        },
      },
      locales: ['es'],
      translations: [],
    });
  });

  it('should handle API errors', async () => {
    const mockFiles: FileToTranslate[] = [
      {
        fileName: 'component.json',
        content: '{"hello": "world"}',
        fileFormat: 'JSON' as const,
      },
    ];

    const mockOptions: ApiOptions = {
      publish: true,
      wait: false,
      defaultLocale: 'en',
      locales: ['es'],
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const error = new Error('API Error');
    vi.mocked(gt.enqueueFiles).mockRejectedValue(error);

    await expect(sendFiles(mockFiles, mockOptions)).rejects.toThrow(
      'API Error'
    );

    expect(mockSpinner.start).toHaveBeenCalled();
    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send files for translation')
    );
  });

  it('should handle empty files array', async () => {
    const mockFiles: FileToTranslate[] = [];

    const mockOptions: ApiOptions = {
      publish: true,
      wait: false,
      defaultLocale: 'en',
      locales: ['es'],
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse: EnqueueFilesResult = {
      data: {},
      message: 'No files to upload',
      locales: ['es'],
      translations: [],
    };

    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockResponse);

    const result = await sendFiles(mockFiles, mockOptions);

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Sending 0 files to General Translation API...'
    );

    expect(gt.enqueueFiles).toHaveBeenCalledWith([], expect.any(Object));

    expect(result).toEqual<SendFilesResult>({
      data: {},
      locales: ['es'],
      translations: [],
    });
  });

  it('should handle large number of files', async () => {
    const mockFiles: FileToTranslate[] = Array.from(
      { length: 100 },
      (_, i) => ({
        fileName: `file${i}.json`,
        content: `{"key${i}": "value${i}"}`,
        fileFormat: 'JSON' as const,
      })
    );

    const mockOptions: ApiOptions = {
      publish: true,
      wait: false,
      defaultLocale: 'en',
      locales: ['es'],
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse: EnqueueFilesResult = {
      data: {
        'file0.json': {
          versionId: 'version-456',
          fileName: 'file0.json',
        },
      },
      message: 'Files uploaded successfully',
      locales: ['es'],
      translations: [],
    };

    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockResponse);

    const result = await sendFiles(mockFiles, mockOptions);

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Sending 100 files to General Translation API...'
    );

    expect(gt.enqueueFiles).toHaveBeenCalledWith(mockFiles, expect.any(Object));

    expect(result).toEqual<SendFilesResult>({
      data: {
        'file0.json': {
          versionId: 'version-456',
          fileName: 'file0.json',
        },
      },
      locales: ['es'],
      translations: [],
    });
  });

  it('should handle network timeout errors', async () => {
    const mockFiles: FileToTranslate[] = [
      {
        fileName: 'component.json',
        content: '{"hello": "world"}',
        fileFormat: 'JSON' as const,
      },
    ];

    const mockOptions: ApiOptions = {
      publish: true,
      wait: false,
      defaultLocale: 'en',
      locales: ['es'],
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const timeoutError = new Error('Network timeout');
    vi.mocked(gt.enqueueFiles).mockRejectedValue(timeoutError);

    await expect(sendFiles(mockFiles, mockOptions)).rejects.toThrow(
      'Network timeout'
    );

    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send files for translation')
    );
  });

  it('should handle authentication errors', async () => {
    const mockFiles: FileToTranslate[] = [
      {
        fileName: 'component.json',
        content: '{"hello": "world"}',
        fileFormat: 'JSON' as const,
      },
    ];

    const mockOptions: ApiOptions = {
      publish: true,
      wait: false,
      defaultLocale: 'en',
      locales: ['es'],
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const authError = new Error('Unauthorized');
    vi.mocked(gt.enqueueFiles).mockRejectedValue(authError);

    await expect(sendFiles(mockFiles, mockOptions)).rejects.toThrow(
      'Unauthorized'
    );

    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send files for translation')
    );
  });

  it('should handle different file formats', async () => {
    const mockFiles: FileToTranslate[] = [
      {
        fileName: 'component.js',
        content: 'export const Hello = () => <div>Hello</div>',
        fileFormat: 'JS' as const,
      },
      {
        fileName: 'messages.md',
        content: '# Hello\n\nThis is a test',
        fileFormat: 'MD' as const,
      },
    ];

    const mockOptions: ApiOptions = {
      publish: true,
      wait: false,
      defaultLocale: 'en',
      locales: ['es'],
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse: EnqueueFilesResult = {
      data: {
        'component.jsx': {
          versionId: 'version-456',
          fileName: 'component.jsx',
        },
        'messages.po': { versionId: 'version-456', fileName: 'messages.po' },
      },
      message: 'Files uploaded successfully',
      locales: ['es'],
      translations: [],
    };

    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockResponse);

    const result = await sendFiles(mockFiles, mockOptions);

    expect(gt.enqueueFiles).toHaveBeenCalledWith(mockFiles, expect.any(Object));
    expect(result).toEqual<SendFilesResult>({
      data: {
        'component.jsx': {
          versionId: 'version-456',
          fileName: 'component.jsx',
        },
        'messages.po': { versionId: 'version-456', fileName: 'messages.po' },
      },
      locales: ['es'],
      translations: [],
    });
  });

  it('should handle missing optional parameters', async () => {
    const mockFiles: FileToTranslate[] = [
      {
        fileName: 'component.json',
        content: '{"hello": "world"}',
        fileFormat: 'JSON' as const,
      },
    ];

    const mockOptions: ApiOptions = {
      publish: true,
      wait: false,
      defaultLocale: 'en',
      locales: ['es'],
      // Missing description and _versionId
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse: EnqueueFilesResult = {
      data: {
        'component.json': {
          versionId: 'version-456',
          fileName: 'component.json',
        },
      },
      message: 'Files uploaded successfully',
      locales: ['es'],
      translations: [],
    };

    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockResponse);

    const result = await sendFiles(mockFiles, mockOptions);

    expect(gt.enqueueFiles).toHaveBeenCalledWith(mockFiles, {
      publish: true,
      description: undefined,
      sourceLocale: 'en',
      targetLocales: ['es'],
      _versionId: undefined,
    });

    expect(result).toEqual<SendFilesResult>({
      data: {
        'component.json': {
          versionId: 'version-456',
          fileName: 'component.json',
        },
      },
      locales: ['es'],
      translations: [],
    });
  });

  it('should handle response with translations', async () => {
    const mockFiles: FileToTranslate[] = [
      {
        fileName: 'component.json',
        content: '{"hello": "world"}',
        fileFormat: 'JSON' as const,
      },
    ];

    const mockOptions: ApiOptions = {
      publish: true,
      wait: false,
      defaultLocale: 'en',
      locales: ['es'],
      config: '/path/to/config.json',
      baseUrl: 'https://api.generaltranslation.com',
      dashboardUrl: 'https://dashboard.generaltranslation.com',
      apiKey: '1234567890',
      projectId: '1234567890',
      stageTranslations: false,
      src: ['src'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
      },
    };

    const mockResponse: EnqueueFilesResult = {
      data: {
        'component.json': {
          versionId: 'version-456',
          fileName: 'component.json',
        },
      },
      message: 'Files uploaded successfully',
      locales: ['es'],
      translations: [
        {
          locale: 'es',
          metadata: {
            context: 'test',
            id: 'test',
            sourceLocale: 'en',
            actionType: 'standard',
          },
          fileId: 'file-1',
          fileName: 'component.json',
          versionId: 'version-456',
          id: 'translation-1',
          isReady: true,
          downloadUrl: 'https://api.generaltranslation.com/download/file-1',
        },
      ],
    };

    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockResponse);

    const result = await sendFiles(mockFiles, mockOptions);

    expect(result).toEqual<SendFilesResult>({
      data: {
        'component.json': {
          versionId: 'version-456',
          fileName: 'component.json',
        },
      },
      locales: ['es'],
      translations: [
        {
          id: 'translation-1',
          locale: 'es',
          metadata: {
            context: 'test',
            id: 'test',
            sourceLocale: 'en',
            actionType: 'standard',
          },
          fileId: 'file-1',
          fileName: 'component.json',
          versionId: 'version-456',
          isReady: true,
          downloadUrl: 'https://api.generaltranslation.com/download/file-1',
        },
      ],
    });
  });
});
