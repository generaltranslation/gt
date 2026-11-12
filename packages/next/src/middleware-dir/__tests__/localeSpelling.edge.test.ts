// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GTIntl } from 'generaltranslation/internal';
import { NextRequest } from 'next/server';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from 'gt-i18n/internal/cookies';
import type { CustomMapping } from '@generaltranslation/format';
import { createNextMiddleware } from '../createNextMiddleware';
import {
  expectRoutedResponse,
  stubRoutingEnv,
  type RoutingEnv,
} from './routingTestUtils';

type Middleware = ReturnType<typeof createNextMiddleware>;
type MiddlewareOptions = NonNullable<
  Parameters<typeof createNextMiddleware>[0]
>;
const origin = 'https://example.com';

/** Every suite here runs with GT services and browser-locale negotiation on. */
function configure(env: RoutingEnv) {
  stubRoutingEnv({ services: true, browserLocales: true, ...env });
}

afterEach(() => vi.unstubAllEnvs());

describe('configured locale spellings without custom mappings', () => {
  beforeEach(() =>
    configure({ defaultLocale: 'en-us', locales: ['en-us', 'en-gb', 'fr'] })
  );

  it('keeps distinct configured aliases that share a canonical language', () => {
    configure({
      locales: ['en', 'brand-uk', 'partner-uk'],
      customMapping: {
        'brand-uk': { code: 'en-GB' },
        'partner-uk': { code: 'en-GB' },
      },
    });
    const middleware = createNextMiddleware({
      pathConfig: { '/pricing': { 'partner-uk': '/prices' } },
      routeOverrides: { 'partner-uk': ['/pricing'] },
      localeRoutes: { 'partner-uk': ['/pricing'] },
    });
    const res = middleware(
      new NextRequest('https://example.com/partner-uk/prices')
    );
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/partner-uk/partner-uk/pricing'
    );
  });
  it.each(['en-gb', 'en-GB', 'EN-gb'])(
    'resolves cookie %s to the configured route',
    (locale) => {
      const req = new NextRequest('https://example.com/pricing');
      req.cookies.set('generaltranslation.locale', locale);
      const res = createNextMiddleware()(req);
      expect(res.headers.get('location')).toBe(
        'https://example.com/en-gb/pricing'
      );
    }
  );

  it('keeps a generated lowercase route and redirects equivalent spelling to it', () => {
    const middleware = createNextMiddleware();
    expect(
      middleware(
        new NextRequest('https://example.com/en-gb/pricing')
      ).headers.get('location')
    ).toBeNull();
    expect(
      middleware(
        new NextRequest('https://example.com/en-GB/pricing')
      ).headers.get('location')
    ).toBe('https://example.com/en-gb/pricing');
  });

  it('rewrites the default locale with its configured spelling', () => {
    const res = createNextMiddleware()(
      new NextRequest('https://example.com/pricing')
    );
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/en-us/pricing'
    );
  });

  it('uses configured keys for aliases, overrides and route restrictions', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/pricing': { 'en-gb': '/prices', 'en-us': '/plans' } },
      routeOverrides: { 'en-gb': ['/pricing'] },
      localeRoutes: { 'en-gb': ['/pricing'] },
    });
    const res = middleware(new NextRequest('https://example.com/en-gb/prices'));
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/en-gb/en-gb/pricing'
    );
    const fallback = middleware(
      new NextRequest('https://example.com/en-gb/careers')
    );
    expect(fallback.headers.get('location')).toBe(
      'https://example.com/careers'
    );
  });
});

