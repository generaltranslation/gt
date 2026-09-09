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

describe.each(['[...slug]', '[[...slug]]'])(
  'catchall trailing delimiter, %s',
  (segment) => {
    it.each(['', 'one', 'one/two', 'a%2Fb/a%252Fb'])(
      'routes %s without redirecting to a double trailing slash',
      (tail) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale: true,
          pathConfig: {
            [`/catalog/[category]/${segment}/`]: {
              en: `/catalog/[category]/${segment}/`,
              fr: `/catalogue/[category]/${segment}/`,
            },
          },
        });
        for (const slash of ['', '/']) {
          const suffix = `/science${tail ? '/' + tail : ''}${slash}`;
          const sharedUrl = origin + '/fr/catalog' + suffix + query;
          const localizedUrl = origin + '/fr/catalogue' + suffix + query;
          const localized = middleware(new NextRequest(localizedUrl));
          const shared = middleware(new NextRequest(sharedUrl));
          if (!tail && segment === '[...slug]') {
            for (const response of [localized, shared]) {
              expect(response.headers.get('location')).toBeNull();
              expect(response.headers.get('x-middleware-rewrite')).toBeNull();
              expect(response.headers.get('x-middleware-next')).toBe('1');
            }
            continue;
          }
          expect(localized.headers.get(defaultLocaleHeaderName)).toBe('fr');
          expect(localized.headers.get('location')).toBeNull();
          expect(localized.headers.get('x-middleware-rewrite')).toBe(sharedUrl);
          expect(shared.headers.get('location')).toBe(localizedUrl);
          const followed = middleware(
            new NextRequest(shared.headers.get('location')!)
          );
          expect(followed.headers.get('location')).toBeNull();
          expect(followed.headers.get('x-middleware-rewrite')).toBe(sharedUrl);
        }
      }
    );
  }
);

it('preserves singular parameters beside configured trailing slashes', () => {
  const middleware = createNextMiddleware({
    prefixDefaultLocale: true,
    pathConfig: {
      '/catalog/[category]/[id]/': {
        fr: '/catalogue/[category]/[id]/',
      },
    },
  });
  const response = middleware(
    new NextRequest(origin + '/fr/catalogue/science/a%2Fb/' + query)
  );
  expect(response.headers.get('location')).toBeNull();
  expect(response.headers.get('x-middleware-rewrite')).toBe(
    origin + '/fr/catalog/science/a%2Fb/' + query
  );
});
