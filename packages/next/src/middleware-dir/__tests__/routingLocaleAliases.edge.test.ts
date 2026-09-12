// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createNextMiddleware } from '../createNextMiddleware';
type Options = NonNullable<Parameters<typeof createNextMiddleware>[0]>;
const origin = 'https://example.com';
const query = '?tag=a&tag=b&next=%2Faccount';
function configure(defaultLocale = 'en', alias = 'en-gb', code = 'en-GB') {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({
      defaultLocale,
      locales: [...new Set(['en', alias === 'en-gb' ? code : alias, 'fr'])],
      customMapping: { [alias]: { code } },
    })
  );
}
beforeEach(() => {
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'true');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'false');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
  configure();
});
afterEach(() => vi.unstubAllEnvs());
function request(
  path: string,
  {
    cookie,
    reset = false,
    browser,
    basePath = '',
  }: {
    cookie?: string;
    reset?: boolean;
    browser?: string;
    basePath?: string;
  } = {}
) {
  const req = new NextRequest(origin + basePath + path + query, {
    headers: browser ? { 'accept-language': browser } : {},
    nextConfig: { basePath },
  });
  if (cookie) req.cookies.set('generaltranslation.locale', cookie);
  if (reset) req.cookies.set('generaltranslation.locale-reset', 'true');
  return req;
}
function check(
  res: ReturnType<ReturnType<typeof createNextMiddleware>>,
  status: number,
  target?: string,
  kind = 'location'
) {
  expect(res.status).toBe(status);
  expect(res.headers.get(kind)).toBe(target ? origin + target + query : null);
}
const paths: Options['pathConfig'] = {
  '/pricing': { 'en-gb': '/prices', en: '/plans', fr: '/tarifs' },
};
describe('separate lookup and routing locale', () => {
  it('keeps an already correct lowercase alias URL', () =>
    check(createNextMiddleware()(request('/en-gb/pricing')), 200));
  it('redirects a canonical prefix to the configured alias', () =>
    check(
      createNextMiddleware()(request('/en-GB/pricing')),
      307,
      '/en-gb/pricing'
    ));
  it('routes a browser preference through the alias', () =>
    check(
      createNextMiddleware()(request('/pricing', { browser: 'en-GB' })),
      307,
      '/en-gb/pricing'
    ));
  it('routes a reset preference through the alias', () =>
    check(
      createNextMiddleware()(
        request('/fr/pricing', { cookie: 'en-GB', reset: true })
      ),
      307,
      '/en-gb/pricing'
    ));
  it('rewrites an unprefixed default through its alias', () => {
    configure('en-gb');
    check(
      createNextMiddleware()(request('/pricing')),
      200,
      '/en-gb/pricing',
      'x-middleware-rewrite'
    );
  });
  it('prefixes an aliased default when requested', () => {
    configure('en-gb');
    check(
      createNextMiddleware({ prefixDefaultLocale: true })(request('/pricing')),
      307,
      '/en-gb/pricing'
    );
  });
  it('matches a lowercase localized path', () =>
    check(
      createNextMiddleware({ pathConfig: paths })(request('/en-gb/prices')),
      200,
      '/en-gb/pricing',
      'x-middleware-rewrite'
    ));
  it('redirects a canonical localized path to lowercase', () =>
    check(
      createNextMiddleware({ pathConfig: paths })(request('/en-GB/prices')),
      307,
      '/en-gb/prices'
    ));
  it('redirects a shared page to its localized alias', () =>
    check(
      createNextMiddleware({ pathConfig: paths })(request('/en-gb/pricing')),
      307,
      '/en-gb/prices'
    ));
  it('uses alias spelling for both override segments', () =>
    check(
      createNextMiddleware({ routeOverrides: { 'en-gb': ['/pricing'] } })(
        request('/en-gb/pricing')
      ),
      200,
      '/en-gb/en-gb/pricing',
      'x-middleware-rewrite'
    ));
  it('combines localized paths and overrides', () =>
    check(
      createNextMiddleware({
        pathConfig: paths,
        routeOverrides: { 'en-gb': ['/pricing'] },
      })(request('/en-gb/prices')),
      200,
      '/en-gb/en-gb/pricing',
      'x-middleware-rewrite'
    ));
  it('checks allowed aliases against the normalized availability key', () =>
    check(
      createNextMiddleware({
        pathConfig: paths,
        localeRoutes: { 'en-gb': ['/pricing'] },
      })(request('/en-gb/prices')),
      200,
      '/en-gb/pricing',
      'x-middleware-rewrite'
    ));
  it('terminates a rejected aliased locale at the default', () => {
    const mw = createNextMiddleware({
      localeRoutes: { 'en-gb': ['/pricing'] },
    });
    check(mw(request('/en-gb/careers', { cookie: 'en-GB' })), 307, '/careers');
    check(
      mw(request('/careers', { cookie: 'en-GB' })),
      200,
      '/en/careers',
      'x-middleware-rewrite'
    );
  });
  it('uses the default alias for a prefixed fallback', () => {
    configure('en-gb');
    check(
      createNextMiddleware({
        prefixDefaultLocale: true,
        localeRoutes: { fr: [] },
      })(request('/fr/careers', { cookie: 'fr' })),
      307,
      '/en-gb/careers'
    );
  });
  it('preserves catch-all params through aliases and overrides', () =>
    check(
      createNextMiddleware({
        pathConfig: { '/guides/[...slug]': { 'en-gb': '/docs/[...slug]' } },
        routeOverrides: { 'en-gb': ['/guides/[...slug]'] },
      })(request('/en-gb/docs/authors/ernest')),
      200,
      '/en-gb/en-gb/guides/authors/ernest',
      'x-middleware-rewrite'
    ));
  it('preserves basePath, trailing slash, and repeated query', () =>
    check(
      createNextMiddleware({ pathConfig: paths })(
        request('/en-gb/prices/', { basePath: '/portal' })
      ),
      200,
      '/portal/en-gb/pricing/',
      'x-middleware-rewrite'
    ));
  it.each(['qbr', 'uk', 'en_gb'])('preserves an existing %s alias', (alias) => {
    configure('en', alias);
    check(
      createNextMiddleware({ routeOverrides: { [alias]: ['/pricing'] } })(
        request('/' + alias + '/pricing')
      ),
      200,
      '/' + alias + '/' + alias + '/pricing',
      'x-middleware-rewrite'
    );
  });
});

describe('services-disabled approved locale spelling', () => {
  beforeEach(() => {
    vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
    vi.stubEnv(
      '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
      JSON.stringify({
        defaultLocale: 'en-us',
        locales: ['en-us', 'fr'],
      })
    );
  });

  it.each([false, true])(
    'terminates a reset fallback with override=%s',
    (override) => {
      const middleware = createNextMiddleware({
        pathConfig: { '/about': { 'en-us': '/company', fr: '/entreprise' } },
        localeRoutes: { fr: [] },
        routeOverrides: override ? { 'en-us': ['/about'] } : {},
      });
      for (const reset of [true, false]) {
        const response = middleware(
          request('/company', { cookie: 'fr', reset })
        );
        check(
          response,
          200,
          override ? '/en-us/en-us/about' : '/en-us/about',
          'x-middleware-rewrite'
        );
        expect(response.headers.get('x-generaltranslation-locale')).toBe(
          'en-us'
        );
      }
    }
  );
});
