// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from '@generaltranslation/react-core/pure';
import { defaultLocaleHeaderName } from '../../utils/headers';
import { createNextMiddleware } from '../createNextMiddleware';

const origin = 'https://example.com';
const query = '?tag=a&tag=b&encoded=%2F%252F';

beforeEach(() => {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'en-GB', 'fr'],
    })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'true');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
});
afterEach(() => vi.unstubAllEnvs());

function request(path: string, reset = false, basePath = '') {
  const req = new NextRequest(origin + basePath + path + query, {
    nextConfig: { basePath },
  });
  req.cookies.set(defaultLocaleCookieName, 'en-GB');
  if (reset) req.cookies.set(defaultResetLocaleCookieName, 'true');
  return req;
}

function expectTarget(
  response: ReturnType<ReturnType<typeof createNextMiddleware>>,
  header: string,
  path: string
) {
  expect(response.headers.get(header)).toBe(origin + path + query);
}

describe('localeRoutes.include', () => {
  it.each([
    '/pricing',
    '/blog',
    '/blog/one/two',
    '/product/123',
    '/legal/terms',
  ])('allows shared path %s', (path) => {
    const middleware = createNextMiddleware({
      localeRoutes: {
        'en-GB': {
          include: [
            '/pricing',
            '/blog/[[...slug]]',
            '/product/[id]',
            '/legal/[...slug]',
          ],
        },
      },
    });
    const response = middleware(request('/en-GB' + path));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get(defaultLocaleHeaderName)).toBe('en-GB');
  });

  it.each([
    '/careers',
    '/pricing/extra',
    '/blogger',
    '/product',
    '/product/1/2',
    '/legal',
  ])('falls back for unavailable path %s', (path) => {
    const middleware = createNextMiddleware({
      localeRoutes: {
        'en-GB': {
          include: [
            '/pricing',
            '/blog/[[...slug]]',
            '/product/[id]',
            '/legal/[...slug]',
          ],
        },
      },
    });
    const response = middleware(request('/en-GB' + path));
    expect(response.status).toBe(307);
    expectTarget(response, 'location', path);
    const terminal = middleware(request(path));
    expect(terminal.headers.get('location')).toBeNull();
    expectTarget(terminal, 'x-middleware-rewrite', '/en' + path);
    expect(terminal.headers.get(defaultLocaleHeaderName)).toBe('en');
    expect(terminal.cookies.get(defaultLocaleCookieName)).toBeUndefined();
  });

  it('does not restrict an omitted locale', () => {
    const middleware = createNextMiddleware({
      localeRoutes: { 'en-GB': { include: [] } },
    });
    const response = middleware(request('/fr/careers'));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get(defaultLocaleHeaderName)).toBe('fr');
  });

  it.each([false, true])(
    'uses default locale as the terminal fallback with prefixDefaultLocale=%s',
    (prefixDefaultLocale) => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale,
        localeRoutes: {
          'en-GB': { include: [] },
          en: { include: [] },
        },
      });
      const path = prefixDefaultLocale ? '/en/careers' : '/careers';
      expectTarget(
        middleware(request('/en-GB/careers', true)),
        'location',
        path
      );
      const terminal = middleware(request(path, true));
      expect(terminal.headers.get('location')).toBeNull();
      expect(terminal.headers.get(defaultLocaleHeaderName)).toBe('en');
      expect(terminal.cookies.get(defaultResetLocaleCookieName)?.value).toBe(
        ''
      );
    }
  );

  it.each([false, true])(
    'preserves base paths, slashes and query with prefixDefaultLocale=%s',
    (prefixDefaultLocale) => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale,
        localeRoutes: { 'en-GB': { include: [] } },
      });
      const path = prefixDefaultLocale ? '/en/careers/' : '/careers/';
      expectTarget(
        middleware(request('/en-GB/careers/', false, '/portal')),
        'location',
        '/portal' + path
      );
      const terminal = middleware(request(path, false, '/portal'));
      expect(terminal.headers.get('location')).toBeNull();
      expect(terminal.headers.get(defaultLocaleHeaderName)).toBe('en');
    }
  );

  it.each(['', '/'])(
    'falls back from the root without a self redirect (slash=%s)',
    (slash) => {
      const middleware = createNextMiddleware({
        localeRoutes: { 'en-GB': { include: [] } },
        routeOverrides: { en: ['/'] },
      });
      expectTarget(middleware(request('/en-GB' + slash)), 'location', '/');
      const terminal = middleware(request('/'));
      expect(terminal.headers.get('location')).toBeNull();
      expectTarget(terminal, 'x-middleware-rewrite', '/en/en');
    }
  );

  it('allows an explicitly listed root', () => {
    const middleware = createNextMiddleware({
      localeRoutes: { 'en-GB': { include: ['/'] } },
    });
    expect(middleware(request('/en-GB')).headers.get('location')).toBeNull();
  });

  it('matches a translated alias against its concrete shared path', () => {
    const middleware = createNextMiddleware({
      localeRoutes: { 'en-GB': { include: ['/blog/first'] } },
      pathConfig: {
        '/blog/[slug]': { 'en-GB': '/stories/[slug]', en: '/articles/[slug]' },
      },
      routeOverrides: { 'en-GB': ['/blog/[slug]'], en: ['/blog/[slug]'] },
    });
    expectTarget(
      middleware(request('/en-GB/stories/first')),
      'x-middleware-rewrite',
      '/en-GB/en-GB/blog/first'
    );
    expectTarget(
      middleware(request('/en-GB/stories/second')),
      'location',
      '/articles/second'
    );
    const terminal = middleware(request('/articles/second'));
    expect(terminal.headers.get('location')).toBeNull();
    expectTarget(terminal, 'x-middleware-rewrite', '/en/en/blog/second');
  });

  it('handles empty and populated optional catchall aliases', () => {
    const middleware = createNextMiddleware({
      localeRoutes: { 'en-GB': { include: [] } },
      pathConfig: {
        '/blog/[[...slug]]': {
          'en-GB': '/stories/[[...slug]]',
          en: '/articles/[[...slug]]',
        },
      },
    });
    for (const tail of ['', '/one/two']) {
      expectTarget(
        middleware(request('/en-GB/stories' + tail)),
        'location',
        '/articles' + tail
      );
      const terminal = middleware(request('/articles' + tail));
      expect(terminal.headers.get('location')).toBeNull();
      expectTarget(terminal, 'x-middleware-rewrite', '/en/blog' + tail);
    }
  });

  it('uses the URL locale to strip the prefix during an allowed locale reset', () => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      localeRoutes: { 'en-GB': { include: ['/pricing'] } },
    });
    expectTarget(
      middleware(request('/fr/pricing', true)),
      'location',
      '/en-GB/pricing'
    );
  });

  it('falls back during a denied locale reset from another locale', () => {
    const middleware = createNextMiddleware({
      localeRoutes: { 'en-GB': { include: ['/pricing'] } },
    });
    expectTarget(
      middleware(request('/fr/careers', true)),
      'location',
      '/careers'
    );
    const terminal = middleware(request('/careers', true));
    expect(terminal.headers.get('location')).toBeNull();
    expectTarget(terminal, 'x-middleware-rewrite', '/en/careers');
  });

  it('falls back for browser language detection without needing a cookie', () => {
    vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'false');
    const middleware = createNextMiddleware({
      localeRoutes: { 'en-GB': { include: [] } },
    });
    const req = new NextRequest(origin + '/careers', {
      headers: { 'accept-language': 'en-GB' },
    });
    const response = middleware(req);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      origin + '/en/careers'
    );
    expect(response.headers.get(defaultLocaleHeaderName)).toBe('en');
  });

  it.each(['/caf%C3%A9', '/product/a%2Fb', '/dollar/%24%26'])(
    'preserves encoded path %s',
    (path) => {
      const middleware = createNextMiddleware({
        localeRoutes: { 'en-GB': { include: [] } },
      });
      expectTarget(middleware(request('/en-GB' + path)), 'location', path);
      expectTarget(
        middleware(request(path)),
        'x-middleware-rewrite',
        '/en' + path
      );
    }
  );

  it.each(['', '/'])(
    'uses the prefixed default root override (slash=%s)',
    (slash) => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
        localeRoutes: { 'en-GB': { include: [] }, en: { include: [] } },
        routeOverrides: { en: ['/'] },
      });
      expectTarget(
        middleware(request('/en-GB' + slash, true)),
        'location',
        '/en' + slash
      );
      const terminal = middleware(request('/en' + slash, true));
      expect(terminal.headers.get('location')).toBeNull();
      expectTarget(terminal, 'x-middleware-rewrite', '/en/en' + slash);
      expect(terminal.cookies.get(defaultResetLocaleCookieName)?.value).toBe(
        ''
      );
    }
  );

  it('terminates on the default alias with a pending reset', () => {
    const middleware = createNextMiddleware({
      localeRoutes: { 'en-GB': { include: [] } },
      pathConfig: { '/careers': { 'en-GB': '/jobs', en: '/opportunities' } },
    });
    expectTarget(
      middleware(request('/en-GB/jobs', true)),
      'location',
      '/opportunities'
    );
    const terminal = middleware(request('/opportunities', true));
    expect(terminal.headers.get('location')).toBeNull();
    expectTarget(terminal, 'x-middleware-rewrite', '/en/careers');
    expect(terminal.cookies.get(defaultResetLocaleCookieName)?.value).toBe('');
  });

  it('standardizes configured locale keys when GT services are enabled', () => {
    vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'true');
    const middleware = createNextMiddleware({
      localeRoutes: { 'EN-gb': { include: [] } },
    });
    expectTarget(middleware(request('/en-GB/careers')), 'location', '/careers');
  });

  it('does not treat an encoded slash as an allowed path boundary', () => {
    const middleware = createNextMiddleware({
      localeRoutes: { 'en-GB': { include: ['/pricing'] } },
    });
    expectTarget(
      middleware(request('/en-GB/pricing%2Fextra')),
      'location',
      '/pricing%2Fextra'
    );
  });

  it('recognizes the shared path behind a universal string alias', () => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      pathConfig: { '/about': '/company' },
      localeRoutes: { fr: { include: ['/about'] } },
    });
    const initial = middleware(request('/fr/about'));
    expectTarget(initial, 'location', '/fr/company');
    const terminal = middleware(request('/fr/company'));
    expect(terminal.headers.get('location')).toBeNull();
    expect(terminal.headers.get(defaultLocaleHeaderName)).toBe('fr');
  });

  it('falls back from a universal string alias to its default URL', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': '/company' },
      localeRoutes: { fr: { include: [] }, 'en-GB': { include: [] } },
    });
    expectTarget(middleware(request('/fr/company')), 'location', '/company');
    const terminal = middleware(request('/company'));
    expect(terminal.headers.get('location')).toBeNull();
    expectTarget(terminal, 'x-middleware-rewrite', '/en/company');
  });

  it('bypasses availability when locale routing is disabled', () => {
    const middleware = createNextMiddleware({
      localeRouting: false,
      localeRoutes: { 'en-GB': { include: [] } },
    });
    const response = middleware(request('/en-GB/careers'));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(response.headers.get(defaultLocaleHeaderName)).toBe('en-GB');
  });

  it('preserves the configured middleware path filter', () => {
    vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '^/public');
    const middleware = createNextMiddleware({
      localeRoutes: { 'en-GB': { include: [] } },
    });
    const response = middleware(request('/en-GB/private'));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get(defaultLocaleHeaderName)).toBeNull();
  });
});
