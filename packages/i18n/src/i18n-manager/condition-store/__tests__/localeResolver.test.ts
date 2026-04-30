import { describe, expect, it } from 'vitest';
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
