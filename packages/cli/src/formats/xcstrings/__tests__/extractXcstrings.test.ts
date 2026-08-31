import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extractXcstrings } from '../extractXcstrings.js';
import type { XcstringsCatalog } from '../parseXcstrings.js';
import { logger } from '../../../console/logger.js';

vi.mock('../../../console/logger.js');

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

describe('extractXcstrings - per-locale slice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps exactly the entries that have the target locale (realistic fixture)', () => {
    const input = parseCatalog(realisticAppContent);
    const extracted = extractXcstrings(
      realisticAppContent,
      'Localizable.xcstrings',
      'es'
    );
    expect(extracted).not.toBeNull();
    const slice = parseCatalog(extracted!);

    const expectedKeys = Object.keys(input.strings).filter(
      (key) => input.strings[key].localizations?.es !== undefined
    );
    expect(expectedKeys).toHaveLength(104);
    // Partial overlay: entries lacking es are omitted, order preserved
    expect(Object.keys(slice.strings)).toEqual(expectedKeys);

    for (const [key, entry] of Object.entries(slice.strings)) {
      const inputEntry = input.strings[key];
      expect(entry.localizations).toEqual({
        es: inputEntry.localizations!.es,
      });
      // Entry-level fields other than localizations are untouched
      expect({ ...entry, localizations: undefined }).toEqual({
        ...inputEntry,
        localizations: undefined,
      });
    }

    // The slice is still a valid catalog document
    expect(slice.sourceLanguage).toBe('en');
    expect(slice.version).toBe(input.version);
  });

  it('returns null when the catalog has no content for the locale', () => {
    expect(
      extractXcstrings(realisticAppContent, 'Localizable.xcstrings', 'ko')
    ).toBeNull();
    // The guardian fixture has 59 target locales, but not plain es
    expect(
      extractXcstrings(guardianScaleContent, 'Localizable.xcstrings', 'es')
    ).toBeNull();
  });

  it('omits entries without localizations and entries lacking the locale', () => {
    const content = JSON.stringify({
      sourceLanguage: 'en',
      strings: {
        Save: {},
        greeting: {
          localizations: {
            en: { stringUnit: { state: 'translated', value: 'Hello' } },
            es: { stringUnit: { state: 'translated', value: 'Hola' } },
          },
        },
        farewell: {
          localizations: {
            en: { stringUnit: { state: 'translated', value: 'Bye' } },
          },
        },
      },
    });

    const slice = parseCatalog(extractXcstrings(content, 'test', 'es')!);

    expect(Object.keys(slice.strings)).toEqual(['greeting']);
  });

  it('preserves unknown fields on kept entries', () => {
    const content = JSON.stringify({
      sourceLanguage: 'en',
      unknownRoot: 'keep-me',
      strings: {
        greeting: {
          comment: 'Home screen',
          unknownEntryField: { deep: [true] },
          localizations: {
            en: { stringUnit: { state: 'translated', value: 'Hello' } },
            es: {
              stringUnit: {
                state: 'translated',
                value: 'Hola',
                unknownUnitField: 42,
              },
            },
          },
        },
      },
    });

    const slice = parseCatalog(extractXcstrings(content, 'test', 'es')!);

    expect(slice.unknownRoot).toBe('keep-me');
    expect(slice.strings.greeting).toEqual({
      comment: 'Home screen',
      unknownEntryField: { deep: [true] },
      localizations: {
        es: {
          stringUnit: {
            state: 'translated',
            value: 'Hola',
            unknownUnitField: 42,
          },
        },
      },
    });
  });

  it('logs and returns null for invalid content', () => {
    expect(extractXcstrings('not json', 'bad.xcstrings', 'es')).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'Invalid .xcstrings file: bad.xcstrings'
    );

    expect(
      extractXcstrings('{"strings":{}}', 'bad.xcstrings', 'es')
    ).toBeNull();
  });

  describe('serialization contract (shares the pinned slice format)', () => {
    it('is byte-deterministic across repeated extraction', () => {
      expect(extractXcstrings(realisticAppContent, 'f', 'es')).toBe(
        extractXcstrings(realisticAppContent, 'f', 'es')
      );
    });

    // DO NOT update these bytes to make a failing test pass: see the
    // serializer's pinned-format comment in parseXcstrings.ts.
    it('produces the pinned byte-exact output', () => {
      const expected = `{
  "sourceLanguage": "en",
  "version": "1.0",
  "strings": {
    "greeting": {
      "comment": "Home screen",
      "localizations": {
        "es": {
          "stringUnit": {
            "state": "translated",
            "value": "Hola"
          }
        }
      }
    }
  }
}
`;
      const slice = extractXcstrings(smallCatalogContent, 'test', 'es');
      expect(slice).toBe(expected);
      expect(createHash('sha256').update(slice!).digest('hex')).toBe(
        '78da64d53e69022901560666d6a87152bcf5898f24add1f415ce7f10cf8bf6d3'
      );
    });
  });

  it('extracts every locale of the 59-locale guardian catalog', () => {
    const input = parseCatalog(guardianScaleContent);
    const locales = new Set<string>();
    for (const entry of Object.values(input.strings)) {
      for (const locale of Object.keys(entry.localizations ?? {})) {
        if (locale !== input.sourceLanguage) locales.add(locale);
      }
    }
    expect(locales.size).toBe(59);

    const started = performance.now();
    for (const locale of locales) {
      const extracted = extractXcstrings(guardianScaleContent, 'f', locale);
      expect(extracted).not.toBeNull();
      const slice = parseCatalog(extracted!);
      for (const entry of Object.values(slice.strings)) {
        expect(Object.keys(entry.localizations!)).toEqual([locale]);
      }
    }
    const elapsedMs = performance.now() - started;
    expect(elapsedMs).toBeLessThan(60_000);
  });
});
