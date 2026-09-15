import { describe, it, expect, beforeEach } from 'vitest';
import { initializeGT } from '../../setup/initializeGT';
import { getRequestLocale } from '../getRequestLocale';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe('getLocale', () => {
  beforeEach(() => {
    resetGTGlobals();
    initializeGT({
      defaultLocale: 'en-US',
      locales: ['en-US', 'es', 'fr', 'ja'],
    });
  });

  it('returns the best matching locale from Accept-Language', () => {
    const request = {
      headers: { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' },
    };
    expect(getRequestLocale(request)).toBe('fr');
  });

  it('returns exact match when available', () => {
    const request = { headers: { 'accept-language': 'en-US' } };
    expect(getRequestLocale(request)).toBe('en-US');
  });

  it('respects quality values', () => {
    const request = { headers: { 'accept-language': 'ja;q=0.5,es;q=0.9' } };
    expect(getRequestLocale(request)).toBe('es');
  });

  it('returns default locale when no match found', () => {
    const request = { headers: { 'accept-language': 'zh-CN,zh;q=0.9' } };
    expect(getRequestLocale(request)).toBe('en-US');
  });

  it('returns default locale when header is missing', () => {
    const request = {
      headers: {} as Record<string, string | string[] | undefined>,
    };
    expect(getRequestLocale(request)).toBe('en-US');
  });

  it('handles array header values', () => {
    const request = {
      headers: { 'accept-language': ['es,en-US;q=0.9', 'fr'] },
    };
    expect(getRequestLocale(request)).toBe('es');
  });

  it('handles wildcard locale', () => {
    const request = { headers: { 'accept-language': '*' } };
    const result = getRequestLocale(request);
    expect(['en-US', 'es', 'fr', 'ja']).toContain(result);
  });

  it('preserves an exact configured alias in request locales', () => {
    resetGTGlobals();
    initializeGT({
      defaultLocale: 'en-US',
      locales: ['en-US', 'fr', 'brand-french'],
      customMapping: {
        'brand-french': {
          code: 'fr',
          name: 'Brand French',
        },
      },
    });

    const request = { headers: { 'accept-language': 'brand-french' } };

    expect(getRequestLocale(request)).toBe('brand-french');
  });

  it.each([
    {
      locales: ['en-US', 'brand-french'],
      header: 'fr,en-US;q=0.8',
      expected: 'brand-french',
    },
    {
      locales: ['en-US', 'brand-french'],
      header: 'fr-FR,fr;q=0.9,en-US;q=0.8',
      expected: 'brand-french',
    },
    {
      locales: ['en-US', 'fr', 'brand-french'],
      header: 'fr,en-US;q=0.8',
      expected: 'fr',
    },
  ])(
    'resolves browser header $header to configured $expected',
    ({ locales, header, expected }) => {
      resetGTGlobals();
      initializeGT({
        defaultLocale: 'en-US',
        locales,
        customMapping: { 'brand-french': { code: 'fr' } },
      });

      expect(getRequestLocale({ headers: { 'accept-language': header } })).toBe(
        expected
      );
    }
  );
});
