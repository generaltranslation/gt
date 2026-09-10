// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from '@generaltranslation/react-core/pure';
import { defaultLocaleHeaderName } from '../../utils/headers';
import { createNextMiddleware } from '../createNextMiddleware';

const origin = 'https://example.com';
const query = '?tag=a&tag=b&encoded=%2F%252F';
beforeEach(() => {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({ defaultLocale: 'en', locales: ['en', 'fr', 'en-GB'] })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'true');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
});
afterEach(() => vi.unstubAllEnvs());

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
        origin + (prefixDefaultLocale ? '/en' : '') + '/articles/hello' + query
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

it('preserves empty-string root alias behavior', () => {
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
