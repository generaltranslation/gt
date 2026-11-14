// @vitest-environment edge-runtime
import { describe, it } from 'vitest';
import { NextRequest } from 'next/server';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from 'gt-i18n/internal/cookies';
import { createNextMiddleware } from '../createNextMiddleware';
import type { RouteOverrides } from '../types';
import type { PathConfig } from '../createPathMatcher';
import {
  expectRoutedResponse,
  stubRoutingEnv,
  useRoutingEnv,
} from './routingTestUtils';

type Config = NonNullable<Parameters<typeof createNextMiddleware>[0]>;
type Preference = { locale?: string; language?: string; reset?: boolean };
type MiddlewareResponse = ReturnType<ReturnType<typeof createNextMiddleware>>;
const origin = 'http://localhost:3000';
const search = '?tag=first&tag=second&raw=%2F%252F&empty=';

useRoutingEnv({ locales: ['en', 'fr', 'de'], browserLocales: true });

function request(path: string, preference: Preference = {}, basePath?: string) {
  const req = new NextRequest(origin + path + search, {
    headers: preference.language
      ? { 'accept-language': preference.language }
      : undefined,
    nextConfig: basePath ? { basePath } : undefined,
  });
  if (preference.locale) {
    req.cookies.set(defaultLocaleCookieName, preference.locale);
  }
  if (preference.reset) req.cookies.set(defaultResetLocaleCookieName, 'true');
  return req;
}

function expectRewrite(
  response: MiddlewareResponse,
  path: string,
  locale: string
) {
  expectRoutedResponse(response, 'rewrite', locale, origin + path + search);
}

function expectNext(response: MiddlewareResponse, locale: string) {
  expectRoutedResponse(response, 'next', locale);
}

function expectRedirect(
  response: MiddlewareResponse,
  path: string,
  locale: string
) {
  expectRoutedResponse(response, 'redirect', locale, origin + path + search);
}

describe('routeOverrides: public URLs and preference changes', () => {
  it.each([
    {
      name: 'saved French cookie',
      preference: { locale: 'fr', language: 'en' },
    },
    {
      name: 'fresh French browser language',
      preference: { language: 'fr-FR,fr;q=0.9,en;q=0.8' },
    },
  ])(
    'redirects then rewrites an override-only blog for $name',
    ({ preference }) => {
      const middleware = createNextMiddleware({
        routeOverrides: { fr: ['/blog'] },
      });

      // The public route has one locale; only the internal implementation has two.
      expectRedirect(
        middleware(request('/blog', preference)),
        '/fr/blog',
        'fr'
      );
      expectRewrite(
        middleware(request('/fr/blog', preference)),
        '/fr/fr/blog',
        'fr'
      );
    }
  );

  it('keeps an English cookie ahead of French browser language', () => {
    const middleware = createNextMiddleware({
      routeOverrides: { fr: ['/blog'] },
    });
    expectRewrite(
      middleware(request('/blog', { locale: 'en', language: 'fr' })),
      '/en/blog',
      'en'
    );
  });

  it('does not use French browser language when browser detection is disabled', () => {
    stubRoutingEnv({ locales: ['en', 'fr', 'de'] });
    const middleware = createNextMiddleware({
      routeOverrides: { fr: ['/blog'] },
    });
    expectRewrite(
      middleware(request('/blog', { language: 'fr' })),
      '/en/blog',
      'en'
    );
  });

  it('gives an explicit French URL priority over an English cookie', () => {
    const middleware = createNextMiddleware({
      routeOverrides: { fr: ['/blog'] },
    });
    expectRewrite(
      middleware(request('/fr/blog', { locale: 'en' })),
      '/fr/fr/blog',
      'fr'
    );
  });

  it('switches away from a French override through the public English URL', () => {
    const middleware = createNextMiddleware({
      routeOverrides: { fr: ['/blog'] },
    });
    expectRedirect(
      middleware(request('/fr/blog', { locale: 'en', reset: true })),
      '/blog',
      'en'
    );
    expectRewrite(
      middleware(request('/blog', { locale: 'en' })),
      '/en/blog',
      'en'
    );
  });

  it.each([
    { prefixDefaultLocale: false, publicPath: '/blog' },
    { prefixDefaultLocale: true, publicPath: '/en/blog' },
  ])(
    'rewrites a default-locale override with prefixDefaultLocale=$prefixDefaultLocale',
    ({ prefixDefaultLocale, publicPath }) => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale,
        routeOverrides: { en: ['/blog'] },
      });
      if (prefixDefaultLocale)
        expectRedirect(middleware(request('/blog')), publicPath, 'en');
      expectRewrite(middleware(request(publicPath)), '/en/en/blog', 'en');
    }
  );

  it('keeps the override internal when adding a French prefix to a nested path', () => {
    const middleware = createNextMiddleware({
      routeOverrides: { fr: ['/docs/[...slug]'] },
    });
    expectRedirect(
      middleware(request('/docs/start/install', { locale: 'fr' })),
      '/fr/docs/start/install',
      'fr'
    );
    expectRewrite(
      middleware(request('/fr/docs/start/install')),
      '/fr/fr/docs/start/install',
      'fr'
    );
  });
});

