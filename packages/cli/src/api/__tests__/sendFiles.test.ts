import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendFiles, SendFilesResult } from '../sendFiles.js';
import { gt } from '../../utils/gt.js';
import { createSpinner, logSuccess } from '../../console/logging.js';
import { SpinnerResult } from '@clack/prompts';
import { EnqueueFilesResult, FileToTranslate } from 'generaltranslation/types';
import { Settings, TranslateFlags } from '../../types/index.js';

// Mock dependencies
vi.mock('../../utils/gt.js', () => ({
  gt: {
    enqueueFiles: vi.fn(),
    uploadSourceFiles: vi.fn(),
    shouldSetupProject: vi.fn(),
    setupProject: vi.fn(),
    checkSetupStatus: vi.fn(),
  },
}));

vi.mock('../../console/logging.js', () => ({
  createSpinner: vi.fn(),
  logMessage: vi.fn(),
  logSuccess: vi.fn(),
  logError: vi.fn(),
}));

describe('sendFiles', () => {
  const mockSpinner = {
    start: vi.fn(),
    stop: vi.fn(),
  };

  // Common mock data factories
  const createMockFiles = (
    count: number = 1,
    overrides: Partial<FileToTranslate> = {}
  ): FileToTranslate[] => {
    return Array.from({ length: count }, (_, i) => ({
      fileName: `file${i}.json`,
      content: `{"key${i}": "value${i}"}`,
      fileFormat: 'JSON' as const,
      ...overrides,
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
  const createMockFlags = (
    overrides: Partial<TranslateFlags> = {}
  ): TranslateFlags => ({
    publish: true,
    apiKey: '1234567890',
    projectId: '1234567890',
    timeout: '10000',
    dryRun: false,
    ...overrides,
  });

  const createMockEnqueueResponse = (
    overrides: Partial<EnqueueFilesResult> = {}
  ): EnqueueFilesResult => ({
    data: {
      'file0.json': {
        versionId: 'version-456',
        fileName: 'file0.json',
      },
    },
    message: 'Files uploaded successfully',
    locales: ['es', 'fr'],
    translations: [],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSpinner).mockReturnValue(
      mockSpinner as unknown as SpinnerResult
    );
  });

  it('should send files successfully', async () => {
    const mockFiles = [
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

    const mockFlags = createMockFlags();
    const mockSettings = createMockSettings();

    const mockUploadResponse = {
      uploadedFiles: [
        { fileId: 'file-123', versionId: 'version-456', fileName: 'component.json' },
        { fileId: 'file-789', versionId: 'version-012', fileName: 'page.json' },
      ],
    };

    const mockEnqueueResponse = createMockEnqueueResponse({
      data: {
        'component.json': {
          versionId: 'version-456',
          fileName: 'component.json',
        },
        'page.json': { versionId: 'version-456', fileName: 'page.json' },
      },
    });

    vi.mocked(gt.uploadSourceFiles).mockResolvedValue(mockUploadResponse);
    vi.mocked(gt.shouldSetupProject).mockResolvedValue({ shouldSetupProject: false });
    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockEnqueueResponse);

    const result = await sendFiles(mockFiles, mockFlags, mockSettings);

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Uploading 2 files to General Translation API...'
    );

    expect(gt.uploadSourceFiles).toHaveBeenCalled();
    expect(gt.shouldSetupProject).toHaveBeenCalled();
    expect(gt.enqueueFiles).toHaveBeenCalled();

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
    const mockFiles = createMockFiles(1, {
      fileName: 'component.json',
      content: '{"hello": "world"}',
    });
    const mockSettings = createMockSettings({
      publish: false,
      locales: ['es'],
    });
    const mockFlags = createMockFlags({
      publish: false,
    });

    const mockUploadResponse = {
      uploadedFiles: [
        { fileId: 'file-123', versionId: 'version-456', fileName: 'component.json' },
      ],
    };

    const mockEnqueueResponse = createMockEnqueueResponse({
      data: {
        'component.json': {
          versionId: 'version-456',
          fileName: 'component.json',
        },
      },
      locales: ['es'],
    });

    vi.mocked(gt.uploadSourceFiles).mockResolvedValue(mockUploadResponse);
    vi.mocked(gt.shouldSetupProject).mockResolvedValue({ shouldSetupProject: false });
    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockEnqueueResponse);

    const result = await sendFiles(mockFiles, mockFlags, mockSettings);

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Uploading 1 file to General Translation API...'
    );

    expect(gt.uploadSourceFiles).toHaveBeenCalled();
    expect(gt.shouldSetupProject).toHaveBeenCalled();
    expect(gt.enqueueFiles).toHaveBeenCalled();

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

  it('should handle setup workflow when setup is needed', async () => {
    const mockFiles = [
      {
        fileName: 'component.json',
        content: '{"hello": "world"}',
        fileFormat: 'JSON' as const,
      },
    ];

    const mockFlags = createMockFlags({ timeout: '30' });
    const mockSettings = createMockSettings();

    const mockUploadResponse = {
      uploadedFiles: [
        { fileId: 'file-123', versionId: 'version-456', fileName: 'component.json' },
      ],
    };

    const mockSetupResponse = {
      setupJobId: 'setup-job-789',
      status: 'queued' as const,
    };

    const mockSetupStatusResponse = {
      jobId: 'setup-job-789',
      status: 'completed' as const,
    };

    const mockEnqueueResponse = createMockEnqueueResponse({
      data: {
        'component.json': {
          versionId: 'version-456',
          fileName: 'component.json',
        },
      },
    });

    vi.mocked(gt.uploadSourceFiles).mockResolvedValue(mockUploadResponse);
    vi.mocked(gt.shouldSetupProject).mockResolvedValue({ shouldSetupProject: true });
    vi.mocked(gt.setupProject).mockResolvedValue(mockSetupResponse);
    vi.mocked(gt.checkSetupStatus).mockResolvedValue(mockSetupStatusResponse);
    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockEnqueueResponse);

    const result = await sendFiles(mockFiles, mockFlags, mockSettings);

    expect(gt.shouldSetupProject).toHaveBeenCalled();
    expect(gt.setupProject).toHaveBeenCalledWith(mockUploadResponse.uploadedFiles);
    expect(gt.checkSetupStatus).toHaveBeenCalledWith('setup-job-789');
    expect(gt.enqueueFiles).toHaveBeenCalled();

    expect(result).toEqual<SendFilesResult>({
      data: {
        'component.json': {
          versionId: 'version-456',
          fileName: 'component.json',
        },
      },
      locales: ['es', 'fr'],
      translations: [],
    });
  });

  it('should handle setup timeout gracefully', async () => {
    const mockFiles = [
      {
        fileName: 'component.json',
        content: '{"hello": "world"}',
        fileFormat: 'JSON' as const,
      },
    ];

    const mockFlags = createMockFlags({ timeout: '1' }); // Very short timeout
    const mockSettings = createMockSettings();

    const mockUploadResponse = {
      uploadedFiles: [
        { fileId: 'file-123', versionId: 'version-456', fileName: 'component.json' },
      ],
    };

    const mockSetupResponse = {
      setupJobId: 'setup-job-789',
      status: 'queued' as const,
    };

    const mockSetupStatusResponse = {
      jobId: 'setup-job-789',
      status: 'processing' as const, // Still processing, will timeout
    };

    const mockEnqueueResponse = createMockEnqueueResponse();

    vi.mocked(gt.uploadSourceFiles).mockResolvedValue(mockUploadResponse);
    vi.mocked(gt.shouldSetupProject).mockResolvedValue({ shouldSetupProject: true });
    vi.mocked(gt.setupProject).mockResolvedValue(mockSetupResponse);
    vi.mocked(gt.checkSetupStatus).mockResolvedValue(mockSetupStatusResponse);
    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockEnqueueResponse);

    const result = await sendFiles(mockFiles, mockFlags, mockSettings);

    expect(gt.checkSetupStatus).toHaveBeenCalled();
    expect(gt.enqueueFiles).toHaveBeenCalled();

    // Should still proceed with enqueue even if setup times out
    expect(result.data).toBeDefined();
  });

  it('should handle API errors', async () => {
    const mockFiles = createMockFiles(1, {
      fileName: 'component.json',
      content: '{"hello": "world"}',
    });
    const mockOptions = createMockSettings({ locales: ['es'] });

    const error = new Error('API Error');
    vi.mocked(gt.uploadSourceFiles).mockRejectedValue(error);

    await expect(
      sendFiles(mockFiles, { timeout: '10000', dryRun: false }, mockOptions)
    ).rejects.toThrow('API Error');

    expect(mockSpinner.start).toHaveBeenCalled();
    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send files for translation')
    );
  });

  it('should handle empty files array', async () => {
    const mockFiles: FileToTranslate[] = [];
    const mockOptions = createMockSettings({ locales: ['es'] });
    const mockResponse = createMockEnqueueResponse({
      data: {},
      message: 'No files to upload',
      locales: ['es'],
    });

    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockResponse);

    const result = await sendFiles(
      mockFiles,
      { timeout: '10000', dryRun: false },
      mockOptions
    );

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
    const mockFiles = createMockFiles(100);
    const mockOptions = createMockSettings({ locales: ['es'] });
    const mockResponse = createMockEnqueueResponse({
      data: {
        'file0.json': { versionId: 'version-456', fileName: 'file0.json' },
      },
      locales: ['es'],
    });

    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockResponse);

    const result = await sendFiles(
      mockFiles,
      { timeout: '10000', dryRun: false },
      mockOptions
    );

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Sending 100 files to General Translation API...'
    );

    expect(gt.enqueueFiles).toHaveBeenCalledWith(mockFiles, expect.any(Object));

    expect(result).toEqual<SendFilesResult>({
      data: {
        'file0.json': { versionId: 'version-456', fileName: 'file0.json' },
      },
      locales: ['es'],
      translations: [],
    });
  });

  it('should handle network timeout errors', async () => {
    const mockFiles = createMockFiles(1, {
      fileName: 'component.json',
      content: '{"hello": "world"}',
    });
    const mockOptions = createMockSettings({ locales: ['es'] });

    const timeoutError = new Error('Network timeout');
    vi.mocked(gt.enqueueFiles).mockRejectedValue(timeoutError);

    await expect(
      sendFiles(mockFiles, { timeout: '10000', dryRun: false }, mockOptions)
    ).rejects.toThrow('Network timeout');

    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send files for translation')
    );
  });

  it('should handle authentication errors', async () => {
    const mockFiles = createMockFiles(1, {
      fileName: 'component.json',
      content: '{"hello": "world"}',
    });
    const mockOptions = createMockSettings({ locales: ['es'] });

    const authError = new Error('Unauthorized');
    vi.mocked(gt.enqueueFiles).mockRejectedValue(authError);

    await expect(
      sendFiles(mockFiles, { timeout: '10000', dryRun: false }, mockOptions)
    ).rejects.toThrow('Unauthorized');

    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send files for translation')
    );
  });

  it('should handle different file formats', async () => {
    const mockFiles = [
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

    const mockOptions = createMockSettings({ locales: ['es'] });
    const mockResponse = createMockEnqueueResponse({
      data: {
        'component.jsx': {
          versionId: 'version-456',
          fileName: 'component.jsx',
        },
        'messages.po': { versionId: 'version-456', fileName: 'messages.po' },
      },
      locales: ['es'],
    });

    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockResponse);

    const result = await sendFiles(
      mockFiles,
      { timeout: '10000', dryRun: false },
      mockOptions
    );

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
    const mockFiles = createMockFiles(1, {
      fileName: 'component.json',
      content: '{"hello": "world"}',
    });
    const mockOptions = createMockSettings({ locales: ['es'] });

    const mockResponse = createMockEnqueueResponse({
      data: {
        'component.json': {
          versionId: 'version-456',
          fileName: 'component.json',
        },
      },
      locales: ['es'],
    });

    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockResponse);

    const result = await sendFiles(
      mockFiles,
      { timeout: '10000', dryRun: false },
      mockOptions
    );

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
    const mockFiles = createMockFiles(1, {
      fileName: 'component.json',
      content: '{"hello": "world"}',
    });
    const mockOptions = createMockSettings({ locales: ['es'] });

    const mockResponse = createMockEnqueueResponse({
      data: {
        'component.json': {
          versionId: 'version-456',
          fileName: 'component.json',
        },
      },
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
    });

    vi.mocked(gt.enqueueFiles).mockResolvedValue(mockResponse);

    const result = await sendFiles(
      mockFiles,
      { timeout: '10000', dryRun: false },
      mockOptions
    );

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
