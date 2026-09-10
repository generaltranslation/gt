// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from '@generaltranslation/react-core/pure';
import { createNextMiddleware } from '../createNextMiddleware';
import { getResponse } from '../utils';
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

describe.each(['/docs', '/fr', '/en', '/corp/nested'])(
  'basePath=%s',
  (basePath) => {
    describe.each([false, true])('trailingSlash=%s', (trailingSlash) => {
      const slash = trailingSlash ? '/' : '';
      const query = '?tag=a&tag=b&raw=%2F';
      const request = (path: string) =>
        new NextRequest(origin + basePath + path + query, {
          nextConfig: { basePath, trailingSlash },
        });

      it('redirects a locale reset directly to the base-path root', () => {
        const middleware = createNextMiddleware({ prefixDefaultLocale: false });
        const req = request('/fr' + slash);
        req.cookies.set(defaultLocaleCookieName, 'en');
        req.cookies.set(defaultResetLocaleCookieName, 'true');

        const response = middleware(req);

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
          origin + basePath + slash + query
        );
        const followed = middleware(
          new NextRequest(response.headers.get('location')!, {
            headers: req.headers,
            nextConfig: { basePath, trailingSlash },
          })
        );
        expect(followed.headers.get('location')).toBeNull();
        expect(followed.headers.get('x-middleware-rewrite')).toBe(
          origin + basePath + '/en/' + query
        );
      });

      it('handles a request for the base-path root', () => {
        const middleware = createNextMiddleware({ prefixDefaultLocale: false });
        const response = middleware(request(slash));

        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('x-middleware-rewrite')).toBe(
          origin + basePath + '/en/' + query
        );
      });

      it.each(['redirect', 'rewrite'] as const)(
        'preserves the incoming base-path root slash for a %s',
        (type) => {
          const req = request(slash);
          const response = getResponse({
            type,
            originalUrl: req.nextUrl,
            responsePath: '/',
            userLocale: 'en',
            clearResetCookie: false,
            headerList: new Headers(),
            localeRouting: true,
            localeRoutingEnabledCookieName: 'locale-routing',
            resetLocaleCookieName: defaultResetLocaleCookieName,
            localeHeaderName: 'x-locale',
          });

          expect(response.status).toBe(type === 'redirect' ? 307 : 200);
          expect(
            response.headers.get(
              type === 'redirect' ? 'location' : 'x-middleware-rewrite'
            )
          ).toBe(origin + basePath + slash + query);
        }
      );
    });

    it.each(['', '/'])(
      'retains a same-named app route (trailing slash "%s")',
      (slash) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale: false,
          pathConfig: {
            '/about': { en: basePath + '/about', fr: '/a-propos' },
          },
        });
        const request = (path: string) =>
          new NextRequest(origin + basePath + path, {
            nextConfig: { basePath },
          });
        const response = middleware(request('/about' + slash + '?tag=a&tag=b'));
        expect(response.headers.get('location')).toBe(
          origin + basePath + basePath + '/about' + slash + '?tag=a&tag=b'
        );
      }
    );
    it('retains a locale prefix identical to the base path', () => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
        pathConfig: { '/posts/[id]': { fr: '/articles/[id]' } },
      });
      const response = middleware(
        new NextRequest(origin + basePath + '/fr/articles/123', {
          nextConfig: { basePath },
        })
      );
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        origin + basePath + '/fr/posts/123'
      );
    });
  }
);
