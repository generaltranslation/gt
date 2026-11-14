// @vitest-environment edge-runtime
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, type NextResponse } from 'next/server';
import { GTIntl } from 'generaltranslation/internal';
import {
  defaultLocaleCookieName as LOCALE_COOKIE,
  defaultResetLocaleCookieName as RESET_COOKIE,
} from 'gt-i18n/internal/cookies';
import {
  defaultLocaleRoutingEnabledCookieName as ROUTING_COOKIE,
  defaultReferrerLocaleCookieName as REFERRER_COOKIE,
} from '../../utils/cookies';
import { defaultLocaleHeaderName as LOCALE_HEADER } from '../../utils/headers';
import { createNextMiddleware } from '../createNextMiddleware';
import { splitMiddlewareConfig } from '../defaultMiddlewareConfig';
import { resolveMiddlewareConfig } from '../resolveMiddlewareConfig';
import type { MiddlewareConfig, RouteOverrides } from '../types';
import {
  createPathMatcher,
  type PathConfig,
  type PathMatcher,
} from '../createPathMatcher';
import { getLocaleFromRequest } from '../utils';
import { stubRoutingEnv, useRoutingEnv } from './routingTestUtils';

const origin = 'https://example.com';

type Cookies = Record<string, string>;
type Middleware = ReturnType<typeof createNextMiddleware>;

useRoutingEnv({ locales: ['en', 'fr', 'es', 'de'] });

function request(
  path: string,
  {
    browser,
    cookies = {},
    basePath = '',
    trailingSlash,
    destination,
  }: {
    browser?: string;
    cookies?: Cookies;
    basePath?: string;
    trailingSlash?: boolean;
    destination?: string;
  } = {}
) {
  const req = new NextRequest(origin + basePath + path, {
    headers: browser ? { 'accept-language': browser } : {},
    nextConfig: { basePath, trailingSlash },
  });
  if (destination !== undefined) req.headers.set('sec-fetch-dest', destination);
  for (const [name, value] of Object.entries(cookies))
    req.cookies.set(name, value);
  return req;
}

function target(
  response: Response,
  header: 'location' | 'x-middleware-rewrite'
) {
  const value = response.headers.get(header);
  return value ? new URL(value) : undefined;
}

/** Summarizes where a response sends the request, including its query. */
function routeOf(response: Response) {
  const redirect = target(response, 'location');
  const rewrite = target(response, 'x-middleware-rewrite');
  if (response.status === 307 && redirect) {
    return { type: 'redirect', path: redirect.pathname + redirect.search };
  }
  if (rewrite) {
    return { type: 'rewrite', path: rewrite.pathname + rewrite.search };
  }
  return {
    type:
      response.headers.get('x-middleware-next') === '1' ? 'next' : 'unknown',
  };
}

function expectRedirect(response: Response, path: string) {
  expect(response.status).toBe(307);
  expect(target(response, 'location')?.pathname).toBe(path);
}

