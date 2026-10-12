import { beforeEach, describe, expect, it } from 'vitest';
import { getRequestLocale } from '../functions/getRequestLocale';
import { initializeGT } from '../setup/initializeGT';

function request(path: string, headers: Record<string, string> = {}) {
  return new Request(`https://example.com${path}`, { headers });
}

const prefersFrench = { cookie: 'generaltranslation.locale=fr' };

/** The redirect location getRequestLocale throws, or the locale it returns. */
function resolve(path: string, headers?: Record<string, string>) {
  try {
    return getRequestLocale(request(path, headers));
  } catch (error) {
    if (!(error instanceof Response)) throw error;
    expect(error.status).toBe(302);
    return `redirect ${error.headers.get('Location')}`;
  }
}

describe.sequential('getRequestLocale', () => {
  describe('with locale routing', () => {
    beforeEach(() => {
      initializeGT({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        localeRouting: true,
      });
    });

    it('takes the locale from the URL over the visitor preference', () => {
      expect(resolve('/fr/about')).toBe('fr');
      expect(
        resolve('/fr/about', { cookie: 'generaltranslation.locale=en' })
      ).toBe('fr');
    });

    it('redirects an unprefixed URL to the preferred locale', () => {
      expect(resolve('/about?view=full', prefersFrench)).toBe(
        'redirect /fr/about?view=full'
      );
      expect(resolve('/', { 'accept-language': 'fr' })).toBe('redirect /fr');
    });

    it('renders the default locale at an unprefixed URL', () => {
      expect(resolve('/about')).toBe('en');
      expect(resolve('/about', { 'accept-language': 'en' })).toBe('en');
    });

    it('redirects a locale prefix to its supported spelling', () => {
      expect(resolve('/fr-CA/about')).toBe('redirect /fr/about');
    });

    it('keeps an explicit default-locale prefix', () => {
      expect(resolve('/en/about', prefersFrench)).toBe('en');
    });
  });

  it('ignores the URL without locale routing', () => {
    initializeGT({ defaultLocale: 'en', locales: ['en', 'fr'] });

    expect(resolve('/about', prefersFrench)).toBe('fr');
    expect(resolve('/fr/about')).toBe('en');
  });
});
