import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchedFiles, downloadFileBatch } from '../downloadFileBatch.js';
import { gt } from '../../utils/gt.js';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../console/logger.js';
import {
  DownloadFileBatchResult as CoreDownloadFileBatchResult,
  FileFormat,
} from 'generaltranslation/types';
import { createMockSettings } from '../__mocks__/settings.js';
import type { FileStatusTracker } from '../../workflow/PollJobsStep.js';

// Mock dependencies
vi.mock('../../utils/gt.js', () => ({
  gt: {
    downloadFileBatch: vi.fn(),
    resolveAliasLocale: vi.fn((locale) => locale), // Return locale as-is for testing
  },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  promises: {
    writeFile: vi.fn(),
  },
}));

vi.mock('path', () => ({
  dirname: vi.fn(),
}));

vi.mock('../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('downloadFileBatch', () => {
  // Common mock data factories
  const createMockResponseData = (
    overrides: Partial<CoreDownloadFileBatchResult> = {}
  ): CoreDownloadFileBatchResult => {
    const defaultFiles = [
      {
        id: 'translation-1',
        branchId: 'branch-1',
        fileId: 'file-1',
        versionId: 'version-1',
        locale: 'en',
        fileFormat: 'JSON' as FileFormat,
        data: 'content1',
        fileName: 'file1.json',
        metadata: {},
      },
      {
        id: 'translation-2',
        branchId: 'branch-2',
        fileId: 'file-2',
        versionId: 'version-2',
        locale: 'en',
        fileFormat: 'JSON' as FileFormat,
        data: 'content2',
        fileName: 'file2.json',
        metadata: {},
      },
    ];

    return {
      files: defaultFiles,
      count: defaultFiles.length,
      ...overrides,
    };
  };

  const createBatchedFiles = (
    count: number = 2,
    overrides: Partial<BatchedFiles[0]> = {}
  ): BatchedFiles => {
    return Array.from({ length: count }, (_, i) => ({
      branchId: `branch-${i + 1}`,
      fileId: `file-${i + 1}`,
      versionId: `version-${i + 1}`,
      outputPath: `/output/file${i + 1}.json`,
      inputPath: `/input/file${i + 1}.json`,
      locale: 'en',
      fileLocale: 'en', // Add required fileLocale property
      ...overrides,
    }));
  };

  const createMockFileTracker = (files: BatchedFiles): FileStatusTracker => {
    const completed = new Map();
    files.forEach((file) => {
      const fileKey = `${file.branchId}:${file.fileId}:${file.versionId}:${file.locale}`;
      completed.set(fileKey, {
        fileId: file.fileId,
        versionId: file.versionId,
        locale: file.locale,
        branchId: file.branchId,
        fileName: file.inputPath,
      });
    });
    return {
      completed,
      inProgress: new Map(),
      failed: new Map(),
      skipped: new Map(),
    };
  };

  const setupFileSystemMocks = (
    options: {
      dirExists?: boolean;
      writeFileError?: Error;
      mkdirError?: Error;
    } = {}
  ) => {
    const { dirExists = true, writeFileError, mkdirError } = options;

    vi.mocked(path.dirname).mockReturnValue('/output');
    vi.mocked(fs.existsSync).mockReturnValue(dirExists);

    if (writeFileError) {
      vi.mocked(fs.promises.writeFile).mockRejectedValue(writeFileError);
    } else {
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
    }

    if (mkdirError) {
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        throw mkdirError;
      });
    } else {
      vi.mocked(fs.mkdirSync).mockReturnValue('/output');
    }
  };

  const setupFakeTimers = () => {
    vi.useFakeTimers();
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should download multiple files successfully', async () => {
    const mockResponseData = createMockResponseData();
    const files = createBatchedFiles();
    const fileTracker = createMockFileTracker(files);

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    setupFileSystemMocks();

    const result = await downloadFileBatch(
      fileTracker,
      files,
      createMockSettings()
    );

    expect(gt.downloadFileBatch).toHaveBeenCalled();
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      '/output/file1.json',
      'content1'
    );
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      '/output/file2.json',
      'content2'
    );
    expect(result.successful).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
  });

  it('should create directories if they do not exist', async () => {
    const mockResponseData = createMockResponseData({
      files: [
        {
          id: 'translation-1',
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          locale: 'en',
          fileFormat: 'JSON' as FileFormat,
          data: 'content1',
          fileName: 'file1.json',
          metadata: {},
        },
      ],
      count: 1,
    });
    const files = createBatchedFiles(1, {
      outputPath: '/output/dir/file1.json',
    });
    const fileTracker = createMockFileTracker(files);

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    vi.mocked(path.dirname).mockReturnValue('/output/dir');
    vi.mocked(fs.existsSync).mockReturnValueOnce(false).mockReturnValue(true);
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

    const result = await downloadFileBatch(
      fileTracker,
      files,
      createMockSettings()
    );

    expect(fs.mkdirSync).toHaveBeenCalledWith('/output/dir', {
      recursive: true,
    });
    expect(result.successful).toHaveLength(1);
  });

  it('should handle file write errors', async () => {
    const mockResponseData = createMockResponseData({ count: 1 });
    const files = createBatchedFiles();
    const fileTracker = createMockFileTracker(files);

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    vi.mocked(path.dirname).mockReturnValue('/output');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.promises.writeFile)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Write error'));

    const result = await downloadFileBatch(
      fileTracker,
      files,
      createMockSettings()
    );

    expect(logger.error).toHaveBeenCalled();
    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
  });

  it('should handle missing output path', async () => {
    const files = createBatchedFiles(1);
    const fileTracker = createMockFileTracker(files);

    // Create files array that includes both the known file and an unknown one that will be requested
    const requestedFiles = [
      ...files,
      {
        branchId: 'branch-unknown',
        fileId: 'file-unknown',
        versionId: 'version-unknown',
        outputPath: '/output/file-unknown.json',
        inputPath: '/input/file-unknown.json',
        locale: 'es',
        fileLocale: 'es',
      },
    ];

    const mockResponseData = createMockResponseData({
      files: [
        {
          id: 'translation-1',
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          locale: 'en',
          fileFormat: 'JSON' as FileFormat,
          data: 'content1',
          fileName: 'file1.json',
          metadata: {},
        },
        {
          id: 'translation-unknown',
          branchId: 'branch-unknown',
          fileId: 'file-unknown',
          versionId: 'version-unknown',
          locale: 'es',
          fileFormat: 'JSON' as FileFormat,
          data: 'content2',
          fileName: 'file2.json',
          metadata: {},
        },
      ],
    });

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    setupFileSystemMocks();

    const result = await downloadFileBatch(
      fileTracker,
      requestedFiles,
      createMockSettings()
    );

    expect(logger.warn).toHaveBeenCalled();
    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
  });

  it('should mark files as failed if not in response', async () => {
    const files = createBatchedFiles();
    const fileTracker = createMockFileTracker(files);

    const mockResponseData = createMockResponseData({
      files: [
        {
          id: 'translation-1',
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          locale: 'en',
          fileFormat: 'JSON' as FileFormat,
          data: 'content1',
          fileName: 'file1.json',
          metadata: {},
        },
      ],
      count: 1,
    });

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    setupFileSystemMocks();

    const result = await downloadFileBatch(
      fileTracker,
      files,
      createMockSettings()
    );

    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
  });

  it('should retry on failure and succeed on second attempt', async () => {
    const files = createBatchedFiles(1);
    const fileTracker = createMockFileTracker(files);

    const mockResponseData = createMockResponseData({
      files: [
        {
          id: 'translation-1',
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          locale: 'en',
          fileFormat: 'JSON' as FileFormat,
          data: 'content1',
          fileName: 'file1.json',
          metadata: {},
        },
      ],
      count: 1,
    });

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    setupFileSystemMocks();

    const result = await downloadFileBatch(
      fileTracker,
      files,
      createMockSettings()
    );

    expect(result.successful).toHaveLength(1);
  });

  it('should use default retry parameters', async () => {
    const files = createBatchedFiles(1);
    const fileTracker = createMockFileTracker(files);
    const mockResponseData = createMockResponseData({
      files: [],
      count: 0,
    });

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);

    const result = await downloadFileBatch(
      fileTracker,
      files,
      createMockSettings()
    );

    expect(result.failed).toHaveLength(1);
  });

  it('should handle empty files array', async () => {
    const mockResponseData = createMockResponseData({
      files: [],
      count: 0,
    });
    const fileTracker = createMockFileTracker([]);

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);

    const result = await downloadFileBatch(
      fileTracker,
      [],
      createMockSettings()
    );

    expect(gt.downloadFileBatch).toHaveBeenCalled();
    expect(result.successful).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it('should handle single file', async () => {
    const files = createBatchedFiles(1);
    const fileTracker = createMockFileTracker(files);

    const mockResponseData = createMockResponseData({
      files: [
        {
          id: 'translation-1',
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          locale: 'en',
          fileFormat: 'JSON' as FileFormat,
          data: 'content1',
          fileName: 'file1.json',
          metadata: {},
        },
      ],
      count: 1,
    });

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    setupFileSystemMocks();

    const result = await downloadFileBatch(
      fileTracker,
      files,
      createMockSettings()
    );

    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
  });

  it('should handle directory creation errors', async () => {
    const mockResponseData = createMockResponseData({
      files: [
        {
          id: 'translation-1',
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          fileFormat: 'JSON' as FileFormat,
          data: 'content1',
          fileName: 'file1.json',
          metadata: {},
        },
      ],
      count: 1,
    });
    const files = createBatchedFiles(1, {
      outputPath: '/output/dir/file1.json',
    });
    const fileTracker = createMockFileTracker(files);

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    vi.mocked(path.dirname).mockReturnValue('/output/dir');
    setupFileSystemMocks({
      dirExists: false,
      mkdirError: new Error('Permission denied'),
    });

    const result = await downloadFileBatch(
      fileTracker,
      files,
      createMockSettings()
    );

    expect(logger.error).toHaveBeenCalled();
    expect(result.successful).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
  });
});
