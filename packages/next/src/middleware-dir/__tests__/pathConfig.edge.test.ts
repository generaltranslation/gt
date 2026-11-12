// @vitest-environment edge-runtime
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from '@generaltranslation/react-core/pure';
import { defaultLocaleHeaderName } from '../../utils/headers';
// The public entry point, as apps import it.
import { createNextMiddleware, type RouteOverrides } from '../../middleware';
import { getDynamicSegmentType } from '../createPathMatcher';
import {
  createPathMatcher,
  createPathToSharedPathMap,
  getSharedPath,
  type PathConfig,
} from '../utils';
import {
  expectRoutedResponse,
  stubRoutingEnv,
  useRoutingEnv,
  type RouteKind,
} from './routingTestUtils';

type Options = NonNullable<Parameters<typeof createNextMiddleware>[0]>;
type MiddlewareResponse = ReturnType<ReturnType<typeof createNextMiddleware>>;
const origin = 'http://localhost:3000';
const search = '?tag=a&tag=b&raw=%2F%252F';

useRoutingEnv({ locales: ['en', 'fr', 'de', 'es'] });

function request(path: string, cookieLocale?: string, reset = false) {
  const req = new NextRequest(origin + path + search);
  if (cookieLocale) req.cookies.set(defaultLocaleCookieName, cookieLocale);
  if (reset) req.cookies.set(defaultResetLocaleCookieName, 'true');
  return req;
}

function expectRoute(
  response: MiddlewareResponse,
  kind: RouteKind,
  locale: string,
  path?: string
) {
  expectRoutedResponse(
    response,
    kind,
    locale,
    path === undefined ? undefined : origin + path + search
  );
}

function regionalLocales() {
  stubRoutingEnv({ locales: ['en', 'fr-FR', 'de'], services: true });
}

describe('public pathConfig locale entries', () => {
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

  it('terminates a universal identity shorthand at its prefixed route', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': '/about' },
    });
    expectRoute(middleware(request('/fr/about')), 'next', 'fr');
  });

  it('treats a universal string as an alias for the default locale too', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': '/about' },
    });
    expectRoute(
      middleware(request('/about', 'fr')),
      'rewrite',
      'en',
      '/en/about'
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
    stubRoutingEnv({ locales: ['en', 'fr-FR'], services });
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
    stubRoutingEnv({ locales: ['en', 'fil'], services: true });
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
      '/products/[id]': { fr: '/produits/[id]' },
    },
    routeOverrides: { fr: ['/products/[id]'] },
  };

  it('retains the shared implementation for a locale without an alias or override', () => {
    const middleware = createNextMiddleware(options);
    expectRoute(middleware(request('/es/products/sku')), 'next', 'es');
  });
});

