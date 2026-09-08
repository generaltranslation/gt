// @vitest-environment edge-runtime
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { createNextMiddleware } from '../createNextMiddleware';
import type { PathConfig } from '../utils';

const DEFAULT_LOCALE = 'en';
const LOCALE_HEADER = 'x-generaltranslation-locale';
const TEST_LOCALES = [
  DEFAULT_LOCALE,
  'fr',
  'es',
  'de',
  'ja',
  'pt-BR',
  'zh-CN',
  'ar',
] as const;

type RouteShape = {
  name: string;
  template: (id: number) => string;
  concretePath: (id: number) => string;
  localizedTemplate: (locale: string, id: number) => string;
  localizedConcretePath: (locale: string, id: number) => string;
};

const ROUTE_SHAPES: RouteShape[] = [
  {
    name: 'static',
    template: (id) => `/campaign-${id}`,
    concretePath: (id) => `/campaign-${id}`,
    localizedTemplate: (locale, id) => `/special-${locale}-${id}`,
    localizedConcretePath: (locale, id) => `/special-${locale}-${id}`,
  },
  {
    name: 'dynamic',
    template: (id) => `/products-${id}/[productId]`,
    concretePath: (id) => `/products-${id}/ramp-card-${id}`,
    localizedTemplate: (locale, id) =>
      `/localized-products-${locale}-${id}/[productId]`,
    localizedConcretePath: (locale, id) =>
      `/localized-products-${locale}-${id}/ramp-card-${id}`,
  },
  {
    name: 'multiple dynamic',
    template: (id) => `/accounts-${id}/[accountId]/cards/[cardId]`,
    concretePath: (id) => `/accounts-${id}/account-${id}/cards/card-${id}`,
    localizedTemplate: (locale, id) =>
      `/localized-accounts-${locale}-${id}/[accountId]/cards/[cardId]`,
    localizedConcretePath: (locale, id) =>
      `/localized-accounts-${locale}-${id}/account-${id}/cards/card-${id}`,
  },
  {
    name: 'required catch-all',
    template: (id) => `/cms-${id}/[...slug]`,
    concretePath: (id) => `/cms-${id}/guides/setup/step-${id}`,
    localizedTemplate: (locale, id) =>
      `/localized-cms-${locale}-${id}/[...slug]`,
    localizedConcretePath: (locale, id) =>
      `/localized-cms-${locale}-${id}/guides/setup/step-${id}`,
  },
  {
    name: 'empty optional catch-all',
    template: (id) => `/news-${id}/[[...slug]]`,
    concretePath: (id) => `/news-${id}`,
    localizedTemplate: (locale, id) =>
      `/localized-news-${locale}-${id}/[[...slug]]`,
    localizedConcretePath: (locale, id) => `/localized-news-${locale}-${id}`,
  },
  {
    name: 'populated optional catch-all',
    template: (id) => `/updates-${id}/[[...slug]]`,
    concretePath: (id) => `/updates-${id}/world/latest/story-${id}`,
    localizedTemplate: (locale, id) =>
      `/localized-updates-${locale}-${id}/[[...slug]]`,
    localizedConcretePath: (locale, id) =>
      `/localized-updates-${locale}-${id}/world/latest/story-${id}`,
  },
];

type RouteOverrideCase = {
  basePath?: string;
  expectedPath: string;
  label: string;
  locale: string;
  pathConfig: PathConfig;
  prefixDefaultLocale: boolean;
  requestPath: string;
  routeTemplate: string;
  search: string;
};

function withTrailingSlash(pathname: string, trailingSlash: boolean) {
  return trailingSlash ? `${pathname}/` : pathname;
}

