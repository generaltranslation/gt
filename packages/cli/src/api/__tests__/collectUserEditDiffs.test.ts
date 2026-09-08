import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import { collectAndSendUserEditDiffs } from '../collectUserEditDiffs.js';
import { createMockSettings } from '../__mocks__/settings.js';
import { api } from '../../utils/api.js';
import { getGitUnifiedDiff } from '../../utils/gitDiff.js';
import { hashStringSync } from '../../utils/hash.js';
import {
  readLockfile,
  DownloadedVersionsV1,
} from '../../fs/config/downloadedVersions.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import {
  parseXcstringsCatalog,
  serializeXcstringsSlice,
  sliceTranslationCatalog,
} from '../../formats/xcstrings/parseXcstrings.js';
import type { FileReference } from 'generaltranslation/types';

vi.mock('../../utils/api.js', () => ({
  api: {
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

    expect(api.queryFileData).not.toHaveBeenCalled();
    expect(api.downloadFileBatch).not.toHaveBeenCalled();
    expect(api.submitUserEditDiffs).not.toHaveBeenCalled();
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

    vi.mocked(api.queryFileData).mockResolvedValue({
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

    vi.mocked(api.downloadFileBatch).mockResolvedValue({
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

    expect(api.queryFileData).toHaveBeenCalledTimes(1);
    expect(api.downloadFileBatch).toHaveBeenCalledTimes(1);
    expect(getGitUnifiedDiff).toHaveBeenCalledTimes(1);
    expect(api.submitUserEditDiffs).toHaveBeenCalledTimes(1);
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

    vi.mocked(api.queryFileData).mockResolvedValue({
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

    vi.mocked(api.downloadFileBatch).mockResolvedValue({
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

    expect(api.queryFileData).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(api.queryFileData).mock.calls[0][0].translatedFiles[0].versionId
    ).toBe('version1');
    expect(api.downloadFileBatch).toHaveBeenCalledTimes(1);
    expect(api.submitUserEditDiffs).toHaveBeenCalledTimes(1);
  });

  describe('Apple .xcstrings catalogs', () => {
    const CATALOG = 'App/Localizable.xcstrings';
    const unit = (value: string) => ({
      stringUnit: { state: 'translated', value },
    });
    const catalog = (deGreeting: string) => ({
      sourceLanguage: 'en',
      version: '1.0',
      strings: {
        Save: {},
        greeting: {
          comment: 'Home screen',
          localizations: {
            de: unit(deGreeting),
            en: unit('Hello'),
            fr: unit('Bonjour'),
          },
        },
        farewell: {
          localizations: { en: unit('Bye'), fr: unit('Au revoir') },
        },
      },
    });
    const pinned = (content: object) => JSON.stringify(content, null, 2) + '\n';
    const slice = (content: string, locale: string) =>
      serializeXcstringsSlice(
        sliceTranslationCatalog(parseXcstringsCatalog(content), locale)!
      );
    /** A download as the server returns it: the source slice plus the locale. */
    const served = (locale: string, values: Record<string, string>) =>
      JSON.stringify({
        sourceLanguage: 'en',
        version: '1.0',
        strings: {
          Save: {},
          greeting: {
            comment: 'Home screen',
            localizations: {
              en: unit('Hello'),
              ...(values.greeting && { [locale]: unit(values.greeting) }),
            },
          },
          farewell: {
            localizations: {
              en: unit('Bye'),
              ...(values.farewell && { [locale]: unit(values.farewell) }),
            },
          },
        },
      });
    const reference: FileReference = {
      fileName: CATALOG,
      fileFormat: 'XCSTRINGS',
      branchId: 'branch1',
      fileId: 'file1',
      versionId: 'version1',
    };

    const buildCatalogSettings = () => {
      const catalogPath = path.join(tempDir, CATALOG);
      return createMockSettings({
        configDirectory: tempDir,
        config: path.join(tempDir, 'gt.config.json'),
        defaultLocale: 'en',
        locales: ['de', 'fr'],
        _branchId: 'branch1',
        files: {
          resolvedPaths: { xcstrings: [catalogPath] },
          placeholderPaths: { xcstrings: [catalogPath] },
          transformPaths: {},
        },
      });
    };
    const writeCatalog = (content: string) => {
      fs.mkdirSync(path.join(tempDir, 'App'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, CATALOG), content);
    };
    /** The lockfile as translate leaves it: one file hash under each locale. */
    const writeLockHashes = (hashes: Record<string, string>) => {
      writeLockFile({
        version: 1,
        entries: {
          branch1: {
            file1: {
              version1: Object.fromEntries(
                Object.entries(hashes).map(([locale, postProcessHash]) => [
                  locale,
                  { updatedAt: new Date().toISOString(), postProcessHash },
                ])
              ),
            },
          },
        },
      });
    };
    /** The server holds the catalog's translations as they were downloaded. */
    const serveTranslations = () => {
      vi.mocked(api.queryFileData).mockImplementation(async (body) => ({
        translatedFiles: (body.translatedFiles ?? []).map((file) => ({
          ...file,
          completedAt: new Date().toISOString(),
        })),
      }));
      vi.mocked(api.downloadFileBatch).mockImplementation(async (files) => ({
        files: files.map((file) => ({
          id: `translation-${file.locale}`,
          branchId: 'branch1',
          fileId: 'file1',
          versionId: 'version1',
          locale: file.locale,
          fileFormat: 'XCSTRINGS' as const,
          data:
            file.locale === 'de'
              ? served('de', { greeting: 'Hallo' })
              : served('fr', { greeting: 'Bonjour', farewell: 'Au revoir' }),
          metadata: {},
        })),
        count: files.length,
      }));
    };
    const queriedLocales = () =>
      vi
        .mocked(api.queryFileData)
        .mock.calls[0][0].translatedFiles?.map((file) => file.locale);

    it('skips every locale while the catalog still hashes to the recorded post-process hash', async () => {
      const settings = buildCatalogSettings();
      const content = pinned(catalog('Hallo'));
      writeCatalog(content);
      writeLockHashes({
        de: hashStringSync(content),
        fr: hashStringSync(content),
      });

      await collectAndSendUserEditDiffs([reference], settings);

      expect(api.queryFileData).not.toHaveBeenCalled();
      expect(api.downloadFileBatch).not.toHaveBeenCalled();
      expect(api.submitUserEditDiffs).not.toHaveBeenCalled();
    });

    it('submits nothing when the catalog was only re-saved in another layout', async () => {
      const settings = buildCatalogSettings();
      const pristine = pinned(catalog('Hallo'));
      writeLockHashes({
        de: hashStringSync(pristine),
        fr: hashStringSync(pristine),
      });
      // The same content as Xcode lays it out
      writeCatalog(JSON.stringify(catalog('Hallo'), null, 4));
      serveTranslations();

      await collectAndSendUserEditDiffs([reference], settings);

      // The file hash no longer matches, so every locale is checked against
      // the server — slice against slice, where nothing differs
      expect(queriedLocales()).toEqual(['de', 'fr']);
      expect(getGitUnifiedDiff).not.toHaveBeenCalled();
      expect(api.submitUserEditDiffs).not.toHaveBeenCalled();
    });

    it('submits one slice diff for the edited locale and nothing for the others', async () => {
      const settings = buildCatalogSettings();
      const pristine = pinned(catalog('Hallo'));
      writeLockHashes({
        de: hashStringSync(pristine),
        fr: hashStringSync(pristine),
      });
      // One de string edited by hand
      const edited = JSON.stringify(catalog('Hallo!'));
      writeCatalog(edited);
      serveTranslations();
      const { getGitUnifiedDiff: realGitUnifiedDiff } = await vi.importActual<
        typeof import('../../utils/gitDiff.js')
      >('../../utils/gitDiff.js');
      vi.mocked(getGitUnifiedDiff).mockImplementation(realGitUnifiedDiff);

      await collectAndSendUserEditDiffs([reference], settings);

      // Both locales share the changed file, so both are checked; only de
      // differs from the server
      expect(queriedLocales()).toEqual(['de', 'fr']);
      expect(getGitUnifiedDiff).toHaveBeenCalledTimes(1);
      expect(api.submitUserEditDiffs).toHaveBeenCalledTimes(1);
      const { diffs } = vi.mocked(api.submitUserEditDiffs).mock.calls[0][0];
      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toMatchObject({
        fileName: CATALOG,
        locale: 'de',
        fileId: 'file1',
        versionId: 'version1',
      });
      // The submitted content is the de slice, not the whole catalog
      expect(diffs[0].localContent).toBe(slice(edited, 'de'));
      // The diff is slice against slice: the one edited value and nothing else
      const lines = diffs[0].diff.split('\n');
      expect(
        lines.filter((line) => line.startsWith('-') && !line.startsWith('---'))
      ).toEqual([expect.stringContaining('"Hallo"')]);
      expect(
        lines.filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      ).toEqual([expect.stringContaining('"Hallo!"')]);
    });

    it('treats a server payload with nothing for the locale as no baseline', async () => {
      const settings = buildCatalogSettings();
      writeCatalog(pinned(catalog('Hallo')));
      writeLockHashes({ de: hashStringSync('stale') });

      vi.mocked(api.queryFileData).mockResolvedValue({
        translatedFiles: [
          {
            branchId: 'branch1',
            fileId: 'file1',
            versionId: 'version1',
            locale: 'de',
            completedAt: new Date().toISOString(),
          },
        ],
      });
      vi.mocked(api.downloadFileBatch).mockResolvedValue({
        files: [
          {
            id: 'translation-de',
            branchId: 'branch1',
            fileId: 'file1',
            versionId: 'version1',
            locale: 'de',
            fileFormat: 'XCSTRINGS',
            // The source slice with no de in it
            data: served('de', {}),
            metadata: {},
          },
        ],
        count: 1,
      });

      await collectAndSendUserEditDiffs([reference], settings);

      expect(getGitUnifiedDiff).not.toHaveBeenCalled();
      expect(api.submitUserEditDiffs).not.toHaveBeenCalled();
    });
  });
});