describe('routeOverrides: locale and route isolation', () => {
  const config: Config = {
    routeOverrides: { de: ['/support'], fr: ['/blog'], en: ['/account'] },
  };

  it.each([
    { path: '/account', destination: '/en/en/account', locale: 'en' },
    { path: '/fr/blog', destination: '/fr/fr/blog', locale: 'fr' },
    { path: '/de/support', destination: '/de/de/support', locale: 'de' },
  ])('selects the owning locale for $path', ({ path, destination, locale }) => {
    expectRewrite(
      createNextMiddleware(config)(request(path)),
      destination,
      locale
    );
  });

  it.each([
    { path: '/fr/support', locale: 'fr' },
    { path: '/de/blog', locale: 'de' },
    { path: '/fr/blogger', locale: 'fr' },
    { path: '/fr/blog/archive', locale: 'fr' },
  ])(
    'does not borrow another locale or extend a static override at $path',
    ({ path, locale }) => {
      expectNext(createNextMiddleware(config)(request(path)), locale);
    }
  );

  it('does not leak the previous request locale when reusing a middleware instance', () => {
    const middleware = createNextMiddleware(config);
    expectRewrite(middleware(request('/fr/blog')), '/fr/fr/blog', 'fr');
    expectNext(middleware(request('/de/blog')), 'de');
    expectRewrite(middleware(request('/account')), '/en/en/account', 'en');
    expectRewrite(middleware(request('/de/support')), '/de/de/support', 'de');
    expectNext(middleware(request('/fr/support')), 'fr');
  });

  it('ignores overrides when locale routing is disabled', () => {
    const middleware = createNextMiddleware({
      ...config,
      localeRouting: false,
    });
    expectRoutedResponse(
      middleware(request('/fr/blog', { locale: 'fr' })),
      'next',
      'fr',
      undefined,
      false
    );
  });
});

describe('routeOverrides: route boundaries', () => {
  it.each([
    { name: 'bare root', template: '/', path: '/fr', destination: '/fr/fr' },
    {
      name: 'root with public trailing delimiter',
      template: '/',
      path: '/fr/',
      destination: '/fr/fr/',
    },
    {
      name: 'optional root with zero segments',
      template: '/[[...slug]]',
      path: '/fr',
      destination: '/fr/fr',
    },
    {
      name: 'optional root with zero segments and a trailing slash',
      template: '/[[...slug]]',
      path: '/fr/',
      destination: '/fr/fr/',
    },
    {
      name: 'optional root with multiple segments',
      template: '/[[...slug]]',
      path: '/fr/news/world',
      destination: '/fr/fr/news/world',
    },
    {
      name: 'required root with one segment',
      template: '/[...slug]',
      path: '/fr/news',
      destination: '/fr/fr/news',
    },
    {
      name: 'required root with multiple segments',
      template: '/[...slug]',
      path: '/fr/news/world',
      destination: '/fr/fr/news/world',
    },
    {
      name: 'nested optional landing',
      template: '/library/[[...slug]]',
      path: '/fr/library',
      destination: '/fr/fr/library',
    },
    {
      name: 'nested optional single tail',
      template: '/library/[[...slug]]',
      path: '/fr/library/start',
      destination: '/fr/fr/library/start',
    },
    {
      name: 'nested optional deep tail',
      template: '/library/[[...slug]]',
      path: '/fr/library/start/install',
      destination: '/fr/fr/library/start/install',
    },
    {
      name: 'nested required single tail',
      template: '/docs/[...slug]',
      path: '/fr/docs/start',
      destination: '/fr/fr/docs/start',
    },
    {
      name: 'nested required deep tail and slash',
      template: '/docs/[...slug]',
      path: '/fr/docs/start/install/',
      destination: '/fr/fr/docs/start/install/',
    },
    {
      name: 'category followed by a required tail',
      template: '/docs/[category]/[...slug]',
      path: '/fr/docs/science/one/two',
      destination: '/fr/fr/docs/science/one/two',
    },
    {
      name: 'encoded separators remain raw tail data',
      template: '/docs/[...slug]',
      path: '/fr/docs/a%2Fb/%252F',
      destination: '/fr/fr/docs/a%2Fb/%252F',
    },
  ])('rewrites $name', ({ template, path, destination }) => {
    const middleware = createNextMiddleware({
      routeOverrides: { fr: [template] },
    });
    expectRewrite(middleware(request(path)), destination, 'fr');
  });

  it.each([
    {
      name: 'required root tail is absent',
      template: '/[...slug]',
      path: '/fr',
    },
    {
      name: 'required nested tail is absent',
      template: '/docs/[...slug]',
      path: '/fr/docs',
    },
    {
      name: 'category does not supply the required tail',
      template: '/docs/[category]/[...slug]',
      path: '/fr/docs/science',
    },
    {
      name: 'singular parameter does not accept a second segment',
      template: '/products/[id]',
      path: '/fr/products/one/two',
    },
  ])('leaves routing to Next when $name', ({ template, path }) => {
    // Middleware has no route-file inventory: a nonmatch continues to Next, not a fabricated 404.
    expectNext(
      createNextMiddleware({
        routeOverrides: { fr: [template] },
      })(request(path)),
      'fr'
    );
  });
});

