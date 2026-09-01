import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import { collectAndSendUserEditDiffs } from '../collectUserEditDiffs.js';
import { createMockSettings } from '../__mocks__/settings.js';
import { gt } from '../../utils/gt.js';
import { getGitUnifiedDiff } from '../../utils/gitDiff.js';
import { hashStringSync } from '../../utils/hash.js';
import {
  readLockfile,
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

  const writeLockFile = (content: DownloadedVersionsV1) => {
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

  describe('xcstrings catalogs', () => {
    const catalogRelPath = 'Sources/Localizable.xcstrings';

    const buildXcstringsSettings = () =>
      createMockSettings({
        configDirectory: tempDir,
        config: path.join(tempDir, 'gt.config.json'),
        defaultLocale: 'en',
        locales: ['es'],
        _branchId: 'branch1',
        files: {
          resolvedPaths: {
            xcstrings: [path.join(tempDir, catalogRelPath)],
          },
          placeholderPaths: {
            xcstrings: [path.join(tempDir, catalogRelPath)],
          },
          transformPaths: {},
        },
      });

    const catalogContent = JSON.stringify(
      {
        sourceLanguage: 'en',
        strings: {
          greeting: {
            localizations: {
              en: { stringUnit: { state: 'translated', value: 'Hello' } },
              es: { stringUnit: { state: 'translated', value: 'Hola' } },
            },
          },
          Save: {
            localizations: {
              es: { stringUnit: { state: 'translated', value: 'Guardar' } },
            },
          },
        },
        version: '1.0',
      },
      null,
      2
    );

    // The server serializes with its own top-level key order and whitespace.
    const serverEsSlice = JSON.stringify({
      sourceLanguage: 'en',
      version: '1.0',
      strings: {
        greeting: {
          localizations: {
            es: { stringUnit: { state: 'translated', value: 'Hola' } },
          },
        },
        Save: {
          localizations: {
            es: { stringUnit: { state: 'translated', value: 'Guardar' } },
          },
        },
      },
    });

    const seedCatalogAndLock = (localCatalog: string) => {
      const catalogPath = path.join(tempDir, catalogRelPath);
      fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
      fs.writeFileSync(catalogPath, localCatalog);
      // No postProcessHash: the locale is always a diff candidate.
      writeLockFile({
        version: 1,
        entries: {
          branch1: {
            file1: {
              version1: {
                es: { updatedAt: new Date().toISOString() },
              },
            },
          },
        },
      });
    };

    const mockServerResponses = () => {
      vi.mocked(gt.queryFileData).mockResolvedValue({
        translatedFiles: [
          {
            branchId: 'branch1',
            fileId: 'file1',
            versionId: 'version1',
            locale: 'es',
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
            locale: 'es',
            data: serverEsSlice,
          },
        ],
      });
    };

    const files: FileReference[] = [
      {
        fileName: catalogRelPath,
        fileFormat: 'XCSTRINGS',
        branchId: 'branch1',
        fileId: 'file1',
        versionId: 'version1',
      },
    ];

    it('submits nothing when the catalog locale matches the server slice', async () => {
      const settings = buildXcstringsSettings();
      seedCatalogAndLock(catalogContent);
      mockServerResponses();

      await collectAndSendUserEditDiffs(files, settings);

      // The multi-locale catalog itself never gets diffed against the
      // single-locale server slice.
      expect(getGitUnifiedDiff).not.toHaveBeenCalled();
      expect(gt.submitUserEditDiffs).not.toHaveBeenCalled();
    });

    it('ignores server slice entries with no target-locale localization', async () => {
      const settings = buildXcstringsSettings();
      seedCatalogAndLock(catalogContent);
      mockServerResponses();
      // The server keeps shouldTranslate:false entries verbatim in every
      // locale's slice, so its slice can hold entries — and locales — the
      // local extract legitimately omits.
      const serverDoc = JSON.parse(serverEsSlice);
      serverDoc.strings['brand.name'] = {
        shouldTranslate: false,
        localizations: {
          en: { stringUnit: { state: 'translated', value: 'Cascade Pro' } },
        },
      };
      vi.mocked(gt.downloadFileBatch).mockResolvedValue({
        files: [
          {
            branchId: 'branch1',
            fileId: 'file1',
            versionId: 'version1',
            locale: 'es',
            data: JSON.stringify(serverDoc),
          },
        ],
      });

      await collectAndSendUserEditDiffs(files, settings);

      expect(getGitUnifiedDiff).not.toHaveBeenCalled();
      expect(gt.submitUserEditDiffs).not.toHaveBeenCalled();
    });

    it('submits the extracted locale slice, not the catalog, when edited', async () => {
      const settings = buildXcstringsSettings();
      seedCatalogAndLock(catalogContent.replace('Guardar', 'GUARDAR!'));
      mockServerResponses();
      vi.mocked(getGitUnifiedDiff).mockResolvedValue('mock-diff');

      await collectAndSendUserEditDiffs(files, settings);

      expect(gt.submitUserEditDiffs).toHaveBeenCalledTimes(1);
      const submitted = vi.mocked(gt.submitUserEditDiffs).mock.calls[0][0]
        .diffs[0];
      expect(submitted.locale).toBe('es');
      const localContent = JSON.parse(submitted.localContent);
      // Single-locale slice with the local edit, no other locales leaked
      expect(localContent.strings.Save.localizations).toEqual({
        es: { stringUnit: { state: 'translated', value: 'GUARDAR!' } },
      });
      expect(localContent.strings.greeting.localizations).toEqual({
        es: { stringUnit: { state: 'translated', value: 'Hola' } },
      });
    });
  });

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