describe('single-pass routing', () => {
  it('rewrites an unprefixed default-locale path to its locale route', () => {
    const res = createNextMiddleware()(request('/about'));

    expect(routeOf(res)).toEqual({ type: 'rewrite', path: '/en/about' });
    expect(res.headers.get(LOCALE_HEADER)).toBe('en');
    expect(res.cookies.get(ROUTING_COOKIE)?.value).toBe('true');
  });

  it.each([
    { path: '/en/about', locale: 'en', prefixDefaultLocale: true },
    { path: '/fr/about', locale: 'fr', prefixDefaultLocale: false },
  ])(
    'continues for a correctly prefixed $path',
    ({ path, locale, prefixDefaultLocale }) => {
      const res = createNextMiddleware({ prefixDefaultLocale })(request(path));

      expect(routeOf(res)).toEqual({ type: 'next' });
      expect(res.headers.get(LOCALE_HEADER)).toBe(locale);
    }
  );

  it.each([
    { path: '/fr/a-propos', destination: '/fr/about', locale: 'fr' },
    { path: '/about-us', destination: '/en/about', locale: 'en' },
  ])(
    'rewrites the localized pathConfig path $path to its shared route',
    ({ path, destination, locale }) => {
      const res = createNextMiddleware({
        pathConfig: { '/about': { en: '/about-us', fr: '/a-propos' } },
      })(request(path));

      expect(routeOf(res)).toEqual({ type: 'rewrite', path: destination });
      expect(res.headers.get(LOCALE_HEADER)).toBe(locale);
    }
  );

  it('supports catch-all and optional catch-all pathConfig routes', () => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      pathConfig: {
        '/docs/[...slug]': { fr: '/knowledge/base/[...slug]' },
        '/news/[[...slug]]': { fr: '/international/actualites/[[...slug]]' },
      },
    });

    expect(
      routeOf(middleware(request('/fr/knowledge/base/guides/start')))
    ).toEqual({ type: 'rewrite', path: '/fr/docs/guides/start' });
    expect(routeOf(middleware(request('/fr/docs/guides/start')))).toEqual({
      type: 'redirect',
      path: '/fr/knowledge/base/guides/start',
    });
    expect(
      routeOf(middleware(request('/fr/international/actualites')))
    ).toEqual({ type: 'rewrite', path: '/fr/news' });
    expect(
      routeOf(middleware(request('/fr/international/actualites/world/latest')))
    ).toEqual({ type: 'rewrite', path: '/fr/news/world/latest' });
  });

  it('treats regex metacharacters in dynamic paths literally', () => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      pathConfig: {
        '/releases/v1.0/[slug]': { fr: '/versions/v1.0/[slug]' },
        '/language/c++/[slug]': { fr: '/langage/c++/[slug]' },
      },
    });

    expect(routeOf(middleware(request('/fr/versions/v1.0/notes')))).toEqual({
      type: 'rewrite',
      path: '/fr/releases/v1.0/notes',
    });
    expect(routeOf(middleware(request('/fr/versions/v1x0/notes')))).toEqual({
      type: 'next',
    });
    expect(routeOf(middleware(request('/fr/langage/c++/templates')))).toEqual({
      type: 'rewrite',
      path: '/fr/language/c++/templates',
    });
  });

  it('only detects the locale when localeRouting is false', () => {
    const res = createNextMiddleware({ localeRouting: false })(
      request('/some/path')
    );

    expect(routeOf(res)).toEqual({ type: 'next' });
    expect(res.headers.get(LOCALE_HEADER)).toBe('en');
    expect(res.cookies.get(ROUTING_COOKIE)?.value).toBe('false');
  });

  it('skips Next.js source map requests entirely', () => {
    const res = createNextMiddleware({ ignoreSourceMaps: true })(
      request('/__nextjs_source-map/main.js')
    );

    expect(routeOf(res)).toEqual({ type: 'next' });
    expect(res.headers.get(LOCALE_HEADER)).toBeNull();
  });

  it('applies i18n routing only to paths matching pathRegex', () => {
    vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '^/(?!excluded(?:/|$)).*');
    const middleware = createNextMiddleware();

    expect(routeOf(middleware(request('/about')))).toEqual({
      type: 'rewrite',
      path: '/en/about',
    });
    const excluded = middleware(request('/excluded/about'));
    expect(routeOf(excluded)).toEqual({ type: 'next' });
    expect(excluded.headers.get(LOCALE_HEADER)).toBeNull();
    expect(excluded.cookies.get(ROUTING_COOKIE)).toBeUndefined();
  });

  it('throws a descriptive error for an invalid pathRegex', () => {
    vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '[unclosed');

    expect(() => createNextMiddleware()).toThrowError(
      'gt-next Error: pathRegex "[unclosed" is not a valid regular expression.'
    );
  });
});

