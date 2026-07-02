import { describe, expect, it } from 'vitest';
import { I18nConfig } from 'gt-i18n/internal';
import { getLocalizedPath, matchPathLocale } from '../pathLocale';

const i18nConfig = new I18nConfig({
  defaultLocale: 'en',
  locales: ['en', 'fr', 'zh'],
});

describe('matchPathLocale', () => {
  it('matches an exact locale prefix', () => {
    expect(matchPathLocale('/fr/about', i18nConfig)).toEqual({
      segment: 'fr',
      locale: 'fr',
    });
  });

  it('matches case-insensitively', () => {
    expect(matchPathLocale('/FR/about', i18nConfig)).toEqual({
      segment: 'FR',
      locale: 'fr',
    });
  });

  it('resolves locale aliases to a supported locale', () => {
    expect(matchPathLocale('/fr-FR/about', i18nConfig)).toEqual({
      segment: 'fr-FR',
      locale: 'fr',
    });
  });

  it('ignores ordinary path segments', () => {
    expect(matchPathLocale('/about', i18nConfig)).toBeUndefined();
    expect(matchPathLocale('/posts/some-post', i18nConfig)).toBeUndefined();
  });

  it('ignores locale-shaped segments that are not supported', () => {
    expect(matchPathLocale('/de/about', i18nConfig)).toBeUndefined();
  });

  it('returns undefined for the root path', () => {
    expect(matchPathLocale('/', i18nConfig)).toBeUndefined();
  });

  it('matches custom mapping keys', () => {
    const mapped = new I18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      customMapping: { 'brand-french': { code: 'fr' } },
    });
    expect(matchPathLocale('/brand-french/about', mapped)).toEqual({
      segment: 'brand-french',
      locale: 'fr',
    });
  });
});

describe('getLocalizedPath', () => {
  const locales = ['en', 'fr', 'zh'];

  it('swaps an existing locale prefix', () => {
    expect(getLocalizedPath('/fr/about', 'zh', locales)).toBe('/zh/about');
  });

  it('prefixes paths without a locale', () => {
    expect(getLocalizedPath('/about', 'fr', locales)).toBe('/fr/about');
  });

  it('handles the root path', () => {
    expect(getLocalizedPath('/', 'fr', locales)).toBe('/fr');
    expect(getLocalizedPath('/fr', 'zh', locales)).toBe('/zh');
  });
});
