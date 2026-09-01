import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchedFiles, downloadFileBatch } from '../downloadFileBatch.js';
import { gt } from '../../utils/gt.js';
import * as fs from 'fs';
import * as path from 'path';
import nodePath from 'node:path';
import { logger } from '../../console/logger.js';
import { mergeXcstrings } from '../../formats/xcstrings/mergeXcstrings.js';
import type { XcstringsCatalog } from '../../formats/xcstrings/parseXcstrings.js';
import {
  clearDownloaded,
  getDownloadedMeta,
} from '../../state/recentDownloads.js';
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
import type { FileStatusTracker } from '../../workflows/steps/PollJobsStep.js';
import { clearWarnings, getWarnings } from '../../state/translateWarnings.js';

// Mock dependencies
vi.mock('../../utils/gt.js', () => ({
  gt: {
    downloadFileBatch: vi.fn(),
    resolveAliasLocale: vi.fn((locale) => locale), // Return locale as-is for testing
    resolveCanonicalLocale: vi.fn((locale) => locale),
  },
}));

// The 'fs' mock below also captures 'node:fs'; fixtures need the real module
const { readFileSync: readRealFileSync } =
  await vi.importActual<typeof import('node:fs')>('node:fs');

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
    clearWarnings();
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

  it('stores relative output paths in the lockfile', async () => {
    const outputPath = nodePath.resolve('public/gt/es.json');
    const files = createBatchedFiles(1, {
      locale: 'es',
      outputPath,
    });
    const fileTracker = createMockFileTracker(files);
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

    const result = await downloadFileBatch(
      fileTracker,
      files,
      createMockSettings()
    );

    expect(result.successful).toHaveLength(1);
    expect(lockEntry.translations.es.fileName).toBe('public/gt/es.json');
  });

  it.each([
    ['gt-vue', '<Vue Elements>'],
    ['gt-react', '<React Elements>'],
  ] as const)(
    'labels review-withheld %s catalogs with their framework',
    async (inlineLibrary, expectedLabel) => {
      const files = createBatchedFiles(1, { locale: 'es' });
      const fileTracker = createMockFileTracker(files);
      const fileProperties = fileTracker.completed.values().next().value;
      if (!fileProperties) throw new Error('Expected one completed file');
      fileProperties.componentCount = 2;

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

      await downloadFileBatch(
        fileTracker,
        files,
        createMockSettings(),
        false,
        inlineLibrary
      );

      expect(getWarnings()).toContainEqual({
        category: 'pending_review',
        fileName: expectedLabel,
        reason:
          '1 component translation(s) for locale es require review and are not approved yet',
      });
    }
  );

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
      originalV1: false,
    });

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

  describe('xcstrings catalog downloads', () => {
    const catalogPath = 'Cascade/Localizable.xcstrings';
    // Hermetic copies of xcstrings-fixtures 10 (realistic app) and 19
    // (catalog coexisting with legacy .strings files)
    const realisticCatalog = readRealFileSync(
      nodePath.join(
        __dirname,
        '../../formats/xcstrings/__mocks__/realistic_app.xcstrings'
      ),
      'utf8'
    );
    const legacyMixedCatalog = readRealFileSync(
      nodePath.join(
        __dirname,
        '../../formats/xcstrings/__mocks__/legacy_catalog_mixed.xcstrings'
      ),
      'utf8'
    );
    const legacyMixedDeStrings = readRealFileSync(
      nodePath.join(
        __dirname,
        '../../formats/xcstrings/__mocks__/legacy_catalog_mixed_de.strings'
      ),
      'utf8'
    );

    /** Routes the mocked fs at an in-memory store so merges read prior writes. */
    const setupInMemoryFs = (store: Map<string, string>, dirs: string[]) => {
      vi.mocked(fs.existsSync).mockImplementation(
        (p) => store.has(String(p)) || dirs.includes(String(p))
      );
      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        const content = store.get(String(p));
        if (content === undefined) {
          throw new Error(`ENOENT: no such file ${String(p)}`);
        }
        return content;
      });
      vi.mocked(fs.promises.writeFile).mockImplementation(async (p, data) => {
        store.set(String(p), String(data));
      });
    };

    /** A single-locale translated slice covering some of a catalog's keys. */
    const buildSlice = (
      catalogContent: string,
      locale: string,
      marker: string,
      keyCount = 5
    ): string => {
      const catalog = JSON.parse(catalogContent) as XcstringsCatalog;
      const keys = Object.keys(catalog.strings)
        .filter((key) => catalog.strings[key].localizations?.[locale])
        .slice(0, keyCount);
      expect(keys.length).toBeGreaterThan(0);
      return JSON.stringify({
        sourceLanguage: catalog.sourceLanguage,
        strings: Object.fromEntries(
          keys.map((key) => [
            key,
            {
              localizations: {
                [locale]: {
                  stringUnit: {
                    state: 'translated',
                    value: `${marker} ${key}`,
                  },
                },
              },
            },
          ])
        ),
      });
    };

    const xcstringsBatchFile = (
      locale: string,
      overrides: Partial<BatchedFiles[0]> = {}
    ): BatchedFiles[0] => ({
      branchId: 'branch-1',
      fileId: 'file-1',
      versionId: 'version-1',
      outputPath: catalogPath,
      inputPath: catalogPath,
      locale,
      ...overrides,
    });

    const xcstringsResponseFile = (
      locale: string,
      data: string,
      overrides: Record<string, unknown> = {}
    ) => ({
      id: `translation-${locale}`,
      branchId: 'branch-1',
      fileId: 'file-1',
      versionId: 'version-1',
      locale,
      fileFormat: 'XCSTRINGS' as FileFormat,
      data,
      fileName: catalogPath,
      metadata: {},
      ...overrides,
    });

    beforeEach(() => {
      clearDownloaded();
    });

    it('merges every downloaded locale into the shared catalog sequentially', async () => {
      const esSlice = buildSlice(realisticCatalog, 'es', 'nuevo');
      const frSlice = buildSlice(realisticCatalog, 'fr', 'nouveau');
      const files = [xcstringsBatchFile('es'), xcstringsBatchFile('fr')];
      const fileTracker = createMockFileTracker(files);
      const lockEntry: DownloadedVersionEntry = {
        fileId: 'file-1',
        versionId: 'version-1',
        translations: {},
      };
      vi.mocked(findOrCreateEntry).mockReturnValue(lockEntry);

      vi.mocked(gt.downloadFileBatch).mockResolvedValue({
        files: [
          xcstringsResponseFile('es', esSlice),
          xcstringsResponseFile('fr', frSlice),
        ],
        count: 2,
      });
      const store = new Map([[catalogPath, realisticCatalog]]);
      setupInMemoryFs(store, ['Cascade']);

      const result = await downloadFileBatch(
        fileTracker,
        files,
        createMockSettings({ locales: ['es', 'fr'] })
      );

      expect(result.successful).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);
      expect(result.failed).toHaveLength(0);

      // Both merges land in the one on-disk file, byte-exactly: each locale
      // folds into the previous locale's write
      const afterEs = mergeXcstrings(realisticCatalog, esSlice, 'es');
      const afterFr = mergeXcstrings(afterEs, frSlice, 'fr');
      const writes = vi
        .mocked(fs.promises.writeFile)
        .mock.calls.filter((call) => call[0] === catalogPath);
      expect(writes).toHaveLength(2);
      expect(writes[0][1]).toBe(afterEs);
      expect(writes[1][1]).toBe(afterFr);
      expect(store.get(catalogPath)).toBe(afterFr);

      const merged = JSON.parse(store.get(catalogPath)!) as XcstringsCatalog;
      const [esKey] = Object.keys(
        (JSON.parse(esSlice) as XcstringsCatalog).strings
      );
      expect(merged.strings[esKey].localizations!.es).toEqual({
        stringUnit: { state: 'translated', value: `nuevo ${esKey}` },
      });
      // Untouched locales survive both merges
      const original = JSON.parse(realisticCatalog) as XcstringsCatalog;
      expect(merged.strings[esKey].localizations!.de).toEqual(
        original.strings[esKey].localizations!.de
      );

      // The lockfile tracks each locale separately...
      expect(Object.keys(lockEntry.translations).sort()).toEqual(['es', 'fr']);
      // ...but recentDownloads meta is keyed by output path, so the shared
      // catalog keeps only the last locale's meta (last-locale-wins), exactly
      // like composite JSON files that share one output path
      expect(getDownloadedMeta().get(catalogPath)?.locale).toBe('fr');
    });

    it('never takes the already-downloaded skip: an up-to-date lockfile still merges fresh data', async () => {
      // Mirrors the composite test above: the catalog always exists on disk,
      // so the lock can't tell whether this locale's content is present. The
      // in-place exemption must keep the skip unreachable for xcstrings —
      // otherwise locales silently never merge.
      const esSlice = buildSlice(realisticCatalog, 'es', 'nuevo');
      const files = [xcstringsBatchFile('es')];
      const fileTracker = createMockFileTracker(files);

      vi.mocked(gt.downloadFileBatch).mockResolvedValue({
        files: [xcstringsResponseFile('es', esSlice)],
        count: 1,
      });
      vi.mocked(readLockfile).mockReturnValue({
        data: { version: 2, branchId: 'branch-1', entries: [] },
        entryMap: new Map<string, DownloadedVersionEntry>([
          [
            'file-1',
            {
              fileId: 'file-1',
              versionId: 'version-1',
              fileName: catalogPath,
              translations: {
                es: {
                  updatedAt: '2026-01-01T00:00:00.000Z',
                  fileName: catalogPath,
                },
              },
            },
          ],
        ]),
        originalV1: false,
      });
      const store = new Map([[catalogPath, realisticCatalog]]);
      setupInMemoryFs(store, ['Cascade']);

      const result = await downloadFileBatch(
        fileTracker,
        files,
        createMockSettings({ locales: ['es'] })
      );

      expect(result.skipped).toHaveLength(0);
      expect(result.successful).toHaveLength(1);
      expect(store.get(catalogPath)).toBe(
        mergeXcstrings(realisticCatalog, esSlice, 'es')
      );
    });

    it('accumulates every locale when a path transform shares one non-source output', async () => {
      // Without [locale] in the transform, all locales merge into one output
      // file that is not the source catalog. The source never sees those
      // merges, so later locales must build on the output written earlier in
      // this run rather than rereading the source and discarding them.
      const transformedPath = 'Cascade/Localizable.translated.xcstrings';
      const esSlice = buildSlice(realisticCatalog, 'es', 'nuevo');
      const frSlice = buildSlice(realisticCatalog, 'fr', 'nouveau');
      const files = [
        xcstringsBatchFile('es', { outputPath: transformedPath }),
        xcstringsBatchFile('fr', { outputPath: transformedPath }),
      ];
      const fileTracker = createMockFileTracker(files);
      const lockEntry: DownloadedVersionEntry = {
        fileId: 'file-1',
        versionId: 'version-1',
        translations: {},
      };
      vi.mocked(findOrCreateEntry).mockReturnValue(lockEntry);

      vi.mocked(gt.downloadFileBatch).mockResolvedValue({
        files: [
          xcstringsResponseFile('es', esSlice),
          xcstringsResponseFile('fr', frSlice),
        ],
        count: 2,
      });
      const store = new Map([[catalogPath, realisticCatalog]]);
      setupInMemoryFs(store, ['Cascade']);

      const result = await downloadFileBatch(
        fileTracker,
        files,
        createMockSettings({ locales: ['es', 'fr'] })
      );

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);

      // The source catalog is untouched; the shared output holds both merges
      expect(store.get(catalogPath)).toBe(realisticCatalog);
      const afterEs = mergeXcstrings(realisticCatalog, esSlice, 'es');
      const afterFr = mergeXcstrings(afterEs, frSlice, 'fr');
      expect(store.get(transformedPath)).toBe(afterFr);
    });

    it('touches only the catalog when it coexists with legacy .strings files', async () => {
      const fixtureCatalogPath =
        'Sources/FieldNotesKit/Resources/Localizable.xcstrings';
      const legacyDePath =
        'Sources/FieldNotesKit/Resources/de.lproj/Localizable.strings';
      const legacyEnPath =
        'Sources/FieldNotesKit/Resources/en.lproj/Localizable.strings';
      const deSlice = buildSlice(legacyMixedCatalog, 'de', 'frisch');
      const legacyDePayload = '"legacy.error.generic" = "Frisch übersetzt";\n';

      const files: BatchedFiles = [
        xcstringsBatchFile('de', {
          inputPath: fixtureCatalogPath,
          outputPath: fixtureCatalogPath,
        }),
        {
          branchId: 'branch-1',
          fileId: 'file-2',
          versionId: 'version-2',
          inputPath: legacyEnPath,
          outputPath: legacyDePath,
          locale: 'de',
        },
      ];
      const fileTracker = createMockFileTracker(files);

      vi.mocked(gt.downloadFileBatch).mockResolvedValue({
        files: [
          xcstringsResponseFile('de', deSlice, {
            fileName: fixtureCatalogPath,
          }),
          {
            id: 'translation-legacy-de',
            branchId: 'branch-1',
            fileId: 'file-2',
            versionId: 'version-2',
            locale: 'de',
            fileFormat: 'APPLE_STRINGS' as FileFormat,
            data: legacyDePayload,
            fileName: legacyEnPath,
            metadata: {},
          },
        ],
        count: 2,
      });
      const store = new Map([
        [fixtureCatalogPath, legacyMixedCatalog],
        [legacyDePath, legacyMixedDeStrings],
      ]);
      setupInMemoryFs(store, [
        'Sources/FieldNotesKit/Resources',
        'Sources/FieldNotesKit/Resources/de.lproj',
      ]);

      const result = await downloadFileBatch(
        fileTracker,
        files,
        createMockSettings({ locales: ['de'] })
      );

      expect(result.successful).toHaveLength(2);
      // Catalog merged in place; the legacy file written verbatim, unmerged
      expect(store.get(fixtureCatalogPath)).toBe(
        mergeXcstrings(legacyMixedCatalog, deSlice, 'de')
      );
      expect(store.get(legacyDePath)).toBe(legacyDePayload);
      // The catalog merge reads only the catalog — never the legacy files
      for (const call of vi.mocked(fs.readFileSync).mock.calls) {
        expect(call[0]).toBe(fixtureCatalogPath);
      }
      // One write per output path, nothing else touched
      const writtenPaths = vi
        .mocked(fs.promises.writeFile)
        .mock.calls.map((call) => call[0]);
      expect(writtenPaths.sort()).toEqual([fixtureCatalogPath, legacyDePath]);
    });

    it('never routes a merged catalog through the JSON key sorter', async () => {
      // Entry order is part of the pinned catalog bytes. Even if a path
      // transform remaps the output to a .json name, the merged catalog must
      // be written as-is — sortJsonString would reorder keys and drop the
      // trailing newline.
      const unsortedCatalog = JSON.stringify({
        sourceLanguage: 'en',
        strings: {
          zebra: {
            localizations: {
              en: { stringUnit: { state: 'translated', value: 'Zebra' } },
            },
          },
          alpha: {
            localizations: {
              en: { stringUnit: { state: 'translated', value: 'Alpha' } },
            },
          },
        },
      });
      const esSlice = JSON.stringify({
        sourceLanguage: 'en',
        strings: {
          zebra: {
            localizations: {
              es: { stringUnit: { state: 'translated', value: 'Cebra' } },
            },
          },
        },
      });
      const files: BatchedFiles = [
        xcstringsBatchFile('es', {
          inputPath: 'App.xcstrings',
          outputPath: 'locales/App.es.json',
        }),
      ];
      const fileTracker = createMockFileTracker(files);

      vi.mocked(gt.downloadFileBatch).mockResolvedValue({
        files: [
          xcstringsResponseFile('es', esSlice, { fileName: 'App.xcstrings' }),
        ],
        count: 1,
      });
      const store = new Map([['App.xcstrings', unsortedCatalog]]);
      setupInMemoryFs(store, ['locales']);

      const result = await downloadFileBatch(
        fileTracker,
        files,
        createMockSettings({ locales: ['es'] })
      );

      expect(result.successful).toHaveLength(1);
      const written = store.get('locales/App.es.json')!;
      expect(written).toBe(mergeXcstrings(unsortedCatalog, esSlice, 'es'));
      // Catalog entry order and the trailing newline survive
      expect(
        Object.keys((JSON.parse(written) as XcstringsCatalog).strings)
      ).toEqual(['zebra', 'alpha']);
      expect(written.endsWith('\n')).toBe(true);
    });
  });
});