describe('custom-mapped locale aliases', () => {
  const query = '?tag=a&tag=b&next=%2Faccount';
  function configureAlias(
    defaultLocale = 'en',
    alias = 'en-gb',
    code = 'en-GB'
  ) {
    configure({
      defaultLocale,
      locales: [...new Set(['en', alias, 'fr'])],
      customMapping: { [alias]: { code } },
    });
  }
  beforeEach(() => configureAlias());
  function request(
    path: string,
    {
      cookie,
      reset = false,
      browser,
      basePath = '',
    }: {
      cookie?: string;
      reset?: boolean;
      browser?: string;
      basePath?: string;
    } = {}
  ) {
    const req = new NextRequest(origin + basePath + path + query, {
      headers: browser ? { 'accept-language': browser } : {},
      nextConfig: { basePath },
    });
    if (cookie) req.cookies.set('generaltranslation.locale', cookie);
    if (reset) req.cookies.set('generaltranslation.locale-reset', 'true');
    return req;
  }
  function check(
    res: ReturnType<Middleware>,
    status: number,
    target?: string,
    kind = 'location'
  ) {
    expect(res.status).toBe(status);
    expect(res.headers.get(kind)).toBe(target ? origin + target + query : null);
  }
  const paths: MiddlewareOptions['pathConfig'] = {
    '/pricing': { 'en-gb': '/prices', en: '/plans', fr: '/tarifs' },
  };
  describe('separate lookup and routing locale', () => {
    it('keeps an already correct lowercase alias URL', () =>
      check(createNextMiddleware()(request('/en-gb/pricing')), 200));
    it('redirects a canonical prefix to the configured alias', () =>
      check(
        createNextMiddleware()(request('/en-GB/pricing')),
        307,
        '/en-gb/pricing'
      ));
    it('routes a browser preference through the alias', () =>
      check(
        createNextMiddleware()(request('/pricing', { browser: 'en-GB' })),
        307,
        '/en-gb/pricing'
      ));
    it('routes a reset preference through the alias', () =>
      check(
        createNextMiddleware()(
          request('/fr/pricing', { cookie: 'en-GB', reset: true })
        ),
        307,
        '/en-gb/pricing'
      ));
    it('rewrites an unprefixed default through its alias', () => {
      configureAlias('en-gb');
      check(
        createNextMiddleware()(request('/pricing')),
        200,
        '/en-gb/pricing',
        'x-middleware-rewrite'
      );
    });
    it('prefixes an aliased default when requested', () => {
      configureAlias('en-gb');
      check(
        createNextMiddleware({ prefixDefaultLocale: true })(
          request('/pricing')
        ),
        307,
        '/en-gb/pricing'
      );
    });
    it('matches a lowercase localized path', () =>
      check(
        createNextMiddleware({ pathConfig: paths })(request('/en-gb/prices')),
        200,
        '/en-gb/pricing',
        'x-middleware-rewrite'
      ));
    it('redirects a canonical localized path to lowercase', () =>
      check(
        createNextMiddleware({ pathConfig: paths })(request('/en-GB/prices')),
        307,
        '/en-gb/prices'
      ));
    it('redirects a shared page to its localized alias', () =>
      check(
        createNextMiddleware({ pathConfig: paths })(request('/en-gb/pricing')),
        307,
        '/en-gb/prices'
      ));
    it('uses alias spelling for both override segments', () =>
      check(
        createNextMiddleware({ routeOverrides: { 'en-gb': ['/pricing'] } })(
          request('/en-gb/pricing')
        ),
        200,
        '/en-gb/en-gb/pricing',
        'x-middleware-rewrite'
      ));
    it('combines localized paths and overrides', () =>
      check(
        createNextMiddleware({
          pathConfig: paths,
          routeOverrides: { 'en-gb': ['/pricing'] },
        })(request('/en-gb/prices')),
        200,
        '/en-gb/en-gb/pricing',
        'x-middleware-rewrite'
      ));
    it('checks allowed aliases against the normalized availability key', () =>
      check(
        createNextMiddleware({
          pathConfig: paths,
          localeRoutes: { 'en-gb': ['/pricing'] },
        })(request('/en-gb/prices')),
        200,
        '/en-gb/pricing',
        'x-middleware-rewrite'
      ));
    it('terminates a rejected aliased locale at the default', () => {
      const mw = createNextMiddleware({
        localeRoutes: { 'en-gb': ['/pricing'] },
      });
      check(
        mw(request('/en-gb/careers', { cookie: 'en-GB' })),
        307,
        '/careers'
      );
      check(
        mw(request('/careers', { cookie: 'en-GB' })),
        200,
        '/en/careers',
        'x-middleware-rewrite'
      );
    });
    it('uses the default alias for a prefixed fallback', () => {
      configureAlias('en-gb');
      check(
        createNextMiddleware({
          prefixDefaultLocale: true,
          localeRoutes: { fr: [] },
        })(request('/fr/careers', { cookie: 'fr' })),
        307,
        '/en-gb/careers'
      );
    });
    it('preserves catch-all params through aliases and overrides', () =>
      check(
        createNextMiddleware({
          pathConfig: { '/guides/[...slug]': { 'en-gb': '/docs/[...slug]' } },
          routeOverrides: { 'en-gb': ['/guides/[...slug]'] },
        })(request('/en-gb/docs/authors/ernest')),
        200,
        '/en-gb/en-gb/guides/authors/ernest',
        'x-middleware-rewrite'
      ));
    it('preserves basePath, trailing slash, and repeated query', () =>
      check(
        createNextMiddleware({ pathConfig: paths })(
          request('/en-gb/prices/', { basePath: '/portal' })
        ),
        200,
        '/portal/en-gb/pricing/',
        'x-middleware-rewrite'
      ));
    it.each(['qbr', 'uk', 'en_gb'])(
      'preserves an existing %s alias',
      (alias) => {
        configureAlias('en', alias);
        check(
          createNextMiddleware({ routeOverrides: { [alias]: ['/pricing'] } })(
            request('/' + alias + '/pricing')
          ),
          200,
          '/' + alias + '/' + alias + '/pricing',
          'x-middleware-rewrite'
        );
      }
    );
  });

  describe('services-disabled approved locale spelling', () => {
    beforeEach(() =>
      configure({
        defaultLocale: 'en-us',
        locales: ['en-us', 'fr'],
        services: false,
      })
    );

    it.each([false, true])(
      'terminates a reset fallback with override=%s',
      (override) => {
        const middleware = createNextMiddleware({
          pathConfig: { '/about': { 'en-us': '/company', fr: '/entreprise' } },
          localeRoutes: { fr: [] },
          routeOverrides: override ? { 'en-us': ['/about'] } : {},
        });
        for (const reset of [true, false]) {
          const response = middleware(
            request('/company', { cookie: 'fr', reset })
          );
          check(
            response,
            200,
            override ? '/en-us/en-us/about' : '/en-us/about',
            'x-middleware-rewrite'
          );
          expect(response.headers.get('x-generaltranslation-locale')).toBe(
            'en-us'
          );
        }
      }
    );
  });

  describe('configured locale matcher', () => {
    it.each([
      [undefined, 307, '/en-GB/pricing'],
      ['lookup', 200, undefined],
    ])(
      'routes a browser "en" preference with localeMatcher=%s',
      (localeMatcher, status, target) => {
        configure({
          defaultLocale: 'fr',
          locales: ['fr', 'en-GB'],
          localeMatcher,
        });
        check(
          createNextMiddleware()(request('/pricing', { browser: 'en' })),
          status,
          target
        );
      }
    );
  });
});

