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
import { readLockfile } from '../../fs/config/downloadedVersions.js';
import type { FileStatusTracker } from '../../workflow/PollJobsStep.js';

// Mock dependencies
vi.mock('../../utils/gt.js', () => ({
  gt: {
    downloadFileBatch: vi.fn(),
    resolveAliasLocale: vi.fn((locale) => locale), // Return locale as-is for testing
    resolveCanonicalLocale: vi.fn((locale) => locale),
  },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  promises: {
    writeFile: vi.fn(),
  },
}));

vi.mock('path', () => {
  // Shared instances so default and named imports resolve to the same mocks
  const dirname = vi.fn();
  const relative = vi.fn();
  return {
    default: { dirname, relative },
    dirname,
    relative,
  };
});

vi.mock('../../fs/config/downloadedVersions.js', () => ({
  readLockfile: vi.fn(() => ({
    data: { entries: [] },
    entryMap: new Map(),
    originalV1: false,
  })),
  writeLockfile: vi.fn(),
  findOrCreateEntry: vi.fn(() => ({ translations: {} })),
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

  it('should sort JSON keys when writing JSON output files', async () => {
    const mockResponseData = createMockResponseData({
      files: [
        {
          id: 'translation-1',
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          locale: 'en',
          fileFormat: 'JSON' as FileFormat,
          data: '{"z":1,"a":{"c":3,"b":2}}',
          fileName: 'file1.json',
          metadata: {},
        },
      ],
      count: 1,
    });
    const files = createBatchedFiles(1);
    const fileTracker = createMockFileTracker(files);

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    setupFileSystemMocks();

    const result = await downloadFileBatch(
      fileTracker,
      files,
      createMockSettings()
    );

    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      '/output/file1.json',
      JSON.stringify({ a: { b: 2, c: 3 }, z: 1 }, null, 2)
    );
    expect(result.successful).toHaveLength(1);
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

  it('always merges composite schema files from fresh data, even when the lockfile is up to date', async () => {
    // Composite files (e.g. Mintlify docs.json) merge translations into the
    // source file itself, so outputPath always exists and the lockfile check
    // cannot tell whether derived split outputs ({locale}/docs.json) are still
    // on disk. The up-to-date skip must be bypassed for them — otherwise a run
    // that cleared the locale dirs never regenerates the locale nav files.
    const sourceDocsJson = JSON.stringify({
      navigation: {
        languages: [{ language: 'en', tabs: [{ tab: 'Guides' }] }],
      },
    });
    const translatedPayload = JSON.stringify({
      '/navigation/languages': { '/0': { '/tabs/0/tab': 'Guías' } },
    });

    const files: BatchedFiles = [
      {
        branchId: 'branch-1',
        fileId: 'file-1',
        versionId: 'version-1',
        outputPath: 'docs.json',
        inputPath: 'docs.json',
        locale: 'es',
      },
    ];
    const fileTracker = createMockFileTracker(files);

    vi.mocked(gt.downloadFileBatch).mockResolvedValue({
      files: [
        {
          id: 'translation-1',
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          locale: 'es',
          fileFormat: 'JSON' as FileFormat,
          data: translatedPayload,
          fileName: 'docs.json',
          metadata: {},
        },
      ],
      count: 1,
    });

    // Lockfile says this exact version+locale was already downloaded, and the
    // output file exists — the conditions that previously triggered the skip
    vi.mocked(readLockfile).mockReturnValue({
      data: { entries: [] },
      entryMap: new Map([
        [
          'file-1',
          {
            versionId: 'version-1',
            fileName: 'docs.json',
            translations: {
              es: {
                updatedAt: '2026-01-01T00:00:00.000Z',
                fileName: 'docs.json',
              },
            },
          },
        ],
      ]),
      originalV1: false,
    } as any);

    setupFileSystemMocks({ dirExists: true });
    vi.mocked(fs.readFileSync).mockReturnValue(sourceDocsJson);
    vi.mocked(path.relative).mockReturnValue('docs.json');

    const result = await downloadFileBatch(
      fileTracker,
      files,
      createMockSettings({
        locales: ['en', 'es'],
        options: {
          jsonSchema: {
            'docs.json': {
              composite: {
                '$.navigation.languages': {
                  type: 'array',
                  key: '$.language',
                  include: ['$..tab'],
                },
              },
            },
          },
        },
      } as any)
    );

    // Fresh data must be merged and written — not skipped
    expect(result.skipped).toHaveLength(0);
    expect(result.successful).toHaveLength(1);
    const writeCall = vi
      .mocked(fs.promises.writeFile)
      .mock.calls.find((c) => c[0] === 'docs.json');
    expect(writeCall).toBeDefined();
    const written = JSON.parse(writeCall![1] as string);
    const esEntry = written.navigation.languages.find(
      (l: any) => l.language === 'es'
    );
    expect(esEntry.tabs[0].tab).toBe('Guías');
  });
});