describe('redirects', () => {
  const pathConfig: PathConfig = {
    '/about': { en: '/about-us', fr: '/a-propos' },
  };

  it.each([
    {
      name: 'a reset to the unprefixed default locale',
      path: '/fr/about',
      cookies: { [LOCALE_COOKIE]: 'en', [RESET_COOKIE]: 'true' },
      destination: '/about',
    },
    {
      name: 'a reset to another locale',
      options: { prefixDefaultLocale: true },
      path: '/en/about',
      cookies: { [LOCALE_COOKIE]: 'fr', [RESET_COOKIE]: 'true' },
      destination: '/fr/about',
    },
    {
      name: 'a non-default locale cookie on an unprefixed path',
      path: '/about',
      cookies: { [LOCALE_COOKIE]: 'fr' },
      destination: '/fr/about',
    },
    {
      name: 'a reset between localized pathConfig paths',
      options: { prefixDefaultLocale: true, pathConfig },
      path: '/en/about-us',
      cookies: { [LOCALE_COOKIE]: 'fr', [RESET_COOKIE]: 'true' },
      destination: '/fr/a-propos',
    },
    {
      name: 'a shared path that has a localized pathConfig path',
      options: { prefixDefaultLocale: true, pathConfig },
      path: '/fr/about',
      cookies: { [LOCALE_COOKIE]: 'fr' },
      destination: '/fr/a-propos',
    },
    {
      name: 'a referrer locale cookie',
      path: '/docs',
      cookies: { [REFERRER_COOKIE]: 'fr' },
      destination: '/fr/docs',
    },
  ] as {
    name: string;
    options?: MiddlewareConfig;
    path: string;
    cookies: Cookies;
    destination: string;
  }[])('redirects for $name', ({ options, path, cookies, destination }) => {
    const res = createNextMiddleware(options)(request(path, { cookies }));

    expect(routeOf(res)).toEqual({ type: 'redirect', path: destination });
  });
});

describe('response properties', () => {
  it('preserves the query string on rewrites and redirects', () => {
    const middleware = createNextMiddleware();

    expect(routeOf(middleware(request('/about?foo=bar&baz=1')))).toEqual({
      type: 'rewrite',
      path: '/en/about?foo=bar&baz=1',
    });
    const redirect = middleware(
      request('/about?page=2', { cookies: { [LOCALE_COOKIE]: 'fr' } })
    );
    expect(routeOf(redirect)).toEqual({
      type: 'redirect',
      path: '/fr/about?page=2',
    });
    expect(redirect.headers.get(LOCALE_HEADER)).toBe('fr');
  });

  it('preserves basePath on rewrites and redirects', () => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      pathConfig: { '/about': { fr: '/a-propos' } },
    });

    expect(
      routeOf(
        middleware(request('/fr/a-propos?preview=true', { basePath: '/corp' }))
      )
    ).toEqual({ type: 'rewrite', path: '/corp/fr/about?preview=true' });
    expect(
      routeOf(middleware(request('/fr/about', { basePath: '/corp' })))
    ).toEqual({ type: 'redirect', path: '/corp/fr/a-propos' });
  });

  it('clears the reset cookie on the final response only, keeping the locale cookie', () => {
    const middleware = createNextMiddleware({ prefixDefaultLocale: true });
    const cookies = { [LOCALE_COOKIE]: 'fr', [RESET_COOKIE]: 'true' };

    // The reset cookie persists across the redirect to the new locale.
    const redirect = middleware(request('/en/about', { cookies }));
    expect(routeOf(redirect)).toEqual({ type: 'redirect', path: '/fr/about' });
    expect(redirect.headers.get('set-cookie') || '').not.toContain(
      `${RESET_COOKIE}=;`
    );

    const final = middleware(request('/fr/about', { cookies }));
    expect(routeOf(final)).toEqual({ type: 'next' });
    const setCookie = final.headers.get('set-cookie') || '';
    expect(setCookie).toContain(`${RESET_COOKIE}=;`);
    // The locale cookie must survive: the client re-reads it on every
    // render, and deleting it races with concurrent prefetch responses
    // after a locale switch.
    expect(setCookie).not.toContain(`${LOCALE_COOKIE}=;`);
  });
});

