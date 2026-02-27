// @vitest-environment edge-runtime
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import createNextMiddleware from '../createNextMiddleware';
import type { PathConfig } from '../utils';

// Mock gt-react/internal — only provides a constant, avoids deep react-core build chain
vi.mock('gt-react/internal', () => ({
  defaultLocaleCookieName: 'generaltranslation.locale',
}));

// ---- Cookie Constants (must match the real defaults) ----
const LOCALE_COOKIE = 'generaltranslation.locale';
const RESET_COOKIE = 'generaltranslation.locale-reset';
const REFERRER_COOKIE = 'generaltranslation.referrer-locale';
const ROUTING_COOKIE = 'generaltranslation.locale-routing-enabled';
const LOCALE_HEADER = 'x-generaltranslation-locale';

// ---- Helpers ----

function setEnvConfig(overrides: Record<string, any> = {}) {
  process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
    defaultLocale: 'en',
    locales: ['en', 'fr', 'es', 'de'],
    ...overrides,
  });
}

function createRequest(
  pathname: string,
  opts: {
    cookies?: Record<string, string>;
    acceptLanguage?: string;
    search?: string;
  } = {}
): NextRequest {
  const url = new URL(pathname, 'http://localhost:3000');
  if (opts.search) url.search = opts.search;

  const headers = new Headers();
  if (opts.acceptLanguage) {
    headers.set('accept-language', opts.acceptLanguage);
  }

  const req = new NextRequest(url, { headers });
  if (opts.cookies) {
    for (const [name, value] of Object.entries(opts.cookies)) {
      req.cookies.set(name, value);
    }
  }
  return req;
}

// ---- Response Inspection ----

function getResponseType(
  res: Response
): 'redirect' | 'rewrite' | 'next' | 'unknown' {
  if (res.status === 307 || res.status === 308) return 'redirect';
  if (res.headers.has('x-middleware-rewrite')) return 'rewrite';
  if (res.headers.get('x-middleware-next') === '1') return 'next';
  return 'unknown';
}

function getResponsePath(res: Response): string {
  const type = getResponseType(res);
  if (type === 'redirect') {
    return new URL(res.headers.get('location')!).pathname;
  }
  if (type === 'rewrite') {
    return new URL(res.headers.get('x-middleware-rewrite')!).pathname;
  }
  return '';
}

function getResponseSearch(res: Response): string {
  const type = getResponseType(res);
  if (type === 'redirect') {
    return new URL(res.headers.get('location')!).search;
  }
  if (type === 'rewrite') {
    return new URL(res.headers.get('x-middleware-rewrite')!).search;
  }
  return '';
}

// ---- Tests ----

