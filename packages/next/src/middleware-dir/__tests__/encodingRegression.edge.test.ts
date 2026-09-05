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
const request = (path: string) => new NextRequest(origin + path);

describe.each([true, false])(
  'encoded paths, prefixDefaultLocale=%s',
  (prefixDefaultLocale) => {
    it.each([
      'a%252Fb',
      '100%25',
      'a%5Cb',
      'a%0Ab',
      'a%09b',
      'a%0Db',
      'a%2Fb',
      'a%3Fb',
      'a%23b',
      'a%26b',
      '%C3%A9',
      'e%CC%81',
      'a%255Cb',
      '%252e%252e',
      '%E0%A4%A',
      'bad%escape',
    ])(
      'preserves parameter bytes for %s through redirects and rewrites',
      (value) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale,
          pathConfig: {
            '/posts/[id]': { en: '/entries/[id]', fr: '/articles/[id]' },
          },
        });
        for (const locale of ['en', 'fr']) {
          const prefix =
            locale === 'en' && !prefixDefaultLocale ? '' : '/' + locale;
          const alias = locale === 'en' ? '/entries/' : '/articles/';
          const publicPath = prefix + alias + value;
          const response = middleware(request(publicPath + '?tag=a&tag=b'));
          expect(response.headers.get('location')).toBeNull();
          expect(response.headers.get('x-middleware-rewrite')).toBe(
            origin + '/' + locale + '/posts/' + value + '?tag=a&tag=b'
          );
          const redirect = middleware(
            request(prefix + '/posts/' + value + '?tag=a&tag=b')
          );
          expect(redirect.headers.get('location')).toBe(
            origin + publicPath + '?tag=a&tag=b'
          );
        }
      }
    );

    it.each(['/notes%5Bfr%5D', '/cafe\u0301', '/café', '/c++', '/100%25'])(
      'terminates for encoded or Unicode static template %s',
      (alias) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale,
          pathConfig: { '/docs': { en: alias, fr: alias } },
        });
        for (const locale of ['en', 'fr']) {
          const prefix =
            locale === 'en' && !prefixDefaultLocale ? '' : '/' + locale;
          const response = middleware(request(prefix + alias));
          expect(response.headers.get('location')).toBeNull();
          expect(response.headers.get('x-middleware-rewrite')).toBe(
            origin + '/' + locale + '/docs'
          );
        }
      }
    );
  }
);

it('does not decode a double-encoded static segment twice', () => {
  const middleware = createNextMiddleware({
    prefixDefaultLocale: true,
    pathConfig: { '/docs/[id]': { fr: '/café/[id]' } },
  });
  const response = middleware(request('/fr/caf%25C3%25A9/123'));
  expect(response.headers.get('location')).toBeNull();
  expect(response.headers.get('x-middleware-rewrite')).toBeNull();
});

it.each(['%5Bid%5D', '%5B...slug%5D', '%5B%5B...slug%5D%5D'])(
  'does not promote encoded literal %s into a dynamic route',
  (literal) => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      pathConfig: { '/docs': { fr: '/' + literal } },
    });
    const unrelated = middleware(request('/fr/unrelated'));
    expect(unrelated.headers.get('location')).toBeNull();
    expect(unrelated.headers.get('x-middleware-rewrite')).toBeNull();
    const matched = middleware(request('/fr/' + literal));
    expect(matched.headers.get('location')).toBeNull();
    expect(matched.headers.get('x-middleware-rewrite')).toBe(
      origin + '/fr/docs'
    );
  }
);

it('keeps encoded shared literals ahead of localized dynamic aliases', () => {
  const middleware = createNextMiddleware({
    prefixDefaultLocale: true,
    pathConfig: {
      '/%5Bid%5D': { en: '/%5Bid%5D' },
      '/docs/[slug]': { fr: '/[slug]' },
    },
  });
  const response = middleware(request('/fr/%5Bid%5D'));
  expect(response.headers.get('location')).toBeNull();
  expect(response.headers.get('x-middleware-rewrite')).toBeNull();
});
