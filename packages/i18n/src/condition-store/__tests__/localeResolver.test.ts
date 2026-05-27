import { beforeEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import {
  createLocaleResolver,
  determineSupportedLocale,
  resolveSupportedLocale,
} from '../localeResolver';

const customMapping = {
  'brand-french': {
    code: 'fr',
    name: 'Brand French',
  },
};

describe('localeResolver', () => {
  beforeEach(() => {
    initializeI18nConfig();
  });

  it('resolves custom aliases to supported canonical locales', () => {
    expect(
      determineSupportedLocale('brand-french', {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        customMapping,
      })
    ).toBe('fr');
  });

  it('resolves canonical candidates to supported custom aliases', () => {
    expect(
      determineSupportedLocale('fr', {
        defaultLocale: 'en',
        locales: ['en', 'brand-french'],
        customMapping,
      })
    ).toBe('brand-french');
  });

  it('falls back to the default locale when no supported locale matches', () => {
    expect(
      resolveSupportedLocale('de', {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      })
    ).toBe('en');
  });

  it('does not treat undefined config fields as explicit overrides', () => {
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });

    expect(
      determineSupportedLocale('fr', {
        defaultLocale: undefined,
        locales: undefined,
        customMapping: undefined,
      })
    ).toBe('fr');
  });

  it('does not add the default locale to explicit override locales', () => {
    expect(
      determineSupportedLocale('en', {
        defaultLocale: 'en',
        locales: ['fr', 'de'],
      })
    ).toBeUndefined();
  });

  it('creates reusable locale resolvers', () => {
    const resolveLocale = createLocaleResolver({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      customMapping,
    });

    expect(resolveLocale('brand-french')).toBe('fr');
    expect(resolveLocale(undefined)).toBe('en');
  });
});
