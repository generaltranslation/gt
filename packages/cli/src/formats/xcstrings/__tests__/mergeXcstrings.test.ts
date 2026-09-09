import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mergeXcstringsLocale } from '../mergeXcstrings.js';
import {
  parseXcstrings,
  parseXcstringsCatalog,
  serializeXcstringsSlice,
  sliceTranslationCatalog,
  type XcstringsCatalog,
} from '../parseXcstrings.js';
import { logger } from '../../../console/logger.js';
import { gt } from '../../../utils/gt.js';

vi.mock('../../../console/logger.js');

const multiLocaleContent = readFileSync(
  path.join(__dirname, '../__mocks__', 'multi_locale.xcstrings'),
  'utf8'
);

const parseCatalog = (content: string): XcstringsCatalog =>
  JSON.parse(content) as XcstringsCatalog;

const unit = (value: string) => ({
  stringUnit: { state: 'translated', value },
});

/**
 * A download as the server returns it: the source slice with `locale` units
 * added for the given keys. Serialized compactly, not with the pinned layout,
 * so the merge cannot depend on the download's formatting.
 */
function download(
  content: string,
  locale: string,
  values: Record<string, unknown>
): string {
  const slice = parseCatalog(parseXcstrings(content));
  for (const [key, localization] of Object.entries(values)) {
    slice.strings[key] = {
      ...slice.strings[key],
      localizations: {
        ...slice.strings[key].localizations,
        [locale]: localization,
      },
    };
  }
  return JSON.stringify(slice);
}

