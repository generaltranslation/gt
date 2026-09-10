// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { defaultLocaleCookieName } from '@generaltranslation/react-core/pure';
import { createNextMiddleware, type RouteOverrides } from '../../middleware';
import type { PathConfig } from '../utils';
import { defaultLocaleHeaderName } from '../../utils/headers';

const origin = 'http://localhost:3000';
const search = '?tag=a&tag=b&raw=%2F%252F';

beforeEach(() => {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({ defaultLocale: 'en', locales: ['en', 'fr', 'de'] })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'true');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
});
afterEach(() => vi.unstubAllEnvs());

function request(path: string, locale?: string) {
  const req = new NextRequest(origin + path + search);
  if (locale) req.cookies.set(defaultLocaleCookieName, locale);
  return req;
}

function expectRoute(
  response: Response,
  kind: 'next' | 'rewrite' | 'redirect',
  locale: string,
  path?: string
) {
  expect(response.status).toBe(kind === 'redirect' ? 307 : 200);
  expect(response.headers.get(defaultLocaleHeaderName)).toBe(locale);
  expect(response.headers.get('location')).toBe(
    kind === 'redirect' ? origin + path + search : null
  );
  expect(response.headers.get('x-middleware-rewrite')).toBe(
    kind === 'rewrite' ? origin + path + search : null
  );
  if (kind === 'next')
    expect(response.headers.get('x-middleware-next')).toBe('1');
}

function regionalLocales() {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({ defaultLocale: 'en', locales: ['en', 'fr-FR', 'de'] })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'true');
}

describe('public pathConfig locale entries', () => {
  it.each([false, true])(
    'composes a localized string with override=%s',
    (override) => {
      const pathConfig: PathConfig = { '/about': { fr: '/a-propos' } };
      const routeOverrides: RouteOverrides = override ? { fr: ['/about'] } : {};
      const middleware = createNextMiddleware({ pathConfig, routeOverrides });
      expectRoute(
        middleware(request('/fr/a-propos')),
        'rewrite',
        'fr',
        override ? '/fr/fr/about' : '/fr/about'
      );
    }
  );

  it('keeps an explicit identity alias ahead of a saved foreign locale', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { en: '/about' } },
      routeOverrides: { en: ['/about'] },
    });
    expectRoute(
      middleware(request('/about', 'fr')),
      'rewrite',
      'en',
      '/en/en/about'
    );
  });

  it('does not give an override-only route default-alias priority', () => {
    const middleware = createNextMiddleware({
      routeOverrides: { en: ['/about'] },
    });
    expectRoute(
      middleware(request('/about', 'fr')),
      'redirect',
      'fr',
      '/fr/about'
    );
    // An English implementation override must not create French alias ownership.
    expectRoute(middleware(request('/fr/about')), 'next', 'fr');
    expectRoute(
      middleware(request('/about', 'en')),
      'rewrite',
      'en',
      '/en/en/about'
    );
  });

  it.each([
    {
      shared: '/about',
      path: '/about/',
      requestPath: '/about',
      destination: '/en/en/about',
    },
    {
      shared: '/about',
      path: '/%61bout',
      requestPath: '/%61bout',
      destination: '/en/en/about',
    },
  ])(
    'preserves explicit default-alias ownership for $path',
    ({ shared, path, requestPath, destination }) => {
      const middleware = createNextMiddleware({
        pathConfig: { [shared]: { en: path } },
        routeOverrides: { en: [shared] },
      });
      // These explicit aliases match after pathname normalization; their
      // default-locale priority must survive alongside implementation overrides.
      expectRoute(
        middleware(request(requestPath, 'fr')),
        'rewrite',
        'en',
        destination
      );
    }
  );

  it('retains universal string shorthand', () => {
    const pathConfig: PathConfig = { '/about': '/company' };
    const middleware = createNextMiddleware({ pathConfig });
    expectRoute(
      middleware(request('/fr/about')),
      'redirect',
      'fr',
      '/fr/company'
    );
    expectRoute(
      middleware(request('/de/about')),
      'redirect',
      'de',
      '/de/company'
    );
  });

  it('retains explicitly empty locale maps as shared owners', () => {
    const middleware = createNextMiddleware({ pathConfig: { '/about': {} } });
    expectRoute(middleware(request('/fr/about')), 'next', 'fr');
  });

  it('keeps alias ownership for one locale when another is override-only', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { fr: '/a-propos' } },
      routeOverrides: { en: ['/about'] },
    });
    expectRoute(
      middleware(request('/about', 'fr')),
      'redirect',
      'fr',
      '/fr/a-propos'
    );
    expectRoute(
      middleware(request('/fr/a-propos')),
      'rewrite',
      'fr',
      '/fr/about'
    );
    expectRoute(
      middleware(request('/about', 'en')),
      'rewrite',
      'en',
      '/en/en/about'
    );
  });

  it('preserves sparse overrides and optional root tails across three locales', () => {
    const middleware = createNextMiddleware({
      pathConfig: {
        '/[[...slug]]': {
          en: '/pages/[[...tail]]',
          fr: '/accueil/[[...tail]]',
          de: '/seiten/[[...tail]]',
        },
      },
      routeOverrides: { fr: ['/[[...slug]]'] },
    });
    expectRoute(middleware(request('/fr/accueil')), 'rewrite', 'fr', '/fr/fr');
    expectRoute(
      middleware(request('/fr/accueil/a%2Fb/c')),
      'rewrite',
      'fr',
      '/fr/fr/a%2Fb/c'
    );
    expectRoute(
      middleware(request('/de/seiten/a/b')),
      'rewrite',
      'de',
      '/de/a/b'
    );
    expectRoute(
      middleware(request('/pages/a/b', 'fr')),
      'rewrite',
      'en',
      '/en/a/b'
    );
  });

  it('does not create a static alias owner beneath a broad CMS alias', () => {
    const middleware = createNextMiddleware({
      pathConfig: {
        '/cms/[[...slug]]': { fr: '/pages/[[...tail]]' },
      },
      routeOverrides: { en: ['/pages'] },
    });
    expectRoute(middleware(request('/fr/pages')), 'rewrite', 'fr', '/fr/cms');
    expectRoute(
      middleware(request('/fr/pages/about')),
      'rewrite',
      'fr',
      '/fr/cms/about'
    );
  });
});

