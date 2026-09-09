import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import type { FileReference } from 'generaltranslation/types';
import { api } from '../../utils/api.js';
import { logger } from '../../console/logger.js';
import { collectAndSendUserEditDiffs } from '../collectUserEditDiffs.js';
import { downloadFileBatch, type BatchedFiles } from '../downloadFileBatch.js';
import { persistPostProcessHashes } from '../../utils/persistPostprocessHashes.js';
import {
  clearDownloaded,
  getDownloadedMeta,
  getNeedsPostprocessing,
} from '../../state/recentDownloads.js';
import { clearWarnings } from '../../state/translateWarnings.js';
import { readLockfile } from '../../fs/config/downloadedVersions.js';
import { hashStringSync } from '../../utils/hash.js';
import {
  emptyLocaleContent,
  localeContent,
} from '../../formats/files/localeContent.js';
import {
  parseXcstrings,
  parseXcstringsCatalog,
  serializeXcstringsSlice,
  type XcstringsCatalog,
} from '../../formats/xcstrings/parseXcstrings.js';
import { createMockSettings } from '../__mocks__/settings.js';
import type { FileStatusTracker } from '../../workflows/steps/PollJobsStep.js';
import type { Settings } from '../../types/index.js';

vi.mock('../../utils/api.js', () => ({
  api: {
    queryFileData: vi.fn(),
    downloadFileBatch: vi.fn(),
    submitUserEditDiffs: vi.fn(),
    resolveAliasLocale: vi.fn((locale: string) => locale),
    resolveCanonicalLocale: vi.fn((locale: string) => locale),
  },
}));

