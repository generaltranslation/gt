import { describe, it, expect } from 'vitest';
import { LocaleConfig } from '../LocaleConfig';
import { _isValidLocale, _standardizeLocale } from '../locales/isValidLocale';

// Regression tests for https://github.com/generaltranslation/gt/issues/2067.
// requiresTranslation and determineLocale results are memoized, so these
// tests verify that repeated (cached) calls always match freshly computed
// results and that memoization never leaks across differing inputs.

// The 55-locale config from the issue report.
const manyLocales = [
  'es',
  'zh',
  'zh-Hant',
  'hi',
  'bn',
  'ar',
  'pt-BR',
  'fr',
  'de',
  'it',
  'ru',
  'pt-PT',
  'ja',
  'ko',
  'vi',
  'th',
  'id',
  'ms',
  'fil',
  'ur',
  'ta',
  'ml',
  'gu',
  'fa',
  'tr',
  'kk',
  'mn',
  'hy',
  'ka',
  'uk',
  'pl',
  'cs',
  'sk',
  'sr',
  'hr',
  'sl',
  'mk',
  'bg',
  'lt',
  'et',
  'lv',
  'sv',
  'no',
  'da',
  'fi',
  'is',
  'nl',
  'el',
  'hu',
  'ro',
  'sq',
  'ca',
  'cy',
  'af',
];

const targetLocales = [
  ...manyLocales,
  'en',
  'en-US',
  'ar-EG',
  'pt',
  'zh-CN',
  'fr-CA',
  'xx-INVALID',
  'invalid-locale',
];

describe('LocaleConfig memoization', () => {
  describe('requiresTranslation', () => {
    it('returns the same result on repeated calls as a fresh instance', () => {
      const memoized = new LocaleConfig({
        defaultLocale: 'en',
        locales: manyLocales,
      });
      for (const target of targetLocales) {
        const fresh = new LocaleConfig({
          defaultLocale: 'en',
          locales: manyLocales,
        });
        const expected = fresh.requiresTranslation(target);
        expect(memoized.requiresTranslation(target)).toBe(expected);
        // Second call hits the memo and must not change the answer.
        expect(memoized.requiresTranslation(target)).toBe(expected);
      }
    });

    it('does not leak results between explicit approvedLocales overrides and defaults', () => {
      const config = new LocaleConfig({
        defaultLocale: 'en',
        locales: manyLocales,
      });
      expect(config.requiresTranslation('ja')).toBe(true);
      expect(config.requiresTranslation('ja', 'en', ['fr'])).toBe(false);
      expect(config.requiresTranslation('ja')).toBe(true);
      expect(config.requiresTranslation('ja', 'en', ['fr'])).toBe(false);
      expect(config.requiresTranslation('ja', 'en', ['ja'])).toBe(true);
    });

    it('distinguishes an explicit empty approvedLocales list from the no-locales default', () => {
      const config = new LocaleConfig({ defaultLocale: 'en' });
      // With no approved-locales scope, any different valid locale requires
      // translation; an explicit empty scope approves nothing.
      expect(config.requiresTranslation('ja', 'en', [])).toBe(false);
      expect(config.requiresTranslation('ja')).toBe(true);
      expect(config.requiresTranslation('ja', 'en', [])).toBe(false);
    });

    it('reflects mutations of the configured locales array', () => {
      const locales = ['es'];
      const config = new LocaleConfig({ defaultLocale: 'en', locales });
      expect(config.requiresTranslation('fr')).toBe(false);
      locales.push('fr');
      expect(config.requiresTranslation('fr')).toBe(true);
    });
  });

  describe('determineLocale', () => {
    it('returns the same result on repeated calls as a fresh instance', () => {
      const memoized = new LocaleConfig({
        defaultLocale: 'en',
        locales: manyLocales,
      });
      const candidateLists: (string | string[])[] = [
        ...manyLocales.map((locale) => [locale]),
        ['ar-EG', 'ar'],
        ['fr-CA'],
        ['ja-JP', 'en-US'],
        ['invalid-locale', 'en-US', 'es'],
        ['xx-INVALID'],
        'fr-CA',
        [],
      ];
      for (const candidates of candidateLists) {
        const fresh = new LocaleConfig({
          defaultLocale: 'en',
          locales: manyLocales,
        });
        const expected = fresh.determineLocale(candidates);
        expect(memoized.determineLocale(candidates)).toBe(expected);
        expect(memoized.determineLocale(candidates)).toBe(expected);
      }
    });

    it('does not leak results between explicit approvedLocales overrides and defaults', () => {
      const config = new LocaleConfig({
        defaultLocale: 'en',
        locales: manyLocales,
      });
      expect(config.determineLocale(['fr-FR'])).toBe('fr');
      expect(config.determineLocale(['fr-FR'], ['ja'])).toBeUndefined();
      expect(config.determineLocale(['fr-FR'])).toBe('fr');
      expect(config.determineLocale(['fr-FR'], ['ja'])).toBeUndefined();
    });

    it('keeps candidate and approved locale lists distinct in the memo key', () => {
      const config = new LocaleConfig({ defaultLocale: 'en', locales: [] });
      // Same flattened contents, different split between the two lists.
      expect(config.determineLocale(['de-DE'], ['de', 'fr'])).toBe('de');
      expect(config.determineLocale(['de-DE', 'de'], ['fr'])).toBeUndefined();
    });

    it('memoizes undefined results', () => {
      const config = new LocaleConfig({
        defaultLocale: 'en',
        locales: manyLocales,
      });
      expect(config.determineLocale(['xx-INVALID'])).toBeUndefined();
      expect(config.determineLocale(['xx-INVALID'])).toBeUndefined();
    });

    it('stays correct after the memo cache overflows and resets', () => {
      const config = new LocaleConfig({
        defaultLocale: 'en',
        locales: manyLocales,
      });
      expect(config.determineLocale(['ar-EG', 'ar'])).toBe('ar');
      expect(config.requiresTranslation('ar')).toBe(true);
      for (let i = 0; i < 600; i++) {
        config.determineLocale([`en-x${i}`]);
      }
      expect(config.determineLocale(['ar-EG', 'ar'])).toBe('ar');
      expect(config.requiresTranslation('ar')).toBe(true);
    });
  });

  describe('customMapping', () => {
    const customMapping = {
      'zz-mine': { code: 'fr', name: 'My French' },
    };

    it('resolves custom locale codes identically on repeated calls', () => {
      const config = new LocaleConfig({
        defaultLocale: 'en',
        locales: ['zz-mine', 'es'],
        customMapping,
      });
      const fresh = new LocaleConfig({
        defaultLocale: 'en',
        locales: ['zz-mine', 'es'],
        customMapping,
      });
      expect(fresh.requiresTranslation('zz-mine')).toBe(true);
      expect(config.requiresTranslation('zz-mine')).toBe(true);
      expect(config.requiresTranslation('zz-mine')).toBe(true);
      expect(fresh.determineLocale(['zz-mine'])).toBe('zz-mine');
      expect(config.determineLocale(['zz-mine'])).toBe('zz-mine');
      expect(config.determineLocale(['zz-mine'])).toBe('zz-mine');
    });
  });
});

