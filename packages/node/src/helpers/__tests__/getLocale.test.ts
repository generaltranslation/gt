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

  it.each<{
    name: string;
    header: string | string[] | undefined;
    expected: string;
  }>([
    {
      name: 'returns the best matching locale from Accept-Language',
      header: 'fr-FR,fr;q=0.9,en;q=0.8',
      expected: 'fr',
    },
    {
      name: 'returns exact match when available',
      header: 'en-US',
      expected: 'en-US',
    },
    {
      name: 'respects quality values',
      header: 'ja;q=0.5,es;q=0.9',
      expected: 'es',
    },
    {
      name: 'returns default locale when no match found',
      header: 'zh-CN,zh;q=0.9',
      expected: 'en-US',
    },
    {
      name: 'returns default locale when header is missing',
      header: undefined,
      expected: 'en-US',
    },
    {
      name: 'handles array header values',
      header: ['es,en-US;q=0.9', 'fr'],
      expected: 'es',
    },
  ])('$name', ({ header, expected }) => {
    const headers = header === undefined ? {} : { 'accept-language': header };
    expect(getRequestLocale({ headers })).toBe(expected);
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