describe('mergeXcstringsLocale', () => {
  let tmpDir: string;
  let catalogPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = mkdtempSync(path.join(tmpdir(), 'gt-merge-xcstrings-'));
    catalogPath = path.join(tmpDir, 'Localizable.xcstrings');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    gt.setConfig({ customMapping: {} });
  });

  /** Writes `catalogContent` to the temp catalog and merges `downloaded` into it. */
  const merge = (
    catalogContent: string,
    downloaded: string,
    locale: string
  ): string => {
    writeFileSync(catalogPath, catalogContent);
    return mergeXcstringsLocale(downloaded, locale, catalogPath);
  };

  it('copies only localizations[locale] into each matching entry', () => {
    const input = parseCatalog(multiLocaleContent);
    const merged = merge(
      multiLocaleContent,
      download(multiLocaleContent, 'es', {
        greeting: unit('Hola (rev)'),
        'items.count': unit('%d elementos'),
      }),
      'es'
    );
    const catalog = parseCatalog(merged);

    // Document shape, entry set, and entry order are the catalog's
    expect(Object.keys(catalog)).toEqual(Object.keys(input));
    expect(catalog.version).toBe(input.version);
    expect(Object.keys(catalog.strings)).toEqual(Object.keys(input.strings));

    for (const [key, inputEntry] of Object.entries(input.strings)) {
      const { localizations: inputLocalizations, ...inputFields } = inputEntry;
      const { localizations, ...fields } = catalog.strings[key];
      // Entry-level fields are untouched
      expect(fields).toEqual(inputFields);
      // Every other locale is untouched, serialization included
      for (const [locale, localization] of Object.entries(
        inputLocalizations!
      )) {
        if (locale === 'es') continue;
        expect(JSON.stringify(localizations![locale])).toBe(
          JSON.stringify(localization)
        );
      }
    }
    // An existing es unit is replaced in place; a missing one is added
    expect(Object.keys(catalog.strings.greeting.localizations!)).toEqual(
      Object.keys(input.strings.greeting.localizations!)
    );
    expect(catalog.strings.greeting.localizations!.es).toEqual(
      unit('Hola (rev)')
    );
    expect(catalog.strings['items.count'].localizations!.es).toEqual(
      unit('%d elementos')
    );
    // The entry the download did not translate keeps its es unit as it was
    expect(catalog.strings['account.plan.pro'].localizations!.es).toEqual(
      input.strings['account.plan.pro'].localizations!.es
    );
  });

  it('merges the same download twice to identical bytes', () => {
    const esDownload = download(multiLocaleContent, 'es', {
      greeting: unit('Hola'),
    });
    const once = merge(multiLocaleContent, esDownload, 'es');
    expect(merge(once, esDownload, 'es')).toBe(once);
    // The pinned layout is the write format
    expect(once).toBe(JSON.stringify(JSON.parse(once), null, 2) + '\n');
  });

  it('inserts a new locale at its sorted position and never moves existing keys', () => {
    // fr before en: the developer's order is not sorted and must survive
    const content = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        greeting: {
          localizations: { fr: unit('Salut'), en: unit('Hello') },
        },
      },
    });
    const de = download(content, 'de', { greeting: unit('Hallo') });
    const it_ = download(content, 'it', { greeting: unit('Ciao') });
    const es = download(content, 'es', { greeting: unit('Hola') });

    const deItEs = merge(merge(merge(content, de, 'de'), it_, 'it'), es, 'es');
    const esItDe = merge(merge(merge(content, es, 'es'), it_, 'it'), de, 'de');

    expect(deItEs).toBe(esItDe);
    expect(
      Object.keys(parseCatalog(deItEs).strings.greeting.localizations!)
    ).toEqual(['de', 'es', 'fr', 'en', 'it']);
  });

  it('adds localizations to an implicit entry and leaves the source slice unchanged', () => {
    const content = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        Save: {},
        Cancel: { comment: 'Toolbar button', extractionState: 'manual' },
        greeting: { localizations: { en: unit('Hello') } },
      },
    });

    let merged = merge(
      content,
      download(content, 'es', {
        Save: unit('Guardar'),
        Cancel: unit('Cancelar'),
        greeting: unit('Hola'),
      }),
      'es'
    );
    merged = merge(
      merged,
      download(content, 'fr', { Save: unit('Enregistrer') }),
      'fr'
    );
    const catalog = parseCatalog(merged);

    expect(catalog.strings.Save).toEqual({
      localizations: { es: unit('Guardar'), fr: unit('Enregistrer') },
    });
    expect(catalog.strings.Cancel).toEqual({
      comment: 'Toolbar button',
      extractionState: 'manual',
      localizations: { es: unit('Cancelar') },
    });
    // Re-slicing the merged catalog reproduces the uploaded source slice, so
    // versionId does not change because translations were downloaded
    expect(parseXcstrings(merged)).toBe(parseXcstrings(content));
    // And the per-locale upload slice is what was merged in
    expect(
      serializeXcstringsSlice(
        sliceTranslationCatalog(parseXcstringsCatalog(merged), 'fr')!
      )
    ).toBe(
      serializeXcstringsSlice({
        sourceLanguage: 'en',
        strings: { Save: { localizations: { fr: unit('Enregistrer') } } },
      })
    );
  });

  it('never replaces an entry or its localizations object wholesale', () => {
    const content = JSON.stringify({
      sourceLanguage: 'en',
      unknownRoot: { keep: ['me'] },
      strings: {
        'task.count': {
          comment: 'Badge',
          unknownEntryField: 7,
          localizations: {
            en: unit('Tasks'),
            es: {
              variations: {
                plural: {
                  one: { stringUnit: { state: 'new', value: 'Tarea' } },
                  other: { stringUnit: { state: 'new', value: 'Tareas' } },
                },
              },
            },
            fr: {
              stringUnit: {
                state: 'translated',
                value: 'Tâches',
                unknownUnitField: true,
              },
            },
          },
        },
      },
    });
    // The download carries only the es unit and drops every other field
    const downloaded = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        'task.count': {
          localizations: {
            es: {
              variations: {
                plural: {
                  one: unit('Tarea'),
                  many: unit('Tareas'),
                  other: unit('Tareas'),
                },
              },
            },
          },
        },
      },
    });

    const catalog = parseCatalog(merge(content, downloaded, 'es'));

    expect(catalog.unknownRoot).toEqual({ keep: ['me'] });
    const entry = catalog.strings['task.count'];
    expect(entry.comment).toBe('Badge');
    expect(entry.unknownEntryField).toBe(7);
    expect(Object.keys(entry.localizations!)).toEqual(['en', 'es', 'fr']);
    expect(entry.localizations!.en).toEqual(unit('Tasks'));
    expect(entry.localizations!.fr).toEqual({
      stringUnit: {
        state: 'translated',
        value: 'Tâches',
        unknownUnitField: true,
      },
    });
    // The target unit itself is replaced wholesale: target plural categories
    // legitimately differ from the source's
    expect(entry.localizations!.es).toEqual({
      variations: {
        plural: {
          one: unit('Tarea'),
          many: unit('Tareas'),
          other: unit('Tareas'),
        },
      },
    });
  });

  it('leaves entries the download did not translate alone', () => {
    const content = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        greeting: { localizations: { en: unit('Hello'), es: unit('Hola') } },
        farewell: { localizations: { en: unit('Bye') } },
        Save: {},
      },
    });
    // Untranslated entries come back as the source slice had them
    const downloaded = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        greeting: { localizations: { en: unit('Hello') } },
        farewell: { localizations: { en: unit('Bye'), es: unit('Adiós') } },
        Save: {},
      },
    });

    const merged = merge(content, downloaded, 'es');
    const catalog = parseCatalog(merged);

    expect(catalog.strings.greeting.localizations!.es).toEqual(unit('Hola'));
    expect(catalog.strings.farewell.localizations!.es).toEqual(unit('Adiós'));
    expect(catalog.strings.Save).toEqual({});
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('skips downloaded keys the catalog no longer has and warns', () => {
    const content = JSON.stringify({
      sourceLanguage: 'en',
      strings: { greeting: { localizations: { en: unit('Hello') } } },
    });
    const downloaded = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        greeting: { localizations: { es: unit('Hola') } },
        'deleted.key': { localizations: { es: unit('Huérfano') } },
        // Absent from the catalog: must not resolve to Object.prototype's
        constructor: { localizations: { es: unit('Constructor') } },
      },
    });

    const catalog = parseCatalog(merge(content, downloaded, 'es'));

    expect(Object.keys(catalog.strings)).toEqual(['greeting']);
    expect(catalog.strings.greeting.localizations!.es).toEqual(unit('Hola'));
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('"deleted.key", "constructor"')
    );
  });

  it('merges into entries keyed by constructor and prototype', () => {
    const content = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        constructor: { localizations: { en: unit('Constructor') } },
        prototype: { localizations: { en: unit('Prototype') } },
      },
    });
    const downloaded = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        constructor: { localizations: { es: unit('Constructor (es)') } },
        prototype: { localizations: { es: unit('Prototipo') } },
      },
    });

    const catalog = parseCatalog(merge(content, downloaded, 'es'));

    expect(catalog.strings.constructor.localizations).toEqual({
      en: unit('Constructor'),
      es: unit('Constructor (es)'),
    });
    expect(catalog.strings.prototype.localizations).toEqual({
      en: unit('Prototype'),
      es: unit('Prototipo'),
    });
  });

  // JSON.parse hoists integer-like keys ahead of the others, so the merge
  // writes them first. Pinned here so the reorder is a known, one-time effect.
  it('lists integer-like keys first and stays idempotent', () => {
    const content = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        About: { localizations: { en: unit('About') } },
        '404': { localizations: { en: unit('Not found') } },
      },
    });
    const downloaded = download(content, 'es', {
      About: unit('Acerca de'),
      '404': unit('No encontrado'),
    });

    const once = merge(content, downloaded, 'es');

    expect(Object.keys(parseCatalog(once).strings)).toEqual(['404', 'About']);
    expect(merge(once, downloaded, 'es')).toBe(once);
  });

  it('keys the catalog by the canonical tag a custom mapping gives a differently cased locale', () => {
    gt.setConfig({ customMapping: { 'pt-br': { code: 'pt-BR' } } });
    const content = JSON.stringify({
      sourceLanguage: 'en',
      strings: { greeting: { localizations: { en: unit('Hello') } } },
    });
    const downloaded = JSON.stringify({
      sourceLanguage: 'en',
      strings: { greeting: { localizations: { 'pt-BR': unit('Olá') } } },
    });

    const once = merge(content, downloaded, 'pt-br');
    const catalog = parseCatalog(once);

    expect(Object.keys(catalog.strings.greeting.localizations!)).toEqual([
      'en',
      'pt-BR',
    ]);
    expect(catalog.strings.greeting.localizations!['pt-BR']).toEqual(
      unit('Olá')
    );
    // A second merge replaces pt-BR in place rather than adding pt-br
    expect(merge(once, downloaded, 'pt-br')).toBe(once);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('keys the catalog by the canonical tag a custom mapping aliases the locale to', () => {
    gt.setConfig({ customMapping: { 'brand-french': { code: 'fr-CA' } } });
    const content = JSON.stringify({
      sourceLanguage: 'en',
      strings: { greeting: { localizations: { en: unit('Hello') } } },
    });
    const downloaded = JSON.stringify({
      sourceLanguage: 'en',
      strings: { greeting: { localizations: { 'fr-CA': unit('Salut') } } },
    });

    const catalog = parseCatalog(merge(content, downloaded, 'brand-french'));

    expect(catalog.strings.greeting.localizations).toEqual({
      en: unit('Hello'),
      'fr-CA': unit('Salut'),
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('throws on invalid catalog or download content', () => {
    const valid = JSON.stringify({ sourceLanguage: 'en', strings: {} });
    expect(() => merge('not json', valid, 'es')).toThrow(
      'Invalid .xcstrings content'
    );
    expect(() => merge(valid, '{"strings":{}}', 'es')).toThrow(
      'Invalid .xcstrings content'
    );
  });
});
