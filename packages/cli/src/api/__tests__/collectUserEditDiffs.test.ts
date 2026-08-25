import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { collectAndSendUserEditDiffs } from '../collectUserEditDiffs.js';
import { createMockSettings } from '../__mocks__/settings.js';
import { gt } from '../../utils/gt.js';
import { getGitUnifiedDiff } from '../../utils/gitDiff.js';
import { hashStringSync } from '../../utils/hash.js';
import {
  readLockfile,
  migrateLockfileFileIds,
  DownloadedVersions,
  DownloadedVersionsV1,
} from '../../fs/config/downloadedVersions.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import type { FileReference } from 'generaltranslation/types';

vi.mock('../../utils/gt.js', () => ({
  gt: {
    queryFileData: vi.fn(),
    downloadFileBatch: vi.fn(),
    submitUserEditDiffs: vi.fn(),
  },
}));

vi.mock('../../utils/gitDiff.js', () => ({
  getGitUnifiedDiff: vi.fn(),
}));

describe('collectAndSendUserEditDiffs', () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gt-lock-'))
    );
    process.chdir(tempDir);
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.resetAllMocks();
  });

  const buildSettings = () =>
    createMockSettings({
      configDirectory: tempDir,
      config: path.join(tempDir, 'gt.config.json'),
      defaultLocale: 'en',
      locales: ['en', 'ja'],
      _branchId: 'branch1',
      files: {
        resolvedPaths: {
          md: [path.join(tempDir, 'docs', 'doc.md')],
        },
        placeholderPaths: {
          md: [path.join(tempDir, 'docs', '[locale]', 'doc.md')],
        },
        transformPaths: {},
      },
    });

  const writeLockFile = (
    content: DownloadedVersions | DownloadedVersionsV1
  ) => {
    fs.writeFileSync(
      path.join(tempDir, 'gt-lock.json'),
      JSON.stringify(content, null, 2)
    );
  };

  it('skips submitting diffs when local file hash matches postprocessed hash', async () => {
    const settings = buildSettings();
    const translatedPath = path.join(tempDir, 'docs', 'ja', 'doc.md');
    fs.mkdirSync(path.dirname(translatedPath), { recursive: true });
    const translatedContent = '# heading\n\nbody\n';
    fs.writeFileSync(translatedPath, translatedContent);

    // Seed lock file with matching postprocess hash
    writeLockFile({
      version: 1,
      entries: {
        branch1: {
          file1: {
            version1: {
              ja: {
                updatedAt: new Date().toISOString(),
                postProcessHash: hashStringSync(translatedContent),
              },
            },
          },
        },
      },
    });

    const files: FileReference[] = [
      {
        fileName: 'docs/doc.md',
        fileFormat: 'MD',
        branchId: 'branch1',
        fileId: 'file1',
        versionId: 'version1',
      },
    ];

    const { entryMap } = readLockfile(settings);
    const entry = entryMap.get('file1');
    expect(entry?.translations?.ja?.postProcessHash).toBeDefined();

    await collectAndSendUserEditDiffs(files, settings);

    expect(gt.queryFileData).not.toHaveBeenCalled();
    expect(gt.downloadFileBatch).not.toHaveBeenCalled();
    expect(gt.submitUserEditDiffs).not.toHaveBeenCalled();
  });

  it('submits diffs when local file hash differs from postprocessed hash', async () => {
    const settings = buildSettings();
    const mapping = createFileMapping(
      settings.files.resolvedPaths,
      settings.files.placeholderPaths,
      settings.files.transformPaths,
      settings.files.transformFormats,
      settings.locales,
      settings.defaultLocale
    );
    expect(mapping.ja['docs/doc.md']).toBe('docs/ja/doc.md');

    const translatedPath = path.join(tempDir, 'docs', 'ja', 'doc.md');
    fs.mkdirSync(path.dirname(translatedPath), { recursive: true });
    fs.writeFileSync(translatedPath, 'changed content');

    // Lock file has different hash
    writeLockFile({
      version: 1,
      entries: {
        branch1: {
          file1: {
            version1: {
              ja: {
                updatedAt: new Date().toISOString(),
                postProcessHash: hashStringSync('original content'),
              },
            },
          },
        },
      },
    });

    vi.mocked(gt.queryFileData).mockResolvedValue({
      translatedFiles: [
        {
          branchId: 'branch1',
          fileId: 'file1',
          versionId: 'version1',
          locale: 'ja',
          completedAt: new Date().toISOString(),
        },
      ],
    });

    vi.mocked(gt.downloadFileBatch).mockResolvedValue({
      files: [
        {
          branchId: 'branch1',
          fileId: 'file1',
          versionId: 'version1',
          locale: 'ja',
          data: 'server content',
        },
      ],
    });

    vi.mocked(getGitUnifiedDiff).mockResolvedValue('mock-diff');

    const files: FileReference[] = [
      {
        fileName: 'docs/doc.md',
        fileFormat: 'MD',
        branchId: 'branch1',
        fileId: 'file1',
        versionId: 'version1',
      },
    ];

    await collectAndSendUserEditDiffs(files, settings);

    expect(gt.queryFileData).toHaveBeenCalledTimes(1);
    expect(gt.downloadFileBatch).toHaveBeenCalledTimes(1);
    expect(getGitUnifiedDiff).toHaveBeenCalledTimes(1);
    expect(gt.submitUserEditDiffs).toHaveBeenCalledTimes(1);
  });

  it.skipIf(path.sep === '\\')(
    'skips a tentative V2 alias on POSIX until the server accepts the move',
    async () => {
      const settings = buildSettings();
      const translatedPath = path.join(tempDir, 'docs', 'ja', 'doc.md');
      fs.mkdirSync(path.dirname(translatedPath), { recursive: true });
      fs.writeFileSync(translatedPath, 'changed content');

      const windowsFileName = 'docs\\doc.md';
      const windowsFileId = hashStringSync(windowsFileName);
      writeLockFile({
        version: 2,
        branchId: 'branch1',
        entries: [
          {
            fileId: windowsFileId,
            versionId: 'version1',
            fileName: windowsFileName,
            translations: {
              ja: {
                updatedAt: new Date().toISOString(),
                postProcessHash: hashStringSync('original content'),
              },
            },
          },
        ],
      });

      await collectAndSendUserEditDiffs(
        [
          {
            fileName: 'docs/doc.md',
            fileFormat: 'MD',
            branchId: 'branch1',
            fileId: hashStringSync('docs/doc.md'),
            versionId: 'version2',
          },
        ],
        settings
      );

      expect(gt.queryFileData).not.toHaveBeenCalled();
      expect(gt.downloadFileBatch).not.toHaveBeenCalled();
      expect(gt.submitUserEditDiffs).not.toHaveBeenCalled();
    }
  );

  it('uses a V2 legacy alias for standalone save-local on Windows', async () => {
    const originalSeparator = Object.getOwnPropertyDescriptor(path, 'sep')!;
    const settings = buildSettings();
    const translatedPath = path.join(tempDir, 'docs', 'ja', 'doc.md');
    fs.mkdirSync(path.dirname(translatedPath), { recursive: true });
    fs.writeFileSync(translatedPath, 'changed content');

    const windowsFileName = 'docs\\doc.md';
    const windowsFileId = hashStringSync(windowsFileName);
    const portableFileId = hashStringSync('docs/doc.md');
    writeLockFile({
      version: 2,
      branchId: 'branch1',
      entries: [
        {
          fileId: windowsFileId,
          versionId: 'version1',
          fileName: windowsFileName,
          translations: {
            ja: { postProcessHash: hashStringSync('original content') },
          },
        },
      ],
    });
    vi.mocked(gt.queryFileData).mockResolvedValue({
      translatedFiles: [
        {
          branchId: 'branch1',
          fileId: windowsFileId,
          versionId: 'version1',
          locale: 'ja',
          completedAt: new Date().toISOString(),
        },
      ],
    });
    vi.mocked(gt.downloadFileBatch).mockResolvedValue({
      files: [
        {
          branchId: 'branch1',
          fileId: windowsFileId,
          versionId: 'version1',
          locale: 'ja',
          data: 'server content',
        },
      ],
    });
    vi.mocked(getGitUnifiedDiff).mockResolvedValue('mock-diff');

    try {
      Object.defineProperty(path, 'sep', {
        ...originalSeparator,
        value: path.win32.sep,
      });
      await collectAndSendUserEditDiffs(
        [
          {
            fileName: 'docs/doc.md',
            fileFormat: 'MD',
            branchId: 'branch1',
            fileId: portableFileId,
            versionId: 'version2',
          },
        ],
        settings
      );
    } finally {
      Object.defineProperty(path, 'sep', originalSeparator);
    }

    expect(gt.queryFileData).toHaveBeenCalledWith({
      translatedFiles: [
        {
          branchId: 'branch1',
          fileId: windowsFileId,
          versionId: 'version1',
          locale: 'ja',
        },
      ],
    });
    expect(gt.submitUserEditDiffs).toHaveBeenCalledWith({
      diffs: [expect.objectContaining({ fileId: windowsFileId })],
    });
  });

  it('finds a V1 legacy ID for standalone save-local on Windows', async () => {
    const originalSeparator = Object.getOwnPropertyDescriptor(path, 'sep')!;
    const settings = buildSettings();
    const translatedPath = path.join(tempDir, 'docs', 'ja', 'doc.md');
    fs.mkdirSync(path.dirname(translatedPath), { recursive: true });
    fs.writeFileSync(translatedPath, 'changed content');

    const windowsFileId = hashStringSync('docs\\doc.md');
    const portableFileId = hashStringSync('docs/doc.md');
    writeLockFile({
      version: 1,
      entries: {
        branch1: {
          [windowsFileId]: {
            version1: {
              ja: { postProcessHash: hashStringSync('original content') },
            },
          },
        },
      },
    });
    vi.mocked(gt.queryFileData).mockResolvedValue({
      translatedFiles: [
        {
          branchId: 'branch1',
          fileId: windowsFileId,
          versionId: 'version1',
          locale: 'ja',
          completedAt: new Date().toISOString(),
        },
      ],
    });
    vi.mocked(gt.downloadFileBatch).mockResolvedValue({
      files: [
        {
          branchId: 'branch1',
          fileId: windowsFileId,
          versionId: 'version1',
          locale: 'ja',
          data: 'server content',
        },
      ],
    });
    vi.mocked(getGitUnifiedDiff).mockResolvedValue('mock-diff');

    try {
      Object.defineProperty(path, 'sep', {
        ...originalSeparator,
        value: path.win32.sep,
      });
      await collectAndSendUserEditDiffs(
        [
          {
            fileName: 'docs/doc.md',
            fileFormat: 'MD',
            branchId: 'branch1',
            fileId: portableFileId,
            versionId: 'version2',
          },
        ],
        settings
      );
    } finally {
      Object.defineProperty(path, 'sep', originalSeparator);
    }

    expect(gt.queryFileData).toHaveBeenCalledWith({
      translatedFiles: [
        {
          branchId: 'branch1',
          fileId: windowsFileId,
          versionId: 'version1',
          locale: 'ja',
        },
      ],
    });
    expect(gt.submitUserEditDiffs).toHaveBeenCalledWith({
      diffs: [expect.objectContaining({ fileId: windowsFileId })],
    });
  });

  it('uses migrated V1 history after the server accepts the move', async () => {
    const settings = buildSettings();
    const translatedPath = path.join(tempDir, 'docs', 'ja', 'doc.md');
    fs.mkdirSync(path.dirname(translatedPath), { recursive: true });
    fs.writeFileSync(translatedPath, 'changed content');

    const windowsFileId = hashStringSync('docs\\doc.md');
    writeLockFile({
      version: 1,
      entries: {
        branch1: {
          [windowsFileId]: {
            version1: {
              ja: {
                updatedAt: new Date().toISOString(),
                postProcessHash: hashStringSync('original content'),
              },
            },
          },
        },
      },
    });

    const portableFileId = hashStringSync('docs/doc.md');
    expect(
      migrateLockfileFileIds('branch1', [
        {
          oldFileId: windowsFileId,
          newFileId: portableFileId,
          newFileName: 'docs/doc.md',
        },
      ])
    ).toBe(1);

    vi.mocked(gt.queryFileData).mockResolvedValue({
      translatedFiles: [
        {
          branchId: 'branch1',
          fileId: portableFileId,
          versionId: 'version1',
          locale: 'ja',
          completedAt: new Date().toISOString(),
        },
      ],
    });
    vi.mocked(gt.downloadFileBatch).mockResolvedValue({
      files: [
        {
          branchId: 'branch1',
          fileId: portableFileId,
          versionId: 'version1',
          locale: 'ja',
          data: 'server content',
        },
      ],
    });
    vi.mocked(getGitUnifiedDiff).mockResolvedValue('mock-diff');

    await collectAndSendUserEditDiffs(
      [
        {
          fileName: 'docs/doc.md',
          fileFormat: 'MD',
          branchId: 'branch1',
          fileId: portableFileId,
          versionId: 'version2',
        },
      ],
      settings
    );

    expect(gt.queryFileData).toHaveBeenCalledWith({
      translatedFiles: [
        {
          branchId: 'branch1',
          fileId: portableFileId,
          versionId: 'version1',
          locale: 'ja',
        },
      ],
    });
    expect(gt.submitUserEditDiffs).toHaveBeenCalledWith({
      diffs: [expect.objectContaining({ fileId: portableFileId })],
    });
  });

  it.skipIf(path.sep === '\\')(
    'does not borrow an unconfirmed V1 ID for an absent literal POSIX path',
    async () => {
      const settings = buildSettings();
      const translatedPath = path.join(tempDir, 'docs', 'ja', 'doc.md');
      fs.mkdirSync(path.dirname(translatedPath), { recursive: true });
      fs.writeFileSync(translatedPath, 'changed content');
      const literalFileId = hashStringSync('docs\\doc.md');
      writeLockFile({
        version: 1,
        entries: {
          branch1: {
            [literalFileId]: {
              version1: {
                ja: {
                  updatedAt: new Date().toISOString(),
                  postProcessHash: hashStringSync('original content'),
                },
              },
            },
          },
        },
      });

      vi.mocked(gt.queryFileData).mockResolvedValue({ translatedFiles: [] });
      vi.mocked(gt.downloadFileBatch).mockResolvedValue({ files: [] });

      await collectAndSendUserEditDiffs(
        [
          {
            fileName: 'docs/doc.md',
            fileFormat: 'MD',
            branchId: 'branch1',
            fileId: hashStringSync('docs/doc.md'),
            versionId: 'version2',
          },
        ],
        settings
      );

      expect(gt.queryFileData).not.toHaveBeenCalled();
      expect(gt.downloadFileBatch).not.toHaveBeenCalled();
      expect(gt.submitUserEditDiffs).not.toHaveBeenCalled();
    }
  );

  it('uses the latest downloaded version when the uploaded version has changed', async () => {
    const settings = buildSettings();
    const translatedPath = path.join(tempDir, 'docs', 'ja', 'doc.md');
    fs.mkdirSync(path.dirname(translatedPath), { recursive: true });
    fs.writeFileSync(translatedPath, 'changed content');

    // Lock file only knows about version1, but uploaded file reports version2
    writeLockFile({
      version: 1,
      entries: {
        branch1: {
          file1: {
            version1: {
              ja: {
                updatedAt: new Date().toISOString(),
                postProcessHash: hashStringSync('original content'),
              },
            },
          },
        },
      },
    });

    vi.mocked(gt.queryFileData).mockResolvedValue({
      translatedFiles: [
        {
          branchId: 'branch1',
          fileId: 'file1',
          versionId: 'version1',
          locale: 'ja',
          completedAt: new Date().toISOString(),
        },
      ],
    });

    vi.mocked(gt.downloadFileBatch).mockResolvedValue({
      files: [
        {
          branchId: 'branch1',
          fileId: 'file1',
          versionId: 'version1',
          locale: 'ja',
          data: 'server content',
        },
      ],
    });

    vi.mocked(getGitUnifiedDiff).mockResolvedValue('mock-diff');

    const files: FileReference[] = [
      {
        fileName: 'docs/doc.md',
        fileFormat: 'MD',
        branchId: 'branch1',
        fileId: 'file1',
        versionId: 'version2',
      },
    ];

    await collectAndSendUserEditDiffs(files, settings);

    expect(gt.queryFileData).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(gt.queryFileData).mock.calls[0][0].translatedFiles[0].versionId
    ).toBe('version1');
    expect(gt.downloadFileBatch).toHaveBeenCalledTimes(1);
    expect(gt.submitUserEditDiffs).toHaveBeenCalledTimes(1);
  });
});
