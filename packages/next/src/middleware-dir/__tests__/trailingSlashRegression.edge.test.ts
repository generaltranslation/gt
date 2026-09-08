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