describe('routeOverrides: composition with localized paths', () => {
  it.each([
    {
      name: 'static French alias',
      shared: '/about',
      alias: '/a-propos',
      path: '/fr/a-propos',
      destination: '/fr/fr/about',
    },
    {
      name: 'empty optional root alias',
      shared: '/[[...slug]]',
      alias: '/pages/[[...tail]]',
      path: '/fr/pages',
      destination: '/fr/fr',
    },
    {
      name: 'empty nested optional alias',
      shared: '/library/[[...slug]]',
      alias: '/bibliotheque/[[...tail]]',
      path: '/fr/bibliotheque',
      destination: '/fr/fr/library',
    },
    {
      name: 'localized static depth before renamed parameters',
      shared: '/docs/[category]/[...slug]',
      alias: '/centre/aide/[section]/[...tail]',
      path: '/fr/centre/aide/science/one/two',
      destination: '/fr/fr/docs/science/one/two',
    },
    {
      name: 'shared static depth before renamed parameters',
      shared: '/content/archive/[category]/[...slug]',
      alias: '/aide/[section]/[...tail]',
      path: '/fr/aide/science/a%2Fb/%252F',
      destination: '/fr/fr/content/archive/science/a%2Fb/%252F',
    },
  ])(
    'matches the shared override behind $name',
    ({ shared, alias, path, destination }) => {
      const middleware = createNextMiddleware({
        pathConfig: { [shared]: { fr: alias } },
        routeOverrides: { fr: [shared] },
      });
      expectRewrite(middleware(request(path)), destination, 'fr');
    }
  );

  it('redirects the shared spelling to its alias before applying the override', () => {
    const middleware = createNextMiddleware({
      pathConfig: {
        '/docs/[...slug]': { fr: '/guides/[...tail]' },
      },
      routeOverrides: { fr: ['/docs/[...slug]'] },
    });
    expectRedirect(
      middleware(request('/fr/docs/start/install')),
      '/fr/guides/start/install',
      'fr'
    );
    expectRewrite(
      middleware(request('/fr/guides/start/install')),
      '/fr/fr/docs/start/install',
      'fr'
    );
  });

  it('uses a German shared implementation when only French has an override', () => {
    const middleware = createNextMiddleware({
      pathConfig: {
        '/about': { fr: '/a-propos', de: '/uber-uns' },
      },
      routeOverrides: { fr: ['/about'] },
    });
    expectRewrite(middleware(request('/de/uber-uns')), '/de/about', 'de');
    expectRewrite(middleware(request('/fr/a-propos')), '/fr/fr/about', 'fr');
  });

  it('composes an identity path with a French override', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { fr: '/about' } },
      routeOverrides: { fr: ['/about'] },
    });
    expectRewrite(middleware(request('/fr/about')), '/fr/fr/about', 'fr');
  });

  it('allows an omitted localized path without disabling an override', () => {
    const middleware = createNextMiddleware({
      routeOverrides: { fr: ['/blog'] },
    });
    expectRewrite(middleware(request('/fr/blog')), '/fr/fr/blog', 'fr');
  });

  it('keeps a locale without overrides on ordinary localized routing', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { fr: '/a-propos' } },
      routeOverrides: {},
    });
    expectRewrite(middleware(request('/fr/a-propos')), '/fr/about', 'fr');
  });

  it('matches literal regex characters and encoded localized Unicode paths', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/cafe/[slug]': { fr: '/café/[slug]' } },
      routeOverrides: { fr: ['/cafe/[slug]', '/docs/v1.0/[...slug]'] },
    });
    expectRewrite(
      middleware(request('/fr/docs/v1.0/setup')),
      '/fr/fr/docs/v1.0/setup',
      'fr'
    );
    expectNext(middleware(request('/fr/docs/v1x0/setup')), 'fr');
    expectRewrite(
      middleware(request('/fr/caf%C3%A9/guides')),
      '/fr/fr/cafe/guides',
      'fr'
    );
  });

  it('preserves a repeated base path, encoded id, slash and query in the implementation', () => {
    const middleware = createNextMiddleware({
      pathConfig: {
        '/corp/products/[id]': { fr: '/boutique/[product]' },
      },
      routeOverrides: { fr: ['/corp/products/[id]'] },
    });
    expectRewrite(
      middleware(request('/corp/fr/boutique/a%2Fb/', {}, '/corp')),
      '/corp/fr/fr/corp/products/a%2Fb/',
      'fr'
    );
  });

  it('preserves the base path on both the public redirect and override rewrite', () => {
    const middleware = createNextMiddleware({
      routeOverrides: { fr: ['/blog'] },
    });
    expectRedirect(
      middleware(request('/corp/blog', { locale: 'fr' }, '/corp')),
      '/corp/fr/blog',
      'fr'
    );
    expectRewrite(
      middleware(request('/corp/fr/blog', {}, '/corp')),
      '/corp/fr/fr/blog',
      'fr'
    );
  });
});