describe('string pathConfig aliases', () => {
  beforeEach(() => stubRoutingEnv({ locales: ['en', 'fr', 'en-GB'] }));

  const query = '?tag=a&tag=b&encoded=%2F%252F';

  const cases = [
    {
      shared: '/about',
      alias: '/company',
      source: '/about',
      publicPath: '/company',
    },
    {
      shared: '/blog/[slug]',
      alias: '/articles/[slug]',
      source: '/blog/hello',
      publicPath: '/articles/hello',
    },
    {
      shared: '/blog/[slug]',
      alias: '/articles/[slug]',
      source: '/blog/a%2Fb',
      publicPath: '/articles/a%2Fb',
    },
    {
      shared: '/docs/[...slug]',
      alias: '/guides/[...slug]',
      source: '/docs/one/two',
      publicPath: '/guides/one/two',
    },
    {
      shared: '/docs/[[...slug]]',
      alias: '/guides/[[...slug]]',
      source: '/docs',
      publicPath: '/guides',
    },
    { shared: '/', alias: '/home', source: '', publicPath: '/home' },
    { shared: '/about', alias: '/', source: '/about', publicPath: '' },
  ];

  describe.each([false, true])(
    'string pathConfig, prefixDefaultLocale=%s',
    (prefixDefaultLocale) => {
      it.each(cases)(
        'redirects and rewrites $shared -> $alias',
        ({ shared, alias, source, publicPath }) => {
          const middleware = createNextMiddleware({
            prefixDefaultLocale,
            pathConfig: { [shared]: alias },
          });
          const response = middleware(
            new NextRequest(origin + '/fr' + source + query)
          );
          expect(response.headers.get('location')).toBe(
            origin + '/fr' + publicPath + query
          );
          const terminal = middleware(
            new NextRequest(origin + '/fr' + publicPath + query)
          );
          expect(terminal.headers.get('location')).toBeNull();
          expect(terminal.headers.get('x-middleware-rewrite')).toBe(
            origin + '/fr' + source + query
          );
          expect(terminal.headers.get(defaultLocaleHeaderName)).toBe('fr');
        }
      );

      it('recognizes default aliases despite a different preferred locale', () => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale,
          pathConfig: { '/blog/[slug]': '/articles/[slug]' },
        });
        const req = new NextRequest(
          origin +
            (prefixDefaultLocale ? '/en' : '') +
            '/articles/hello' +
            query
        );
        req.cookies.set(defaultLocaleCookieName, 'fr');
        const response = middleware(req);
        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('x-middleware-rewrite')).toBe(
          origin + '/en/blog/hello' + query
        );
        expect(response.headers.get(defaultLocaleHeaderName)).toBe('en');
      });
    }
  );

  it('preserves base path, trailing slash, query and override destination', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/blog/[slug]': '/articles/[slug]' },
      routeOverrides: { fr: ['/blog/[slug]'] },
    });
    const req = new NextRequest(origin + '/portal/fr/articles/hello/' + query, {
      nextConfig: { basePath: '/portal', trailingSlash: true },
    });
    const response = middleware(req);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      origin + '/portal/fr/fr/blog/hello/' + query
    );
  });

  it('recognizes a regional locale alias', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': '/company' },
    });
    const response = middleware(new NextRequest(origin + '/en-GB/company'));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      origin + '/en-GB/about'
    );
    expect(response.headers.get(defaultLocaleHeaderName)).toBe('en-GB');
  });

  it('round trips an empty-string alias through the default root', () => {
    const middleware = createNextMiddleware({ pathConfig: { '/about': '' } });
    const defaultResponse = middleware(new NextRequest(origin + '/about'));
    expect(defaultResponse.headers.get('location')).toBe(origin + '/');
    const defaultTerminal = middleware(
      new NextRequest(defaultResponse.headers.get('location')!)
    );
    expect(defaultTerminal.headers.get('location')).toBeNull();
    expect(defaultTerminal.headers.get('x-middleware-rewrite')).toBe(
      origin + '/en/about'
    );
  });

  it('resolves a direct default-root request through an empty-string alias', () => {
    const middleware = createNextMiddleware({ pathConfig: { '/about': '' } });
    const directRoot = middleware(new NextRequest(origin + '/'));
    expect(directRoot.headers.get('location')).toBeNull();
    expect(directRoot.headers.get('x-middleware-rewrite')).toBe(
      origin + '/en/about'
    );
  });

  it('preserves empty-string aliases for prefixed locales', () => {
    const middleware = createNextMiddleware({ pathConfig: { '/about': '' } });
    const response = middleware(new NextRequest(origin + '/fr/about'));
    expect(response.headers.get('location')).toBe(origin + '/fr');
    const terminal = middleware(new NextRequest(origin + '/fr'));
    expect(terminal.headers.get('location')).toBeNull();
    expect(terminal.headers.get('x-middleware-rewrite')).toBe(
      origin + '/fr/about'
    );
  });

  it('resolves the source alias during a locale reset and terminates', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/blog/[slug]': '/articles/[slug]' },
    });
    const req = new NextRequest(origin + '/fr/articles/hello');
    req.cookies.set(defaultLocaleCookieName, 'en');
    req.cookies.set(defaultResetLocaleCookieName, 'true');
    const response = middleware(req);
    expect(response.headers.get('location')).toBe(origin + '/articles/hello');
    const terminal = middleware(
      new NextRequest(origin + '/articles/hello', { headers: req.headers })
    );
    expect(terminal.headers.get('location')).toBeNull();
    expect(terminal.headers.get('x-middleware-rewrite')).toBe(
      origin + '/en/blog/hello'
    );
    expect(terminal.cookies.get(defaultResetLocaleCookieName)?.value).toBe('');
  });

  it('does not mutate frozen caller configuration', () => {
    const objectEntry = Object.freeze({ fr: '/contactez' });
    const pathConfig = Object.freeze({
      '/about': '/company',
      '/contact': objectEntry,
    });
    const middleware = createNextMiddleware({ pathConfig });
    expect(
      middleware(new NextRequest(origin + '/fr/company')).headers.get(
        'x-middleware-rewrite'
      )
    ).toBe(origin + '/fr/about');
    expect(pathConfig['/about']).toBe('/company');
    expect(pathConfig['/contact']).toBe(objectEntry);
  });

  it('retains more specific static aliases alongside a string catchall', () => {
    const middleware = createNextMiddleware({
      pathConfig: {
        '/blog/[...slug]': '/articles/[...slug]',
        '/featured': { fr: '/articles/featured' },
      },
    });
    expect(
      middleware(new NextRequest(origin + '/fr/articles/featured')).headers.get(
        'x-middleware-rewrite'
      )
    ).toBe(origin + '/fr/featured');
    expect(
      middleware(new NextRequest(origin + '/fr/articles/other')).headers.get(
        'x-middleware-rewrite'
      )
    ).toBe(origin + '/fr/blog/other');
  });
});

