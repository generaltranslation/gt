// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from '@generaltranslation/react-core/pure';
import {
  defaultReferrerLocaleCookieName,
  defaultRoutingFetchLocaleCookieName,
} from '../../utils/cookies';
import { defaultLocaleHeaderName } from '../../utils/headers';
import { createNextMiddleware } from '../createNextMiddleware';

const origin = 'https://example.com';
const query = '?tag=a&tag=b';

beforeEach(() => {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
    })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'true');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
});
afterEach(() => vi.unstubAllEnvs());

function request(
  path: string,
  {
    current = 'en',
    requested = 'fr',
    reset = true,
    localeCookieName = defaultLocaleCookieName,
    headers = {},
  }: {
    current?: string;
    requested?: string;
    reset?: boolean;
    localeCookieName?: string;
    headers?: Record<string, string>;
  } = {}
) {
  const req = new NextRequest(origin + path + query, { headers });
  req.cookies.set(localeCookieName, current);
  req.cookies.set(defaultReferrerLocaleCookieName, 'es');
  if (requested)
    req.cookies.set(defaultRoutingFetchLocaleCookieName, requested);
  if (reset)
    req.cookies.set(
      defaultResetLocaleCookieName,
      defaultRoutingFetchLocaleCookieName
    );
  return req;
}

