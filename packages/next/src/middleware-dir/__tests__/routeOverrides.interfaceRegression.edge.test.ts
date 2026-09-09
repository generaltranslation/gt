// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from '@generaltranslation/react-core/pure';
import { defaultLocaleHeaderName } from '../../utils/headers';
import { createNextMiddleware } from '../createNextMiddleware';

type Config = NonNullable<Parameters<typeof createNextMiddleware>[0]>;
type Preference = { locale?: string; language?: string; reset?: boolean };
const origin = 'http://localhost:3000';
const search = '?tag=first&tag=second&raw=%2F%252F&empty=';

beforeEach(() => {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({ defaultLocale: 'en', locales: ['en', 'fr', 'de'] })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'false');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
});
afterEach(() => vi.unstubAllEnvs());

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

function expectRewrite(response: Response, path: string, locale: string) {
  expect(response.status).toBe(200);
  expect(response.headers.get('location')).toBeNull();
  expect(response.headers.get('x-middleware-rewrite')).toBe(
    origin + path + search
  );
  expect(response.headers.get(defaultLocaleHeaderName)).toBe(locale);
}

function expectNext(response: Response, locale: string) {
  expect(response.status).toBe(200);
  expect(response.headers.get('location')).toBeNull();
  expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  expect(response.headers.get('x-middleware-next')).toBe('1');
  expect(response.headers.get(defaultLocaleHeaderName)).toBe(locale);
}

function expectRedirect(response: Response, path: string, locale: string) {
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe(origin + path + search);
  expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  expect(response.headers.get(defaultLocaleHeaderName)).toBe(locale);
}

describe('pathConfig overrides: public URLs and preference changes', () => {
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
        pathConfig: { '/blog': { fr: { override: true } } },
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
      pathConfig: { '/blog': { fr: { override: true } } },
    });
    expectRewrite(
      middleware(request('/blog', { locale: 'en', language: 'fr' })),
      '/en/blog',
      'en'
    );
  });

  it('does not use French browser language when browser detection is disabled', () => {
    vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'true');
    const middleware = createNextMiddleware({
      pathConfig: { '/blog': { fr: { override: true } } },
    });
    expectRewrite(
      middleware(request('/blog', { language: 'fr' })),
      '/en/blog',
      'en'
    );
  });

  it('gives an explicit French URL priority over an English cookie', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/blog': { fr: { override: true } } },
    });
    expectRewrite(
      middleware(request('/fr/blog', { locale: 'en' })),
      '/fr/fr/blog',
      'fr'
    );
  });

  it('switches away from a French override through the public English URL', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/blog': { fr: { override: true } } },
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
        pathConfig: { '/blog': { en: { override: true } } },
      });
      if (prefixDefaultLocale)
        expectRedirect(middleware(request('/blog')), publicPath, 'en');
      expectRewrite(middleware(request(publicPath)), '/en/en/blog', 'en');
    }
  );

  it('keeps the override internal when adding a French prefix to a nested path', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/docs/[...slug]': { fr: { override: true } } },
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

describe('pathConfig overrides: locale and route isolation', () => {
  const config: Config = {
    pathConfig: {
      '/account': { en: { override: true } },
      '/blog': { fr: { override: true } },
      '/support': { de: { override: true } },
    },
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
    expectNext(middleware(request('/fr/blog', { locale: 'fr' })), 'fr');
  });
});

describe('pathConfig overrides: route boundaries', () => {
  it.each([
    { name: 'bare root', template: '/', path: '/fr', destination: '/fr/fr' },
    {
      name: 'root with public trailing delimiter',
      template: '/',
      path: '/fr/',
      destination: '/fr/fr',
    },
    {
      name: 'optional root with zero segments',
      template: '/[[...slug]]',
      path: '/fr',
      destination: '/fr/fr',
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
      pathConfig: { [template]: { fr: { override: true } } },
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
        pathConfig: { [template]: { fr: { override: true } } },
      })(request(path)),
      'fr'
    );
  });
});

describe('pathConfig overrides: composition with localized paths', () => {
  it.each([
    {
      name: 'static French alias',
      shared: '/about',
      alias: '/a-propos',
      path: '/fr/a-propos',
      destination: '/fr/fr/about',
    },
    {
      name: 'root alias',
      shared: '/',
      alias: '/accueil',
      path: '/fr/accueil',
      destination: '/fr/fr',
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
        pathConfig: { [shared]: { fr: { path: alias, override: true } } },
      });
      expectRewrite(middleware(request(path)), destination, 'fr');
    }
  );

  it('redirects the shared spelling to its alias before applying the override', () => {
    const middleware = createNextMiddleware({
      pathConfig: {
        '/docs/[...slug]': {
          fr: { path: '/guides/[...tail]', override: true },
        },
      },
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
        '/about': {
          fr: { path: '/a-propos', override: true },
          de: '/uber-uns',
        },
      },
    });
    expectRewrite(middleware(request('/de/uber-uns')), '/de/about', 'de');
    expectRewrite(middleware(request('/fr/a-propos')), '/fr/fr/about', 'fr');
  });

  it('composes an identity path with a French override', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { fr: { path: '/about', override: true } } },
    });
    expectRewrite(middleware(request('/fr/about')), '/fr/fr/about', 'fr');
  });

  it('allows an omitted localized path without disabling an override', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/blog': { fr: { override: true } } },
    });
    expectRewrite(middleware(request('/fr/blog')), '/fr/fr/blog', 'fr');
  });

  it('keeps an explicitly disabled override as ordinary localized routing', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/about': { fr: { path: '/a-propos', override: false } } },
    });
    expectRewrite(middleware(request('/fr/a-propos')), '/fr/about', 'fr');
  });

  it('preserves a repeated base path, encoded id, slash and query in the implementation', () => {
    const middleware = createNextMiddleware({
      pathConfig: {
        '/corp/products/[id]': {
          fr: { path: '/boutique/[product]', override: true },
        },
      },
    });
    expectRewrite(
      middleware(request('/corp/fr/boutique/a%2Fb/', {}, '/corp')),
      '/corp/fr/fr/corp/products/a%2Fb/',
      'fr'
    );
  });

  it('preserves the base path on both the public redirect and override rewrite', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/blog': { fr: { override: true } } },
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
