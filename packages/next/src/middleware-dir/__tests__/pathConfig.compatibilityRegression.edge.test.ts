// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from '@generaltranslation/react-core/pure';
import { defaultLocaleRoutingEnabledCookieName } from '../../utils/cookies';
import { defaultLocaleHeaderName } from '../../utils/headers';
import { createNextMiddleware } from '../createNextMiddleware';
import type { PathConfig } from '../normalizePathConfig';

const origin = 'http://localhost:3000';
const search = '?tag=one&tag=two&literal=%252F%2B';
type Options = NonNullable<Parameters<typeof createNextMiddleware>[0]>;
type Response = ReturnType<ReturnType<typeof createNextMiddleware>>;

beforeEach(() => {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({ defaultLocale: 'en', locales: ['en', 'fr', 'es'] })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'true');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
});

afterEach(() => vi.unstubAllEnvs());

function request(path: string, cookieLocale?: string, reset = false) {
  const req = new NextRequest(origin + path + search);
  if (cookieLocale) req.cookies.set(defaultLocaleCookieName, cookieLocale);
  if (reset) req.cookies.set(defaultResetLocaleCookieName, 'true');
  return req;
}

function expectRoute(
  response: Response,
  kind: 'next' | 'rewrite' | 'redirect',
  locale: string,
  destination?: string
) {
  expect(response.status).toBe(kind === 'redirect' ? 307 : 200);
  expect(response.headers.get(defaultLocaleHeaderName)).toBe(locale);
  expect(
    response.cookies.get(defaultLocaleRoutingEnabledCookieName)?.value
  ).toBe('true');
  expect(response.headers.get('location')).toBe(
    kind === 'redirect' ? origin + destination + search : null
  );
  expect(response.headers.get('x-middleware-rewrite')).toBe(
    kind === 'rewrite' ? origin + destination + search : null
  );
  expect(response.headers.get('x-middleware-next')).toBe(
    kind === 'next' ? '1' : null
  );
}

describe('legacy pathConfig value forms', () => {
  it.each([
    ['/fr/services', 'fr', '/fr/our-services'],
    ['/services', 'en', '/our-services'],
  ])('uses universal string shorthand for %s', (path, locale, destination) => {
    const middleware = createNextMiddleware({
      pathConfig: { '/services': '/our-services' },
    });
    expectRoute(middleware(request(path)), 'redirect', locale, destination);
  });

  it('substitutes raw singular data in universal string shorthand', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/products/[id]': '/items/[id]' },
    });
    expectRoute(
      middleware(request('/fr/products/a%2Fb')),
      'redirect',
      'fr',
      '/fr/items/a%2Fb'
    );
  });

  it('terminates a universal identity shorthand at its prefixed route', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': '/about' },
    });
    expectRoute(middleware(request('/fr/about')), 'next', 'fr');
  });

  it('does not treat a universal string as an explicit default-locale alias', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': '/about' },
    });
    expectRoute(
      middleware(request('/about', 'fr')),
      'redirect',
      'fr',
      '/fr/about'
    );
  });

  it.each([
    ['/about', '/fr/about'],
    ['/products/[id]', '/fr/products/sku'],
  ])('keeps the shared route for the empty locale map %s', (template, path) => {
    const middleware = createNextMiddleware({ pathConfig: { [template]: {} } });
    expectRoute(middleware(request(path)), 'next', 'fr');
  });

  it('does not let an empty locale map override an ordinary locale cookie', () => {
    const middleware = createNextMiddleware({ pathConfig: { '/about': {} } });
    expectRoute(
      middleware(request('/about', 'fr')),
      'redirect',
      'fr',
      '/fr/about'
    );
  });

  it('falls back to a shared static path when the selected locale has no alias', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { fr: '/a-propos' } },
    });
    expectRoute(middleware(request('/es/about')), 'next', 'es');
  });

  it('rewrites a default-locale shared path even without a default alias entry', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { fr: '/a-propos' } },
    });
    expectRoute(middleware(request('/about')), 'rewrite', 'en', '/en/about');
  });

  it('preserves singular data when the cookie selects an unconfigured alias locale', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/products/[id]': { fr: '/produits/[id]' } },
    });
    expectRoute(
      middleware(request('/products/sku', 'es')),
      'redirect',
      'es',
      '/es/products/sku'
    );
  });
});