describe('requested routing locale', () => {
  it('honors and consumes a routed reset using the configured cookie name', () => {
    vi.stubEnv(
      '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
      JSON.stringify({
        defaultLocale: 'en',
        locales: ['en', 'fr', 'es'],
        headersAndCookies: { resetLocaleCookieName: 'site-reset' },
      })
    );
    const middleware = createNextMiddleware();
    const req = request('/blog', { reset: false });
    req.cookies.set('site-reset', defaultRoutingFetchLocaleCookieName);
    expect(middleware(req).headers.get('location')).toBe(
      origin + '/fr/blog' + query
    );
    const terminalReq = request('/fr/blog', { reset: false });
    terminalReq.cookies.set('site-reset', defaultRoutingFetchLocaleCookieName);
    const terminal = middleware(terminalReq);
    expect(terminal.headers.get(defaultLocaleHeaderName)).toBe('fr');
    expect(terminal.cookies.get('site-reset')?.value).toBe('');
  });
  it.each(['true', 'legacy'])(
    'does not let a stale request cookie override a later legacy choice (reset=%s)',
    (reset) => {
      const middleware = createNextMiddleware();
      const req = request('/blog', {
        current: 'es',
        requested: 'fr',
        reset: false,
      });
      if (reset) req.cookies.set(defaultResetLocaleCookieName, reset);
      const response = middleware(req);
      expect(response.headers.get('location')).toBe(
        origin + '/es/blog' + query
      );
      expect(response.headers.get(defaultLocaleHeaderName)).toBe('es');
    }
  );

  it('retains the requested preference until the provider applies a locale', () => {
    const middleware = createNextMiddleware({
      localeRoutes: { fr: ['/blog'] },
    });
    const response = middleware(request('/careers'));
    expect(response.headers.get(defaultLocaleHeaderName)).toBe('en');
    expect(response.cookies.get(defaultResetLocaleCookieName)?.value).toBe('');
    const nextResponse = middleware(request('/blog', { reset: false }));
    expect(nextResponse.headers.get('location')).toBe(
      origin + '/fr/blog' + query
    );
    const applied = middleware(
      request('/blog', { reset: false, requested: '' })
    );
    expect(applied.headers.get(defaultLocaleHeaderName)).toBe('en');
    expect(applied.headers.get('location')).toBeNull();
  });

  it('honors a later pending choice after an earlier response consumes reset', () => {
    const middleware = createNextMiddleware({
      localeRoutes: { fr: ['/blog'], es: ['/careers'] },
    });
    const earlier = middleware(request('/careers'));
    expect(earlier.cookies.get(defaultResetLocaleCookieName)?.value).toBe('');
    const later = middleware(
      request('/careers', { requested: 'es', reset: false })
    );
    expect(later.headers.get(defaultLocaleHeaderName)).toBe('es');
    expect(later.headers.get('location')).toBe(origin + '/es/careers' + query);
  });

  it.each(['de-DE', 'it'])(
    'uses the current locale when the requested locale is no longer supported: %s',
    (requested) => {
      const response = createNextMiddleware()(
        request('/en/blog', { current: 'es', requested })
      );
      expect(response.headers.get('location')).toBe(
        origin + '/es/blog' + query
      );
      expect(response.headers.get(defaultLocaleHeaderName)).toBe('es');
    }
  );

  it('accepts a requested regional locale that resolves to a supported locale', () => {
    const response = createNextMiddleware()(
      request('/blog', { requested: 'fr-CA' })
    );
    expect(response.headers.get('location')).toBe(origin + '/fr/blog' + query);
  });

  it.each(['/blog', '/en/blog', '/es/blog'])(
    'uses the requested locale for an explicit switch from %s',
    (path) => {
      const response = createNextMiddleware()(request(path));
      expect(response.headers.get('location')).toBe(
        origin + '/fr/blog' + query
      );
      expect(response.headers.get(defaultLocaleHeaderName)).toBe('fr');
      expect(response.cookies.get(defaultLocaleCookieName)).toBeUndefined();
      expect(
        response.cookies.get(defaultRoutingFetchLocaleCookieName)
      ).toBeUndefined();
    }
  );

  it('keeps URL locale precedence when there is no reset', () => {
    const response = createNextMiddleware()(
      request('/es/blog', { reset: false })
    );
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get(defaultLocaleHeaderName)).toBe('es');
  });

  it.each(['', 'not a locale', '%0d%0aLocation:https://evil.example'])(
    'falls back to the current cookie when the request cookie is missing or invalid: %s',
    (requested) => {
      const response = createNextMiddleware()(
        request('/en/blog', { current: 'es', requested })
      );
      expect(response.headers.get('location')).toBe(
        origin + '/es/blog' + query
      );
      expect(response.headers.get(defaultLocaleHeaderName)).toBe('es');
    }
  );

  it('ignores the request cookie when locale routing is disabled', () => {
    const response = createNextMiddleware({ localeRouting: false })(
      request('/blog', { current: 'es' })
    );
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(response.headers.get(defaultLocaleHeaderName)).toBe('es');
  });

  it.each(['', 'fr'])(
    'supports custom current-locale cookie names with requested=%s',
    (requested) => {
      vi.stubEnv(
        '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
        JSON.stringify({
          defaultLocale: 'en',
          locales: ['en', 'fr', 'es'],
          headersAndCookies: { localeCookieName: 'site-locale' },
        })
      );
      const response = createNextMiddleware()(
        request('/en/blog', {
          current: 'es',
          requested,
          localeCookieName: 'site-locale',
        })
      );
      expect(response.headers.get('location')).toBe(
        origin + `/${requested || 'es'}/blog` + query
      );
    }
  );

  it.each([false, true])(
    'rejects an unavailable switch without a self-redirect (prefixed=%s)',
    (prefixDefaultLocale) => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale,
        localeRoutes: { fr: ['/blog'] },
      });
      const path = prefixDefaultLocale ? '/en/careers' : '/careers';
      const response = middleware(request(path));
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get(defaultLocaleHeaderName)).toBe('en');
      expect(response.cookies.get(defaultLocaleCookieName)).toBeUndefined();
      expect(
        response.cookies.get(defaultRoutingFetchLocaleCookieName)
      ).toBeUndefined();
      expect(response.cookies.get(defaultResetLocaleCookieName)?.value).toBe(
        ''
      );
    }
  );

  it.each([{}, { rsc: '1', 'next-router-prefetch': '1' }])(
    'does not write either locale cookie on a fallback response (%j)',
    (headers) => {
      const middleware = createNextMiddleware({ localeRoutes: { fr: [] } });
      const response = middleware(request('/fr/careers', { headers }));
      expect(response.headers.get('location')).toBe(
        origin + '/careers' + query
      );
      expect(response.cookies.get(defaultLocaleCookieName)).toBeUndefined();
      expect(
        response.cookies.get(defaultRoutingFetchLocaleCookieName)
      ).toBeUndefined();
      const terminal = middleware(request('/careers', { headers }));
      expect(terminal.headers.get('location')).toBeNull();
      expect(terminal.headers.get('x-middleware-rewrite')).toBe(
        origin + '/en/careers' + query
      );
      expect(terminal.headers.get(defaultLocaleHeaderName)).toBe('en');
    }
  );

  it('preserves aliases and override rewrites for an accepted switch', () => {
    const middleware = createNextMiddleware({
      localeRoutes: { fr: ['/blog/[slug]'] },
      pathConfig: { '/blog/[slug]': { fr: '/articles/[slug]' } },
      routeOverrides: { fr: ['/blog/[slug]'] },
    });
    const response = middleware(request('/blog/hello'));
    expect(response.headers.get('location')).toBe(
      origin + '/fr/articles/hello' + query
    );
    const terminal = middleware(request('/fr/articles/hello'));
    expect(terminal.headers.get('location')).toBeNull();
    expect(terminal.headers.get('x-middleware-rewrite')).toBe(
      origin + '/fr/fr/blog/hello' + query
    );
    expect(terminal.cookies.get(defaultResetLocaleCookieName)?.value).toBe('');
  });
});
