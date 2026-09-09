import { describe, expect, it, vi } from 'vitest';
import type { FileToUpload } from 'generaltranslation/types';

vi.mock('../../../fs/findFilepath.js', () => ({
  getRelative: vi.fn((path: string) => path.replace(/^\/repo\//, '')),
  readFile: vi.fn((path: string) => files[path]),
}));
vi.mock('../../../utils/gt.js', () => ({
  gt: {
    resolveCanonicalLocale: vi.fn((locale: string) =>
      locale === 'french' ? 'fr' : locale
    ),
  },
}));

import { collectXcstringsTranslations } from '../sliceTranslations.js';

const CATALOG = '/repo/App/Localizable.xcstrings';
const files: Record<string, string> = {
  [CATALOG]: JSON.stringify({
    sourceLanguage: 'en',
    strings: {
      Save: {},
      greeting: {
        comment: 'Home',
        localizations: {
          en: { stringUnit: { state: 'translated', value: 'Hello' } },
          de: { stringUnit: { state: 'translated', value: 'Hallo' } },
          fr: { stringUnit: { state: 'translated', value: 'Bonjour' } },
        },
      },
    },
    version: '1.0',
  }),
};

const source: FileToUpload = {
  content: '{}',
  fileName: 'App/Localizable.xcstrings',
  fileFormat: 'XCSTRINGS',
  fileId: 'file-1',
  versionId: 'version-1',
  locale: 'en',
};

describe('collectXcstringsTranslations', () => {
  it('returns one slice per configured locale the catalog carries, keyed by source', () => {
    const result = collectXcstringsTranslations({
      sourceFiles: [source],
      catalogPaths: [CATALOG],
      locales: ['de', 'fr', 'ja'],
    });
    const slices = result.get(source.fileName)!;
    expect(slices.map((s) => s.locale)).toEqual(['de', 'fr']);
    for (const slice of slices) {
      expect(slice).toMatchObject({
        fileName: source.fileName,
        fileFormat: 'XCSTRINGS',
        fileId: 'file-1',
        versionId: 'version-1',
      });
      const parsed = JSON.parse(slice.content);
      expect(Object.keys(parsed.strings)).toEqual(['greeting']);
      expect(Object.keys(parsed.strings.greeting.localizations)).toEqual([
        slice.locale,
      ]);
    }
  });

  it('slices an aliased locale by its canonical tag and labels it with the alias', () => {
    const result = collectXcstringsTranslations({
      sourceFiles: [source],
      catalogPaths: [CATALOG],
      locales: ['french'],
    });
    const [slice] = result.get(source.fileName)!;
    expect(slice.locale).toBe('french');
    expect(
      Object.keys(JSON.parse(slice.content).strings.greeting.localizations)
    ).toEqual(['fr']);
  });

  it('skips catalogs that are not among the source files', () => {
    expect(
      collectXcstringsTranslations({
        sourceFiles: [],
        catalogPaths: [CATALOG],
        locales: ['de'],
      }).size
    ).toBe(0);
  });

  it('registers a catalog with an empty list when it carries none of the locales', () => {
    const result = collectXcstringsTranslations({
      sourceFiles: [source],
      catalogPaths: [CATALOG],
      locales: ['ja'],
    });
    expect(result.get(source.fileName)).toEqual([]);
  });
});
