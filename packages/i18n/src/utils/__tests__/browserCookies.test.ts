import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getBrowserCookieValue,
  setBrowserCookieValue,
} from '../browserCookies';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
  defaultResetLocaleCookieName,
} from '../cookieNames';

describe('browser cookies', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the canonical GT cookie names in one dependency-free module', () => {
    expect(defaultLocaleCookieName).toBe('generaltranslation.locale');
    expect(defaultRegionCookieName).toBe('generaltranslation.region');
    expect(defaultEnableI18nCookieName).toBe('generaltranslation.enable-i18n');
    expect(defaultResetLocaleCookieName).toBe(
      'generaltranslation.locale-reset'
    );
  });

  it('reads and decodes an exact browser cookie name', () => {
    vi.stubGlobal('document', {
      cookie:
        'other=value; generaltranslation.locale=brand%2Dfrench%3Dca; generaltranslation.locale-extra=es',
    });

    expect(getBrowserCookieValue(defaultLocaleCookieName)).toBe(
      'brand-french=ca'
    );
  });

  it('writes the path-wide session-cookie contract used by GT web runtimes', () => {
    const cookieDocument = { cookie: '' };
    vi.stubGlobal('document', cookieDocument);

    setBrowserCookieValue('custom-locale', 'fr-CA');

    expect(cookieDocument.cookie).toBe('custom-locale=fr-CA;path=/');
  });

  it('does not access browser globals during SSR', () => {
    expect(getBrowserCookieValue(defaultLocaleCookieName)).toBeUndefined();
    expect(() =>
      setBrowserCookieValue(defaultLocaleCookieName, 'fr')
    ).not.toThrow();
  });
});