describe('routeOverrides: locale roots', () => {
  it.each(['', '/'])(
    'redirects the locale root with slash "%s" to its alias before applying the override',
    (slash) => {
      const middleware = createNextMiddleware({
        pathConfig: { '/': { fr: '/accueil' } },
        routeOverrides: { fr: ['/'] },
      });
      expectRedirect(
        middleware(request('/fr' + slash)),
        '/fr/accueil' + slash,
        'fr'
      );
      expectRewrite(
        middleware(request('/fr/accueil' + slash)),
        '/fr/fr' + slash,
        'fr'
      );
    }
  );

  // The rewrite targets the locale-specific root, without alias segments.
  it.each([
    {
      name: 'trailing-slash empty optional root catchall alias',
      shared: '/[[...slug]]',
      localized: '/pages/[[...slug]]',
      path: '/fr/pages/',
      destination: '/fr/fr/',
    },
    {
      name: 'homepage with an identity alias',
      shared: '/',
      localized: '/',
      path: '/fr',
      destination: '/fr/fr',
    },
    {
      name: 'trailing-slash homepage with an identity alias',
      shared: '/',
      localized: '/',
      path: '/fr/',
      destination: '/fr/fr/',
    },
    {
      name: 'trailing-slash empty optional root with an identity alias',
      shared: '/[[...slug]]',
      localized: '/[[...slug]]',
      path: '/fr/',
      destination: '/fr/fr/',
    },
  ])('rewrites $name', ({ shared, localized, path, destination }) => {
    const middleware = createNextMiddleware({
      pathConfig: { [shared]: { fr: localized } },
      routeOverrides: { fr: [shared] },
    });
    expectRewrite(middleware(request(path)), destination, 'fr');
  });
});

/**
 * Every override rewrites /{locale}{page} to /{locale}/{locale}{page}. The
 * matrix crosses each route shape with shared/localized public paths and the
 * four ways a locale reaches the route, alternating the trailing slash so each
 * three-way combination appears; base paths and queries ride along.
 */
