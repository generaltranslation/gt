import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetCookieValue = vi.hoisted(() => vi.fn());
const mockCookieNames = vi.hoisted(() => ({
  locale: 'generaltranslation.locale',
  region: 'generaltranslation.region',
  enableI18n: 'generaltranslation.enable-i18n',
}));

vi.mock('../cookies', () => ({
  getCookieValue: vi.fn(),
  setCookieValue: (...args: unknown[]) => mockSetCookieValue(...args),
}));

vi.mock('gt-i18n/internal', () => ({
  defaultLocaleCookieName: 'generaltranslation.locale',
  defaultRegionCookieName: 'generaltranslation.region',
  defaultEnableI18nCookieName: 'generaltranslation.enable-i18n',
  getI18nConfig: () => ({
    determineLocale: (locale: string | string[] | undefined) => {
      return Array.isArray(locale) ? locale[0] : locale;
    },
    getDefaultLocale: () => 'en',
    resolveSupportedLocale: (locale?: string | string[]) => {
      const resolved = Array.isArray(locale) ? locale[0] : locale;
      return resolved || 'en';
    },
    getLocaleCookieName: () => mockCookieNames.locale,
    getRegionCookieName: () => mockCookieNames.region,
    getEnableI18nCookieName: () => mockCookieNames.enableI18n,
  }),
}));

import { BrowserConditionStore } from '../BrowserConditionStore';

describe('BrowserConditionStore', () => {
  beforeEach(() => {
    mockSetCookieValue.mockReset();
    mockCookieNames.locale = 'generaltranslation.locale';
    mockCookieNames.region = 'generaltranslation.region';
    mockCookieNames.enableI18n = 'generaltranslation.enable-i18n';
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

  it('falls back to I18nConfig cookie names when none are passed', () => {
    mockCookieNames.locale = 'custom-locale';
    mockCookieNames.region = 'custom-region';
    mockCookieNames.enableI18n = 'custom-enable-i18n';

    const conditionStore = new BrowserConditionStore({
      locale: 'fr',
      region: 'CA',
      enableI18n: false,
      _reload: vi.fn(),
    });

    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'custom-locale',
      value: 'fr',
    });
    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'custom-region',
      value: 'CA',
    });
    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'custom-enable-i18n',
      value: 'false',
    });

    mockSetCookieValue.mockClear();
    conditionStore.setLocale('es');

    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'custom-locale',
      value: 'es',
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
