import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseXcstrings, type XcstringsCatalog } from '../parseXcstrings.js';

const realisticAppContent = readFileSync(
  path.join(__dirname, '../__mocks__', 'realistic_app.xcstrings'),
  'utf8'
);
const guardianScaleContent = readFileSync(
  path.join(__dirname, '../__mocks__', 'guardian_scale.xcstrings'),
  'utf8'
);

const parseCatalog = (content: string): XcstringsCatalog =>
  JSON.parse(content) as XcstringsCatalog;

const smallCatalogContent = JSON.stringify({
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

describe('parseXcstrings - source slice', () => {
  it('keeps every entry with only the source-language localization (realistic fixture)', () => {
    const input = parseCatalog(realisticAppContent);
    const slice = parseCatalog(parseXcstrings(realisticAppContent));

    expect(slice.sourceLanguage).toBe('en');
    expect(slice.version).toBe(input.version);

    const inputKeys = Object.keys(input.strings);
    expect(inputKeys).toHaveLength(106);
    // Every entry survives, in the original order
    expect(Object.keys(slice.strings)).toEqual(inputKeys);

    for (const [key, inputEntry] of Object.entries(input.strings)) {
      const slicedEntry = slice.strings[key];
      if (
        inputEntry.shouldTranslate === false ||
        inputEntry.localizations === undefined
      ) {
        expect(slicedEntry).toEqual(inputEntry);
        continue;
      }
      // Only the source language remains; its content is untouched. Entries
      // with no source-language unit slice as implicit (no localizations key).
      expect(slicedEntry.localizations).toEqual(
        'en' in inputEntry.localizations
          ? { en: inputEntry.localizations.en }
          : undefined
      );
      // Entry-level fields other than localizations are untouched
      expect({ ...slicedEntry, localizations: undefined }).toEqual({
        ...inputEntry,
        localizations: undefined,
      });
    }
  });

  it('keeps entries with no localizations verbatim (the key is the source)', () => {
    const content = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        Save: {},
        Cancel: { comment: 'toolbar', extractionState: 'manual' },
      },
    });

    const slice = parseCatalog(parseXcstrings(content));

    expect(slice.strings.Save).toEqual({});
    expect(slice.strings.Cancel).toEqual({
      comment: 'toolbar',
      extractionState: 'manual',
    });
  });

  it('slices entries with no source-language localization as implicit entries', () => {
    // After a download merge, formerly-implicit entries carry only target
    // locales. Their slice must match the pre-merge implicit form byte-for-
    // byte, or versionId changes on every run and re-triggers translation.
    const content = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        Save: {
          comment: 'toolbar',
          localizations: {
            es: { stringUnit: { state: 'translated', value: 'Guardar' } },
          },
        },
      },
    });

    const slice = parseCatalog(parseXcstrings(content));

    expect(slice.strings.Save).toEqual({ comment: 'toolbar' });
    expect('localizations' in slice.strings.Save).toBe(false);
  });

  it('keeps shouldTranslate:false entries verbatim, including non-source locales', () => {
    const entry = {
      comment: 'Product name. Do not translate.',
      shouldTranslate: false,
      localizations: {
        en: { stringUnit: { state: 'translated', value: 'Cascade Pro' } },
        es: { stringUnit: { state: 'translated', value: 'Cascade Pro' } },
      },
    };
    const content = JSON.stringify({
      sourceLanguage: 'en',
      strings: { 'account.plan.pro': entry },
    });

    const slice = parseCatalog(parseXcstrings(content));

    expect(slice.strings['account.plan.pro']).toEqual(entry);
  });

  it('preserves unknown fields at every level', () => {
    const content = JSON.stringify({
      sourceLanguage: 'en',
      unknownRoot: { nested: true },
      strings: {
        greeting: {
          comment: 'Home screen',
          unknownEntryField: [1, 2, 3],
          localizations: {
            en: {
              stringUnit: {
                state: 'translated',
                value: 'Hello',
                unknownUnitField: 'keep-me',
              },
              unknownLocalizationField: { deep: 'value' },
            },
            es: { stringUnit: { state: 'translated', value: 'Hola' } },
          },
        },
      },
      version: '1.0',
    });

    const slice = parseCatalog(parseXcstrings(content));

    expect(slice.unknownRoot).toEqual({ nested: true });
    expect(slice.strings.greeting).toEqual({
      comment: 'Home screen',
      unknownEntryField: [1, 2, 3],
      localizations: {
        en: {
          stringUnit: {
            state: 'translated',
            value: 'Hello',
            unknownUnitField: 'keep-me',
          },
          unknownLocalizationField: { deep: 'value' },
        },
      },
    });
    // Top-level field order survives the clone
    expect(Object.keys(slice)).toEqual([
      'sourceLanguage',
      'unknownRoot',
      'strings',
      'version',
    ]);
  });

  it('slices by the catalog sourceLanguage, not by a hardcoded locale', () => {
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

  describe('serialization contract (versionId hashes this output)', () => {
    it('is byte-deterministic across repeated slicing', () => {
      expect(parseXcstrings(realisticAppContent)).toBe(
        parseXcstrings(realisticAppContent)
      );
    });

    // DO NOT update these bytes to make a failing test pass: the slice is
    // hashed into versionId, so a serialization change re-versions every
    // customer xcstrings file and re-triggers translation fleet-wide.
    it('produces the pinned byte-exact output', () => {
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
      const slice = parseXcstrings(smallCatalogContent);
      expect(slice).toBe(expected);
      expect(createHash('sha256').update(slice).digest('hex')).toBe(
        'aad579f973ef23dea4b7750203b6001e1fbe1a739791f2d784265b254e5d8ed6'
      );
    });
  });

  describe('validation', () => {
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
        '{"sourceLanguage":"en","strings":{"key":{"localizations":{"constructor":{}}}}}',
        /reserved name "constructor"/,
      ],
      [
        'a reserved sourceLanguage',
        '{"sourceLanguage":"__proto__","strings":{}}',
        /reserved name "__proto__"/,
      ],
    ])('rejects %s', (_name, content, message) => {
      expect(() => parseXcstrings(content)).toThrow(message);
    });
  });

  it('slices the 59-locale guardian catalog into a well-formed source slice', () => {
    const started = performance.now();
    const sliceContent = parseXcstrings(guardianScaleContent);
    const elapsedMs = performance.now() - started;
    expect(elapsedMs).toBeLessThan(10_000);

    const input = parseCatalog(guardianScaleContent);
    const slice = parseCatalog(sliceContent);
    expect(Object.keys(slice.strings)).toEqual(Object.keys(input.strings));
    for (const [key, entry] of Object.entries(slice.strings)) {
      const inputEntry = input.strings[key];
      if (
        inputEntry.shouldTranslate === false ||
        inputEntry.localizations === undefined
      ) {
        expect(entry).toEqual(inputEntry);
        continue;
      }
      const locales = Object.keys(entry.localizations ?? {});
      expect(locales.length).toBeLessThanOrEqual(1);
      if (locales.length === 1) expect(locales[0]).toBe('en');
    }
  });
});
