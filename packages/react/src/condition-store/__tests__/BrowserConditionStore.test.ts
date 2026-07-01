import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetCookieValue = vi.hoisted(() => vi.fn());

vi.mock('../cookies', () => ({
  getCookieValue: vi.fn(),
  setCookieValue: (...args: unknown[]) => mockSetCookieValue(...args),
}));

vi.mock('gt-i18n/internal', () => ({
  getI18nConfig: () => ({
    determineLocale: (locale: string | string[] | undefined) => {
      return Array.isArray(locale) ? locale[0] : locale;
    },
    getDefaultLocale: () => 'en',
    resolveSupportedLocale: (locale?: string | string[]) => {
      const resolved = Array.isArray(locale) ? locale[0] : locale;
      return resolved || 'en';
    },
  }),
}));

import { BrowserConditionStore } from '../BrowserConditionStore';

describe('BrowserConditionStore', () => {
  beforeEach(() => {
    mockSetCookieValue.mockReset();
  });

  it('persists the initial locale, region, and enableI18n state', () => {
    new BrowserConditionStore({
      locale: 'fr',
      region: 'CA',
      enableI18n: false,
      localeCookieName: 'locale-cookie',
      regionCookieName: 'region-cookie',
      enableI18nCookieName: 'enable-cookie',
    });

    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'locale-cookie',
      value: 'fr',
    });
    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'region-cookie',
      value: 'CA',
    });
    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'enable-cookie',
      value: 'false',
    });
  });

  it('signals locale resets when users set a locale', () => {
    const conditionStore = new BrowserConditionStore({
      locale: 'en',
      _reload: vi.fn(),
    });
    mockSetCookieValue.mockClear();

    conditionStore.setLocale('fr');

    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'generaltranslation.locale',
      value: 'fr',
    });
    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'generaltranslation.locale-reset',
      value: 'true',
    });
  });
});
