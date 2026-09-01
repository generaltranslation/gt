import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mergeXcstrings } from '../mergeXcstrings.js';
import { extractXcstrings } from '../extractXcstrings.js';
import { parseXcstrings, type XcstringsCatalog } from '../parseXcstrings.js';
import { logger } from '../../../console/logger.js';

vi.mock('../../../console/logger.js');

const realisticAppContent = readFileSync(
  path.join(__dirname, '../__mocks__', 'realistic_app.xcstrings'),
  'utf8'
);

const parseCatalog = (content: string): XcstringsCatalog =>
  JSON.parse(content) as XcstringsCatalog;

/** Appends a marker to every "value" string, keeping structure intact. */
function rewriteValues(node: unknown, suffix: string): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => rewriteValues(item, suffix));
  }
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [
        key,
        key === 'value' && typeof value === 'string'
          ? `${value} ${suffix}`
          : rewriteValues(value, suffix),
      ])
    );
  }
  return node;
}

/**
 * Builds a downloaded translation slice for a locale: the upload-time slice
 * with every value rewritten, serialized WITHOUT the pinned serializer so
 * the merge cannot depend on slice formatting.
 */
function buildTranslatedSlice(
  content: string,
  locale: string,
  suffix: string
): string {
  const slice = parseCatalog(extractXcstrings(content, 'fixture', locale)!);
  return JSON.stringify(rewriteValues(slice, suffix));
}