describe('getLocaleFromRequest', () => {
  function resolveLocale(
    req: NextRequest,
    defaultLocalePaths: PathMatcher = createPathMatcher([]),
    defaultLocale = 'en',
    locales = ['en', 'fr', 'es', 'de']
  ) {
    return getLocaleFromRequest(
      req,
      defaultLocale,
      true,
      false,
      defaultLocalePaths,
      REFERRER_COOKIE,
      LOCALE_COOKIE,
      RESET_COOKIE,
      new GTIntl({ locales })
    );
  }

  it.each([
    {
      name: 'uses the pathname locale',
      path: '/fr/about',
      expected: { userLocale: 'fr', pathnameLocale: 'fr' },
    },
    {
      name: 'prefers the pathname locale over the locale cookie',
      path: '/fr/about',
      cookies: { [LOCALE_COOKIE]: 'de' },
      expected: { userLocale: 'fr', pathnameLocale: 'fr' },
    },
    {
      name: 'lets a reset cookie override the pathname locale',
      path: '/fr/about',
      cookies: { [LOCALE_COOKIE]: 'es', [RESET_COOKIE]: 'true' },
      expected: {
        userLocale: 'es',
        pathnameLocale: 'fr',
        clearResetCookie: true,
      },
    },
    {
      name: 'uses the locale cookie on an unprefixed path',
      path: '/about',
      cookies: { [LOCALE_COOKIE]: 'de' },
      expected: { userLocale: 'de' },
    },
    {
      name: 'uses the referrer cookie',
      path: '/about',
      cookies: { [REFERRER_COOKIE]: 'fr' },
      expected: { userLocale: 'fr' },
    },
    {
      name: 'ignores the referrer cookie during a reset',
      path: '/about',
      cookies: {
        [LOCALE_COOKIE]: 'en',
        [RESET_COOKIE]: 'true',
        [REFERRER_COOKIE]: 'fr',
      },
      expected: { userLocale: 'en', clearResetCookie: true },
    },
    {
      name: 'negotiates Accept-Language when browser locales are enabled',
      path: '/about',
      browser: 'es-ES,es;q=0.9,en;q=0.8',
      browserLocales: true,
      expected: { userLocale: 'es' },
    },
    {
      name: 'falls back to the default locale without signals',
      path: '/about',
      expected: { userLocale: 'en' },
    },
    {
      name: 'ignores an invalid pathname locale',
      path: '/notavalidlocale/page',
      expected: { userLocale: 'en' },
    },
  ] as {
    name: string;
    path: string;
    cookies?: Cookies;
    browser?: string;
    browserLocales?: boolean;
    expected: object;
  }[])('$name', ({ path, cookies, browser, browserLocales, expected }) => {
    stubRoutingEnv({ browserLocales });

    expect(resolveLocale(request(path, { cookies, browser }))).toMatchObject({
      pathnameLocale: undefined,
      clearResetCookie: false,
      ...expected,
    });
  });

  it('gives an unprefixed default-locale path priority over the locale cookie', () => {
    const req = request('/about-us', { cookies: { [LOCALE_COOKIE]: 'fr' } });

    expect(resolveLocale(req).userLocale).toBe('fr');
    expect(
      resolveLocale(req, createPathMatcher([['/about-us', '/about']]))
        .userLocale
    ).toBe('en');
  });

  it('prefers a same-script match over the default locale in the same language', () => {
    stubRoutingEnv({ browserLocales: true });

    expect(
      resolveLocale(request('/', { browser: 'zh-Hant' }), undefined, 'zh-CN', [
        'zh-CN',
        'zh-TW',
      ]).userLocale
    ).toBe('zh-TW');
  });

  it('matches a header preference with extension subtags', () => {
    stubRoutingEnv({ browserLocales: true });

    expect(
      resolveLocale(
        request('/', { browser: 'fr-CA-u-nu-latn' }),
        undefined,
        'en',
        ['en', 'fr-FR']
      ).userLocale
    ).toBe('fr-FR');
  });
});

