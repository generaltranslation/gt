import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetCookieValue = vi.hoisted(() => vi.fn());
const mockCookieValues = vi.hoisted(
  () => new Map<string, string | undefined>()
);
const mockCookieNames = vi.hoisted(() => ({
  locale: 'generaltranslation.locale',
  region: 'generaltranslation.region',
  enableI18n: 'generaltranslation.enable-i18n',
}));

vi.mock('../cookies', () => ({
  getCookieValue: ({ cookieName }: { cookieName: string }) =>
    mockCookieValues.get(cookieName),
  setCookieValue: (...args: unknown[]) => mockSetCookieValue(...args),
}));

vi.mock('@generaltranslation/react-core/pure', () => ({
  defaultResetLocaleCookieName: 'generaltranslation.locale-reset',
  getI18nConfig: () => ({
    resolveSupportedLocale: (locale?: string | string[]) => {
      const resolved = Array.isArray(locale) ? locale[0] : locale;
      return resolved || 'en';
    },
    getLocaleCookieName: () => mockCookieNames.locale,
    getRegionCookieName: () => mockCookieNames.region,
    getEnableI18nCookieName: () => mockCookieNames.enableI18n,
  }),
}));

import { createOrUpdateBrowserConditionStore } from '../createBrowserConditionStore';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe('createOrUpdateBrowserConditionStore', () => {
  beforeEach(() => {
    resetGTGlobals();
    mockSetCookieValue.mockReset();
    mockCookieValues.clear();
    mockCookieNames.locale = 'generaltranslation.locale';
    mockCookieNames.region = 'generaltranslation.region';
    mockCookieNames.enableI18n = 'generaltranslation.enable-i18n';
  });

  it('uses the enableI18n prop before the persisted cookie', () => {
    mockCookieValues.set('generaltranslation.enable-i18n', 'true');

    createOrUpdateBrowserConditionStore({
      locale: 'fr',
      enableI18n: false,
    });

    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'generaltranslation.enable-i18n',
      value: 'false',
    });
  });

  it('uses the persisted enableI18n cookie when the prop is omitted', () => {
    mockCookieValues.set('generaltranslation.enable-i18n', 'false');

    createOrUpdateBrowserConditionStore({
      locale: 'fr',
    });

    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'generaltranslation.enable-i18n',
      value: 'false',
    });
  });

  it('uses _getEnableI18n when the prop and cookie are omitted', () => {
    createOrUpdateBrowserConditionStore({
      locale: 'fr',
      _getEnableI18n: () => false,
    });

    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'generaltranslation.enable-i18n',
      value: 'false',
    });
  });

  it('defaults enableI18n to true without a prop or cookie', () => {
    createOrUpdateBrowserConditionStore({
      locale: 'fr',
    });

    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'generaltranslation.enable-i18n',
      value: 'true',
    });
  });
});
