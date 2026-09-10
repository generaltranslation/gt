// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { defaultLocaleHeaderName } from '../../utils/headers';
import { createNextMiddleware } from '../createNextMiddleware';
import {
  createPathMatcher,
  createPathToSharedPathMap,
  getSharedPath,
  type PathConfig,
} from '../utils';

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

const origin = 'http://localhost:3000';
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
  describe.each([false, true])(
    'prefixDefaultLocale=%s',
    (prefixDefaultLocale) => {
      it.each(['', '/'])(
        'redirects the locale root to its alias with slash "%s"',
        (slash) => {
          const middleware = createNextMiddleware({
            prefixDefaultLocale,
            pathConfig,
          });
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
      { '/': { fr: '/accueil' }, '/[[...slug]]': { fr: '/pages/[[...slug]]' } },
      false,
      'en'
    ).pathToSharedPath;

    expect(getSharedPath('/fr', matcher, 'fr')?.sharedPath).toBe('/');
  });
});
