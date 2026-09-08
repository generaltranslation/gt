import { describe, expect, it } from 'vitest';
import { localeContent } from '../localeContent.js';

const unit = (value: string) => ({
  stringUnit: { state: 'translated', value },
});

const catalog = JSON.stringify({
  sourceLanguage: 'en',
  version: '1.0',
  strings: {
    Save: {},
    greeting: {
      comment: 'Home screen',
      localizations: {
        de: unit('Hallo'),
        en: unit('Hello'),
        fr: unit('Bonjour'),
      },
    },
    farewell: {
      localizations: { en: unit('Bye'), fr: unit('Au revoir') },
    },
  },
});

const deSlice =
  JSON.stringify(
    {
      sourceLanguage: 'en',
      version: '1.0',
      strings: {
        greeting: {
          comment: 'Home screen',
          localizations: { de: unit('Hallo') },
        },
      },
    },
    null,
    2
  ) + '\n';

describe('localeContent', () => {
  it('is the content itself for a file that holds one locale', () => {
    expect(localeContent('# heading\n', 'MD', 'de')).toBe('# heading\n');
    expect(localeContent('{"a":1}', 'JSON', 'de')).toBe('{"a":1}');
  });

  it('is the pinned single-locale slice of an .xcstrings catalog', () => {
    expect(localeContent(catalog, 'XCSTRINGS', 'de')).toBe(deSlice);
  });

  it('normalizes a download shaped as the source slice plus the locale to the same bytes as the catalog slice', () => {
    // The server returns the source slice with the locale's units added, in
    // whatever layout it likes; only the locale's share of it is the baseline.
    const download = JSON.stringify({
      sourceLanguage: 'en',
      version: '1.0',
      strings: {
        Save: {},
        greeting: {
          comment: 'Home screen',
          localizations: { en: unit('Hello'), de: unit('Hallo') },
        },
        farewell: { localizations: { en: unit('Bye') } },
      },
    });

    expect(localeContent(download, 'XCSTRINGS', 'de')).toBe(deSlice);
  });

  it('is undefined when the catalog carries nothing for the locale', () => {
    expect(localeContent(catalog, 'XCSTRINGS', 'ja')).toBeUndefined();
  });

  it('throws on content that is not a catalog', () => {
    expect(() => localeContent('not json', 'XCSTRINGS', 'de')).toThrow(
      'Invalid .xcstrings content'
    );
  });
});