describe('independent config locale standardization', () => {
  it.each([
    { earlier: 'fr-fr', later: 'fr-FR' },
    { earlier: 'fr-FR', later: 'fr-fr' },
  ])(
    'keeps the last alias and override list for $earlier then $later',
    ({ earlier, later }) => {
      regionalLocales();
      const middleware = createNextMiddleware({
        pathConfig: {
          '/about': { [earlier]: '/ancien', [later]: '/nouveau' },
        },
        routeOverrides: { [earlier]: ['/obsolete'], [later]: ['/about'] },
      });
      expectRoute(
        middleware(request('/fr-FR/nouveau')),
        'rewrite',
        'fr-FR',
        '/fr-FR/fr-FR/about'
      );
      expectRoute(middleware(request('/fr-FR/ancien')), 'next', 'fr-FR');
      expectRoute(middleware(request('/fr-FR/obsolete')), 'next', 'fr-FR');
    }
  );

  it('keeps an alias when the last standardized override list is empty', () => {
    regionalLocales();
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { 'fr-fr': '/a-propos' } },
      routeOverrides: { 'fr-fr': ['/about'], 'fr-FR': [] },
    });
    expectRoute(
      middleware(request('/fr-FR/a-propos')),
      'rewrite',
      'fr-FR',
      '/fr-FR/about'
    );
    expectRoute(
      middleware(request('/fr-FR/about')),
      'redirect',
      'fr-FR',
      '/fr-FR/a-propos'
    );
  });

  it('preserves overrides when a later standardized alias replaces an earlier alias', () => {
    regionalLocales();
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { 'fr-fr': '/ancien', 'fr-FR': '/nouveau' } },
      routeOverrides: { 'fr-fr': ['/about'] },
    });
    expectRoute(
      middleware(request('/fr-FR/nouveau')),
      'rewrite',
      'fr-FR',
      '/fr-FR/fr-FR/about'
    );
    expectRoute(middleware(request('/fr-FR/ancien')), 'next', 'fr-FR');
  });

  it('matches multiple shared paths in a standardized override list', () => {
    regionalLocales();
    const middleware = createNextMiddleware({
      pathConfig: {
        '/about': { 'fr-fr': '/a-propos' },
        '/products/[id]': { 'fr-FR': '/produits/[item]' },
      },
      routeOverrides: { 'fr-fr': ['/about', '/products/[id]'] },
    });
    expectRoute(
      middleware(request('/fr-FR/a-propos')),
      'rewrite',
      'fr-FR',
      '/fr-FR/fr-FR/about'
    );
    expectRoute(
      middleware(request('/fr-FR/produits/a%2Fb')),
      'rewrite',
      'fr-FR',
      '/fr-FR/fr-FR/products/a%2Fb'
    );
  });

  it('keeps configured locale spelling when services are disabled', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { FR: '/upper', fr: '/lower' } },
      routeOverrides: { FR: ['/about'] },
    });
    expectRoute(middleware(request('/fr/lower')), 'rewrite', 'fr', '/fr/about');
    expectRoute(middleware(request('/fr/upper')), 'next', 'fr');
  });

  it('does not mutate frozen caller objects and lists across repeated factory calls', () => {
    regionalLocales();
    const locales = Object.freeze({ 'fr-fr': '/a-propos', de: '/uber-uns' });
    const pathConfig: PathConfig = Object.freeze({ '/about': locales });
    const paths = Object.freeze(['/about']);
    const routeOverrides: RouteOverrides = Object.freeze({ 'fr-fr': paths });
    const before = JSON.stringify({ pathConfig, routeOverrides });
    for (let i = 0; i < 2; i++) {
      const middleware = createNextMiddleware({ pathConfig, routeOverrides });
      expectRoute(
        middleware(request('/fr-FR/a-propos')),
        'rewrite',
        'fr-FR',
        '/fr-FR/fr-FR/about'
      );
      expectRoute(
        middleware(request('/de/uber-uns')),
        'rewrite',
        'de',
        '/de/about'
      );
    }
    expect(JSON.stringify({ pathConfig, routeOverrides })).toBe(before);
    expect(Object.keys(locales)).toEqual(['fr-fr', 'de']);
    expect(Object.keys(routeOverrides)).toEqual(['fr-fr']);
    expect(paths).toEqual(['/about']);
  });
});
