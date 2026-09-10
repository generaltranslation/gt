// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from '@generaltranslation/react-core/pure';
import { createNextMiddleware } from '../createNextMiddleware';

const origin = 'https://example.com';
const query = '?tag=a&tag=b';

beforeEach(() => {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'en-US', 'en-GB', 'fr'],
    })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'false');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('regional locale alias redirect chains', () => {
  it.each([
    [
      'en-US',
      '/catalog/product/[id]',
      '/store/product/[id]',
      '/catalog/product/widget',
      '/store/product/widget',
    ],
    [
      'en-GB',
      '/catalog/product/[id]',
      '/shop/product/[id]',
      '/catalog/product/widget',
      '/shop/product/widget',
    ],
    ['en-US', '/', '/home', '/', '/home'],
    [
      'en-US',
      '/docs/[[...slug]]',
      '/guides/[[...parts]]',
      '/docs/a/b/',
      '/guides/a/b/',
    ],
  ])(
    'keeps %s distinguishable on %s',
    (locale, shared, localized, pathname, alias) => {
      const middleware = createNextMiddleware({
        pathConfig: { [shared]: { [locale]: localized } },
        routeOverrides: { [locale]: [shared] },
      });
      const headers = { 'accept-language': locale };
      const response = middleware(
        new NextRequest(origin + pathname + query, { headers })
      );
      const destination = origin + '/' + locale + alias + query;
      expect(response.headers.get('location')).toBe(destination);
      const followed = middleware(new NextRequest(destination, { headers }));
      expect(followed.headers.get('location')).toBeNull();
      expect(followed.headers.get('x-middleware-rewrite')).toBe(
        origin +
          '/' +
          locale +
          '/' +
          locale +
          (pathname === '/' ? '' : pathname) +
          query
      );
    }
  );

  it('preserves a regional prefix when resetting from another locale', () => {
    const middleware = createNextMiddleware({
      pathConfig: {
        '/product/[id]': { fr: '/produit/[id]', 'en-US': '/store/[id]' },
      },
    });
    const request = new NextRequest(origin + '/fr/produit/123' + query);
    request.cookies.set(defaultLocaleCookieName, 'en-US');
    request.cookies.set(defaultResetLocaleCookieName, 'true');
    const response = middleware(request);
    expect(response.headers.get('location')).toBe(
      origin + '/en-US/store/123' + query
    );
    const followed = middleware(
      new NextRequest(response.headers.get('location')!)
    );
    expect(followed.headers.get('location')).toBeNull();
    expect(followed.headers.get('x-middleware-rewrite')).toBe(
      origin + '/en-US/product/123' + query
    );
  });

  it('continues to omit the exact default locale for aliases', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/product/[id]': { en: '/store/[id]' } },
    });
    const response = middleware(
      new NextRequest(origin + '/product/123' + query)
    );
    expect(response.headers.get('location')).toBe(
      origin + '/store/123' + query
    );
    const followed = middleware(
      new NextRequest(response.headers.get('location')!)
    );
    expect(followed.headers.get('location')).toBeNull();
    expect(followed.headers.get('x-middleware-rewrite')).toBe(
      origin + '/en/product/123' + query
    );
  });

  it.each([{ fr: '/a-propos' }, { 'en-US': '/about' }])(
    'retains unprefixed regional shared paths for %j',
    (localizedPaths) => {
      const response = createNextMiddleware({
        pathConfig: { '/about': localizedPaths },
      })(
        new NextRequest(origin + '/about' + query, {
          headers: { 'accept-language': 'en-US' },
        })
      );
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        origin + '/en-US/about' + query
      );
    }
  );

  it.each(['en-US', 'en-GB'])(
    'retains existing unconfigured route behavior for %s',
    (locale) => {
      const response = createNextMiddleware()(
        new NextRequest(origin + '/about' + query, {
          headers: { 'accept-language': locale },
        })
      );
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        origin + '/' + locale + '/about' + query
      );
    }
  );
});
