// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createNextMiddleware } from '../createNextMiddleware';
import { createPathToSharedPathMap, getSharedPath } from '../utils';
import { getDynamicSegmentType } from '../createPathMatcher';

beforeEach(() => {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'de', 'pt-BR'],
    })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'true');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
});
afterEach(() => vi.unstubAllEnvs());

function request(path: string) {
  return new NextRequest(new URL(path, 'http://localhost:3000'));
}

describe.each([false, true])(
  'root routes with prefixDefaultLocale=%s',
  (prefixDefaultLocale) => {
    for (const template of [
      '/[slug]',
      '/[section]/[slug]',
      '/[...slug]',
      '/[[...slug]]',
    ]) {
      const suffix =
        template === '/[section]/[slug]' ? '/about/team' : '/about';
      it.each(['en', 'fr', 'de', 'pt-BR'])(
        `excludes %s from shared ${template} parameters`,
        (locale) => {
          const middleware = createNextMiddleware({
            prefixDefaultLocale,
            pathConfig: { [template]: { en: template } },
          });
          const pathname =
            !prefixDefaultLocale && locale === 'en'
              ? suffix
              : `/${locale}${suffix}`;
          const res = middleware(request(pathname + '?tag=one&tag=two'));
          expect(res.headers.get('location')).toBeNull();
          expect(res.headers.get('x-generaltranslation-locale')).toBe(locale);
          const rewrite = res.headers.get('x-middleware-rewrite');
          if (rewrite)
            expect(new URL(rewrite).pathname).toBe(`/${locale}${suffix}`);
          expect(res.status).toBe(200);
        }
      );
    }

    it.each(['/[...slug]', '/[[...slug]]'])(
      'terminates redirect chains for %s',
      (template) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale,
          pathConfig: { [template]: { en: template } },
        });
        let path = '/fr/about';
        const visited = new Set<string>();
        for (let hop = 0; hop < 4; hop++) {
          expect(visited.has(path)).toBe(false);
          visited.add(path);
          const response = middleware(request(path));
          const location = response.headers.get('location');
          if (!location) {
            expect(path).toBe('/fr/about');
            return;
          }
          expect(new URL(location).origin).toBe('http://localhost:3000');
          path = new URL(location).pathname;
        }
        expect.fail('The redirect chain did not terminate within four hops');
      }
    );
  }
);

describe('localized and shared route specificity', () => {
  it.each(['/[section]/[slug]', '/[...slug]', '/[[...slug]]'])(
    'prefers shared /about over %s even without a French alias',
    (template) => {
      const config = {
        [template]: { en: template },
        '/about': { en: '/about' },
      };
      const matcher = createPathToSharedPathMap(
        config,
        true,
        'en'
      ).pathToSharedPath;
      expect(getSharedPath('/fr/about', matcher, 'fr')).toMatchObject({
        sharedPath: '/about',
        matchedPathname: '/about',
      });
      expect(
        createNextMiddleware({ pathConfig: config, prefixDefaultLocale: true })(
          request('/fr/about')
        ).headers.get('location')
      ).toBeNull();
    }
  );
  it('does not let a localized root catch-all hide a shared static route', () => {
    const config = {
      '/cms/[...slug]': { fr: '/[...slug]' },
      '/about': { en: '/about' },
    };
    const matcher = createPathToSharedPathMap(
      config,
      true,
      'en'
    ).pathToSharedPath;
    expect(getSharedPath('/fr/about', matcher, 'fr')?.sharedPath).toBe(
      '/about'
    );
  });
  it('prefers an explicit localized path when specificity ties', () => {
    const config = {
      '/a/[id]': { fr: '/b/[id]' },
      '/b/[id]': { en: '/b/[id]' },
    };
    const matcher = createPathToSharedPathMap(
      config,
      true,
      'en'
    ).pathToSharedPath;
    expect(getSharedPath('/fr/b/123', matcher, 'fr')).toMatchObject({
      sharedPath: '/a/[id]',
      matchedPathname: '/fr/b/123',
    });
  });
  it('matches the shared locale root as / rather than an empty string', () => {
    const matcher = createPathToSharedPathMap(
      { '/': { en: '/' } },
      true,
      'en'
    ).pathToSharedPath;
    expect(getSharedPath('/fr', matcher, 'fr')?.sharedPath).toBe('/');
  });
});

describe('Next.js parameter names', () => {
  it.each(['post.id', 'post..id', 'post.', 'a-b', 'a_b', '章.節'])(
    'recognizes and rewrites [%s]',
    (name) => {
      expect(getDynamicSegmentType(`[${name}]`)).toBe('dynamic');
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
        pathConfig: { [`/posts/[${name}]`]: { fr: `/articles/[${name}]` } },
      });
      const res = middleware(request('/fr/articles/123'));
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('x-middleware-rewrite')).toBe(
        'http://localhost:3000/fr/posts/123'
      );
    }
  );
  it.each(['[.id]', '[..id]', '[[id]]', '[]', '[id/slug]'])(
    'does not classify invalid ordinary segment %s as dynamic',
    (segment) => {
      expect(getDynamicSegmentType(segment)).not.toBe('dynamic');
    }
  );
});

describe('locale switching from a standardized alias', () => {
  it.each([
    [true, 'fr', '/fr/a-propos'],
    [false, 'fr', '/fr/a-propos'],
    [true, 'en', '/en/about-us'],
    [false, 'en', '/about-us'],
  ] as const)(
    'prefix=%s, target=%s keeps the original shared route',
    (prefixDefaultLocale, target, expected) => {
      vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'true');
      vi.stubEnv(
        '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
        JSON.stringify({
          defaultLocale: 'en',
          locales: ['en', 'fr', 'fil'],
        })
      );
      const middleware = createNextMiddleware({
        prefixDefaultLocale,
        pathConfig: {
          '/about': { en: '/about-us', fr: '/a-propos', fil: '/tungkol' },
        },
      });
      const req = request('/tl/tungkol?tag=one&tag=two');
      req.cookies.set('generaltranslation.locale', target);
      req.cookies.set('generaltranslation.locale-reset', 'true');
      const response = middleware(req);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000' + expected + '?tag=one&tag=two'
      );
      const next = middleware(request(expected));
      expect(next.headers.get('location')).toBeNull();
      expect(next.headers.get('x-middleware-rewrite')).toBe(
        'http://localhost:3000/' + target + '/about'
      );
    }
  );
});