describe('resolved locale prefixes', () => {
  const search = '?plan=team&plan=enterprise&return=%2Faccount%3Ftab%3Dbilling';
  type Preference = 'browser' | 'cookie' | 'reset';

  beforeEach(() => configure({ locales: ['en', 'en-GB', 'fr'] }));

  function request(
    path: string,
    preference?: Preference,
    locale = 'en-GB',
    basePath = ''
  ) {
    const headers = new Headers();
    if (preference === 'browser') headers.set('accept-language', locale);
    const req = new NextRequest(origin + basePath + path + search, {
      headers,
      nextConfig: basePath ? { basePath } : undefined,
    });
    if (preference === 'cookie' || preference === 'reset') {
      req.cookies.set(defaultLocaleCookieName, locale);
    }
    if (preference === 'reset') {
      req.cookies.set(defaultResetLocaleCookieName, 'true');
    }
    return req;
  }

  function expectRoute(
    response: ReturnType<Middleware>,
    kind: 'next' | 'redirect' | 'rewrite',
    locale: string,
    destination?: string
  ) {
    expectRoutedResponse(
      response,
      kind,
      locale,
      destination === undefined ? undefined : origin + destination + search
    );
  }

  describe.each([false, true])(
    'prefixDefaultLocale=%s',
    (prefixDefaultLocale) => {
      it.each(['browser', 'cookie', 'reset'] as const)(
        'keeps a supported regional $preference preference prefixed',
        (preference) => {
          const middleware = createNextMiddleware({ prefixDefaultLocale });
          const path = preference === 'reset' ? '/fr/pricing' : '/pricing';

          expectRoute(
            middleware(request(path, preference)),
            'redirect',
            'en-GB',
            '/en-GB/pricing'
          );
        }
      );

      it.each(['browser', 'cookie', 'reset'] as const)(
        'uses the base default when an $preference regional preference is unsupported',
        (preference) => {
          configure({ locales: ['en', 'fr'] });
          const middleware = createNextMiddleware({ prefixDefaultLocale });
          const path = preference === 'reset' ? '/fr/pricing' : '/pricing';
          const publicDestination = prefixDefaultLocale
            ? '/en/pricing'
            : '/pricing';
          const kind =
            preference === 'reset' || prefixDefaultLocale
              ? 'redirect'
              : 'rewrite';

          expectRoute(
            middleware(request(path, preference)),
            kind,
            'en',
            kind === 'rewrite' ? '/en/pricing' : publicDestination
          );
        }
      );
    }
  );

  it('preserves a configured default when applying no-prefix routing', () => {
    configure({ defaultLocale: 'EN-gb', locales: ['EN-gb', 'fr'] });

    expectRoute(
      createNextMiddleware()(request('/pricing')),
      'rewrite',
      'EN-gb',
      '/EN-gb/pricing'
    );
  });

  it('keeps a lowercase default unprefixed when GT services are disabled', () => {
    configure({
      defaultLocale: 'en-us',
      locales: ['en-us', 'fr'],
      services: false,
    });

    expectRoute(
      createNextMiddleware()(request('/pricing')),
      'rewrite',
      'en-us',
      '/en-us/pricing'
    );
  });

  it.each([
    {
      name: 'universal string alias',
      pathConfig: { '/pricing': '/plans' },
    },
    {
      name: 'canonical object alias',
      pathConfig: { '/pricing': { 'en-US': '/plans', fr: '/tarifs' } },
    },
  ] satisfies Array<{
    name: string;
    pathConfig: MiddlewareOptions['pathConfig'];
  }>)('assigns a $name to a configured default', ({ pathConfig }) => {
    configure({ defaultLocale: 'en-us', locales: ['en-us', 'fr'] });

    expectRoute(
      createNextMiddleware({ pathConfig })(request('/plans')),
      'rewrite',
      'en-us',
      '/en-us/pricing'
    );
  });

  it.each([
    {
      name: 'string custom locale',
      customMapping: { qaa: 'Brand English' },
      internalLocale: 'qaa',
    },
    {
      name: 'object alias',
      customMapping: {
        qaa: { code: 'en-US', name: 'Brand English' },
      },
      internalLocale: 'qaa',
    },
  ] satisfies Array<{
    name: string;
    customMapping: CustomMapping;
    internalLocale: string;
  }>)(
    'keeps a $name default unprefixed',
    ({ customMapping, internalLocale }) => {
      configure({
        defaultLocale: 'qaa',
        locales: ['qaa', 'fr'],
        customMapping,
      });

      expectRoute(
        createNextMiddleware()(request('/pricing')),
        'rewrite',
        internalLocale,
        `/${internalLocale}/pricing`
      );
    }
  );

  it('uses the configured default alias with no signal', () => {
    configure({
      defaultLocale: 'EN',
      locales: ['en', 'fr'],
      customMapping: { EN: { code: 'fr', name: 'Default French' } },
    });

    expectRoute(
      createNextMiddleware()(request('/pricing')),
      'rewrite',
      'EN',
      '/EN/pricing'
    );
  });

  it.each([
    {
      name: 'universal string alias',
      pathConfig: { '/pricing': '/plans' },
      destination: '/en-GB/plans',
    },
    {
      name: 'locale object alias',
      pathConfig: {
        '/pricing': { en: '/plans', 'en-GB': '/prices' },
      },
      destination: '/en-GB/prices',
    },
  ] satisfies Array<{
    name: string;
    pathConfig: MiddlewareOptions['pathConfig'];
    destination: string;
  }>)(
    'keeps the regional prefix with a $name',
    ({ pathConfig, destination }) => {
      expectRoute(
        createNextMiddleware({ pathConfig })(request('/pricing', 'browser')),
        'redirect',
        'en-GB',
        destination
      );
    }
  );

  it('preserves a base path and query when adding a regional prefix', () => {
    const response = createNextMiddleware()(
      request('/pricing', 'cookie', 'en-GB', '/portal')
    );

    expectRoute(response, 'redirect', 'en-GB', '/portal/en-GB/pricing');
  });

  it('terminates a rejected localeRoute at the default page with default headers', () => {
    const middleware = createNextMiddleware({
      localeRoutes: { 'en-GB': ['/pricing'] },
    });

    expectRoute(
      middleware(request('/en-GB/careers', 'cookie')),
      'redirect',
      'en',
      '/careers'
    );
    expectRoute(
      middleware(request('/careers', 'cookie')),
      'rewrite',
      'en',
      '/en/careers'
    );
  });

  it('terminates a whitelist fallback at a raw-spelling default', () => {
    configure({
      defaultLocale: 'en-us',
      locales: ['en-us', 'en-GB', 'fr'],
      services: false,
    });
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      localeRoutes: { 'en-GB': [], 'en-us': [] },
    });

    expectRoute(
      middleware(request('/en-GB/careers', 'cookie')),
      'redirect',
      'en-us',
      '/en-us/careers'
    );
    expectRoute(
      middleware(request('/en-us/careers', 'cookie')),
      'next',
      'en-us'
    );
    expectRoute(
      middleware(request('/en-US/careers', 'cookie')),
      'redirect',
      'en-us',
      '/en-us/careers'
    );
  });
});