describe('middleware config', () => {
  function stubMiddlewareEnv(config: MiddlewareConfig | string) {
    vi.stubEnv(
      '_GENERALTRANSLATION_MIDDLEWARE_CONFIG',
      typeof config === 'string' ? config : JSON.stringify(config)
    );
  }

  beforeEach(() => vi.stubEnv('_GENERALTRANSLATION_MIDDLEWARE_CONFIG', ''));

  describe('splitMiddlewareConfig', () => {
    it('separates set middleware options from the rest of the config', () => {
      const { middlewareConfig, otherConfig } = splitMiddlewareConfig({
        prefixDefaultLocale: true,
        enableSmartRouting: undefined,
        pathConfig: { '/about': { fr: '/a-propos' } },
        defaultLocale: 'en',
      });

      expect(middlewareConfig).toEqual({
        prefixDefaultLocale: true,
        pathConfig: { '/about': { fr: '/a-propos' } },
      });
      expect(otherConfig).toEqual({ defaultLocale: 'en' });
    });
  });

  describe('resolveMiddlewareConfig', () => {
    it('uses the library defaults without env or options', () => {
      expect(resolveMiddlewareConfig()).toEqual({
        localeRouting: true,
        prefixDefaultLocale: false,
        enableSmartRouting: true,
        ignoreSourceMaps: true,
        pathConfig: {},
        routeOverrides: {},
        localeRoutes: {},
      });
    });

    it('uses withGTConfig options from the env over the defaults', () => {
      stubMiddlewareEnv({
        prefixDefaultLocale: true,
        enableSmartRouting: false,
      });

      expect(resolveMiddlewareConfig()).toMatchObject({
        prefixDefaultLocale: true,
        enableSmartRouting: false,
        localeRouting: true,
      });
    });

    it('uses createNextMiddleware options over the env', () => {
      stubMiddlewareEnv({
        prefixDefaultLocale: true,
        localeRoutes: { fr: [] },
      });

      expect(
        resolveMiddlewareConfig({
          prefixDefaultLocale: false,
          localeRoutes: {},
        })
      ).toMatchObject({ prefixDefaultLocale: false, localeRoutes: {} });
    });

    it('treats undefined createNextMiddleware options as unset', () => {
      stubMiddlewareEnv({ prefixDefaultLocale: true });

      expect(
        resolveMiddlewareConfig({ prefixDefaultLocale: undefined })
      ).toMatchObject({ prefixDefaultLocale: true });
    });

    it('ignores unknown env keys', () => {
      stubMiddlewareEnv(JSON.stringify({ unknown: true }));

      expect(resolveMiddlewareConfig()).not.toHaveProperty('unknown');
    });
  });

  describe('createNextMiddleware config precedence', () => {
    it('routes with withGTConfig options from the env', () => {
      stubMiddlewareEnv({ prefixDefaultLocale: true });

      const response = createNextMiddleware()(
        new NextRequest(`${origin}/about`)
      );

      expect(response.headers.get('location')).toBe(`${origin}/en/about`);
    });

    it('routes with createNextMiddleware options over the env', () => {
      stubMiddlewareEnv({ prefixDefaultLocale: true });

      const response = createNextMiddleware({ prefixDefaultLocale: false })(
        new NextRequest(`${origin}/about`)
      );

      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        `${origin}/en/about`
      );
    });
  });

  describe('createNextMiddleware Link routing warning', () => {
    beforeEach(() => vi.stubEnv('NODE_ENV', 'development'));

    it('warns when Link cannot see a middleware-only routing option', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      createNextMiddleware({ prefixDefaultLocale: true });

      expect(warn).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('prefixDefaultLocale')
      );
      warn.mockRestore();
    });

    it('does not warn when withGTConfig sets the same options', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      stubMiddlewareEnv({ prefixDefaultLocale: true });

      createNextMiddleware({ prefixDefaultLocale: true, localeRoutes: {} });

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});