describe('explicit default aliases and locale preference', () => {
  const pathConfig = { '/about': { en: '/about', fr: '/a-propos' } };

  it('lets an unprefixed identity alias take priority over an ordinary French cookie', () => {
    const middleware = createNextMiddleware({ pathConfig });
    expectRoute(
      middleware(request('/about', 'fr')),
      'rewrite',
      'en',
      '/en/about'
    );
  });

  it('gives a renamed unprefixed default alias the same priority', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { en: '/company', fr: '/a-propos' } },
    });
    expectRoute(
      middleware(request('/company', 'fr')),
      'rewrite',
      'en',
      '/en/about'
    );
  });

  it('keeps cookie preference when only the French alias is configured', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { fr: '/a-propos' } },
    });
    expectRoute(
      middleware(request('/about', 'fr')),
      'redirect',
      'fr',
      '/fr/a-propos'
    );
  });

  it('does not grant unprefixed default-alias priority when prefixes are required', () => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      pathConfig,
    });
    expectRoute(
      middleware(request('/about', 'fr')),
      'redirect',
      'fr',
      '/fr/a-propos'
    );
  });

  it('allows an explicit locale reset to override an identity alias', () => {
    const middleware = createNextMiddleware({ pathConfig });
    expectRoute(
      middleware(request('/about', 'fr', true)),
      'redirect',
      'fr',
      '/fr/a-propos'
    );
  });

  it('does not infer an English alias from override-only configuration', () => {
    const middleware = createNextMiddleware({
      pathConfig: {
        '/about': { en: { override: true }, fr: { override: true } },
      },
    });
    expectRoute(
      middleware(request('/about', 'fr')),
      'redirect',
      'fr',
      '/fr/about'
    );
  });
});

describe('pathConfig route specificity', () => {
  const entries: [string, PathConfig[string]][] = [
    ['/fallback/[[...slug]]', { fr: '/articles/[[...slug]]' }],
    ['/archive/[...slug]', { fr: '/articles/[...slug]' }],
    ['/entry/[id]', { fr: '/articles/[id]' }],
    ['/featured', { fr: '/articles/featured' }],
  ];

  it.each([
    ['static before singular', '/fr/articles/featured', '/fr/featured'],
    ['singular before required catchall', '/fr/articles/one', '/fr/entry/one'],
    [
      'required before optional catchall',
      '/fr/articles/one/two',
      '/fr/archive/one/two',
    ],
    ['optional catchall with no tail', '/fr/articles', '/fr/fallback'],
  ])('preserves %s in either insertion order', (_label, path, destination) => {
    for (const ordered of [entries, [...entries].reverse()]) {
      const middleware = createNextMiddleware({
        pathConfig: Object.fromEntries(ordered),
      });
      expectRoute(middleware(request(path)), 'rewrite', 'fr', destination);
    }
  });

  it('prefers a shared static route over a localized singular candidate', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/news': {}, '/product/[id]': { fr: '/[id]' } },
    });
    expectRoute(middleware(request('/fr/news')), 'next', 'fr');
  });

  it('prefers a localized static route over a shared singular candidate', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/[id]': {}, '/special': { fr: '/featured' } },
    });
    expectRoute(
      middleware(request('/fr/featured')),
      'rewrite',
      'fr',
      '/fr/special'
    );
  });
});

describe('locale-key compatibility', () => {
  function regionalMiddleware(services: boolean, key: string) {
    vi.stubEnv(
      '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
      JSON.stringify({ defaultLocale: 'en', locales: ['en', 'fr-FR'] })
    );
    vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', String(services));
    return createNextMiddleware({
      pathConfig: { '/about': { [key]: '/a-propos' } },
    });
  }

  it('canonicalizes configured locale keys when GT services are enabled', () => {
    const middleware = regionalMiddleware(true, 'fr-fr');
    expectRoute(
      middleware(request('/fr-FR/a-propos')),
      'rewrite',
      'fr-FR',
      '/fr-FR/about'
    );
  });

  it('uses an explicitly canonical key with GT services disabled', () => {
    const middleware = regionalMiddleware(false, 'fr-FR');
    expectRoute(
      middleware(request('/fr-FR/a-propos')),
      'rewrite',
      'fr-FR',
      '/fr-FR/about'
    );
  });

  it('does not canonicalize alias-map keys when GT services are disabled', () => {
    const middleware = regionalMiddleware(false, 'fr-fr');
    expectRoute(middleware(request('/fr-FR/about')), 'next', 'fr-FR');
  });

  it('canonicalizes a deprecated locale spelling before selecting its alias', () => {
    vi.stubEnv(
      '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
      JSON.stringify({ defaultLocale: 'en', locales: ['en', 'fil'] })
    );
    vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'true');
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { tl: '/tungkol' } },
    });
    expectRoute(
      middleware(request('/tl/tungkol')),
      'redirect',
      'fil',
      '/fil/tungkol'
    );
    expectRoute(
      middleware(request('/fil/tungkol')),
      'rewrite',
      'fil',
      '/fil/about'
    );
  });
});

describe('localized paths combined with route overrides', () => {
  const options: Options = {
    pathConfig: {
      '/products/[id]': { fr: { path: '/produits/[id]', override: true } },
    },
  };

  it('canonicalizes the public path before using the French implementation', () => {
    const middleware = createNextMiddleware(options);
    expectRoute(
      middleware(request('/fr/products/sku')),
      'redirect',
      'fr',
      '/fr/produits/sku'
    );
    expectRoute(
      middleware(request('/fr/produits/sku')),
      'rewrite',
      'fr',
      '/fr/fr/products/sku'
    );
  });

  it('retains the shared implementation for a locale without an alias or override', () => {
    const middleware = createNextMiddleware(options);
    expectRoute(middleware(request('/es/products/sku')), 'next', 'es');
  });
});