describe('locale resolution during middleware initialization', () => {
  beforeEach(() =>
    configure({
      locales: ['en', 'en-gb', 'fr'],
      customMapping: { 'en-gb': { code: 'en-GB' } },
    })
  );
  afterEach(() => vi.restoreAllMocks());

  it('bounds resolution work by distinct keys across aliases, overrides and availability', () => {
    const determineLocale = vi.spyOn(GTIntl.prototype, 'determineLocale');
    const pathConfig = Object.fromEntries(
      Array.from({ length: 120 }, (_, i) => [
        `/page-${i}`,
        { en: `/alias-${i}`, 'en-GB': `/alias-${i}`, fr: `/alias-${i}` },
      ])
    );
    const middleware = createNextMiddleware({
      pathConfig,
      routeOverrides: { 'en-GB': ['/page-0'] },
      localeRoutes: { 'en-GB': ['/page-0'] },
    });
    expect(determineLocale).toHaveBeenCalledTimes(3);
    expect(determineLocale.mock.calls.map(([locale]) => locale).sort()).toEqual(
      ['en', 'en-GB', 'fr']
    );
    const response = middleware(
      new NextRequest('https://example.com/en-gb/alias-0')
    );
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/en-gb/en-gb/page-0'
    );
  });

  it.each(['false', 'true'])(
    'reuses string-alias locale resolutions with services=%s',
    (services) => {
      vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', services);
      const determineLocale = vi.spyOn(GTIntl.prototype, 'determineLocale');
      const pathConfig = Object.fromEntries(
        Array.from({ length: 120 }, (_, i) => [`/page-${i}`, `/alias-${i}`])
      );
      const middleware = createNextMiddleware({ pathConfig });
      expect(determineLocale).toHaveBeenCalledTimes(3);
      const response = middleware(
        new NextRequest('https://example.com/en-gb/alias-0')
      );
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        'https://example.com/en-gb/page-0'
      );
    }
  );

  it('keeps each factory cache scoped to its own locale configuration', () => {
    const options = { pathConfig: { '/page': { 'en-GB': '/alias' } } };
    const first = createNextMiddleware(options);
    configure({
      locales: ['en', 'brand-uk'],
      customMapping: { 'brand-uk': { code: 'en-GB' } },
    });
    const second = createNextMiddleware(options);
    expect(
      first(new NextRequest('https://example.com/en-gb/alias')).headers.get(
        'x-middleware-rewrite'
      )
    ).toBe('https://example.com/en-gb/page');
    expect(
      second(new NextRequest('https://example.com/brand-uk/alias')).headers.get(
        'x-middleware-rewrite'
      )
    ).toBe('https://example.com/brand-uk/page');
  });
});
