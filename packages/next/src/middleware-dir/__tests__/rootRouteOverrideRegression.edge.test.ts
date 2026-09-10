// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { defaultLocaleHeaderName } from '../../utils/headers';
import { createNextMiddleware } from '../createNextMiddleware';

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

describe.each([false, true])(
  'root routeOverrides with prefixDefaultLocale=%s',
  (prefixDefaultLocale) => {
    it.each([
      {
        name: 'localized homepage alias',
        shared: '/',
        localized: '/accueil',
        pathname: '/fr/accueil',
        destination: '/fr/fr',
      },
      {
        name: 'empty optional root catchall',
        shared: '/[[...slug]]',
        localized: '/pages/[[...slug]]',
        pathname: '/fr/pages',
        destination: '/fr/fr',
      },
      {
        name: 'homepage without an alias control',
        shared: '/',
        localized: '/',
        pathname: '/fr',
        destination: '/fr/fr',
      },
      {
        name: 'trailing-slash homepage alias control',
        shared: '/',
        localized: '/accueil',
        pathname: '/fr/accueil/',
        destination: '/fr/fr/',
      },
      {
        name: 'trailing-slash homepage without an alias',
        shared: '/',
        localized: '/',
        pathname: '/fr/',
        destination: '/fr/fr/',
      },
      {
        name: 'trailing-slash empty optional root alias',
        shared: '/[[...slug]]',
        localized: '/pages/[[...slug]]',
        pathname: '/fr/pages/',
        destination: '/fr/fr/',
      },
      {
        name: 'trailing-slash empty optional root without an alias',
        shared: '/[[...slug]]',
        localized: '/[[...slug]]',
        pathname: '/fr/',
        destination: '/fr/fr/',
      },
    ])(
      'rewrites $name to the locale-specific root without alias segments',
      ({ shared, localized, pathname, destination }) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale,
          pathConfig: { [shared]: { fr: { path: localized, override: true } } },
        });
        const response = middleware(new NextRequest(origin + pathname + query));

        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('x-middleware-rewrite')).toBe(
          origin + destination + query
        );
        expect(response.headers.get(defaultLocaleHeaderName)).toBe('fr');
      }
    );
  }
);