describe('routeOverrides: routing matrix', () => {
  const locales = ['en', 'fr', 'pt-BR'];

  type RouteShape = {
    name: string;
    template: string;
    concretePath: string;
    localizedTemplate: string;
    localizedConcretePath: string;
  };

  const routeShapes: RouteShape[] = [
    {
      name: 'static',
      template: '/campaign',
      concretePath: '/campaign',
      localizedTemplate: '/special',
      localizedConcretePath: '/special',
    },
    {
      name: 'dynamic',
      template: '/products/[productId]',
      concretePath: '/products/ramp-card',
      localizedTemplate: '/localized-products/[productId]',
      localizedConcretePath: '/localized-products/ramp-card',
    },
    {
      name: 'multiple dynamic',
      template: '/accounts/[accountId]/cards/[cardId]',
      concretePath: '/accounts/account-1/cards/card-2',
      localizedTemplate: '/localized-accounts/[accountId]/cards/[cardId]',
      localizedConcretePath: '/localized-accounts/account-1/cards/card-2',
    },
    {
      name: 'required catch-all',
      template: '/cms/[...slug]',
      concretePath: '/cms/guides/setup/step-1',
      localizedTemplate: '/localized-cms/[...slug]',
      localizedConcretePath: '/localized-cms/guides/setup/step-1',
    },
    {
      name: 'empty optional catch-all',
      template: '/news/[[...slug]]',
      concretePath: '/news',
      localizedTemplate: '/localized-news/[[...slug]]',
      localizedConcretePath: '/localized-news',
    },
    {
      name: 'populated optional catch-all',
      template: '/updates/[[...slug]]',
      concretePath: '/updates/world/latest/story-1',
      localizedTemplate: '/localized-updates/[[...slug]]',
      localizedConcretePath: '/localized-updates/world/latest/story-1',
    },
  ];

  const localeRoutings = [
    { name: 'unprefixed default', locale: 'en', prefixDefaultLocale: false },
    { name: 'prefixed default', locale: 'en', prefixDefaultLocale: true },
    { name: 'non-default', locale: 'fr', prefixDefaultLocale: false },
    {
      name: 'regional non-default',
      locale: 'pt-BR',
      prefixDefaultLocale: true,
    },
  ];

  type RouteOverrideCase = {
    basePath?: string;
    expectedPath: string;
    label: string;
    locale: string;
    pathConfig: PathConfig;
    routeOverrides: RouteOverrides;
    prefixDefaultLocale: boolean;
    requestPath: string;
    query: string;
  };

  const cases: RouteOverrideCase[] = [];
  routeShapes.forEach((shape, shapeIndex) => {
    [false, true].forEach((localizedPath, localizedIndex) => {
      localeRoutings.forEach(
        ({ name, locale, prefixDefaultLocale }, routingIndex) => {
          const id = cases.length + 1;
          const slash =
            (shapeIndex + localizedIndex + routingIndex) % 2 === 1 ? '/' : '';
          const basePath = id % 5 === 0 ? '/corp' : undefined;
          const query = id % 3 === 0 ? '?preview=1&tag=first&tag=second' : '';
          const localePrefix =
            prefixDefaultLocale || locale !== 'en' ? `/${locale}` : '';
          const publicPagePath = localizedPath
            ? shape.localizedConcretePath
            : shape.concretePath;

          cases.push({
            basePath,
            expectedPath: `${basePath || ''}/${locale}/${locale}${shape.concretePath}${slash}`,
            label: [
              shape.name,
              localizedPath ? 'localized public path' : 'shared public path',
              name,
              slash ? 'trailing slash' : 'no trailing slash',
              basePath ? 'base path' : 'no base path',
              query ? 'query' : 'no query',
            ].join(' | '),
            locale,
            pathConfig: localizedPath
              ? { [shape.template]: { [locale]: shape.localizedTemplate } }
              : {},
            routeOverrides: { [locale]: [shape.template] },
            prefixDefaultLocale,
            requestPath: `${basePath || ''}${localePrefix}${publicPagePath}${slash}`,
            query,
          });
        }
      );
    });
  });

  it.each(cases)('$label', (testCase) => {
    stubRoutingEnv({ locales });
    const middleware = createNextMiddleware({
      pathConfig: testCase.pathConfig,
      routeOverrides: testCase.routeOverrides,
      prefixDefaultLocale: testCase.prefixDefaultLocale,
    });

    const response = middleware(
      new NextRequest(origin + testCase.requestPath + testCase.query, {
        nextConfig: testCase.basePath
          ? { basePath: testCase.basePath }
          : undefined,
      })
    );

    expectRoutedResponse(
      response,
      'rewrite',
      testCase.locale,
      origin + testCase.expectedPath + testCase.query
    );
  });
});
