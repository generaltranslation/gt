import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchedFiles, downloadFileBatch } from '../downloadFileBatch.js';
import { gt } from '../../utils/gt.js';
import * as fs from 'fs';
import * as path from 'path';
import nodePath from 'node:path';
import { logger } from '../../console/logger.js';
import {
  DownloadFileBatchResult as CoreDownloadFileBatchResult,
  FileFormat,
} from 'generaltranslation/types';
import { createMockSettings } from '../__mocks__/settings.js';
import {
  findOrCreateEntry,
  readLockfile,
} from '../../fs/config/downloadedVersions.js';
import type { DownloadedVersionEntry } from '../../fs/config/downloadedVersions.js';

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

vi.mock('path', async () => {
  const actualPath =
    await vi.importActual<typeof import('node:path')>('node:path');
  // Shared instances so default and named imports resolve to the same mocks
  const dirname = vi.fn(actualPath.dirname);
  const relative = vi.fn(actualPath.relative);
  const resolve = vi.fn(actualPath.resolve);
  return {
    ...actualPath,
    default: { ...actualPath, dirname, relative, resolve },
    dirname,
    relative,
    resolve,
  };
});

vi.mock('../../fs/config/downloadedVersions.js', () => ({
  readLockfile: vi.fn(() => ({
    data: { version: 2, branchId: '', entries: [] },
    entryMap: new Map(),
    originalV1: null,
  })),
  writeLockfile: vi.fn(),
  findOrCreateEntry: vi.fn(() => ({
    fileId: 'file-1',
    versionId: 'version-1',
    translations: {},
  })),
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readLockfile).mockReturnValue({
      data: { version: 2, branchId: '', entries: [] },
      entryMap: new Map(),
      originalV1: null,
    });
    vi.mocked(findOrCreateEntry).mockReturnValue({
      fileId: 'file-1',
      versionId: 'version-1',
      translations: {},
    });
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

  it('should skip the API request when the lockfile has the requested output', async () => {
    const files = createBatchedFiles(1);
    const existingEntry: DownloadedVersionEntry = {
      fileId: 'file-1',
      versionId: 'version-1',
      translations: {
        en: {
          updatedAt: '2026-01-01T00:00:00.000Z',
          fileName: 'file1.json',
        },
      },
    };

    vi.mocked(readLockfile).mockReturnValue({
      data: { version: 2, branchId: 'branch-1', entries: [existingEntry] },
      entryMap: new Map([['file-1', existingEntry]]),
      originalV1: null,
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"hello":"world"}');

    const result = await downloadFileBatch(files, createMockSettings());

    expect(gt.downloadFileBatch).not.toHaveBeenCalled();
    expect(fs.promises.writeFile).not.toHaveBeenCalled();
    expect(result.skipped).toEqual(files);
    expect(result.successful).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it('should keep an unreadable completed GTJSON output skipped', async () => {
    const files = createBatchedFiles(1, { componentCount: 2 });
    const existingEntry: DownloadedVersionEntry = {
      fileId: 'file-1',
      versionId: 'version-1',
      translations: {
        en: {
          updatedAt: '2026-01-01T00:00:00.000Z',
          fileName: 'file1.json',
        },
      },
    };

    vi.mocked(readLockfile).mockReturnValue({
      data: { version: 2, branchId: 'branch-1', entries: [existingEntry] },
      entryMap: new Map([['file-1', existingEntry]]),
      originalV1: null,
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('file disappeared');
    });

    const result = await downloadFileBatch(files, createMockSettings());

    expect(gt.downloadFileBatch).not.toHaveBeenCalled();
    expect(result.skipped).toEqual(files);
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
    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    setupFileSystemMocks();

    const result = await downloadFileBatch(files, createMockSettings());

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
    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    vi.mocked(path.dirname).mockReturnValue('/output/dir');
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

    const result = await downloadFileBatch(files, createMockSettings());

    expect(fs.mkdirSync).toHaveBeenCalledWith('/output/dir', {
      recursive: true,
    });
    expect(result.successful).toHaveLength(1);
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

    expect(logger.error).toHaveBeenCalled();
    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
  });

  it('should mark files as failed if not in response', async () => {
    const files = createBatchedFiles();
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

    const result = await downloadFileBatch(files, createMockSettings());

    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
  });

  it('should retry on failure and succeed on second attempt', async () => {
    const files = createBatchedFiles(1);
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

    const result = await downloadFileBatch(files, createMockSettings());

    expect(result.successful).toHaveLength(1);
  });

  it('should use default retry parameters', async () => {
    const files = createBatchedFiles(1);
    const mockResponseData = createMockResponseData({
      files: [],
      count: 0,
    });

    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);

    const result = await downloadFileBatch(files, createMockSettings());

    expect(result.failed).toHaveLength(1);
  });

  it('should handle empty files array', async () => {
    const mockResponseData = createMockResponseData({
      files: [],
      count: 0,
    });
    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);

    const result = await downloadFileBatch([], createMockSettings());

    expect(gt.downloadFileBatch).not.toHaveBeenCalled();
    expect(result.successful).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it('should handle single file', async () => {
    const files = createBatchedFiles(1);
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

    const result = await downloadFileBatch(files, createMockSettings());

    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
  });

  it('stores relative output paths in the lockfile', async () => {
    const outputPath = nodePath.resolve('public/gt/es.json');
    const files = createBatchedFiles(1, {
      locale: 'es',
      outputPath,
    });
    const lockEntry: DownloadedVersionEntry = {
      fileId: 'file-1',
      versionId: 'version-1',
      translations: {},
    };

    vi.mocked(findOrCreateEntry).mockReturnValue(lockEntry);
    vi.mocked(gt.downloadFileBatch).mockResolvedValue({
      files: [
        {
          id: 'translation-1',
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          locale: 'es',
          fileFormat: 'GTJSON' as FileFormat,
          data: '{"hello":"Hola"}',
          fileName: 'es.json',
          metadata: {},
        },
      ],
      count: 1,
    });
    setupFileSystemMocks();

    const result = await downloadFileBatch(files, createMockSettings());

    expect(result.successful).toHaveLength(1);
    expect(lockEntry.translations.es.fileName).toBe('public/gt/es.json');
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
    vi.mocked(gt.downloadFileBatch).mockResolvedValue(mockResponseData);
    vi.mocked(path.dirname).mockReturnValue('/output/dir');
    setupFileSystemMocks({
      dirExists: false,
      mkdirError: new Error('Permission denied'),
    });

    const result = await downloadFileBatch(files, createMockSettings());

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
      data: { version: 2, branchId: 'branch-1', entries: [] },
      entryMap: new Map<string, DownloadedVersionEntry>([
        [
          'file-1',
          {
            fileId: 'file-1',
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
      originalV1: null,
    });

    setupFileSystemMocks({ dirExists: true });
    vi.mocked(fs.readFileSync).mockReturnValue(sourceDocsJson);
    vi.mocked(path.relative).mockReturnValue('docs.json');

    const result = await downloadFileBatch(
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
      })
    );

    // Fresh data must be merged and written — not skipped
    expect(result.skipped).toHaveLength(0);
    expect(result.successful).toHaveLength(1);
    const writeCall = vi
      .mocked(fs.promises.writeFile)
      .mock.calls.find((c) => c[0] === 'docs.json');
    expect(writeCall).toBeDefined();
    const written = JSON.parse(writeCall![1] as string) as {
      navigation: {
        languages: { language: string; tabs: { tab: string }[] }[];
      };
    };
    const esEntry = written.navigation.languages.find(
      (language) => language.language === 'es'
    );
    expect(esEntry).toBeDefined();
    expect(esEntry!.tabs[0].tab).toBe('Guías');
  });
});
