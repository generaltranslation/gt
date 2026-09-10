// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createNextMiddleware } from '../createNextMiddleware';
import { getResponse } from '../utils';

const origin = 'https://app.example';
const query = '?tag=a&tag=b&raw=%2F';

describe.each(['redirect', 'rewrite'] as const)('%s destinations', (type) => {
  describe.each(['', '/corp'])('basePath="%s"', (basePath) => {
    it.each(['//evil.example/x', '/\\evil.example/x'])(
      'keeps %s on the request origin',
      (responsePath) => {
        const request = new NextRequest(origin + basePath + '/source' + query, {
          nextConfig: { basePath },
        });
        const response = getResponse({
          type,
          originalUrl: request.nextUrl,
          responsePath,
          userLocale: 'en',
          clearResetCookie: false,
          headerList: new Headers(),
          localeRouting: true,
          localeRoutingEnabledCookieName: 'locale-routing',
          resetLocaleCookieName: 'reset-locale',
          localeHeaderName: 'x-locale',
        });

        expect(response.status).toBe(type === 'redirect' ? 307 : 200);
        expect(
          response.headers.get(
            type === 'redirect' ? 'location' : 'x-middleware-rewrite'
          )
        ).toBe(origin + basePath + '//evil.example/x' + query);
      }
    );
  });
});

describe('catch-all alias redirects', () => {
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

  it.each(['/docs//evil.example/x', '/docs/\\evil.example/x'])(
    'keeps the redirect for %s on the request origin without cookies',
    (pathname) => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
        pathConfig: { '/docs/[...slug]': { en: '/[...slug]' } },
      });
      const response = middleware(new NextRequest(origin + pathname + query));

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        origin + '//evil.example/x' + query
      );
    }
  );
});
