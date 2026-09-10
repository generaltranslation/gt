// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createNextMiddleware } from '../createNextMiddleware';

beforeEach(() => {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'true');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
});
afterEach(() => vi.unstubAllEnvs());

const origin = 'http://localhost:3000';
describe.each([true, false])(
  'prefixDefaultLocale=%s',
  (prefixDefaultLocale) => {
    describe.each(['', '/'])('configured slash="%s"', (configuredSlash) => {
      it.each(['', '/'])('preserves request slash="%s"', (slash) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale,
          pathConfig: {
            ['/about' + configuredSlash]: {
              en: '/company' + configuredSlash,
              fr: '/a-propos' + configuredSlash,
            },
            ['/posts/[id]' + configuredSlash]: {
              en: '/entries/[id]' + configuredSlash,
              fr: '/articles/[id]' + configuredSlash,
            },
          },
        });
        for (const locale of ['en', 'fr']) {
          const prefix =
            locale === 'en' && !prefixDefaultLocale ? '' : '/' + locale;
          const aliases =
            locale === 'en'
              ? ['/company', '/entries/123']
              : ['/a-propos', '/articles/123'];
          for (const [index, shared] of ['/about', '/posts/123'].entries()) {
            const publicPath = prefix + aliases[index] + slash;
            const response = middleware(
              new NextRequest(origin + publicPath + '?tag=a&tag=b')
            );
            expect(response.headers.get('location')).toBeNull();
            expect(response.headers.get('x-middleware-rewrite')).toBe(
              origin + '/' + locale + shared + slash + '?tag=a&tag=b'
            );
            const redirect = middleware(
              new NextRequest(origin + prefix + shared + slash)
            );
            expect(redirect.headers.get('location')).toBe(origin + publicPath);
          }
        }
      });
    });
  }
);

it('keeps the locale landing slash when matching the shared root', () => {
  const middleware = createNextMiddleware({
    prefixDefaultLocale: true,
    pathConfig: { '/': { fr: '/home' } },
  });
  const response = middleware(new NextRequest(origin + '/fr/'));
  expect(response.headers.get('location')).toBe(origin + '/fr/home/');
});

describe.each([true, false])(
  'locale root routing, prefixDefaultLocale=%s',
  (prefixDefaultLocale) => {
    it('resolves a localized root alias and preserves repeated query values', () => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale,
        pathConfig: { '/landing/': { en: '/home/', fr: '/' } },
      });
      const response = middleware(new NextRequest(origin + '/fr/?tag=a&tag=b'));
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        origin + '/fr/landing/?tag=a&tag=b'
      );
    });

    it('prefers the localized root alias over an unrelated shared root', () => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale,
        pathConfig: {
          '/': { fr: '/accueil/' },
          '/landing/': { fr: '/' },
        },
      });
      const response = middleware(new NextRequest(origin + '/fr/'));
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        origin + '/fr/landing/'
      );
    });

    it('does not use the locale as a missing root slug', () => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale,
        pathConfig: { '/[slug]': { en: '/[slug]', fr: '/[slug]' } },
      });
      const response = middleware(new NextRequest(origin + '/fr/?tag=a&tag=b'));
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
      expect(response.headers.get('x-middleware-next')).toBe('1');
    });

    it.each(['', '/'])(
      'still resolves a real root slug, slash="%s"',
      (slash) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale,
          pathConfig: { '/[slug]/edit': { fr: '/[slug]/modifier' } },
        });
        const response = middleware(
          new NextRequest(
            origin + '/fr/hello%2Fworld/edit' + slash + '?tag=a&tag=b'
          )
        );
        expect(response.headers.get('location')).toBe(
          origin + '/fr/hello%2Fworld/modifier' + slash + '?tag=a&tag=b'
        );
        const localizedResponse = middleware(
          new NextRequest(
            origin + '/fr/hello%2Fworld/modifier' + slash + '?tag=a&tag=b'
          )
        );
        expect(localizedResponse.headers.get('location')).toBeNull();
        expect(localizedResponse.headers.get('x-middleware-rewrite')).toBe(
          origin + '/fr/hello%2Fworld/edit' + slash + '?tag=a&tag=b'
        );
      }
    );
  }
);