const spinner = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  message: vi.fn(),
  advance: vi.fn(),
}));
vi.mock('../../console/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
    step: vi.fn(),
    createSpinner: () => spinner,
    createProgressBar: () => spinner,
  },
}));
vi.mock('../../console/logging.js', () => ({
  displayHeader: vi.fn(),
  exitSync: vi.fn((code: number) => {
    throw new Error(`exit ${code}`);
  }),
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));

/**
 * The lifecycle of one .xcstrings catalog across `translate` runs, driven
 * through the real modules that own the lockfile, the download metadata, the
 * post-process hashes, and the user-edit diffs. Only the API client is
 * mocked; files, lockfile, slicing, merging, and git diff are real.
 */
describe('.xcstrings catalog bookkeeping across translate runs', () => {
  const CATALOG = 'App/Localizable.xcstrings';
  const BRANCH = 'branch-1';
  const LOCALES = ['de', 'fr', 'ja'];
  const unit = (value: string) => ({
    stringUnit: { state: 'translated', value },
  });
  const TRANSLATIONS: Record<string, Record<string, string>> = {
    de: { Save: 'Sichern', greeting: 'Hallo', 'items.count': '%d Elemente' },
    fr: {
      Save: 'Enregistrer',
      greeting: 'Bonjour',
      'items.count': '%d éléments',
    },
    ja: { Save: '保存', greeting: 'こんにちは', 'items.count': '%d 件' },
  };
  const sourceCatalog: XcstringsCatalog = {
    sourceLanguage: 'en',
    version: '1.0',
    strings: {
      Save: {},
      greeting: {
        comment: 'Home screen',
        localizations: { en: unit('Hello') },
      },
      'items.count': {
        extractionState: 'manual',
        localizations: { en: unit('%d items') },
      },
    },
  };
  /** The catalog after every locale has been merged in (sorted locale keys). */
  const translatedCatalog: XcstringsCatalog = {
    sourceLanguage: 'en',
    version: '1.0',
    strings: {
      Save: {
        localizations: {
          de: unit(TRANSLATIONS.de.Save),
          fr: unit(TRANSLATIONS.fr.Save),
          ja: unit(TRANSLATIONS.ja.Save),
        },
      },
      greeting: {
        comment: 'Home screen',
        localizations: {
          de: unit(TRANSLATIONS.de.greeting),
          en: unit('Hello'),
          fr: unit(TRANSLATIONS.fr.greeting),
          ja: unit(TRANSLATIONS.ja.greeting),
        },
      },
      'items.count': {
        extractionState: 'manual',
        localizations: {
          de: unit(TRANSLATIONS.de['items.count']),
          en: unit('%d items'),
          fr: unit(TRANSLATIONS.fr['items.count']),
          ja: unit(TRANSLATIONS.ja['items.count']),
        },
      },
    },
  };

  const originalCwd = process.cwd();
  let tempDir: string;
  let settings: Settings;
  /** What the server serves per locale on the next download. */
  const server = new Map<string, string>();

  beforeEach(() => {
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gt-xcstrings-'))
    );
    process.chdir(tempDir);
    fs.mkdirSync(path.join(tempDir, 'App'), { recursive: true });
    vi.clearAllMocks();
    clearDownloaded();
    clearWarnings();
    server.clear();

    const catalogPath = path.join(tempDir, CATALOG);
    settings = {
      ...createMockSettings({
        configDirectory: path.join(tempDir, '.gt'),
        config: path.join(tempDir, 'gt.config.json'),
        apiKey: 'gtx-api-key',
        projectId: 'project-1',
        defaultLocale: 'en',
        locales: [...LOCALES],
        _branchId: BRANCH,
      }),
      files: {
        resolvedPaths: { xcstrings: [catalogPath] },
        placeholderPaths: { xcstrings: [catalogPath] },
        transformPaths: {},
        transformFormats: {},
        publishPaths: new Set<string>(),
        unpublishPaths: new Set<string>(),
        requiresReviewPaths: new Set<string>(),
        parsingFlags: {},
        gtJson: { parsingFlags: {} },
      },
    };

    vi.mocked(api.queryFileData).mockImplementation(async (body) => ({
      translatedFiles: (body.translatedFiles ?? []).map((file) => ({
        ...file,
        completedAt: new Date().toISOString(),
      })),
    }));
    vi.mocked(api.downloadFileBatch).mockImplementation(async (requests) => {
      const { fileId, versionId } = ids();
      const files = requests.flatMap((request) => {
        const data = server.get(request.locale ?? '');
        if (data === undefined) return [];
        return [
          {
            id: `translation-${request.locale}`,
            branchId: BRANCH,
            fileId,
            versionId,
            locale: request.locale,
            fileFormat: 'XCSTRINGS' as const,
            data,
            metadata: {},
          },
        ];
      });
      return { files, count: files.length };
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const readCatalog = () => fs.readFileSync(CATALOG, 'utf8');
  const writeCatalog = (content: string) => fs.writeFileSync(CATALOG, content);
  /** fileId and versionId exactly as aggregateFiles derives them. */
  const ids = () => ({
    fileId: hashStringSync(CATALOG),
    versionId: hashStringSync(parseXcstrings(readCatalog())),
  });
  const lockTranslations = () =>
    readLockfile(settings).entryMap.get(ids().fileId)?.translations ?? {};
  /** The locales save-local asked the server about, in order. */
  const queriedLocales = () =>
    vi
      .mocked(api.queryFileData)
      .mock.calls[0][0].translatedFiles?.map((file) => file.locale);

  /**
   * A download as the server returns it: the source slice of the current
   * catalog with the locale's units added, in a compact layout.
   */
  const served = (locale: string, values: Record<string, string>) => {
    const slice = parseXcstringsCatalog(parseXcstrings(readCatalog()));
    for (const [key, value] of Object.entries(values)) {
      slice.strings[key] = {
        ...slice.strings[key],
        localizations: {
          ...slice.strings[key].localizations,
          [locale]: unit(value),
        },
      };
    }
    return JSON.stringify(slice);
  };
  const serveTranslations = (locales: string[] = LOCALES) => {
    for (const locale of locales) {
      server.set(locale, served(locale, TRANSLATIONS[locale]));
    }
  };

  /**
   * What `gt translate` does with a catalog once its jobs are complete: save
   * local edits, download every locale into the catalog, record the hashes.
   */
  const translateRun = async () => {
    const { fileId, versionId } = ids();
    const reference: FileReference = {
      fileName: CATALOG,
      fileFormat: 'XCSTRINGS',
      branchId: BRANCH,
      fileId,
      versionId,
    };
    await collectAndSendUserEditDiffs([reference], settings);

    const fileTracker: FileStatusTracker = {
      completed: new Map(
        LOCALES.map((locale) => [
          `${BRANCH}:${fileId}:${versionId}:${locale}`,
          { fileId, versionId, locale, branchId: BRANCH, fileName: CATALOG },
        ])
      ),
      inProgress: new Map(),
      failed: new Map(),
      skipped: new Map(),
    };
    const batched: BatchedFiles = LOCALES.map((locale) => ({
      branchId: BRANCH,
      fileId,
      versionId,
      locale,
      outputPath: CATALOG,
      inputPath: CATALOG,
    }));
    const result = await downloadFileBatch(fileTracker, batched, settings);
    persistPostProcessHashes(
      settings,
      getNeedsPostprocessing(),
      getDownloadedMeta()
    );
    clearDownloaded();
    return result;
  };

  it('gives every locale of a fresh translate the hash of its own slice, each equal to what the server sent', async () => {
    writeCatalog(serializeXcstringsSlice(sourceCatalog));
    serveTranslations();

    const result = await translateRun();

    expect(result.failed).toEqual([]);
    expect(result.successful).toHaveLength(3);
    expect(api.submitUserEditDiffs).not.toHaveBeenCalled();
    expect(readCatalog()).toBe(serializeXcstringsSlice(translatedCatalog));

    // One file holds every locale, and each locale is fingerprinted by its
    // own slice of it, so an edit to one locale leaves the others matching
    const translations = lockTranslations();
    expect(Object.keys(translations).sort()).toEqual(LOCALES);
    const disk = readCatalog();
    for (const locale of LOCALES) {
      expect(translations[locale].postProcessHash, locale).toBe(
        hashStringSync(localeContent(disk, 'XCSTRINGS', locale)!)
      );
      // The slice of the merged catalog is byte-identical to the locale's
      // share of what the server sent: that is what save-local compares
      expect(localeContent(disk, 'XCSTRINGS', locale), locale).toBe(
        localeContent(server.get(locale)!, 'XCSTRINGS', locale)
      );
    }
  });

  it('submits no user edits on a second translate when nothing changed', async () => {
    writeCatalog(serializeXcstringsSlice(sourceCatalog));
    serveTranslations();
    await translateRun();
    const before = readCatalog();
    const lockBefore = fs.readFileSync('gt-lock.json', 'utf8');
    vi.clearAllMocks();

    const result = await translateRun();

    expect(api.queryFileData).not.toHaveBeenCalled();
    expect(api.submitUserEditDiffs).not.toHaveBeenCalled();
    // The lockfile records every locale, yet the catalog is downloaded and
    // merged again: it always reflects what the server stores
    expect(api.downloadFileBatch).toHaveBeenCalledTimes(1);
    expect(result.skipped).toEqual([]);
    expect(result.successful).toHaveLength(3);
    expect(readCatalog()).toBe(before);
    expect(
      JSON.parse(fs.readFileSync('gt-lock.json', 'utf8')).entries[0]
        .translations
    ).toMatchObject(
      Object.fromEntries(
        LOCALES.map((locale) => [
          locale,
          {
            postProcessHash:
              JSON.parse(lockBefore).entries[0].translations[locale]
                .postProcessHash,
          },
        ])
      )
    );
  });

  it('submits exactly one diff, for the edited locale, after one de string changes', async () => {
    writeCatalog(serializeXcstringsSlice(sourceCatalog));
    serveTranslations();
    await translateRun();
    vi.clearAllMocks();

    // Edited by hand, saved in a layout of the editor's choosing
    const edited = parseXcstringsCatalog(readCatalog());
    edited.strings.greeting.localizations!.de = unit('Hallo!');
    writeCatalog(JSON.stringify(edited));
    const editedContent = readCatalog();

    await translateRun();

    // Only the de slice changed, so only de is checked against the server
    expect(api.queryFileData).toHaveBeenCalledTimes(1);
    expect(queriedLocales()).toEqual(['de']);
    expect(api.submitUserEditDiffs).toHaveBeenCalledTimes(1);
    const { diffs } = vi.mocked(api.submitUserEditDiffs).mock.calls[0][0];
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ fileName: CATALOG, locale: 'de' });
    expect(diffs[0].localContent).toBe(
      localeContent(editedContent, 'XCSTRINGS', 'de')
    );
    const lines = diffs[0].diff.split('\n');
    expect(
      lines.filter((line) => line.startsWith('-') && !line.startsWith('---'))
    ).toEqual([expect.stringContaining('"Hallo"')]);
    expect(
      lines.filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    ).toEqual([expect.stringContaining('"Hallo!"')]);
  });

  it('submits only the locale edited on disk when another locale changed on the server since the download', async () => {
    writeCatalog(serializeXcstringsSlice(sourceCatalog));
    serveTranslations();
    await translateRun();
    vi.clearAllMocks();

    // de edited in the dashboard: the server now holds a newer de slice
    server.set('de', served('de', { ...TRANSLATIONS.de, Save: 'Speichern' }));
    // The server applies a submitted edit before it is downloaded again
    vi.mocked(api.submitUserEditDiffs).mockImplementation(async ({ diffs }) => {
      for (const diff of diffs) server.set(diff.locale, diff.localContent);
      return { success: true };
    });
    // fr edited by hand
    const edited = parseXcstringsCatalog(readCatalog());
    edited.strings.Save.localizations!.fr = unit('Sauvegarder');
    writeCatalog(serializeXcstringsSlice(edited));
    const editedContent = readCatalog();

    const result = await translateRun();

    // The local de slice is stale, not edited: only fr is submitted
    expect(api.submitUserEditDiffs).toHaveBeenCalledTimes(1);
    const { diffs } = vi.mocked(api.submitUserEditDiffs).mock.calls[0][0];
    expect(diffs.map((diff) => diff.locale)).toEqual(['fr']);
    expect(diffs[0].localContent).toBe(
      localeContent(editedContent, 'XCSTRINGS', 'fr')
    );
    // Only the fr slice changed on disk, so only fr is checked at all
    expect(queriedLocales()).toEqual(['fr']);
    // The download brings the dashboard edit down, keeps the fr edit, and
    // leaves ja as it was
    expect(result.failed).toEqual([]);
    const disk = readCatalog();
    expect(localeContent(disk, 'XCSTRINGS', 'de')).toBe(
      localeContent(server.get('de')!, 'XCSTRINGS', 'de')
    );
    expect(localeContent(disk, 'XCSTRINGS', 'fr')).toBe(
      localeContent(editedContent, 'XCSTRINGS', 'fr')
    );
    expect(localeContent(disk, 'XCSTRINGS', 'ja')).toBe(
      localeContent(server.get('ja')!, 'XCSTRINGS', 'ja')
    );
  });

  it('records a locale whose payload carries nothing for it, leaves the catalog alone, and submits nothing for it later', async () => {
    writeCatalog(serializeXcstringsSlice(sourceCatalog));
    serveTranslations(['de', 'ja']);
    // fr comes back as the untouched source slice: nothing to translate
    server.set('fr', served('fr', {}));

    const result = await translateRun();

    expect(result.failed).toEqual([]);
    expect(result.successful.map((file) => file.locale)).toEqual(LOCALES);
    expect(logger.error).not.toHaveBeenCalled();
    const disk = readCatalog();
    expect(localeContent(disk, 'XCSTRINGS', 'fr')).toBeUndefined();
    expect(localeContent(disk, 'XCSTRINGS', 'de')).toBe(
      localeContent(server.get('de')!, 'XCSTRINGS', 'de')
    );
    // fr is fingerprinted by the empty slice it stands for, so the next run
    // does not read it as edited
    const translations = lockTranslations();
    expect(Object.keys(translations).sort()).toEqual(LOCALES);
    expect(translations.fr.postProcessHash).toBe(
      hashStringSync(emptyLocaleContent(disk, 'XCSTRINGS'))
    );
    vi.clearAllMocks();

    await translateRun();

    expect(api.queryFileData).not.toHaveBeenCalled();
    expect(api.submitUserEditDiffs).not.toHaveBeenCalled();
    expect(readCatalog()).toBe(disk);
  });

  it('submits a slice written by hand for a locale whose download carried nothing for it', async () => {
    writeCatalog(serializeXcstringsSlice(sourceCatalog));
    serveTranslations(['de', 'ja']);
    server.set('fr', served('fr', {}));
    await translateRun();
    vi.clearAllMocks();

    // The user writes the fr greeting by hand
    const edited = parseXcstringsCatalog(readCatalog());
    edited.strings.greeting.localizations!.fr = unit('Salut');
    writeCatalog(serializeXcstringsSlice(edited));
    const editedContent = readCatalog();

    const result = await translateRun();

    // Only fr changed on disk; it is compared against a baseline of nothing
    // and submitted
    expect(queriedLocales()).toEqual(['fr']);
    expect(api.submitUserEditDiffs).toHaveBeenCalledTimes(1);
    const { diffs } = vi.mocked(api.submitUserEditDiffs).mock.calls[0][0];
    expect(diffs.map((diff) => diff.locale)).toEqual(['fr']);
    expect(diffs[0].localContent).toBe(
      localeContent(editedContent, 'XCSTRINGS', 'fr')
    );
    // The download still carries nothing for fr, so the hand-written slice
    // stays in the catalog
    expect(result.failed).toEqual([]);
    expect(localeContent(readCatalog(), 'XCSTRINGS', 'fr')).toBe(
      localeContent(editedContent, 'XCSTRINGS', 'fr')
    );
  });
});
