// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createNextMiddleware } from '../createNextMiddleware';

const origin = 'http://localhost:3000';
const query = '?tag=a&tag=b';

beforeEach(() => {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({ defaultLocale: 'en', locales: ['en', 'fr'] })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'true');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
});
afterEach(() => vi.unstubAllEnvs());

describe.each([false, true])(
  'encoded locale-like route segments, prefixDefaultLocale=%s',
  (prefixDefaultLocale) => {
    it.each([
      ['%66r', 'articles'],
      ['f%72', 'articles'],
      ['%65n', 'entries'],
      ['e%6E', 'entries'],
      ['%2566r', 'articles'],
      ['bad%escape', 'articles'],
      ['%E0%A4%A', 'articles'],
    ])('preserves category %s and the ID in /%s routes', (category, alias) => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale,
        pathConfig: {
          '/posts/[id]': { en: '/entries/[id]', fr: '/articles/[id]' },
          [`/[category]/${alias}/[id]`]: {
            en: `/[category]/${alias}/[id]`,
          },
        },
      });
      for (const id of ['one', 'value%252Fpart', 'bad%escape']) {
        const path = `/${category}/${alias}/${id}`;
        const response = middleware(new NextRequest(origin + path + query));
        const destination = origin + '/en' + path + query;
        expect(response.headers.get('location')).toBe(
          prefixDefaultLocale ? destination : null
        );
        expect(response.headers.get('x-middleware-rewrite')).toBe(
          prefixDefaultLocale ? null : destination
        );
      }
    });

    it.each(['%66r', 'f%72', 'fr'])(
      'preserves category %s after an actual locale prefix',
      (category) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale,
          pathConfig: {
            '/posts/[id]': { en: '/entries/[id]', fr: '/articles/[id]' },
            '/[category]/articles/[id]': { en: '/[category]/articles/[id]' },
          },
        });
        const response = middleware(
          new NextRequest(`${origin}/fr/${category}/articles/a${query}`)
        );

        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('x-middleware-rewrite')).toBeNull();
        expect(response.headers.get('x-generaltranslation-locale')).toBe('fr');
        expect(
          response.cookies.get('generaltranslation.locale-routing-enabled')
            ?.value
        ).toBe('true');
      }
    );

    it('does not match an exact localized alias after removing the locale prefix', () => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale,
        pathConfig: {
          '/posts': { en: '/entries', fr: '/articles' },
          '/[category]/articles': { en: '/[category]/articles' },
        },
      });
      const response = middleware(
        new NextRequest(`${origin}/fr/%66r/articles${query}`)
      );

      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
      expect(response.headers.get('x-generaltranslation-locale')).toBe('fr');
    });

    it.each(['en', 'fr'])(
      'still recognizes the literal %s prefix',
      (locale) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale,
          pathConfig: {
            '/posts/[id]': { en: '/entries/[id]', fr: '/articles/[id]' },
            '/[category]/articles/[id]': { en: '/[category]/articles/[id]' },
          },
        });
        const alias = locale === 'en' ? 'entries' : 'articles';
        const response = middleware(
          new NextRequest(`${origin}/${locale}/${alias}/one${query}`)
        );
        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('x-middleware-rewrite')).toBe(
          `${origin}/${locale}/posts/one${query}`
        );
      }
    );

    it('does not consume an encoded locale when no unprefixed route matches', () => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale,
        pathConfig: { '/posts/[id]': { fr: '/articles/[id]' } },
      });
      const response = middleware(
        new NextRequest(origin + '/%66r/articles/one' + query)
      );
      const destination = origin + '/en/%66r/articles/one' + query;
      expect(response.headers.get('location')).toBe(
        prefixDefaultLocale ? destination : null
      );
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        prefixDefaultLocale ? null : destination
      );
    });

    it('still normalizes a shared static path beginning with an encoded locale', () => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale,
        pathConfig: {
          '/posts': { fr: '/café' },
          '/fr/café': { en: '/category' },
        },
      });
      const response = middleware(
        new NextRequest(origin + '/%66r/cafe%CC%81' + query)
      );
      expect(response.headers.get('location')).toBe(
        origin + (prefixDefaultLocale ? '/en' : '') + '/category' + query
      );
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    });
  }
);

it('still normalizes unprefixed default aliases and gives them locale precedence', () => {
  const middleware = createNextMiddleware({
    prefixDefaultLocale: false,
    pathConfig: {
      '/posts/[id]': { fr: '/café/[id]' },
      '/categories/[id]/article': {
        en: '/fr/[id]/article',
        fr: '/catégories/[id]/article',
      },
    },
  });
  const response = middleware(
    new NextRequest(origin + '/%66r/cafe%CC%81/article' + query, {
      headers: { cookie: 'generaltranslation.locale=fr' },
    })
  );
  expect(response.headers.get('location')).toBeNull();
  expect(response.headers.get('x-middleware-rewrite')).toBe(
    origin + '/en/categories/cafe%CC%81/article' + query
  );
});
