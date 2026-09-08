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
import { localeContent } from '../../formats/files/localeContent.js';
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

  it('gives every locale of a fresh translate the merged file hash, with each slice equal to what the server sent', async () => {
    writeCatalog(serializeXcstringsSlice(sourceCatalog));
    serveTranslations();

    const result = await translateRun();

    expect(result.failed).toEqual([]);
    expect(result.successful).toHaveLength(3);
    expect(api.submitUserEditDiffs).not.toHaveBeenCalled();
    expect(readCatalog()).toBe(serializeXcstringsSlice(translatedCatalog));

    // One file holds every locale, so every locale carries the same hash of
    // that file — not only the last locale merged
    const translations = lockTranslations();
    expect(Object.keys(translations).sort()).toEqual(LOCALES);
    const disk = readCatalog();
    for (const locale of LOCALES) {
      expect(translations[locale].postProcessHash, locale).toBe(
        hashStringSync(disk)
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

    // The shared file changed, so every locale is checked against the server;
    // slice against slice, only de differs
    expect(api.queryFileData).toHaveBeenCalledTimes(1);
    expect(
      vi
        .mocked(api.queryFileData)
        .mock.calls[0][0].translatedFiles?.map((file) => file.locale)
    ).toEqual(LOCALES);
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

  it('fails a locale whose payload carries nothing for it and records nothing for that locale', async () => {
    writeCatalog(serializeXcstringsSlice(sourceCatalog));
    serveTranslations(['de', 'ja']);
    // fr comes back as the untouched source slice
    server.set('fr', served('fr', {}));

    const result = await translateRun();

    expect(result.failed.map((file) => file.locale)).toEqual(['fr']);
    expect(result.successful.map((file) => file.locale)).toEqual(['de', 'ja']);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('no fr content')
    );
    const disk = readCatalog();
    expect(localeContent(disk, 'XCSTRINGS', 'fr')).toBeUndefined();
    expect(localeContent(disk, 'XCSTRINGS', 'de')).toBe(
      localeContent(server.get('de')!, 'XCSTRINGS', 'de')
    );
    expect(Object.keys(lockTranslations()).sort()).toEqual(['de', 'ja']);
  });
});
