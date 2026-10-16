import { beforeAll, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { getLocaleFromPath, getPathnameForLocale } from '../localeRouting';

describe('locale routing', () => {
  beforeAll(() => {
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'ar'],
    });
  });

  it('reads supported locales from the first path segment', () => {
    expect(getLocaleFromPath({ pathname: '/fr/about' })).toBe('fr');
    expect(getLocaleFromPath({ pathname: '/ar' })).toBe('ar');
    expect(getLocaleFromPath({ pathname: '/about' })).toBeUndefined();
    expect(getLocaleFromPath({ pathname: '/' })).toBeUndefined();
    expect(getLocaleFromPath({ pathname: '/%E0%A4%A/about' })).toBeUndefined();
  });

  it('reads locale prefixes after a basepath', () => {
    expect(
      getLocaleFromPath({ pathname: '/app/fr/about', basepath: '/app' })
    ).toBe('fr');
  });

  it('replaces existing locale prefixes', () => {
    expect(getPathnameForLocale({ pathname: '/fr/about', locale: 'ar' })).toBe(
      '/ar/about'
    );
    expect(getPathnameForLocale({ pathname: '/fr', locale: 'ar' })).toBe('/ar');
  });

  it('leaves the default locale unprefixed', () => {
    expect(getPathnameForLocale({ pathname: '/fr/about', locale: 'en' })).toBe(
      '/about'
    );
    expect(getPathnameForLocale({ pathname: '/about', locale: 'en' })).toBe(
      '/about'
    );
    expect(getPathnameForLocale({ pathname: '/', locale: 'en' })).toBe('/');
  });

  it('prefixes non-default locales', () => {
    expect(getPathnameForLocale({ pathname: '/about', locale: 'fr' })).toBe(
      '/fr/about'
    );
    expect(getPathnameForLocale({ pathname: '/', locale: 'fr' })).toBe('/fr');
  });

  it('preserves the basepath', () => {
    expect(
      getPathnameForLocale({
        pathname: '/app/fr/about',
        locale: 'ar',
        basepath: '/app',
      })
    ).toBe('/app/ar/about');
    expect(
      getPathnameForLocale({
        pathname: '/app/fr/about',
        locale: 'en',
        basepath: '/app',
      })
    ).toBe('/app/about');
    expect(
      getPathnameForLocale({
        pathname: '/app',
        locale: 'fr',
        basepath: '//app//',
      })
    ).toBe('/app/fr');
    expect(
      getPathnameForLocale({
        pathname: '/apple',
        locale: 'fr',
        basepath: '/app',
      })
    ).toBe('/fr/apple');
  });
});