describe('dynamic route ownership', () => {
  beforeEach(() => stubRoutingEnv({ locales: ['en', 'fr', 'de', 'pt-BR'] }));
  const get = (path: string) => new NextRequest(new URL(path, origin));

  describe.each([false, true])(
    'root routes with prefixDefaultLocale=%s',
    (prefixDefaultLocale) => {
      for (const template of [
        '/[slug]',
        '/[section]/[slug]',
        '/[...slug]',
        '/[[...slug]]',
      ]) {
        const suffix =
          template === '/[section]/[slug]' ? '/about/team' : '/about';
        it.each(['en', 'fr', 'pt-BR'])(
          `excludes %s from shared ${template} parameters`,
          (locale) => {
            const middleware = createNextMiddleware({
              prefixDefaultLocale,
              pathConfig: { [template]: { en: template } },
            });
            const pathname =
              !prefixDefaultLocale && locale === 'en'
                ? suffix
                : `/${locale}${suffix}`;
            const res = middleware(get(pathname + '?tag=one&tag=two'));
            expect(res.headers.get('location')).toBeNull();
            expect(res.headers.get('x-generaltranslation-locale')).toBe(locale);
            const rewrite = res.headers.get('x-middleware-rewrite');
            if (rewrite)
              expect(new URL(rewrite).pathname).toBe(`/${locale}${suffix}`);
            expect(res.status).toBe(200);
          }
        );
      }

      it.each(['/[...slug]', '/[[...slug]]'])(
        'terminates redirect chains for %s',
        (template) => {
          const middleware = createNextMiddleware({
            prefixDefaultLocale,
            pathConfig: { [template]: { en: template } },
          });
          let path = '/fr/about';
          const visited = new Set<string>();
          for (let hop = 0; hop < 4; hop++) {
            expect(visited.has(path)).toBe(false);
            visited.add(path);
            const response = middleware(get(path));
            const location = response.headers.get('location');
            if (!location) {
              expect(path).toBe('/fr/about');
              return;
            }
            expect(new URL(location).origin).toBe(origin);
            path = new URL(location).pathname;
          }
          expect.fail('The redirect chain did not terminate within four hops');
        }
      );
    }
  );

  describe('localized and shared route specificity', () => {
    it.each(['/[section]/[slug]', '/[...slug]', '/[[...slug]]'])(
      'prefers shared /about over %s even without a French alias',
      (template) => {
        const config = {
          [template]: { en: template },
          '/about': { en: '/about' },
        };
        const matcher = createPathToSharedPathMap(
          config,
          true,
          'en'
        ).pathToSharedPath;
        expect(getSharedPath('/fr/about', matcher, 'fr')).toMatchObject({
          sharedPath: '/about',
          matchedPathname: '/about',
        });
        expect(
          createNextMiddleware({
            pathConfig: config,
            prefixDefaultLocale: true,
          })(get('/fr/about')).headers.get('location')
        ).toBeNull();
      }
    );
    it('does not let a localized root catch-all hide a shared static route', () => {
      const config = {
        '/cms/[...slug]': { fr: '/[...slug]' },
        '/about': { en: '/about' },
      };
      const matcher = createPathToSharedPathMap(
        config,
        true,
        'en'
      ).pathToSharedPath;
      expect(getSharedPath('/fr/about', matcher, 'fr')?.sharedPath).toBe(
        '/about'
      );
    });
    it('prefers an explicit localized path when specificity ties', () => {
      const config = {
        '/a/[id]': { fr: '/b/[id]' },
        '/b/[id]': { en: '/b/[id]' },
      };
      const matcher = createPathToSharedPathMap(
        config,
        true,
        'en'
      ).pathToSharedPath;
      expect(getSharedPath('/fr/b/123', matcher, 'fr')).toMatchObject({
        sharedPath: '/a/[id]',
        matchedPathname: '/fr/b/123',
      });
    });
    it('does not add a trailing slash to an unconfigured locale landing page', () => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
        pathConfig: { '/': { en: '/' } },
      });
      expect(middleware(get('/fr')).headers.get('location')).toBeNull();
    });
  });

  describe('Next.js parameter names', () => {
    it.each(['post.id', 'post[id', 'post..id', '章.節'])(
      'supports catch-all parameter name %s',
      (name) => {
        for (const optional of [false, true]) {
          const segment = optional ? `[[...${name}]]` : `[...${name}]`;
          expect(getDynamicSegmentType(segment)).toBe(
            optional ? 'optional-catch-all' : 'catch-all'
          );
          const middleware = createNextMiddleware({
            prefixDefaultLocale: true,
            pathConfig: {
              [`/posts/${segment}`]: { fr: `/articles/${segment}` },
            },
          });
          for (const tail of ['one', 'one/two/three']) {
            const response = middleware(get('/fr/articles/' + tail));
            expect(response.headers.get('location')).toBeNull();
            expect(response.headers.get('x-middleware-rewrite')).toBe(
              'http://localhost:3000/fr/posts/' + tail
            );
          }
        }
      }
    );
    it.each(['post.id', 'post..id', 'post.', 'post[id', 'a-b', 'a_b', '章.節'])(
      'recognizes and rewrites [%s]',
      (name) => {
        expect(getDynamicSegmentType(`[${name}]`)).toBe('dynamic');
        const middleware = createNextMiddleware({
          prefixDefaultLocale: true,
          pathConfig: { [`/posts/[${name}]`]: { fr: `/articles/[${name}]` } },
        });
        const res = middleware(get('/fr/articles/123'));
        expect(res.headers.get('location')).toBeNull();
        expect(res.headers.get('x-middleware-rewrite')).toBe(
          'http://localhost:3000/fr/posts/123'
        );
      }
    );
    it.each(['[.id]', '[..id]', '[[id]]', '[]', '[id/slug]'])(
      'does not classify invalid ordinary segment %s as dynamic',
      (segment) => {
        expect(getDynamicSegmentType(segment)).not.toBe('dynamic');
      }
    );
  });

  describe('locale switching from a standardized alias', () => {
    it.each([
      [true, 'fr', '/fr/a-propos'],
      [false, 'fr', '/fr/a-propos'],
      [true, 'en', '/en/about-us'],
      [false, 'en', '/about-us'],
    ] as const)(
      'prefix=%s, target=%s keeps the original shared route',
      (prefixDefaultLocale, target, expected) => {
        stubRoutingEnv({ locales: ['en', 'fr', 'fil'], services: true });
        const middleware = createNextMiddleware({
          prefixDefaultLocale,
          pathConfig: {
            '/about': { en: '/about-us', fr: '/a-propos', fil: '/tungkol' },
          },
        });
        const req = get('/tl/tungkol?tag=one&tag=two');
        req.cookies.set('generaltranslation.locale', target);
        req.cookies.set('generaltranslation.locale-reset', 'true');
        const response = middleware(req);
        expect(response.headers.get('location')).toBe(
          origin + expected + '?tag=one&tag=two'
        );
        const next = middleware(get(expected));
        expect(next.headers.get('location')).toBeNull();
        expect(next.headers.get('x-middleware-rewrite')).toBe(
          'http://localhost:3000/' + target + '/about'
        );
      }
    );
  });
});

