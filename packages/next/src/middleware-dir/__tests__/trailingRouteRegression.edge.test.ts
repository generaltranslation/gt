// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createNextMiddleware } from '../createNextMiddleware';
import type { PathConfig } from '../utils';

const origin = 'http://localhost:3000';
const query = '?tag=a&tag=b';

beforeEach(() => {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({ defaultLocale: 'en', locales: ['en', 'fr'] })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'true');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
});
afterEach(() => vi.unstubAllEnvs());

describe.each(['', '/'])('route ownership with trailing slash %j', (slash) => {
  it('does not treat the locale root as a locale-named shared page', () => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      pathConfig: { '/fr': { en: '/fr', fr: '/other' } },
    });
    const response = middleware(
      new NextRequest(`${origin}/fr${slash}${query}`)
    );
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(response.headers.get('x-generaltranslation-locale')).toBe('fr');
  });

  it.each([false, true])(
    'keeps dynamic route ownership in reverse order %s',
    (reverse) => {
      const entries: [string, Record<string, string>][] = [
        ['/[id]', { en: '/[id]', fr: '/[id]' }],
        ['/fr/[id]', { en: '/fr/[id]', fr: '/other/[id]' }],
      ];
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
        pathConfig: Object.fromEntries(reverse ? entries.reverse() : entries),
      });
      const response = middleware(
        new NextRequest(`${origin}/fr/hello${slash}${query}`)
      );
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    }
  );

  it.each([false, true])(
    'keeps an explicit localized root alias in reverse order %s',
    (reverse) => {
      const entries: [string, Record<string, string>][] = [
        ['/landing', { en: '/home', fr: '/' }],
        ['/fr', { en: '/fr', fr: '/other' }],
      ];
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
        pathConfig: Object.fromEntries(reverse ? entries.reverse() : entries),
      });
      const response = middleware(
        new NextRequest(`${origin}/fr${slash}${query}`)
      );
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        `${origin}/fr/landing${slash}${query}`
      );
    }
  );
});

const depthCases: [
  string,
  PathConfig,
  string,
  string,
  'location' | 'x-middleware-rewrite',
][] = [
  [
    'shared to deeper alias',
    {
      '/short/[a]/[b]': {
        en: '/short/[a]/[b]',
        fr: '/long/static/[first]/[second]',
      },
    },
    '/fr/short/alpha/beta',
    '/fr/long/static/alpha/beta',
    'location',
  ],
  [
    'deeper alias to shared',
    {
      '/short/[a]/[b]': {
        en: '/short/[a]/[b]',
        fr: '/long/static/[first]/[second]',
      },
    },
    '/fr/long/static/alpha/beta',
    '/fr/short/alpha/beta',
    'x-middleware-rewrite',
  ],
  [
    'shared to shallower alias',
    {
      '/long/static/[a]/[b]': {
        en: '/long/static/[a]/[b]',
        fr: '/short/[first]/[second]',
      },
    },
    '/fr/long/static/alpha/beta',
    '/fr/short/alpha/beta',
    'location',
  ],
  [
    'shallower alias to shared',
    {
      '/long/static/[a]/[b]': {
        en: '/long/static/[a]/[b]',
        fr: '/short/[first]/[second]',
      },
    },
    '/fr/short/alpha/beta',
    '/fr/long/static/alpha/beta',
    'x-middleware-rewrite',
  ],
  [
    'same-depth reordered names remain positional',
    { '/pair/[first]/[second]': { fr: '/paire/[second]/[first]' } },
    '/fr/paire/alpha/beta',
    '/fr/pair/alpha/beta',
    'x-middleware-rewrite',
  ],
];

describe.each(['', '/'])(
  'source-template parameters with trailing slash %j',
  (slash) => {
    it.each(depthCases)(
      '%s',
      (_name, pathConfig, path, destination, header) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale: true,
          pathConfig,
        });
        const response = middleware(
          new NextRequest(origin + path + slash + query)
        );
        expect(response.headers.get(header)).toBe(
          origin + destination + slash + query
        );
        expect(
          response.headers.get(
            header === 'location' ? 'x-middleware-rewrite' : 'location'
          )
        ).toBeNull();
        expect(response.headers.get('x-generaltranslation-locale')).toBe('fr');
      }
    );

    it.each(['a%2Fb', 'a%25b', 'a%252Fb'])(
      'preserves raw parameter %s across different depths',
      (value) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale: true,
          pathConfig: {
            '/short/[a]/[b]': { fr: '/long/static/[first]/[second]' },
          },
        });
        const response = middleware(
          new NextRequest(`${origin}/fr/short/${value}/beta${slash}${query}`)
        );
        expect(response.headers.get('location')).toBe(
          `${origin}/fr/long/static/${value}/beta${slash}${query}`
        );
        const localized = middleware(
          new NextRequest(
            `${origin}/fr/long/static/${value}/beta${slash}${query}`
          )
        );
        expect(localized.headers.get('location')).toBeNull();
        expect(localized.headers.get('x-middleware-rewrite')).toBe(
          `${origin}/fr/short/${value}/beta${slash}${query}`
        );
      }
    );

    it('uses the source locale template during a cookie locale switch', () => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
        pathConfig: {
          '/short/[a]/[b]': {
            en: '/short/[a]/[b]',
            fr: '/long/static/[first]/[second]',
          },
        },
      });
      const response = middleware(
        new NextRequest(`${origin}/fr/long/static/alpha/beta${slash}${query}`, {
          headers: {
            cookie:
              'generaltranslation.locale=en; generaltranslation.locale-reset=true',
          },
        })
      );
      expect(response.headers.get('location')).toBe(
        `${origin}/en/short/alpha/beta${slash}${query}`
      );
    });

    it('uses the actual unprefixed default alias template', () => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
        pathConfig: {
          '/short/[a]/[b]': {
            en: '/long/static/[first]/[second]',
            fr: '/autre/[first]/[second]',
          },
        },
      });
      const response = middleware(
        new NextRequest(`${origin}/long/static/alpha/beta${slash}${query}`)
      );
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        `${origin}/en/short/alpha/beta${slash}${query}`
      );
    });
  }
);