describe('smart routing', () => {
  beforeEach(() =>
    stubRoutingEnv({ locales: ['en', 'fr', 'es'], browserLocales: true })
  );

  function carryCookies(response: NextResponse, cookies: Cookies): Cookies {
    const next = { ...cookies };
    for (const cookie of response.cookies.getAll()) {
      if (!cookie.value || cookie.maxAge === 0) delete next[cookie.name];
      else next[cookie.name] = cookie.value;
    }
    return next;
  }

  function followRedirect(
    middleware: Middleware,
    response: NextResponse,
    cookies: Cookies,
    options: Parameters<typeof request>[1] = {}
  ) {
    const url = target(response, 'location')!;
    return middleware(
      request(url.pathname + url.search, {
        ...options,
        cookies: carryCookies(response, cookies),
      })
    );
  }

  describe('smart routing disabled', () => {
    it.each(['/', '/docs/guides/install'])(
      'uses the default locale for an ordinary unprefixed %s despite a locale cookie',
      (path) => {
        const response = createNextMiddleware({ enableSmartRouting: false })(
          request(path, { cookies: { [LOCALE_COOKIE]: 'fr' } })
        );

        expect(response.status).toBe(200);
        expect(target(response, 'x-middleware-rewrite')?.pathname).toBe(
          '/en' + path
        );
        expect(response.headers.get(LOCALE_HEADER)).toBe('en');
      }
    );

    it('uses browser locales only when no locale cookie exists, even on a default alias', () => {
      const pathConfig: PathConfig = {
        '/blog': { en: '/articles', fr: '/histoires' },
      };
      const middleware = createNextMiddleware({
        enableSmartRouting: false,
        pathConfig,
      });

      expectRedirect(
        middleware(request('/articles', { browser: 'fr-FR,fr;q=0.9' })),
        '/fr/histoires'
      );
      const returning = middleware(
        request('/articles', { cookies: { [LOCALE_COOKIE]: 'fr' } })
      );
      expect(returning.headers.get('location')).toBeNull();
      expect(target(returning, 'x-middleware-rewrite')?.pathname).toBe(
        '/en/blog'
      );
    });

    it('honors ignoreBrowserLocales when an ordinary route has no cookie', () => {
      stubRoutingEnv({ locales: ['en', 'fr', 'es'] });
      const response = createNextMiddleware({ enableSmartRouting: false })(
        request('/blog', { browser: 'fr-FR,fr;q=0.9' })
      );

      expect(response.status).toBe(200);
      expect(target(response, 'x-middleware-rewrite')?.pathname).toBe(
        '/en/blog'
      );
      expect(response.headers.get(LOCALE_HEADER)).toBe('en');
    });

    it('lets a reset locale override an unprefixed default route', () => {
      const response = createNextMiddleware({ enableSmartRouting: false })(
        request('/blog', {
          cookies: { [LOCALE_COOKIE]: 'fr', [RESET_COOKIE]: 'true' },
        })
      );

      expectRedirect(response, '/fr/blog');
      expect(response.headers.get(LOCALE_HEADER)).toBe('fr');
    });

    it('honors an explicit locale prefix unless a reset cookie changes it', () => {
      const middleware = createNextMiddleware({ enableSmartRouting: false });

      expect(
        middleware(request('/fr/blog', { cookies: { [LOCALE_COOKIE]: 'en' } }))
          .status
      ).toBe(200);
      expectRedirect(
        middleware(
          request('/fr/blog', {
            cookies: { [LOCALE_COOKIE]: 'en', [RESET_COOKIE]: 'true' },
          })
        ),
        '/blog'
      );
    });

    it('removes an explicit default prefix and carries that intent through the next request', () => {
      const middleware = createNextMiddleware({ enableSmartRouting: false });
      const initialCookies = {};
      const first = middleware(
        request('/en/blog?tag=a&tag=b', {
          browser: 'fr',
          cookies: initialCookies,
          destination: 'document',
        })
      );

      expectRedirect(first, '/blog');
      expect(target(first, 'location')?.search).toBe('?tag=a&tag=b');
      expect(first.cookies.get(LOCALE_COOKIE)?.value).toBe('en');

      const second = followRedirect(middleware, first, initialCookies, {
        browser: 'fr',
      });
      expect(second.headers.get('location')).toBeNull();
      expect(target(second, 'x-middleware-rewrite')?.pathname).toBe('/en/blog');
      expect(second.headers.get(LOCALE_HEADER)).toBe('en');
    });

    it('preserves an explicit default root on a first document visit', () => {
      const middleware = createNextMiddleware({ enableSmartRouting: false });
      const first = middleware(
        request('/en', { browser: 'fr', destination: 'document' })
      );

      expectRedirect(first, '/');
      expect(first.cookies.get(LOCALE_COOKIE)?.value).toBe('en');
      const second = followRedirect(middleware, first, {}, { browser: 'fr' });
      expect(second.headers.get('location')).toBeNull();
      expect(second.headers.get(LOCALE_HEADER)).toBe('en');
    });

    it.each([
      { destination: 'empty', cookie: undefined },
      { destination: 'empty', cookie: 'fr' },
      { destination: undefined, cookie: undefined },
      { destination: 'document', cookie: 'fr' },
      { destination: 'document', cookie: 'en' },
      { destination: 'document', cookie: '' },
    ])(
      'does not write the locale cookie for destination=$destination, cookie=$cookie',
      ({ destination, cookie }) => {
        const cookies = cookie === undefined ? {} : { [LOCALE_COOKIE]: cookie };
        const middleware = createNextMiddleware({ enableSmartRouting: false });
        const response = middleware(
          request('/en', { browser: 'fr', destination, cookies })
        );

        expectRedirect(response, '/');
        expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
        if (cookie) {
          const next = followRedirect(middleware, response, cookies, {
            browser: 'fr',
          });
          expect(next.headers.get('location')).toBeNull();
          expect(next.headers.get(LOCALE_HEADER)).toBe('en');
          expect(next.cookies.get(LOCALE_COOKIE)).toBeUndefined();
        }
      }
    );

    it.each(['en+us', 'en[us'])(
      'strips a default alias %s literally for plain paths and localized aliases',
      (defaultLocale) => {
        stubRoutingEnv({
          defaultLocale,
          locales: [defaultLocale, 'fr'],
          customMapping: { [defaultLocale]: { code: 'en-US' } },
          browserLocales: true,
        });
        for (const pathConfig of [
          {},
          { '/blog': { [defaultLocale]: '/articles' } },
        ]) {
          const middleware = createNextMiddleware({
            enableSmartRouting: false,
            pathConfig,
          });
          const first = middleware(
            request(`/${defaultLocale}/blog`, {
              browser: 'fr',
              destination: 'document',
            })
          );
          expectRedirect(
            first,
            Object.keys(pathConfig).length ? '/articles' : '/blog'
          );
          const second = followRedirect(
            middleware,
            first,
            {},
            { browser: 'fr' }
          );
          expect(second.headers.get('location')).toBeNull();
          expect(target(second, 'x-middleware-rewrite')?.pathname).toBe(
            `/${defaultLocale}/blog`
          );
        }
      }
    );

    it('keeps default routing through aliases, route overrides, and availability fallbacks', () => {
      const pathConfig: PathConfig = {
        '/blog/[slug]': { en: '/articles/[slug]', fr: '/histoires/[slug]' },
      };
      const routeOverrides: RouteOverrides = { en: ['/blog/[slug]'] };
      const middleware = createNextMiddleware({
        enableSmartRouting: false,
        pathConfig,
        routeOverrides,
        localeRoutes: { fr: ['/blog/[slug]'] },
      });

      const defaultRoute = middleware(
        request('/articles/first', { cookies: { [LOCALE_COOKIE]: 'fr' } })
      );
      expect(target(defaultRoute, 'x-middleware-rewrite')?.pathname).toBe(
        '/en/en/blog/first'
      );

      expectRedirect(
        middleware(
          request('/fr/careers', { cookies: { [LOCALE_COOKIE]: 'fr' } })
        ),
        '/careers'
      );
    });

    it('supports custom locale and reset cookie names', () => {
      stubRoutingEnv({
        headersAndCookies: {
          localeCookieName: 'locale',
          resetLocaleCookieName: 'locale-reset',
        },
        browserLocales: true,
      });
      const middleware = createNextMiddleware({ enableSmartRouting: false });

      expect(
        target(
          middleware(request('/blog', { cookies: { locale: 'fr' } })),
          'x-middleware-rewrite'
        )?.pathname
      ).toBe('/en/blog');
      expectRedirect(
        middleware(
          request('/blog', {
            cookies: { locale: 'fr', 'locale-reset': 'true' },
          })
        ),
        '/fr/blog'
      );
      const firstVisit = middleware(
        request('/en', { browser: 'fr', destination: 'document' })
      );
      expect(firstVisit.cookies.get('locale')?.value).toBe('en');
      const returning = middleware(
        request('/en', {
          browser: 'fr',
          destination: 'document',
          cookies: { locale: 'fr' },
        })
      );
      expect(returning.cookies.get('locale')).toBeUndefined();
    });

    it('preserves base paths and trailing slashes while removing the default prefix', () => {
      const middleware = createNextMiddleware({ enableSmartRouting: false });
      const response = middleware(
        request('/en/docs/', {
          basePath: '/portal',
          trailingSlash: true,
          browser: 'fr',
        })
      );

      expectRedirect(response, '/portal/docs/');
    });

    it('uses a configured default alias as the ordinary-route fallback', () => {
      stubRoutingEnv({
        defaultLocale: 'en-US',
        locales: ['en-US', 'fr'],
        browserLocales: true,
      });
      const response = createNextMiddleware({ enableSmartRouting: false })(
        request('/blog', { cookies: { [LOCALE_COOKIE]: 'fr' } })
      );

      expect(target(response, 'x-middleware-rewrite')?.pathname).toBe(
        '/en-US/blog'
      );
      expect(response.headers.get(LOCALE_HEADER)).toBe('en-US');
    });

    it('does not change prefixDefaultLocale or localeRouting=false behavior', () => {
      expectRedirect(
        createNextMiddleware({
          enableSmartRouting: false,
          prefixDefaultLocale: true,
        })(request('/blog', { cookies: { [LOCALE_COOKIE]: 'fr' } })),
        '/fr/blog'
      );

      const response = createNextMiddleware({
        enableSmartRouting: false,
        localeRouting: false,
      })(request('/blog', { cookies: { [LOCALE_COOKIE]: 'fr' } }));
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    });
  });

  describe('smart routing enabled explicitly', () => {
    const enableSmartRouting = true;
    it('uses an ordinary locale cookie on an unprefixed shared route', () => {
      const response = createNextMiddleware({ enableSmartRouting })(
        request('/blog', { cookies: { [LOCALE_COOKIE]: 'fr' } })
      );
      expectRedirect(response, '/fr/blog');
    });

    it('retains referrer-cookie negotiation without a locale cookie', () => {
      const response = createNextMiddleware({ enableSmartRouting })(
        request('/blog', {
          browser: 'es',
          cookies: { [REFERRER_COOKIE]: 'fr' },
        })
      );
      expectRedirect(response, '/fr/blog');
    });

    it('recognizes an unprefixed default alias before browser language', () => {
      const response = createNextMiddleware({
        enableSmartRouting,
        pathConfig: { '/blog': { en: '/articles', fr: '/histoires' } },
      })(request('/articles', { browser: 'fr' }));
      expect(response.headers.get('location')).toBeNull();
      expect(target(response, 'x-middleware-rewrite')?.pathname).toBe(
        '/en/blog'
      );
    });

    it('keeps an explicit default prefix without a reset cookie', () => {
      const response = createNextMiddleware({ enableSmartRouting })(
        request('/en/blog', { browser: 'fr' })
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
      expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
    });
  });
});
