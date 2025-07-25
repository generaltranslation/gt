import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadFile } from '../downloadFile.js';
import { gt } from '../../utils/gt.js';
import * as fs from 'fs';
import * as path from 'path';
import { logError } from '../../console/logging.js';
import { createMockSettings } from '../__mocks__/settings.js';

// Mock dependencies
vi.mock('../../utils/gt.js', () => ({
  gt: {
    downloadFile: vi.fn(),
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
}));

describe('downloadFile', () => {
  // Common mock data factories
  const createMockArrayBuffer = (size: number = 8) => new ArrayBuffer(size);

  const setupFileSystemMocks = (
    options: {
      dirExists?: boolean;
      writeFileError?: Error;
      mkdirError?: Error;
    } = {}
  ) => {
    const { dirExists = true, writeFileError, mkdirError } = options;

    vi.mocked(path.dirname).mockReturnValue('/output/dir');
    vi.mocked(fs.existsSync).mockReturnValue(dirExists);

    if (writeFileError) {
      vi.mocked(fs.promises.writeFile).mockRejectedValue(writeFileError);
    } else {
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
    }

    if (mkdirError) {
      vi.mocked(fs.mkdirSync).mockImplementationOnce(() => {
        throw mkdirError;
      });
    } else {
      vi.mocked(fs.mkdirSync).mockReturnValue('/output/dir');
    }
  };

  const setupSuccessfulDownload = (arrayBufferSize: number = 8) => {
    const mockArrayBuffer = createMockArrayBuffer(arrayBufferSize);
    vi.mocked(gt.downloadFile).mockResolvedValue(mockArrayBuffer);
    setupFileSystemMocks();
    return mockArrayBuffer;
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

  it('should download file successfully', async () => {
    setupSuccessfulDownload();

    const result = await downloadFile(
      'translation-123',
      '/output/dir/file.json',
      'en',
      createMockSettings()
    );

    expect(gt.downloadFile).toHaveBeenCalledWith('translation-123');
    expect(path.dirname).toHaveBeenCalledWith('/output/dir/file.json');
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      '/output/dir/file.json',
      expect.any(String)
    );
    expect(result).toBe(true);
  });

  it('should create directory if it does not exist', async () => {
    const mockArrayBuffer = createMockArrayBuffer();
    vi.mocked(gt.downloadFile).mockResolvedValue(mockArrayBuffer);
    setupFileSystemMocks({ dirExists: false });

    const result = await downloadFile(
      'translation-123',
      '/output/dir/file.json',
      'en',
      createMockSettings()
    );

    expect(fs.mkdirSync).toHaveBeenCalledWith('/output/dir', {
      recursive: true,
    });
    expect(result).toBe(true);
  });

  it('should retry on failure and succeed on second attempt', async () => {
    const mockArrayBuffer = createMockArrayBuffer();
    vi.mocked(gt.downloadFile)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockArrayBuffer);
    setupFileSystemMocks();
    setupFakeTimers();

    const downloadPromise = downloadFile(
      'translation-123',
      '/output/dir/file.json',
      'en',
      createMockSettings()
    );

    // Fast-forward through the retry delay
    await vi.advanceTimersByTimeAsync(1000);

    const result = await downloadPromise;

    expect(gt.downloadFile).toHaveBeenCalledTimes(2);
    expect(result).toBe(true);
  });

  it('should return false after max retries', async () => {
    const error = new Error('Network error');
    vi.mocked(gt.downloadFile)
      .mockRejectedValue(error)
      .mockRejectedValue(error)
      .mockRejectedValue(error);
    setupFakeTimers();

    const downloadPromise = downloadFile(
      'translation-123',
      '/output/dir/file.json',
      'en',
      createMockSettings(),
      2,
      100
    );

    // Fast-forward through all retry delays
    await vi.advanceTimersByTimeAsync(300);

    const result = await downloadPromise;

    expect(gt.downloadFile).toHaveBeenCalledTimes(3); // Initial + 2 retries
    expect(logError).toHaveBeenCalledWith(
      'Error downloading file /output/dir/file.json after 3 attempts: Error: Network error'
    );
    expect(result).toBe(false);
  });

  it('should use default retry parameters', async () => {
    const error = new Error('Network error');
    vi.mocked(gt.downloadFile).mockRejectedValue(error);
    setupFakeTimers();

    const downloadPromise = downloadFile(
      'translation-123',
      '/output/dir/file.json',
      'en',
      createMockSettings()
    );

    // Fast-forward through all retry delays (default: 3 retries with 1000ms delay)
    await vi.advanceTimersByTimeAsync(4000);

    const result = await downloadPromise;

    expect(gt.downloadFile).toHaveBeenCalledTimes(4); // Initial + 3 retries (default)
    expect(result).toBe(false);
  });

  it('should handle file write errors and retry', async () => {
    const mockArrayBuffer = createMockArrayBuffer();
    vi.mocked(gt.downloadFile).mockResolvedValue(mockArrayBuffer);

    vi.mocked(path.dirname).mockReturnValue('/output/dir');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.promises.writeFile)
      .mockRejectedValueOnce(new Error('Write error'))
      .mockResolvedValueOnce(undefined);
    setupFakeTimers();

    const downloadPromise = downloadFile(
      'translation-123',
      '/output/dir/file.json',
      'en',
      createMockSettings()
    );

    // Fast-forward through the retry delay
    await vi.advanceTimersByTimeAsync(1000);

    const result = await downloadPromise;

    expect(gt.downloadFile).toHaveBeenCalledTimes(2);
    expect(fs.promises.writeFile).toHaveBeenCalledTimes(2);
    expect(result).toBe(true);
  });

  it('should handle directory creation errors and retry', async () => {
    const mockArrayBuffer = createMockArrayBuffer();
    vi.mocked(gt.downloadFile).mockResolvedValue(mockArrayBuffer);

    vi.mocked(path.dirname).mockReturnValue('/output/dir');
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync)
      .mockImplementationOnce(() => {
        throw new Error('Permission denied');
      })
      .mockImplementationOnce(() => {
        return '/output/dir';
      });
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
    setupFakeTimers();

    const downloadPromise = downloadFile(
      'translation-123',
      '/output/dir/file.json',
      'en',
      createMockSettings()
    );

    // Fast-forward through the retry delay
    await vi.advanceTimersByTimeAsync(1000);

    const result = await downloadPromise;

    expect(gt.downloadFile).toHaveBeenCalledTimes(2);
    expect(fs.mkdirSync).toHaveBeenCalledTimes(2);
    expect(result).toBe(true);
  });

  it('should handle empty file content', async () => {
    setupSuccessfulDownload(0);

    const result = await downloadFile(
      'translation-123',
      '/output/dir/file.json',
      'en',
      createMockSettings()
    );

    expect(result).toBe(true);
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      '/output/dir/file.json',
      expect.any(String)
    );
  });

  it('should handle special characters in translation ID', async () => {
    setupSuccessfulDownload();

    const result = await downloadFile(
      'translation-123-special_chars',
      '/output/dir/file.json',
      'en',
      createMockSettings()
    );

    expect(gt.downloadFile).toHaveBeenCalledWith(
      'translation-123-special_chars'
    );
    expect(result).toBe(true);
  });

  it('should handle nested directory creation', async () => {
    const mockArrayBuffer = createMockArrayBuffer();
    vi.mocked(gt.downloadFile).mockResolvedValue(mockArrayBuffer);

    vi.mocked(path.dirname).mockReturnValue('/output/deeply/nested/dir');
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

    const result = await downloadFile(
      'translation-123',
      '/output/deeply/nested/dir/file.json',
      'en',
      createMockSettings()
    );

    expect(fs.mkdirSync).toHaveBeenCalledWith('/output/deeply/nested/dir', {
      recursive: true,
    });
    expect(result).toBe(true);
  });

  it('should handle API errors gracefully', async () => {
    const apiError = new Error('API Error');
    vi.mocked(gt.downloadFile).mockRejectedValue(apiError);
    setupFakeTimers();

    const downloadPromise = downloadFile(
      'translation-123',
      '/output/dir/file.json',
      'en',
      createMockSettings(),
      0
    );

    // Fast-forward through retry delays
    await vi.advanceTimersByTimeAsync(200);

    const result = await downloadPromise;

    expect(result).toBe(false);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('Error downloading file')
    );
  });
});
