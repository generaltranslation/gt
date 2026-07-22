import { beforeAll, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { getLocaleFromPath, getPathnameForLocale } from '../localeRouting';

describe.sequential('locale routing', () => {
  beforeAll(() => {
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'ar'],
    });
  });

  it('reads supported locales from the first path segment', () => {
    expect(getLocaleFromPath('/fr/about')).toBe('fr');
    expect(getLocaleFromPath('/ar')).toBe('ar');
    expect(getLocaleFromPath('/about')).toBeUndefined();
    expect(getLocaleFromPath('/')).toBeUndefined();
  });

  it('replaces existing locale prefixes', () => {
    expect(getPathnameForLocale('/fr/about', 'ar')).toBe('/ar/about');
    expect(getPathnameForLocale('/fr', 'ar')).toBe('/ar');
  });

  it('leaves the default locale unprefixed', () => {
    expect(getPathnameForLocale('/fr/about', 'en')).toBe('/about');
    expect(getPathnameForLocale('/about', 'en')).toBe('/about');
    expect(getPathnameForLocale('/', 'en')).toBe('/');
  });

  it('prefixes non-default locales', () => {
    expect(getPathnameForLocale('/about', 'fr')).toBe('/fr/about');
    expect(getPathnameForLocale('/', 'fr')).toBe('/fr');
  });
});
