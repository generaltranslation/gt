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
  }),
}));

import { BrowserConditionStore } from '../BrowserConditionStore';

describe('BrowserConditionStore', () => {
  beforeEach(() => {
    mockSetCookieValue.mockReset();
  });

  it('persists the initial locale and enableI18n state', () => {
    new BrowserConditionStore({
      locale: 'fr',
      enableI18n: false,
      localeCookieName: 'locale-cookie',
      enableI18nCookieName: 'enable-cookie',
    });

    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'locale-cookie',
      value: 'fr',
    });
    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'enable-cookie',
      value: 'false',
    });
  });
});