describe('_isValidLocale memoization', () => {
  it('is stable across repeated calls for valid and invalid locales', () => {
    for (let i = 0; i < 2; i++) {
      expect(_isValidLocale('en')).toBe(true);
      expect(_isValidLocale('zh-Hant')).toBe(true);
      expect(_isValidLocale('pt-BR')).toBe(true);
      expect(_isValidLocale('xx-INVALID')).toBe(false);
      expect(_isValidLocale('invalid-locale')).toBe(false);
      expect(_isValidLocale('')).toBe(false);
    }
  });

  it('does not reuse a bare-locale result when a custom mapping applies', () => {
    // The cache is keyed by the resolved code, so an unmapped miss for the
    // same string must not shadow a later mapped hit (and vice versa).
    expect(_isValidLocale('zz-aaa')).toBe(false);
    expect(_isValidLocale('zz-aaa', { 'zz-aaa': { code: 'fr' } })).toBe(true);
    expect(_isValidLocale('zz-aaa')).toBe(false);

    expect(_isValidLocale('zz-bbb', { 'zz-bbb': { code: 'de' } })).toBe(true);
    expect(_isValidLocale('zz-bbb')).toBe(false);

    // A custom mapping to an invalid code stays invalid.
    expect(_isValidLocale('zz-ccc', { 'zz-ccc': { code: 'xx-INVALID' } })).toBe(
      false
    );
  });

  it('stays correct after the validity cache overflows and resets', () => {
    expect(_isValidLocale('en')).toBe(true);
    for (let i = 0; i < 1100; i++) {
      _isValidLocale(`en-overflow${i}`);
    }
    expect(_isValidLocale('en')).toBe(true);
    expect(_isValidLocale('xx-INVALID')).toBe(false);
  });
});

describe('_standardizeLocale memoization', () => {
  it('is stable across repeated calls', () => {
    for (let i = 0; i < 2; i++) {
      expect(_standardizeLocale('en-us')).toBe('en-US');
      expect(_standardizeLocale('EN-GB')).toBe('en-GB');
      expect(_standardizeLocale('zh-hant')).toBe('zh-Hant');
      // Unparseable input is returned unchanged.
      expect(_standardizeLocale('not a locale!!')).toBe('not a locale!!');
    }
  });
});
