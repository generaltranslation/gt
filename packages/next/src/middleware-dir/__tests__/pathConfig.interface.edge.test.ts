// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { defaultLocaleCookieName } from '@generaltranslation/react-core/pure';
import { createNextMiddleware, type PathConfig } from '../../middleware';
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
  it.each([
    { name: 'legacy string', entry: '/a-propos', destination: '/fr/about' },
    {
      name: 'path object',
      entry: { path: '/a-propos' },
      destination: '/fr/about',
    },
    {
      name: 'path with override',
      entry: { path: '/a-propos', override: true },
      destination: '/fr/fr/about',
    },
  ])('accepts the $name form', ({ entry, destination }) => {
    const pathConfig: PathConfig = { '/about': { fr: entry } };
    const middleware = createNextMiddleware({ pathConfig });
    expectRoute(
      middleware(request('/fr/a-propos')),
      'rewrite',
      'fr',
      destination
    );
  });

  it('keeps an override:false identity alias ahead of a saved foreign locale', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { en: { path: '/about', override: false } } },
    });
    expectRoute(
      middleware(request('/about', 'fr')),
      'rewrite',
      'en',
      '/en/about'
    );
  });

  it.each([{ override: true }, { path: '/about', override: true }])(
    'does not give an override-only identity entry default-alias priority: %j',
    (entry) => {
      const middleware = createNextMiddleware({
        pathConfig: { '/about': { en: entry } },
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
    }
  );

  it.each([{}, { override: false }])(
    'does not turn pathless inactive metadata into an alias owner: %j',
    (entry) => {
      const middleware = createNextMiddleware({
        pathConfig: { '/about': { en: entry } },
      });
      expectRoute(middleware(request('/fr/about')), 'next', 'fr');
    }
  );

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
    'compares identity literally for $path',
    ({ shared, path, requestPath, destination }) => {
      const middleware = createNextMiddleware({
        pathConfig: { [shared]: { en: { path, override: true } } },
      });
      // These aliases match after pathname normalization, but were not literally equal
      // to the configured shared key; their default-locale priority must survive.
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

  it('retains explicitly empty legacy locale maps as shared owners', () => {
    const middleware = createNextMiddleware({ pathConfig: { '/about': {} } });
    expectRoute(middleware(request('/fr/about')), 'next', 'fr');
  });

  it('keeps alias ownership for one locale when another is override-only', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { en: { override: true }, fr: '/a-propos' } },
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
          en: { path: '/pages/[[...tail]]', override: false },
          fr: { path: '/accueil/[[...tail]]', override: true },
          de: '/seiten/[[...tail]]',
        },
      },
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
        '/pages': { en: { override: true } },
      },
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

describe('unified entries after locale standardization', () => {
  it.each([
    { name: 'string', later: '/nouveau' },
    { name: 'explicit false', later: { path: '/nouveau', override: false } },
  ])(
    'lets a later $name replace both the old alias and override',
    ({ later }) => {
      regionalLocales();
      const middleware = createNextMiddleware({
        pathConfig: {
          '/about': {
            'fr-fr': { path: '/ancien', override: true },
            'fr-FR': later,
          },
        },
      });
      expectRoute(
        middleware(request('/fr-FR/nouveau')),
        'rewrite',
        'fr-FR',
        '/fr-FR/about'
      );
      expectRoute(middleware(request('/fr-FR/ancien')), 'next', 'fr-FR');
    }
  );

  it.each([{ override: true }, { path: '/about', override: true }])(
    'removes a stale alias when the last canonical entry is override-only: %j',
    (later) => {
      regionalLocales();
      const middleware = createNextMiddleware({
        pathConfig: { '/about': { 'fr-fr': '/ancien', 'fr-FR': later } },
      });
      expectRoute(middleware(request('/fr-FR/ancien')), 'next', 'fr-FR');
      expectRoute(
        middleware(request('/fr-FR/about')),
        'rewrite',
        'fr-FR',
        '/fr-FR/fr-FR/about'
      );
    }
  );

  it('lets the reverse insertion order restore an alias and override together', () => {
    regionalLocales();
    const middleware = createNextMiddleware({
      pathConfig: {
        '/about': {
          'fr-FR': { path: '/ancien', override: false },
          'fr-fr': { path: '/nouveau', override: true },
        },
      },
    });
    expectRoute(
      middleware(request('/fr-FR/nouveau')),
      'rewrite',
      'fr-FR',
      '/fr-FR/fr-FR/about'
    );
    expectRoute(middleware(request('/fr-FR/ancien')), 'next', 'fr-FR');
  });

  it('lets a later inactive entry remove an earlier alias and override', () => {
    regionalLocales();
    const middleware = createNextMiddleware({
      pathConfig: {
        '/about': {
          'fr-fr': { path: '/ancien', override: true },
          'fr-FR': { override: false },
        },
      },
    });
    expectRoute(middleware(request('/fr-FR/ancien')), 'next', 'fr-FR');
    expectRoute(middleware(request('/fr-FR/about')), 'next', 'fr-FR');
  });

  it('aggregates different shared paths under the same standardized locale', () => {
    regionalLocales();
    const middleware = createNextMiddleware({
      pathConfig: {
        '/about': { 'fr-fr': { path: '/a-propos', override: true } },
        '/products/[id]': {
          'fr-FR': { path: '/produits/[item]', override: true },
        },
      },
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
      pathConfig: {
        '/about': { FR: { path: '/upper', override: true }, fr: '/lower' },
      },
    });
    expectRoute(middleware(request('/fr/lower')), 'rewrite', 'fr', '/fr/about');
    expectRoute(middleware(request('/fr/upper')), 'next', 'fr');
  });

  it('does not mutate frozen caller objects across repeated factory calls', () => {
    regionalLocales();
    const entry = Object.freeze({ path: '/a-propos', override: true });
    const locales = Object.freeze({ 'fr-fr': entry, de: '/uber-uns' });
    const pathConfig: PathConfig = Object.freeze({ '/about': locales });
    const before = JSON.stringify(pathConfig);
    for (let i = 0; i < 2; i++) {
      const middleware = createNextMiddleware({ pathConfig });
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
    expect(JSON.stringify(pathConfig)).toBe(before);
    expect(Object.keys(locales)).toEqual(['fr-fr', 'de']);
  });
});
