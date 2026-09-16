// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, type NextResponse } from 'next/server';
import {
  createNextMiddleware,
  type RouteOverrides,
} from '../createNextMiddleware';
import type { PathConfig } from '../utils';

const origin = 'https://example.com';
const localeCookie = 'generaltranslation.locale';
const resetCookie = 'generaltranslation.locale-reset';
const localeHeader = 'x-generaltranslation-locale';

type Cookies = Record<string, string>;
type Middleware = ReturnType<typeof createNextMiddleware>;

beforeEach(() => {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({ defaultLocale: 'en', locales: ['en', 'fr', 'es'] })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'false');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
});

afterEach(() => vi.unstubAllEnvs());

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

function expectRedirect(response: Response, path: string) {
  expect(response.status).toBe(307);
  expect(target(response, 'location')?.pathname).toBe(path);
}

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
  it.each(['/', '/blog', '/products/42', '/docs/guides/install'])(
    'uses the default locale for an ordinary unprefixed %s despite a locale cookie',
    (path) => {
      const response = createNextMiddleware({ enableSmartRouting: false })(
        request(path, { cookies: { [localeCookie]: 'fr' } })
      );

      expect(response.status).toBe(200);
      expect(target(response, 'x-middleware-rewrite')?.pathname).toBe(
        '/en' + path
      );
      expect(response.headers.get(localeHeader)).toBe('en');
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
      request('/articles', { cookies: { [localeCookie]: 'fr' } })
    );
    expect(returning.headers.get('location')).toBeNull();
    expect(target(returning, 'x-middleware-rewrite')?.pathname).toBe(
      '/en/blog'
    );
  });

  it('honors ignoreBrowserLocales when an ordinary route has no cookie', () => {
    vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'true');
    const response = createNextMiddleware({ enableSmartRouting: false })(
      request('/blog', { browser: 'fr-FR,fr;q=0.9' })
    );

    expect(response.status).toBe(200);
    expect(target(response, 'x-middleware-rewrite')?.pathname).toBe('/en/blog');
    expect(response.headers.get(localeHeader)).toBe('en');
  });

  it('lets a reset locale override an unprefixed default route', () => {
    const response = createNextMiddleware({ enableSmartRouting: false })(
      request('/blog', {
        cookies: { [localeCookie]: 'fr', [resetCookie]: 'true' },
      })
    );

    expectRedirect(response, '/fr/blog');
    expect(response.headers.get(localeHeader)).toBe('fr');
  });

  it('honors an explicit locale prefix unless a reset cookie changes it', () => {
    const middleware = createNextMiddleware({ enableSmartRouting: false });

    expect(
      middleware(request('/fr/blog', { cookies: { [localeCookie]: 'en' } }))
        .status
    ).toBe(200);
    expectRedirect(
      middleware(
        request('/fr/blog', {
          cookies: { [localeCookie]: 'en', [resetCookie]: 'true' },
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
    expect(first.cookies.get(localeCookie)?.value).toBe('en');

    const second = followRedirect(middleware, first, initialCookies, {
      browser: 'fr',
    });
    expect(second.headers.get('location')).toBeNull();
    expect(target(second, 'x-middleware-rewrite')?.pathname).toBe('/en/blog');
    expect(second.headers.get(localeHeader)).toBe('en');
  });

  it('preserves an explicit default root on a first document visit', () => {
    const middleware = createNextMiddleware({ enableSmartRouting: false });
    const first = middleware(
      request('/en', { browser: 'fr', destination: 'document' })
    );

    expectRedirect(first, '/');
    expect(first.cookies.get(localeCookie)?.value).toBe('en');
    const second = followRedirect(middleware, first, {}, { browser: 'fr' });
    expect(second.headers.get('location')).toBeNull();
    expect(second.headers.get(localeHeader)).toBe('en');
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
      const cookies = cookie === undefined ? {} : { [localeCookie]: cookie };
      const middleware = createNextMiddleware({ enableSmartRouting: false });
      const response = middleware(
        request('/en', { browser: 'fr', destination, cookies })
      );

      expectRedirect(response, '/');
      expect(response.cookies.get(localeCookie)).toBeUndefined();
      if (cookie) {
        const next = followRedirect(middleware, response, cookies, {
          browser: 'fr',
        });
        expect(next.headers.get('location')).toBeNull();
        expect(next.headers.get(localeHeader)).toBe('en');
        expect(next.cookies.get(localeCookie)).toBeUndefined();
      }
    }
  );

  it.each(['en+us', 'en[us'])(
    'strips a default alias %s literally for plain paths and localized aliases',
    (defaultLocale) => {
      vi.stubEnv(
        '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
        JSON.stringify({
          defaultLocale,
          locales: [defaultLocale, 'fr'],
          customMapping: { [defaultLocale]: { code: 'en-US' } },
        })
      );
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
        const second = followRedirect(middleware, first, {}, { browser: 'fr' });
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
      request('/articles/first', { cookies: { [localeCookie]: 'fr' } })
    );
    expect(target(defaultRoute, 'x-middleware-rewrite')?.pathname).toBe(
      '/en/en/blog/first'
    );

    expectRedirect(
      middleware(request('/fr/careers', { cookies: { [localeCookie]: 'fr' } })),
      '/careers'
    );
  });

  it('supports custom locale and reset cookie names', () => {
    vi.stubEnv(
      '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
      JSON.stringify({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        headersAndCookies: {
          localeCookieName: 'locale',
          resetLocaleCookieName: 'locale-reset',
        },
      })
    );
    const middleware = createNextMiddleware({ enableSmartRouting: false });

    expect(
      target(
        middleware(request('/blog', { cookies: { locale: 'fr' } })),
        'x-middleware-rewrite'
      )?.pathname
    ).toBe('/en/blog');
    expectRedirect(
      middleware(
        request('/blog', { cookies: { locale: 'fr', 'locale-reset': 'true' } })
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
    vi.stubEnv(
      '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
      JSON.stringify({ defaultLocale: 'en-US', locales: ['en-US', 'fr'] })
    );
    const response = createNextMiddleware({ enableSmartRouting: false })(
      request('/blog', { cookies: { [localeCookie]: 'fr' } })
    );

    expect(target(response, 'x-middleware-rewrite')?.pathname).toBe(
      '/en-US/blog'
    );
    expect(response.headers.get(localeHeader)).toBe('en-US');
  });

  it('does not change prefixDefaultLocale or localeRouting=false behavior', () => {
    expectRedirect(
      createNextMiddleware({
        enableSmartRouting: false,
        prefixDefaultLocale: true,
      })(request('/blog', { cookies: { [localeCookie]: 'fr' } })),
      '/fr/blog'
    );

    const response = createNextMiddleware({
      enableSmartRouting: false,
      localeRouting: false,
    })(request('/blog', { cookies: { [localeCookie]: 'fr' } }));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});

describe.each([undefined, true])(
  'smart routing=%s preserves main',
  (enableSmartRouting) => {
    it('uses an ordinary locale cookie on an unprefixed shared route', () => {
      const response = createNextMiddleware({ enableSmartRouting })(
        request('/blog', { cookies: { [localeCookie]: 'fr' } })
      );
      expectRedirect(response, '/fr/blog');
    });

    it('retains referrer-cookie negotiation without a locale cookie', () => {
      const response = createNextMiddleware({ enableSmartRouting })(
        request('/blog', {
          browser: 'es',
          cookies: { 'generaltranslation.referrer-locale': 'fr' },
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
      expect(response.cookies.get(localeCookie)).toBeUndefined();
    });
  }
);
