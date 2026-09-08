// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
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

describe.each(['/docs', '/fr', '/en', '/corp/nested'])(
  'basePath=%s',
  (basePath) => {
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
