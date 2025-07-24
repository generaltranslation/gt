import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchedFiles, downloadFileBatch } from '../downloadFileBatch.js';
import { gt } from '../../utils/gt.js';
import * as fs from 'fs';
import * as path from 'path';
import { logError, logWarning } from '../../console/logging.js';
import { DownloadFileBatchResult } from '../downloadFileBatch.js';
import { DownloadFileBatchResult as CoreDownloadFileBatchResult } from 'generaltranslation/types';
import { createMockSettings } from '../__mocks__/settings.js';

// Mock dependencies
vi.mock('../../utils/gt.js', () => ({
  gt: {
    downloadFileBatch: vi.fn(),
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

vi.mock('../../console/logging.js', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

describe('downloadFileBatch', () => {
  // Common mock data factories
  const createMockResponseData = (
    overrides: Partial<CoreDownloadFileBatchResult> = {}
  ): CoreDownloadFileBatchResult => {
    const defaultFiles = [
      {
        id: 'translation-1',
        data: 'content1',
        fileName: 'file1.json',
        metadata: {},
      },
      {
        id: 'translation-2',
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
      translationId: `translation-${i + 1}`,
      outputPath: `/output/file${i + 1}.json`,
      locale: 'en',
      ...overrides,
    }));
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

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    setupFileSystemMocks();

    const result = await downloadFileBatch(files, createMockSettings());

    expect(gt.downloadFileBatch).toHaveBeenCalledWith([
      'translation-1',
      'translation-2',
    ]);
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      '/output/file1.json',
      'content1'
    );
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      '/output/file2.json',
      'content2'
    );
    expect(result).toEqual<DownloadFileBatchResult>({
      successful: ['translation-1', 'translation-2'],
      failed: [],
    });
  });

  it('should create directories if they do not exist', async () => {
    const mockResponseData = createMockResponseData({
      files: [
        {
          id: 'translation-1',
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

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    vi.mocked(path.dirname).mockReturnValue('/output/dir');
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

    const result = await downloadFileBatch(files, createMockSettings());

    expect(fs.mkdirSync).toHaveBeenCalledWith('/output/dir', {
      recursive: true,
    });
    expect(result.successful).toEqual(['translation-1']);
  });

  it('should handle file write errors', async () => {
    const mockResponseData = createMockResponseData({ count: 1 });
    const files = createBatchedFiles();

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    vi.mocked(path.dirname).mockReturnValue('/output');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.promises.writeFile)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Write error'));

    const result = await downloadFileBatch(files, createMockSettings());

    expect(logError).toHaveBeenCalledWith(
      'Error saving file translation-2: Error: Write error'
    );
    expect(result).toEqual<DownloadFileBatchResult>({
      successful: ['translation-1'],
      failed: ['translation-2'],
    });
  });

  it('should handle missing output path', async () => {
    const mockResponseData = createMockResponseData({
      files: [
        {
          id: 'translation-1',
          data: 'content1',
          fileName: 'file1.json',
          metadata: {},
        },
        {
          id: 'translation-unknown',
          data: 'content2',
          fileName: 'file2.json',
          metadata: {},
        },
      ],
    });
    const files = createBatchedFiles(1);

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    setupFileSystemMocks();

    const result = await downloadFileBatch(files, createMockSettings());

    expect(logWarning).toHaveBeenCalledWith(
      'No output path found for file: translation-unknown'
    );
    expect(result).toEqual<DownloadFileBatchResult>({
      successful: ['translation-1'],
      failed: ['translation-unknown'],
    });
  });

  it('should mark files as failed if not in response', async () => {
    const mockResponseData = createMockResponseData({
      files: [
        {
          id: 'translation-1',
          data: 'content1',
          fileName: 'file1.json',
          metadata: {},
        },
      ],
    });
    const files = createBatchedFiles();

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    setupFileSystemMocks();

    const result = await downloadFileBatch(files, createMockSettings());

    expect(result).toEqual<DownloadFileBatchResult>({
      successful: ['translation-1'],
      failed: ['translation-2'],
    });
  });

  it('should retry on failure and succeed on second attempt', async () => {
    const mockResponseData = createMockResponseData({
      files: [
        {
          id: 'translation-1',
          data: 'content1',
          fileName: 'file1.json',
          metadata: {},
        },
      ],
      count: 1,
    });
    const files = createBatchedFiles(1);

    vi.mocked(gt.downloadFileBatch)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockResponseData);
    setupFileSystemMocks();
    setupFakeTimers();

    const downloadPromise = downloadFileBatch(files, createMockSettings());

    // Fast-forward through the retry delay
    await vi.advanceTimersByTimeAsync(1000);

    const result = await downloadPromise;

    expect(gt.downloadFileBatch).toHaveBeenCalledTimes(2);
    expect(result.successful).toEqual(['translation-1']);
  });

  it('should return all files as failed after max retries', async () => {
    const error = new Error('Network error');
    const files = createBatchedFiles();

    vi.mocked(gt.downloadFileBatch).mockRejectedValue(error);
    setupFakeTimers();

    const downloadPromise = downloadFileBatch(files, createMockSettings());

    // Fast-forward through all retry delays
    await vi.advanceTimersByTimeAsync(300);

    const result = await downloadPromise;

    expect(gt.downloadFileBatch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    expect(logError).toHaveBeenCalledWith(
      'Error downloading files in batch after 3 attempts: Error: Network error'
    );
    expect(result).toEqual<DownloadFileBatchResult>({
      successful: [],
      failed: ['translation-1', 'translation-2'],
    });
  });

  it('should use default retry parameters', async () => {
    const error = new Error('Network error');
    const files = createBatchedFiles(1);

    vi.mocked(gt.downloadFileBatch).mockRejectedValue(error);
    setupFakeTimers();

    const downloadPromise = downloadFileBatch(files, createMockSettings());

    // Fast-forward through all retry delays (default: 3 retries with 1000ms delay)
    await vi.advanceTimersByTimeAsync(4000);

    const result = await downloadPromise;

    expect(gt.downloadFileBatch).toHaveBeenCalledTimes(4); // Initial + 3 retries (default)
    expect(result.failed).toEqual(['translation-1']);
  });

  it('should handle empty files array', async () => {
    const mockResponseData = createMockResponseData({
      files: [],
      count: 0,
    });

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);

    const result = await downloadFileBatch([], createMockSettings());

    expect(gt.downloadFileBatch).toHaveBeenCalledWith([]);
    expect(result).toEqual<DownloadFileBatchResult>({
      successful: [],
      failed: [],
    });
  });

  it('should handle single file', async () => {
    const mockResponseData = createMockResponseData({
      files: [
        {
          id: 'translation-1',
          data: 'content1',
          fileName: 'file1.json',
          metadata: {},
        },
      ],
      count: 1,
    });
    const files = createBatchedFiles(1);

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    setupFileSystemMocks();

    const result = await downloadFileBatch(files, createMockSettings());

    expect(result).toEqual<DownloadFileBatchResult>({
      successful: ['translation-1'],
      failed: [],
    });
  });

  it('should handle directory creation errors', async () => {
    const mockResponseData = createMockResponseData({
      files: [
        {
          id: 'translation-1',
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

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    vi.mocked(path.dirname).mockReturnValue('/output/dir');
    setupFileSystemMocks({
      dirExists: false,
      mkdirError: new Error('Permission denied'),
    });

    const result = await downloadFileBatch(files, createMockSettings());

    expect(logError).toHaveBeenCalledWith(
      'Error saving file translation-1: Error: Permission denied'
    );
    expect(result).toEqual<DownloadFileBatchResult>({
      successful: [],
      failed: ['translation-1'],
    });
  });

  it('should respect custom retry delay', async () => {
    const error = new Error('Network error');
    const files = createBatchedFiles(1);

    vi.mocked(gt.downloadFileBatch).mockRejectedValue(error);
    setupFakeTimers();

    const downloadPromise = downloadFileBatch(files, createMockSettings());

    // Fast-forward through the retry delay
    await vi.advanceTimersByTimeAsync(250);

    const result = await downloadPromise;

    expect(result).toEqual<DownloadFileBatchResult>({
      successful: [],
      failed: ['translation-1'],
    });
    expect(gt.downloadFileBatch).toHaveBeenCalledTimes(2); // Initial + 1 retry
  });
});