function createRouteOverrideCases(): RouteOverrideCase[] {
  const cases: RouteOverrideCase[] = [];
  let id = 0;

  for (const locale of TEST_LOCALES) {
    for (const routeShape of ROUTE_SHAPES) {
      for (const prefixDefaultLocale of [false, true]) {
        for (const localizedPath of [false, true]) {
          for (const trailingSlash of [false, true]) {
            id += 1;

            const routeTemplate = routeShape.template(id);
            const sharedConcretePath = routeShape.concretePath(id);
            const localizedTemplate = routeShape.localizedTemplate(locale, id);
            const localizedConcretePath = routeShape.localizedConcretePath(
              locale,
              id
            );
            const publicPagePath = localizedPath
              ? localizedConcretePath
              : sharedConcretePath;
            const localePrefix =
              prefixDefaultLocale || locale !== DEFAULT_LOCALE
                ? `/${locale}`
                : '';
            const basePath = id % 4 === 0 ? '/corp' : undefined;
            const requestPath = withTrailingSlash(
              `${basePath || ''}${localePrefix}${publicPagePath}`,
              trailingSlash
            );
            const expectedPath = withTrailingSlash(
              `${basePath || ''}/${locale}/${locale}${sharedConcretePath}`,
              trailingSlash
            );
            const search =
              id % 3 === 0 ? `?preview=${id}&tag=first&tag=second` : '';

            cases.push({
              basePath,
              expectedPath,
              label: [
                locale,
                routeShape.name,
                prefixDefaultLocale ? 'prefixed default' : 'unprefixed default',
                localizedPath ? 'localized public path' : 'shared public path',
                trailingSlash ? 'trailing slash' : 'no trailing slash',
                basePath ? 'base path' : 'no base path',
                search ? 'query' : 'no query',
              ].join(' | '),
              locale,
              pathConfig: localizedPath
                ? {
                    [routeTemplate]: {
                      [locale]: localizedTemplate,
                    },
                  }
                : {},
              prefixDefaultLocale,
              requestPath,
              routeTemplate,
              search,
            });
          }
        }
      }
    }
  }

  return cases;
}

function createRequest(testCase: RouteOverrideCase): NextRequest {
  const url = new URL(testCase.requestPath, 'http://localhost:3000');
  url.search = testCase.search;

  return new NextRequest(url, {
    nextConfig: testCase.basePath ? { basePath: testCase.basePath } : undefined,
  });
}

function getRewriteUrl(response: Response): URL | undefined {
  const rewrite = response.headers.get('x-middleware-rewrite');
  return rewrite ? new URL(rewrite) : undefined;
}

describe('routeOverrides routing matrix', () => {
  const routeOverrideCases = createRouteOverrideCases();
  let previousI18nConfig: string | undefined;
  let previousServicesEnabled: string | undefined;
  let previousIgnoreBrowserLocales: string | undefined;

  beforeAll(() => {
    previousI18nConfig = process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
    previousServicesEnabled =
      process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED;
    previousIgnoreBrowserLocales =
      process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES;

    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
      defaultLocale: DEFAULT_LOCALE,
      locales: TEST_LOCALES,
    });
    delete process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED;
    delete process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES;
  });

  afterAll(() => {
    if (previousI18nConfig === undefined) {
      delete process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
    } else {
      process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = previousI18nConfig;
    }
    if (previousServicesEnabled === undefined) {
      delete process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED;
    } else {
      process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED =
        previousServicesEnabled;
    }
    if (previousIgnoreBrowserLocales === undefined) {
      delete process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES;
    } else {
      process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES =
        previousIgnoreBrowserLocales;
    }
  });

  it.each(routeOverrideCases)('$label', (testCase) => {
    const middleware = createNextMiddleware({
      pathConfig: testCase.pathConfig,
      prefixDefaultLocale: testCase.prefixDefaultLocale,
      routeOverrides: {
        [testCase.locale]: [testCase.routeTemplate],
      },
    });

    const response = middleware(createRequest(testCase));
    const rewriteUrl = getRewriteUrl(response);

    expect(rewriteUrl?.pathname).toBe(testCase.expectedPath);
    expect(rewriteUrl?.search).toBe(testCase.search);
    expect(response.status).toBe(200);
    expect(response.headers.get(LOCALE_HEADER)).toBe(testCase.locale);
    expect(response.headers.get('location')).toBeNull();
  });
});