describe('default root aliases', () => {
  beforeEach(() => stubRoutingEnv());

  const query = '?tag=a&tag=b&raw=%2F%252F';
  const configurations: {
    name: string;
    pathConfig: PathConfig;
    localizedRoot: string;
  }[] = [
    {
      name: 'French-only homepage alias',
      pathConfig: { '/': { fr: '/accueil' } },
      localizedRoot: '/accueil',
    },
    {
      name: 'explicit default homepage alias',
      pathConfig: { '/': { en: '/', fr: '/accueil' } },
      localizedRoot: '/accueil',
    },
    {
      name: 'empty optional root catchall',
      pathConfig: {
        '/[[...slug]]': { en: '/[[...slug]]', fr: '/pages/[[...slug]]' },
      },
      localizedRoot: '/pages',
    },
  ];

  describe.each(configurations)('$name', ({ pathConfig, localizedRoot }) => {
    it.each(['', '/'])(
      'redirects the locale root to its alias with slash "%s"',
      (slash) => {
        const middleware = createNextMiddleware({ pathConfig });
        const response = middleware(
          new NextRequest(origin + '/fr' + slash + query)
        );
        const destination = origin + '/fr' + localizedRoot + slash + query;

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(destination);
        const followed = middleware(new NextRequest(destination));
        expect(followed.headers.get('location')).toBeNull();
        expect(followed.headers.get('x-middleware-rewrite')).toBe(
          origin + '/fr' + slash + query
        );
      }
    );

    it('rewrites the unprefixed homepage without redirecting to itself', () => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
        pathConfig,
      });
      const response = middleware(new NextRequest(origin + '/' + query));

      expect(response.headers.get('location')).toBeNull();
      const rewrite = response.headers.get('x-middleware-rewrite');
      expect(rewrite).not.toBeNull();
      const destination = new URL(rewrite!);
      // Either internal root slash style is valid; the public URL must terminate.
      expect(destination.pathname.replace(/\/$/, '')).toBe('/en');
      expect(destination.origin).toBe(origin);
      expect(destination.search).toBe(query);
      expect(response.headers.get(defaultLocaleHeaderName)).toBe('en');
    });

    it.each(['', '/'])(
      'keeps the prefixed homepage with slash "%s" as a terminating control',
      (slash) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale: true,
          pathConfig,
        });
        const response = middleware(
          new NextRequest(origin + '/en' + slash + query)
        );

        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('x-middleware-next')).toBe('1');
        expect(response.headers.get(defaultLocaleHeaderName)).toBe('en');
      }
    );
  });

  describe('bare locale root lookup', () => {
    it.each([false, true])(
      'matches the shared root with localizedRoot=%s',
      (localized) => {
        const matcher = localized
          ? createPathToSharedPathMap({ '/': { fr: '/accueil' } }, false, 'en')
              .pathToSharedPath
          : createPathMatcher([['/', '/']]);

        expect(getSharedPath('/fr', matcher, 'fr')).toEqual({
          sharedPath: '/',
          pathTemplate: '/',
          matchedPathname: '/',
        });
        expect(getSharedPath('', matcher, undefined)).toBeUndefined();
      }
    );

    it('prefers the static root over an optional catch-all', () => {
      const matcher = createPathToSharedPathMap(
        {
          '/': { fr: '/accueil' },
          '/[[...slug]]': { fr: '/pages/[[...slug]]' },
        },
        false,
        'en'
      ).pathToSharedPath;

      expect(getSharedPath('/fr', matcher, 'fr')?.sharedPath).toBe('/');
    });
  });
});