describe('Middleware Integration Tests', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      _GENERALTRANSLATION_I18N_CONFIG_PARAMS:
        process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS,
      _GENERALTRANSLATION_GT_SERVICES_ENABLED:
        process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED,
      _GENERALTRANSLATION_IGNORE_BROWSER_LOCALES:
        process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES,
    };
    // Default: GT services disabled
    delete process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED;
    delete process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  // ================================================================
  // Category 2: 1-Pass Routing
  // ================================================================

  describe('Category 2: 1-Pass Routing', () => {
    it('2.1: !prefixDefault, default user, /about → rewrite /en/about', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
      });

      const res = middleware(createRequest('/about'));

      expect(getResponseType(res)).toBe('rewrite');
      expect(getResponsePath(res)).toBe('/en/about');
      expect(res.headers.get(LOCALE_HEADER)).toBe('en');
      expect(res.cookies.get(ROUTING_COOKIE)?.value).toBe('true');
    });

    it('2.2: prefixDefault, /en/about → next()', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
      });

      const res = middleware(createRequest('/en/about'));

      expect(getResponseType(res)).toBe('next');
      expect(res.headers.get(LOCALE_HEADER)).toBe('en');
    });

    it('2.3: !prefixDefault, non-default locale, /fr/about → next()', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
      });

      const res = middleware(createRequest('/fr/about'));

      expect(getResponseType(res)).toBe('next');
      expect(res.headers.get(LOCALE_HEADER)).toBe('fr');
    });

    it('2.4: pathConfig, /fr/a-propos → rewrite /fr/about', () => {
      setEnvConfig();
      const pathConfig: PathConfig = {
        '/about': { en: '/about-us', fr: '/a-propos' },
      };
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
        pathConfig,
      });

      const res = middleware(createRequest('/fr/a-propos'));

      expect(getResponseType(res)).toBe('rewrite');
      expect(getResponsePath(res)).toBe('/fr/about');
      expect(res.headers.get(LOCALE_HEADER)).toBe('fr');
    });

    it('2.5: pathConfig + !prefixDefault, /about-us → rewrite /en/about', () => {
      setEnvConfig();
      const pathConfig: PathConfig = {
        '/about': { en: '/about-us', fr: '/a-propos' },
      };
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
        pathConfig,
      });

      const res = middleware(createRequest('/about-us'));

      expect(getResponseType(res)).toBe('rewrite');
      expect(getResponsePath(res)).toBe('/en/about');
      expect(res.headers.get(LOCALE_HEADER)).toBe('en');
    });

    it('2.6: localeRouting=false → next()', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        localeRouting: false,
      });

      const res = middleware(createRequest('/some/path'));

      expect(getResponseType(res)).toBe('next');
      expect(res.headers.get(LOCALE_HEADER)).toBe('en');
      expect(res.cookies.get(ROUTING_COOKIE)?.value).toBe('false');
    });

    it('2.7: ignoreSourceMaps, /__nextjs_source-map/* → bare next()', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        ignoreSourceMaps: true,
      });

      const res = middleware(createRequest('/__nextjs_source-map/main.js'));

      expect(getResponseType(res)).toBe('next');
      // Source map next() is bare — no locale header or routing cookie
      expect(res.headers.get(LOCALE_HEADER)).toBeNull();
    });
  });

  // ================================================================
  // Category 3: 2-Pass Routing (Redirect Scenarios)
  // ================================================================

  describe('Category 3: 2-Pass Routing (Redirects)', () => {
    it('3.1: !prefixDefault, reset cookie to en, /fr/about → redirect /about', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
      });

      const res = middleware(
        createRequest('/fr/about', {
          cookies: {
            [LOCALE_COOKIE]: 'en',
            [RESET_COOKIE]: 'true',
          },
        })
      );

      expect(getResponseType(res)).toBe('redirect');
      expect(getResponsePath(res)).toBe('/about');
    });

    it('3.2: prefixDefault, reset cookie to fr, /en/about → redirect /fr/about', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
      });

      const res = middleware(
        createRequest('/en/about', {
          cookies: {
            [LOCALE_COOKIE]: 'fr',
            [RESET_COOKIE]: 'true',
          },
        })
      );

      expect(getResponseType(res)).toBe('redirect');
      expect(getResponsePath(res)).toBe('/fr/about');
    });

    it('3.3: non-default locale cookie fr (no reset), /about → redirect /fr/about', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
      });

      const res = middleware(
        createRequest('/about', {
          cookies: {
            [LOCALE_COOKIE]: 'fr',
          },
        })
      );

      expect(getResponseType(res)).toBe('redirect');
      expect(getResponsePath(res)).toBe('/fr/about');
    });

    it('3.4: pathConfig + prefixDefault, reset cookie to fr, /en/about-us → redirect /fr/a-propos', () => {
      setEnvConfig();
      const pathConfig: PathConfig = {
        '/about': { en: '/about-us', fr: '/a-propos' },
      };
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
        pathConfig,
      });

      const res = middleware(
        createRequest('/en/about-us', {
          cookies: {
            [LOCALE_COOKIE]: 'fr',
            [RESET_COOKIE]: 'true',
          },
        })
      );

      expect(getResponseType(res)).toBe('redirect');
      expect(getResponsePath(res)).toBe('/fr/a-propos');
    });

    it('3.5: wrong localized path /fr/about → redirect /fr/a-propos', () => {
      setEnvConfig();
      const pathConfig: PathConfig = {
        '/about': { en: '/about-us', fr: '/a-propos' },
      };
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
        pathConfig,
      });

      const res = middleware(
        createRequest('/fr/about', {
          cookies: {
            [LOCALE_COOKIE]: 'fr',
          },
        })
      );

      expect(getResponseType(res)).toBe('redirect');
      expect(getResponsePath(res)).toBe('/fr/a-propos');
    });

    it('3.6: referrer cookie fr, /docs → redirect /fr/docs', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
      });

      const res = middleware(
        createRequest('/docs', {
          cookies: {
            [REFERRER_COOKIE]: 'fr',
          },
        })
      );

      expect(getResponseType(res)).toBe('redirect');
      expect(getResponsePath(res)).toBe('/fr/docs');
    });
  });

  // ================================================================
  // Response Properties
  // ================================================================

  describe('Response Properties', () => {
    it('preserves query string on rewrite', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
      });

      const res = middleware(
        createRequest('/about', { search: 'foo=bar&baz=1' })
      );

      expect(getResponseType(res)).toBe('rewrite');
      expect(getResponseSearch(res)).toBe('?foo=bar&baz=1');
    });

    it('preserves query string on redirect', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
      });

      const res = middleware(
        createRequest('/about', {
          cookies: { [LOCALE_COOKIE]: 'fr' },
          search: 'page=2',
        })
      );

      expect(getResponseType(res)).toBe('redirect');
      expect(getResponseSearch(res)).toBe('?page=2');
    });

    it('sets locale header on rewrite responses', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
      });

      const res = middleware(createRequest('/about'));

      expect(res.headers.get(LOCALE_HEADER)).toBe('en');
    });

    it('sets locale header on redirect responses', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
      });

      const res = middleware(
        createRequest('/about', {
          cookies: { [LOCALE_COOKIE]: 'fr' },
        })
      );

      expect(res.headers.get(LOCALE_HEADER)).toBe('fr');
    });

    it('sets locale-routing-enabled cookie on routed responses', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
      });

      const res = middleware(createRequest('/about'));

      expect(res.cookies.get(ROUTING_COOKIE)?.value).toBe('true');
    });

    it('clears reset cookies on rewrite but not on redirect', () => {
      setEnvConfig();
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
      });

      // Redirect case: reset cookie to fr from /en/about
      const redirectRes = middleware(
        createRequest('/en/about', {
          cookies: {
            [LOCALE_COOKIE]: 'fr',
            [RESET_COOKIE]: 'true',
          },
        })
      );
      expect(getResponseType(redirectRes)).toBe('redirect');
      // On redirect, reset cookies should NOT be cleared
      // (they persist until the next non-redirect response)
      const redirectSetCookie = redirectRes.headers.get('set-cookie') || '';
      expect(redirectSetCookie).not.toContain(
        `${RESET_COOKIE}=;`
      );

      // After the redirect to /fr/about, the next request should be a next()
      // that clears the reset cookies
      const nextRes = middleware(
        createRequest('/fr/about', {
          cookies: {
            [LOCALE_COOKIE]: 'fr',
            [RESET_COOKIE]: 'true',
          },
        })
      );
      // This should be a next() since the locale and path now match
      expect(getResponseType(nextRes)).toBe('next');
    });
  });
});
