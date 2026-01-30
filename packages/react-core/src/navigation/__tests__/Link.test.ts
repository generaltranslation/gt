import { describe, it, expect } from 'vitest';
import { isExternalUrl, processHref } from '../utils';

describe('isExternalUrl', () => {
  it('should return true for http URLs', () => {
    expect(isExternalUrl('http://example.com')).toBe(true);
    expect(isExternalUrl('http://example.com/path')).toBe(true);
  });

  it('should return true for https URLs', () => {
    expect(isExternalUrl('https://example.com')).toBe(true);
    expect(isExternalUrl('https://example.com/path?query=1')).toBe(true);
  });

  it('should return true for other protocols', () => {
    expect(isExternalUrl('mailto:test@example.com')).toBe(true);
    expect(isExternalUrl('tel:+1234567890')).toBe(true);
    expect(isExternalUrl('ftp://files.example.com')).toBe(true);
  });

  it('should return false for relative paths', () => {
    expect(isExternalUrl('/about')).toBe(false);
    expect(isExternalUrl('/en/about')).toBe(false);
    expect(isExternalUrl('about')).toBe(false);
    expect(isExternalUrl('./about')).toBe(false);
    expect(isExternalUrl('../about')).toBe(false);
  });

  it('should return false for paths starting with locale-like segments', () => {
    expect(isExternalUrl('en/about')).toBe(false);
    expect(isExternalUrl('fr/contact')).toBe(false);
  });
});

describe('processHref', () => {
  describe('with {locale} placeholder', () => {
    it('should replace {locale} in internal paths', () => {
      expect(processHref('/my/{locale}/path', 'en', 'en', false)).toBe(
        '/my/en/path'
      );
      expect(processHref('/my/{locale}/path', 'fr', 'en', false)).toBe(
        '/my/fr/path'
      );
    });

    it('should replace {locale} in external URLs', () => {
      expect(
        processHref('https://docs.example.com/{locale}/guide', 'en', 'en', false)
      ).toBe('https://docs.example.com/en/guide');
      expect(
        processHref('https://docs.example.com/{locale}/guide', 'fr', 'en', false)
      ).toBe('https://docs.example.com/fr/guide');
    });

    it('should replace multiple {locale} occurrences', () => {
      expect(
        processHref('/{locale}/docs/{locale}/api', 'en', 'en', false)
      ).toBe('/en/docs/en/api');
    });

    it('should replace {locale} even when hideDefaultLocale is true', () => {
      // When using placeholder, always replace it regardless of hideDefaultLocale
      expect(processHref('/my/{locale}/path', 'en', 'en', true)).toBe(
        '/my/en/path'
      );
    });
  });

  describe('internal paths without placeholder', () => {
    it('should prepend locale to internal paths', () => {
      expect(processHref('/about', 'en', 'en', false)).toBe('/en/about');
      expect(processHref('/about', 'fr', 'en', false)).toBe('/fr/about');
      expect(processHref('/contact/form', 'de', 'en', false)).toBe(
        '/de/contact/form'
      );
    });

    it('should handle paths without leading slash', () => {
      expect(processHref('about', 'en', 'en', false)).toBe('/en/about');
      expect(processHref('contact/form', 'fr', 'en', false)).toBe(
        '/fr/contact/form'
      );
    });

    it('should hide locale for default locale when hideDefaultLocale is true', () => {
      expect(processHref('/about', 'en', 'en', true)).toBe('/about');
      expect(processHref('/contact', 'en', 'en', true)).toBe('/contact');
    });

    it('should still show locale for non-default locale when hideDefaultLocale is true', () => {
      expect(processHref('/about', 'fr', 'en', true)).toBe('/fr/about');
      expect(processHref('/contact', 'de', 'en', true)).toBe('/de/contact');
    });
  });

  describe('external URLs without placeholder', () => {
    it('should pass through external URLs unchanged', () => {
      expect(processHref('https://google.com', 'en', 'en', false)).toBe(
        'https://google.com'
      );
      expect(processHref('https://example.com/path', 'fr', 'en', false)).toBe(
        'https://example.com/path'
      );
    });

    it('should pass through mailto links unchanged', () => {
      expect(processHref('mailto:test@example.com', 'en', 'en', false)).toBe(
        'mailto:test@example.com'
      );
    });

    it('should pass through tel links unchanged', () => {
      expect(processHref('tel:+1234567890', 'en', 'en', false)).toBe(
        'tel:+1234567890'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle root path', () => {
      expect(processHref('/', 'en', 'en', false)).toBe('/en/');
      expect(processHref('/', 'en', 'en', true)).toBe('/');
      expect(processHref('/', 'fr', 'en', true)).toBe('/fr/');
    });

    it('should handle paths with query strings', () => {
      expect(processHref('/search?q=test', 'en', 'en', false)).toBe(
        '/en/search?q=test'
      );
    });

    it('should handle paths with hash', () => {
      expect(processHref('/docs#section', 'en', 'en', false)).toBe(
        '/en/docs#section'
      );
    });

    it('should handle paths with both query and hash', () => {
      expect(processHref('/page?id=1#top', 'fr', 'en', false)).toBe(
        '/fr/page?id=1#top'
      );
    });
  });
});