describe('mergeXcstrings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replaces one locale in the realistic catalog and leaves everything else byte-stable', () => {
    const input = parseCatalog(realisticAppContent);
    const esSlice = buildTranslatedSlice(realisticAppContent, 'es', '(rev)');
    const sliceStrings = parseCatalog(esSlice).strings;

    const merged = mergeXcstrings(realisticAppContent, esSlice, 'es');
    const catalog = parseCatalog(merged);

    // Document shape and entry order are the on-disk catalog's
    expect(catalog.sourceLanguage).toBe(input.sourceLanguage);
    expect(catalog.version).toBe(input.version);
    expect(Object.keys(catalog.strings)).toEqual(Object.keys(input.strings));

    for (const [key, inputEntry] of Object.entries(input.strings)) {
      const mergedEntry = catalog.strings[key];
      // Entry-level fields other than localizations are untouched
      expect({ ...mergedEntry, localizations: undefined }).toEqual({
        ...inputEntry,
        localizations: undefined,
      });
      if (inputEntry.localizations === undefined) {
        expect(mergedEntry.localizations).toBeUndefined();
        continue;
      }
      // Locale key order is untouched (es already exists in the fixture)
      expect(Object.keys(mergedEntry.localizations!)).toEqual(
        Object.keys(inputEntry.localizations)
      );
      for (const [locale, localization] of Object.entries(
        inputEntry.localizations
      )) {
        if (locale === 'es' && sliceStrings[key] !== undefined) {
          // Target locale replaced wholesale from the slice
          expect(mergedEntry.localizations![locale]).toEqual(
            sliceStrings[key].localizations!.es
          );
          continue;
        }
        // Other locales byte-stable: deep-equal AND identical serialization
        expect(mergedEntry.localizations![locale]).toEqual(localization);
        expect(JSON.stringify(mergedEntry.localizations![locale])).toBe(
          JSON.stringify(localization)
        );
      }
    }

    // A second merge of the same slice is byte-idempotent
    expect(mergeXcstrings(merged, esSlice, 'es')).toBe(merged);
  });

  it('produces identical bytes regardless of locale merge order', () => {
    const catalogContent = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        greeting: {
          localizations: {
            en: { stringUnit: { state: 'translated', value: 'Hello' } },
            fr: { stringUnit: { state: 'translated', value: 'Salut' } },
          },
        },
      },
    });
    const makeSlice = (locale: string, value: string) =>
      JSON.stringify({
        sourceLanguage: 'en',
        strings: {
          greeting: {
            localizations: {
              [locale]: { stringUnit: { state: 'translated', value } },
            },
          },
        },
      });
    // One new locale sorts before the existing fr, the other after it
    const deSlice = makeSlice('de', 'Hallo');
    const itSlice = makeSlice('it', 'Ciao');

    const deThenIt = mergeXcstrings(
      mergeXcstrings(catalogContent, deSlice, 'de'),
      itSlice,
      'it'
    );
    const itThenDe = mergeXcstrings(
      mergeXcstrings(catalogContent, itSlice, 'it'),
      deSlice,
      'de'
    );

    expect(deThenIt).toBe(itThenDe);
    // Existing locales never move; new ones land at their sorted position
    expect(
      Object.keys(parseCatalog(deThenIt).strings.greeting.localizations!)
    ).toEqual(['de', 'en', 'fr', 'it']);
  });

  it('leaves the source slice (and so versionId) byte-stable across merges', () => {
    // Implicit entries gain a localizations object holding only target
    // locales when translations merge in. Re-slicing the merged catalog must
    // reproduce the original source slice, or every translate run re-versions
    // the file and re-triggers translation.
    const catalogContent = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        Save: {},
        Cancel: { comment: 'toolbar' },
        greeting: {
          localizations: {
            en: { stringUnit: { state: 'translated', value: 'Hello' } },
          },
        },
      },
    });
    const makeSlice = (locale: string, values: Record<string, string>) =>
      JSON.stringify({
        sourceLanguage: 'en',
        strings: Object.fromEntries(
          Object.entries(values).map(([key, value]) => [
            key,
            {
              localizations: {
                [locale]: { stringUnit: { state: 'translated', value } },
              },
            },
          ])
        ),
      });

    let merged = mergeXcstrings(
      catalogContent,
      makeSlice('es', {
        Save: 'Guardar',
        Cancel: 'Cancelar',
        greeting: 'Hola',
      }),
      'es'
    );
    merged = mergeXcstrings(
      merged,
      makeSlice('fr', {
        Save: 'Enregistrer',
        Cancel: 'Annuler',
        greeting: 'Salut',
      }),
      'fr'
    );

    expect(parseXcstrings(merged)).toBe(parseXcstrings(catalogContent));
  });

  it('skips slice entries with no matching catalog entry and warns', () => {
    const catalogContent = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        greeting: {
          localizations: {
            en: { stringUnit: { state: 'translated', value: 'Hello' } },
          },
        },
      },
    });
    const sliceContent = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        greeting: {
          localizations: {
            es: { stringUnit: { state: 'translated', value: 'Hola' } },
          },
        },
        'deleted.key': {
          localizations: {
            es: { stringUnit: { state: 'translated', value: 'Huérfano' } },
          },
        },
      },
    });

    const catalog = parseCatalog(
      mergeXcstrings(catalogContent, sliceContent, 'es')
    );

    // The on-disk catalog is truth for entry existence
    expect(Object.keys(catalog.strings)).toEqual(['greeting']);
    expect(catalog.strings.greeting.localizations!.es).toEqual({
      stringUnit: { state: 'translated', value: 'Hola' },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('"deleted.key"')
    );
  });

  it('preserves unknown fields everywhere and replaces the target locale wholesale', () => {
    const catalogContent = JSON.stringify({
      sourceLanguage: 'en',
      unknownRoot: { keep: ['me'] },
      strings: {
        'task.count': {
          comment: 'Badge',
          unknownEntryField: 7,
          localizations: {
            en: { stringUnit: { state: 'translated', value: 'Tasks' } },
            // Stale machine translation with source-shaped categories and an
            // unknown unit field — replaced wholesale by the download
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
    // Target-language plural categories legitimately differ from the source's
    const sliceContent = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        'task.count': {
          localizations: {
            es: {
              variations: {
                plural: {
                  one: { stringUnit: { state: 'translated', value: 'Tarea' } },
                  many: {
                    stringUnit: { state: 'translated', value: 'Tareas' },
                  },
                  other: {
                    stringUnit: { state: 'translated', value: 'Tareas' },
                  },
                },
              },
            },
          },
        },
      },
    });

    const catalog = parseCatalog(
      mergeXcstrings(catalogContent, sliceContent, 'es')
    );

    expect(catalog.unknownRoot).toEqual({ keep: ['me'] });
    const entry = catalog.strings['task.count'];
    expect(entry.comment).toBe('Badge');
    expect(entry.unknownEntryField).toBe(7);
    expect(entry.localizations!.fr).toEqual({
      stringUnit: {
        state: 'translated',
        value: 'Tâches',
        unknownUnitField: true,
      },
    });
    expect(entry.localizations!.es).toEqual({
      variations: {
        plural: {
          one: { stringUnit: { state: 'translated', value: 'Tarea' } },
          many: { stringUnit: { state: 'translated', value: 'Tareas' } },
          other: { stringUnit: { state: 'translated', value: 'Tareas' } },
        },
      },
    });
  });

  it('throws on invalid catalog or slice content', () => {
    const valid = JSON.stringify({ sourceLanguage: 'en', strings: {} });
    expect(() => mergeXcstrings('not json', valid, 'es')).toThrow(
      'Invalid .xcstrings content'
    );
    expect(() => mergeXcstrings(valid, '{"strings":{}}', 'es')).toThrow(
      'Invalid .xcstrings content'
    );
  });
});
