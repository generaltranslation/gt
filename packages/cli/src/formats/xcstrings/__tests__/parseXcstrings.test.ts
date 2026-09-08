import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  parseXcstrings,
  parseXcstringsCatalog,
  serializeXcstringsSlice,
  sliceTranslationCatalog,
  type XcstringsCatalog,
} from '../parseXcstrings.js';

const multiLocaleContent = readFileSync(
  path.join(__dirname, '../__mocks__', 'multi_locale.xcstrings'),
  'utf8'
);
const implicitEntriesContent = readFileSync(
  path.join(__dirname, '../__mocks__', 'implicit_entries.xcstrings'),
  'utf8'
);

const parseCatalog = (content: string): XcstringsCatalog =>
  JSON.parse(content) as XcstringsCatalog;

describe('parseXcstrings - source slice', () => {
  it('keeps every entry but only the source-language localization', () => {
    const input = parseCatalog(multiLocaleContent);
    const slice = parseCatalog(parseXcstrings(multiLocaleContent));

    expect(slice.sourceLanguage).toBe('en');
    // Entry set and order are preserved
    expect(Object.keys(slice.strings)).toEqual(Object.keys(input.strings));

    for (const entry of Object.values(slice.strings)) {
      const locales = Object.keys(entry.localizations ?? {});
      expect(locales).toEqual(['en']);
    }
    // The foreign-locale content is gone, the source content is untouched
    expect(slice.strings.greeting.localizations).toEqual({
      en: { stringUnit: { state: 'translated', value: 'Hello' } },
    });
  });

  it('slices shouldTranslate:false entries to source but keeps the flag', () => {
    const slice = parseCatalog(parseXcstrings(multiLocaleContent));
    const entry = slice.strings['account.plan.pro'];

    expect(entry.shouldTranslate).toBe(false);
    expect(entry.comment).toBe('Product name. Do not translate.');
    expect(Object.keys(entry.localizations ?? {})).toEqual(['en']);
  });

  it('handles implicit entries where the key is the source', () => {
    const input = parseCatalog(implicitEntriesContent);
    const slice = parseCatalog(parseXcstrings(implicitEntriesContent));

    expect(Object.keys(slice.strings)).toEqual(Object.keys(input.strings));
    // Entries with no localizations are kept verbatim (the key is the source)
    expect(slice.strings.Save).toEqual({});
    expect(slice.strings.Cancel).toEqual({
      comment: 'Toolbar button',
      extractionState: 'manual',
    });
    // Entries with localizations still slice down to the source locale
    expect(slice.strings['Welcome to %@'].localizations).toEqual({
      en: { stringUnit: { state: 'translated', value: 'Welcome to %@' } },
    });
  });

  it('preserves unknown and nested fields at every level', () => {
    const content = JSON.stringify({
      sourceLanguage: 'en',
      unknownRoot: { nested: true },
      strings: {
        items: {
          comment: 'Home screen',
          unknownEntryField: [1, 2, 3],
          localizations: {
            en: {
              variations: {
                plural: {
                  other: {
                    stringUnit: { state: 'translated', value: '%d items' },
                  },
                },
              },
              unknownLocalizationField: { deep: 'value' },
            },
            es: { stringUnit: { state: 'translated', value: '%d elementos' } },
          },
        },
      },
      version: '1.0',
    });

    const slice = parseCatalog(parseXcstrings(content));

    expect(slice.unknownRoot).toEqual({ nested: true });
    expect(slice.strings.items).toEqual({
      comment: 'Home screen',
      unknownEntryField: [1, 2, 3],
      localizations: {
        en: {
          variations: {
            plural: {
              other: { stringUnit: { state: 'translated', value: '%d items' } },
            },
          },
          unknownLocalizationField: { deep: 'value' },
        },
      },
    });
    // Top-level key order survives the clone
    expect(Object.keys(slice)).toEqual([
      'sourceLanguage',
      'unknownRoot',
      'strings',
      'version',
    ]);
  });

  it('slices by the catalog sourceLanguage, not a hardcoded locale', () => {
    const content = JSON.stringify({
      sourceLanguage: 'fr',
      strings: {
        greeting: {
          localizations: {
            en: { stringUnit: { state: 'translated', value: 'Hello' } },
            fr: { stringUnit: { state: 'translated', value: 'Bonjour' } },
          },
        },
      },
    });

    const slice = parseCatalog(parseXcstrings(content));

    expect(Object.keys(slice.strings.greeting.localizations!)).toEqual(['fr']);
  });

  describe('translation slices', () => {
    const sliceLocale = (content: string, locale: string) => {
      const slice = sliceTranslationCatalog(
        parseXcstringsCatalog(content),
        locale
      );
      return slice && serializeXcstringsSlice(slice);
    };

    it('keeps only the entries carrying the locale, each with only that localization', () => {
      const es = parseCatalog(sliceLocale(multiLocaleContent, 'es')!);
      const fr = parseCatalog(sliceLocale(multiLocaleContent, 'fr')!);

      expect(es.sourceLanguage).toBe('en');
      // items.count has no es localization; account.plan.pro has no fr one
      expect(Object.keys(es.strings)).toEqual(['greeting', 'account.plan.pro']);
      expect(Object.keys(fr.strings)).toEqual(['greeting', 'items.count']);
      for (const entry of Object.values(es.strings)) {
        expect(Object.keys(entry.localizations!)).toEqual(['es']);
      }
      for (const entry of Object.values(fr.strings)) {
        expect(Object.keys(entry.localizations!)).toEqual(['fr']);
      }
      expect(es.strings.greeting.localizations).toEqual({
        es: { stringUnit: { state: 'translated', value: 'Hola' } },
      });
      // Entry-level fields travel with the slice
      expect(es.strings['account.plan.pro'].shouldTranslate).toBe(false);
      expect(es.strings['account.plan.pro'].comment).toBe(
        'Product name. Do not translate.'
      );
    });

    it('returns undefined for a locale the catalog does not carry', () => {
      expect(sliceLocale(multiLocaleContent, 'ja')).toBeUndefined();
      expect(sliceLocale(implicitEntriesContent, 'es')).toBeUndefined();
    });

    it('preserves unknown fields at every level', () => {
      const content = JSON.stringify({
        sourceLanguage: 'en',
        unknownRoot: { nested: true },
        strings: {
          items: {
            unknownEntryField: [1, 2, 3],
            localizations: {
              en: { stringUnit: { state: 'translated', value: 'Items' } },
              es: {
                stringUnit: { state: 'translated', value: 'Elementos' },
                unknownLocalizationField: { deep: 'value' },
              },
            },
          },
        },
        version: '1.0',
      });

      const slice = parseCatalog(sliceLocale(content, 'es')!);

      expect(Object.keys(slice)).toEqual([
        'sourceLanguage',
        'unknownRoot',
        'strings',
        'version',
      ]);
      expect(slice.unknownRoot).toEqual({ nested: true });
      expect(slice.strings.items).toEqual({
        unknownEntryField: [1, 2, 3],
        localizations: {
          es: {
            stringUnit: { state: 'translated', value: 'Elementos' },
            unknownLocalizationField: { deep: 'value' },
          },
        },
      });
    });

    it('serializes byte-stably and slicing a slice is a fixed point', () => {
      const first = sliceLocale(multiLocaleContent, 'fr')!;
      expect(sliceLocale(multiLocaleContent, 'fr')).toBe(first);
      expect(sliceLocale(first, 'fr')).toBe(first);
      // Same pinned layout as the source slice
      expect(first).toBe(JSON.stringify(JSON.parse(first), null, 2) + '\n');
    });
  });

  describe('serialization contract (versionId hashes this output)', () => {
    it('re-slices an unchanged catalog byte-identically', () => {
      expect(parseXcstrings(multiLocaleContent)).toBe(
        parseXcstrings(multiLocaleContent)
      );
    });

    // DO NOT update these bytes to make a failing test pass: the slice is
    // hashed into versionId, so a serialization change re-versions every
    // customer .xcstrings file and re-triggers translation fleet-wide.
    it('produces the pinned byte-exact output and versionId', () => {
      const content = JSON.stringify({
        sourceLanguage: 'en',
        version: '1.0',
        strings: {
          Save: {},
          greeting: {
            comment: 'Home screen',
            localizations: {
              en: { stringUnit: { state: 'translated', value: 'Hello' } },
              es: { stringUnit: { state: 'translated', value: 'Hola' } },
            },
          },
        },
      });
      const expected = `{
  "sourceLanguage": "en",
  "version": "1.0",
  "strings": {
    "Save": {},
    "greeting": {
      "comment": "Home screen",
      "localizations": {
        "en": {
          "stringUnit": {
            "state": "translated",
            "value": "Hello"
          }
        }
      }
    }
  }
}
`;
      const slice = parseXcstrings(content);
      expect(slice).toBe(expected);
      expect(createHash('sha256').update(slice).digest('hex')).toBe(
        'aad579f973ef23dea4b7750203b6001e1fbe1a739791f2d784265b254e5d8ed6'
      );
    });
  });

  describe('validation and reserved-key safety', () => {
    it.each([
      ['not JSON', 'not valid', /not valid JSON/],
      ['a root array', '[]', /document root must be an object/],
      ['a root string', '"catalog"', /document root must be an object/],
      [
        'a missing sourceLanguage',
        '{"strings":{}}',
        /sourceLanguage must be a non-empty string/,
      ],
      [
        'an empty sourceLanguage',
        '{"sourceLanguage":"","strings":{}}',
        /sourceLanguage must be a non-empty string/,
      ],
      [
        'missing strings',
        '{"sourceLanguage":"en"}',
        /strings must be an object/,
      ],
      [
        'an array strings value',
        '{"sourceLanguage":"en","strings":[]}',
        /strings must be an object/,
      ],
      [
        'a non-object entry',
        '{"sourceLanguage":"en","strings":{"key":"value"}}',
        /strings\["key"\] must be an object/,
      ],
      [
        'a non-object localizations value',
        '{"sourceLanguage":"en","strings":{"key":{"localizations":[]}}}',
        /localizations must be an object/,
      ],
      [
        'a reserved entry key',
        '{"sourceLanguage":"en","strings":{"__proto__":{}}}',
        /reserved name "__proto__"/,
      ],
      [
        'a reserved locale key',
        '{"sourceLanguage":"en","strings":{"key":{"localizations":{"__proto__":{}}}}}',
        /reserved name "__proto__"/,
      ],
      [
        'a reserved sourceLanguage',
        '{"sourceLanguage":"__proto__","strings":{}}',
        /reserved name "__proto__"/,
      ],
    ])('rejects %s', (_name, content, message) => {
      expect(() => parseXcstrings(content)).toThrow(message);
    });

    it('does not pollute Object.prototype when slicing reserved-key content', () => {
      expect(() =>
        parseXcstrings('{"sourceLanguage":"en","strings":{"__proto__":{}}}')
      ).toThrow();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    // Only __proto__ is reserved, matching the server's validator: a catalog
    // whose UI literally shows "constructor" or "prototype" stays uploadable.
    it('slices and round-trips catalogs keyed by constructor and prototype', () => {
      const content = JSON.stringify({
        sourceLanguage: 'en',
        strings: {
          constructor: {
            localizations: {
              en: { stringUnit: { state: 'translated', value: 'Constructor' } },
              es: { stringUnit: { state: 'translated', value: 'Constructor' } },
            },
          },
          prototype: {
            comment: 'Lab feature name',
            localizations: {
              en: { stringUnit: { state: 'translated', value: 'Prototype' } },
              prototype: { stringUnit: { state: 'translated', value: 'x' } },
            },
          },
        },
      });

      const slice = parseCatalog(parseXcstrings(content));

      expect(Object.keys(slice.strings)).toEqual(['constructor', 'prototype']);
      expect(slice.strings.constructor).toEqual({
        localizations: {
          en: { stringUnit: { state: 'translated', value: 'Constructor' } },
        },
      });
      expect(slice.strings.prototype).toEqual({
        comment: 'Lab feature name',
        localizations: {
          en: { stringUnit: { state: 'translated', value: 'Prototype' } },
        },
      });
      // Re-slicing the slice is a fixed point
      expect(parseXcstrings(parseXcstrings(content))).toBe(
        parseXcstrings(content)
      );
    });
  });
});
