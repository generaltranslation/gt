// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from '@generaltranslation/react-core/pure';
import type { CustomMapping } from '@generaltranslation/format/types';
import { defaultLocaleRoutingEnabledCookieName } from '../../utils/cookies';
import { defaultLocaleHeaderName } from '../../utils/headers';
import { createNextMiddleware } from '../createNextMiddleware';

const origin = 'https://example.com';
const search = '?plan=team&plan=enterprise&return=%2Faccount%3Ftab%3Dbilling';
type Middleware = ReturnType<typeof createNextMiddleware>;
type MiddlewareOptions = NonNullable<
  Parameters<typeof createNextMiddleware>[0]
>;
type Preference = 'browser' | 'cookie' | 'reset';

beforeEach(() => {
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'true');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'false');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
});

afterEach(() => vi.unstubAllEnvs());

function configure({
  defaultLocale = 'en',
  locales = ['en', 'en-GB', 'fr'],
  customMapping,
}: {
  defaultLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
} = {}) {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({ defaultLocale, locales, customMapping })
  );
}

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

describe('resolved locale prefixes', () => {
  describe.each([false, true])(
    'prefixDefaultLocale=%s',
    (prefixDefaultLocale) => {
      it.each(['browser', 'cookie', 'reset'] as const)(
        'keeps a supported regional $preference preference prefixed',
        (preference) => {
          configure();
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

  it('canonicalizes a configured default before applying no-prefix routing', () => {
    configure({ defaultLocale: 'EN-gb', locales: ['EN-gb', 'fr'] });

    expectRoute(
      createNextMiddleware()(request('/pricing')),
      'rewrite',
      'en-GB',
      '/en-GB/pricing'
    );
  });

  it('keeps a lowercase default unprefixed when GT services are disabled', () => {
    vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
    configure({ defaultLocale: 'en-us', locales: ['en-us', 'fr'] });

    expectRoute(
      createNextMiddleware()(request('/pricing')),
      'rewrite',
      'en-US',
      '/en-US/pricing'
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
  }>)('assigns a $name to a canonicalized default', ({ pathConfig }) => {
    configure({ defaultLocale: 'en-us', locales: ['en-us', 'fr'] });

    expectRoute(
      createNextMiddleware({ pathConfig })(request('/plans')),
      'rewrite',
      'en-US',
      '/en-US/pricing'
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

  it('uses the canonical locale behind a custom default alias with no signal', () => {
    configure({
      defaultLocale: 'EN',
      locales: ['en', 'fr'],
      customMapping: { EN: { code: 'fr', name: 'Default French' } },
    });

    expectRoute(
      createNextMiddleware()(request('/pricing')),
      'rewrite',
      'fr',
      '/fr/pricing'
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
      configure();

      expectRoute(
        createNextMiddleware({ pathConfig })(request('/pricing', 'browser')),
        'redirect',
        'en-GB',
        destination
      );
    }
  );

  it('preserves a base path and query when adding a regional prefix', () => {
    configure();

    const response = createNextMiddleware()(
      request('/pricing', 'cookie', 'en-GB', '/portal')
    );

    expectRoute(response, 'redirect', 'en-GB', '/portal/en-GB/pricing');
  });

  it('terminates a rejected localeRoute at the default page with default headers', () => {
    configure();
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
    vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
    configure({
      defaultLocale: 'en-us',
      locales: ['en-us', 'en-GB', 'fr'],
    });
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      localeRoutes: { 'en-GB': [], 'en-US': [] },
    });

    expectRoute(
      middleware(request('/en-GB/careers', 'cookie')),
      'redirect',
      'en-US',
      '/en-us/careers'
    );
    expectRoute(
      middleware(request('/en-us/careers', 'cookie')),
      'redirect',
      'en-US',
      '/en-US/careers'
    );
    expectRoute(
      middleware(request('/en-US/careers', 'cookie')),
      'next',
      'en-US'
    );
  });
});