describe('literal default-locale dynamic aliases', () => {
  beforeEach(() => stubRoutingEnv());

  it.each([
    ['v1.0', 'v1X0'],
    ['a+b', 'aaab'],
    ['docs(v2)', 'docsv2'],
    ['left|right', 'left'],
    ['cost$', 'cost'],
  ])(
    'recognizes %s before the locale cookie, but not %s',
    (literal, lookalike) => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
        pathConfig: {
          '/shared/articles/[id]': {
            en: `/english/${literal}/[id]`,
            fr: '/french/articles/[id]',
          },
        },
      });
      const request = (segment: string) => {
        const req = new NextRequest(`${origin}/english/${segment}/one`);
        req.cookies.set(defaultLocaleCookieName, 'fr');
        return req;
      };

      const matched = middleware(request(literal));
      expect(matched.headers.get(defaultLocaleHeaderName)).toBe('en');
      expect(matched.headers.get('location')).toBeNull();
      expect(
        new URL(matched.headers.get('x-middleware-rewrite')!).pathname
      ).toBe('/en/shared/articles/one');

      const unmatched = middleware(request(lookalike));
      expect(unmatched.headers.get(defaultLocaleHeaderName)).toBe('fr');
      expect(unmatched.headers.get('x-middleware-rewrite')).toBeNull();
      expect(new URL(unmatched.headers.get('location')!).pathname).toBe(
        `/fr/english/${lookalike}/one`
      );
    }
  );
});
