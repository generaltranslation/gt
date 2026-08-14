import { describe, it, expect } from 'vitest';
import { LocaleConfig } from '../LocaleConfig';

// LocaleConfig prepares its approved-locales scope once per instance (see
// https://github.com/generaltranslation/gt/issues/2067). These tests pin the
// behavior of that prepared scope: repeated calls, caller-provided overrides,
// and custom mappings must all behave like a freshly constructed instance.

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

describe('LocaleConfig.requiresTranslation', () => {
  it('returns the same result on repeated calls as a fresh instance', () => {
    const reused = new LocaleConfig({
      defaultLocale: 'en',
      locales: manyLocales,
    });
    for (const target of targetLocales) {
      const fresh = new LocaleConfig({
        defaultLocale: 'en',
        locales: manyLocales,
      });
      const expected = fresh.requiresTranslation(target);
      expect(reused.requiresTranslation(target)).toBe(expected);
      expect(reused.requiresTranslation(target)).toBe(expected);
    }
  });

  it('supports caller-provided approvedLocales alongside the instance scope', () => {
    const config = new LocaleConfig({
      defaultLocale: 'en',
      locales: manyLocales,
    });
    expect(config.requiresTranslation('ja')).toBe(true);
    expect(config.requiresTranslation('ja', 'en', ['fr'])).toBe(false);
    expect(config.requiresTranslation('ja')).toBe(true);
    expect(config.requiresTranslation('ja', 'en', ['ja'])).toBe(true);
  });

  it('distinguishes an explicit empty approvedLocales list from the no-locales default', () => {
    const config = new LocaleConfig({ defaultLocale: 'en' });
    // With no approved-locales scope, any different valid locale requires
    // translation; an explicit empty scope approves nothing.
    expect(config.requiresTranslation('ja', 'en', [])).toBe(false);
    expect(config.requiresTranslation('ja')).toBe(true);
  });
});

describe('LocaleConfig.determineLocale', () => {
  it('returns the same result on repeated calls as a fresh instance', () => {
    const reused = new LocaleConfig({
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
      expect(reused.determineLocale(candidates)).toBe(expected);
      expect(reused.determineLocale(candidates)).toBe(expected);
    }
  });

  it('supports caller-provided approvedLocales alongside the instance scope', () => {
    const config = new LocaleConfig({
      defaultLocale: 'en',
      locales: manyLocales,
    });
    expect(config.determineLocale(['fr-FR'])).toBe('fr');
    expect(config.determineLocale(['fr-FR'], ['ja'])).toBeUndefined();
    expect(config.determineLocale(['fr-FR'])).toBe('fr');
    expect(config.determineLocale(['fr-CA'], ['fr'])).toBe('fr');
  });

  it('treats a single locale string like a one-element list', () => {
    const config = new LocaleConfig({
      defaultLocale: 'en',
      locales: manyLocales,
    });
    expect(config.determineLocale('fr-CA')).toBe(
      config.determineLocale(['fr-CA'])
    );
  });

  it('preserves the configured spelling of a matched approved locale', () => {
    // The configured code is returned as written, while a resolved code that
    // only matches after standardization falls through to alias resolution.
    const config = new LocaleConfig({
      defaultLocale: 'en',
      locales: ['en-us'],
    });
    expect(config.determineLocale(['en-US'])).toBe('en-US');
    const configured = new LocaleConfig({
      defaultLocale: 'en',
      locales: ['en-US'],
    });
    expect(configured.determineLocale(['en-us'])).toBe('en-US');
  });
});

describe('LocaleConfig with a custom mapping', () => {
  const customMapping = {
    'zz-mine': { code: 'fr', name: 'My French' },
  };

  it('resolves custom locale codes identically on repeated calls', () => {
    const config = new LocaleConfig({
      defaultLocale: 'en',
      locales: ['zz-mine', 'es'],
      customMapping,
    });
    expect(config.requiresTranslation('zz-mine')).toBe(true);
    expect(config.requiresTranslation('zz-mine')).toBe(true);
    expect(config.determineLocale(['zz-mine'])).toBe('zz-mine');
    expect(config.determineLocale(['zz-mine'])).toBe('zz-mine');
    expect(config.determineLocale(['fr'])).toBe('zz-mine');
  });
});
