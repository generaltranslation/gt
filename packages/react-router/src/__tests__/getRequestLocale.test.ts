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

/**
 * The redirect location getRequestLocale throws for a page, or the locale it
 * returns. `requestPath` is the URL React Router requests, such as /about.data.
 */
function resolve(
  path: string,
  headers: Record<string, string> = {},
  requestPath = path,
  urlArg: 'url' | 'unstable_url' = 'url'
) {
  const url = new URL(path, 'https://example.com');
  const params = matchRoutes(routes, url.pathname)?.[0].params ?? {};
  try {
    return getRequestLocale({
      request: new Request(new URL(requestPath, url), { headers }),
      params,
      [urlArg]: url,
    });
  } catch (error) {
    if (!(error instanceof Response)) throw error;
    expect(error.status).toBe(302);
    return `redirect ${error.headers.get('Location')}`;
  }
}

describe('getRequestLocale', () => {
  describe('with locale routing', () => {
    beforeEach(() => {
      initializeGT({
        defaultLocale: 'en',
        // gt-i18n keeps the first config, so every locale is set up here.
        locales: ['en', 'fr', 'brand%2Fde'],
        customMapping: { 'brand%2Fde': { code: 'de' } },
        localeRouting: true,
      });
    });

    it('takes the locale from the URL over the visitor preference', () => {
      expect(resolve('/fr/about')).toBe('fr');
      expect(
        resolve('/fr/about', { cookie: 'generaltranslation.locale=en' })
      ).toBe('fr');
      expect(resolve('/fr/')).toBe('fr');
    });

    it('redirects an unprefixed URL to the preferred locale', () => {
      expect(resolve('/about?view=full', prefersFrench)).toBe(
        'redirect /fr/about?view=full'
      );
      expect(resolve('/', { 'accept-language': 'fr' })).toBe('redirect /fr');
      expect(resolve('/about/', prefersFrench)).toBe('redirect /fr/about/');
    });

    it('renders the default locale at an unprefixed URL', () => {
      expect(resolve('/about')).toBe('en');
      expect(resolve('/about', { 'accept-language': 'en' })).toBe('en');
    });

    it('redirects a locale prefix to its supported spelling', () => {
      expect(resolve('/fr-CA/about')).toBe('redirect /fr/about');
      expect(resolve('/EN/about')).toBe('redirect /en/about');
      expect(resolve('/en-US/about', prefersFrench)).toBe('redirect /en/about');
    });

    it('keeps an explicit default-locale prefix', () => {
      expect(resolve('/en/about', prefersFrench)).toBe('en');
    });

    it('puts the locale in front of a first segment that is not a locale', () => {
      expect(resolve('/docs/about')).toBe('redirect /en/docs/about');
      expect(resolve('/en/docs/about')).toBe('en');
      expect(resolve('/nope')).toBe('redirect /en/nope');
      expect(resolve('/nope', prefersFrench)).toBe('redirect /fr/nope');
    });

    it('reads a locale with a literal %2F from the URL', () => {
      // React Router's param for the segment brand%252Fde is brand/de.
      expect(resolve('/about', { 'accept-language': 'de' })).toBe(
        'redirect /brand%252Fde/about'
      );
      expect(resolve('/brand%252Fde/about')).toBe('brand%2Fde');
    });

    it('keeps redirects on the site', () => {
      // A top-level * route outside the prefix matches with no locale param.
      expect(resolve('/en//evil.com')).toBe('redirect /evil.com');
    });

    it('reads the page URL, not the URL React Router requests', () => {
      expect(resolve('/about', prefersFrench, '/about.data?_routes=root')).toBe(
        'redirect /fr/about'
      );
      // React Router 7.13.2 to 7.14 pass it as unstable_url.
      expect(
        resolve(
          '/about',
          prefersFrench,
          '/about.data?_routes=root',
          'unstable_url'
        )
      ).toBe('redirect /fr/about');
    });

    it('reads the page URL from the request before React Router 7.13.2', () => {
      expect(
        getRequestLocale({
          request: new Request('https://example.com/fr/about'),
          params: { locale: 'fr' },
        })
      ).toBe('fr');
    });
  });

  it('ignores the URL without locale routing', () => {
    initializeGT({ defaultLocale: 'en', locales: ['en', 'fr'] });

    expect(resolve('/about', prefersFrench)).toBe('fr');
    expect(resolve('/fr/about')).toBe('en');
  });
});
