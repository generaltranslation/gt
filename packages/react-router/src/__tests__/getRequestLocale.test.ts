import { matchRoutes, type RouteObject } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { getRequestLocale, initializeGT } from '../index';

// The routes that prefix(':locale?', [...]) produces.
const routes: RouteObject[] = [
  { path: ':locale?', index: true },
  { path: ':locale?/about' },
  { path: ':locale?/docs/*' },
];

const prefersFrench = { cookie: 'generaltranslation.locale=fr' };

/** The redirect location getRequestLocale throws, or the locale it returns. */
function run(args: Parameters<typeof getRequestLocale>[0]) {
  try {
    return getRequestLocale(args);
  } catch (error) {
    if (!(error instanceof Response)) throw error;
    expect(error.status).toBe(302);
    return `redirect ${error.headers.get('Location')}`;
  }
}

/**
 * Resolve a page request, with the params React Router matches for it. The
 * page URL comes from the request, as before React Router 7.13.2.
 */
function resolve(path: string, headers: Record<string, string> = {}) {
  const url = new URL(path, 'https://example.com');
  return run({
    request: new Request(url, { headers }),
    params: matchRoutes(routes, url.pathname)?.[0].params ?? {},
  });
}

describe('getRequestLocale', () => {
  describe('with locale routing', () => {
    beforeEach(() => {
      initializeGT({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        localeRouting: true,
      });
    });

    it('takes the locale from the URL over the visitor preference', () => {
      expect(
        resolve('/fr/about', { cookie: 'generaltranslation.locale=en' })
      ).toBe('fr');
    });

    it('redirects an unprefixed URL to the preferred locale', () => {
      expect(resolve('/about?view=full', prefersFrench)).toBe(
        'redirect /fr/about?view=full'
      );
    });

    it('renders the default locale at an unprefixed URL', () => {
      expect(resolve('/about')).toBe('en');
    });

    it('redirects a locale prefix to its supported spelling', () => {
      expect(resolve('/fr-CA/about')).toBe('redirect /fr/about');
    });

    it('keeps an explicit default-locale prefix', () => {
      expect(resolve('/en/about', prefersFrench)).toBe('en');
    });

    it('puts the locale in front of a first segment that is not a locale', () => {
      expect(resolve('/docs/about')).toBe('redirect /en/docs/about');
    });

    it('redirects once for a route outside the locale prefix', () => {
      // No route above matches /nope, so it has no locale param, as under a
      // top-level * route.
      expect(resolve('/nope', prefersFrench)).toBe('redirect /fr/nope');
      expect(resolve('/fr/nope')).toBe('fr');
    });

    it('reads the page URL, not the URL React Router requests', () => {
      expect(
        run({
          request: new Request('https://example.com/about.data?_routes=root', {
            headers: prefersFrench,
          }),
          params: {},
          url: new URL('https://example.com/about'),
        })
      ).toBe('redirect /fr/about');
    });
  });

  it('ignores the URL without locale routing', () => {
    initializeGT({ defaultLocale: 'en', locales: ['en', 'fr'] });

    expect(resolve('/about', prefersFrench)).toBe('fr');
    expect(resolve('/fr/about')).toBe('en');
  });
});
