import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cookieValues = vi.hoisted(() => new Map<string, string>());
const setCookieValue = vi.hoisted(() =>
  vi.fn(({ cookieName, value }: { cookieName: string; value: string }) => {
    cookieValues.set(cookieName, value);
  })
);

vi.mock('../cookies', () => ({
  getCookieValue: ({ cookieName }: { cookieName: string }) =>
    cookieValues.get(cookieName),
  setCookieValue,
}));

import {
  defaultResetLocaleCookieName,
  initializeI18nConfig,
} from '@generaltranslation/react-core/pure';
import { BrowserConditionStore } from '../BrowserConditionStore';

const currentLocaleCookieName = 'custom-current-locale';
const routingLocaleCookieName = 'custom-routing-locale';
const localeRouting = {
  cookieName: routingLocaleCookieName,
  isEnabled: () => true,
};
const regionCookieName = 'custom-region';
const enableI18nCookieName = 'custom-enable-i18n';

describe('BrowserConditionStore routing locale', () => {
  beforeEach(() => {
    cookieValues.clear();
    setCookieValue.mockClear();
    vi.stubGlobal('navigator', { languages: ['de-DE'] });
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es', 'de', 'pt-BR'],
      localeCookieName: currentLocaleCookieName,
      regionCookieName,
      enableI18nCookieName,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks the configured reset cookie for a routed request', () => {
    const store = new BrowserConditionStore({
      locale: 'en',
      _reload: vi.fn(),
      _localeRouting: localeRouting,
      _resetLocaleCookieName: 'site-reset',
    });
    store.setLocale('fr');
    expect(cookieValues.get('site-reset')).toBe(routingLocaleCookieName);
    expect(cookieValues.get(defaultResetLocaleCookieName)).toBeUndefined();
    expect(cookieValues.get(currentLocaleCookieName)).toBe('en');
  });

  it('keeps the rendered locale while requesting a routed locale', () => {
    const reload = vi.fn();
    const store = new BrowserConditionStore({
      locale: 'en',
      region: 'US',
      enableI18n: false,
      _reload: reload,
      _localeRouting: localeRouting,
    });
    setCookieValue.mockClear();

    store.setLocale(['not-supported', 'fr-CA']);

    expect(cookieValues.get(currentLocaleCookieName)).toBe('en');
    expect(cookieValues.get(routingLocaleCookieName)).toBe('fr');
    expect(cookieValues.get(defaultResetLocaleCookieName)).toBe(
      routingLocaleCookieName
    );
    expect(store.getLocale()).toBe('en');
    expect(setCookieValue).not.toHaveBeenCalledWith({
      cookieName: currentLocaleCookieName,
      value: 'fr',
    });
    expect(reload).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledWith({
      locale: 'fr',
      region: 'US',
      enableI18n: false,
    });
  });

  it('retires a pending request when server locale is applied', () => {
    cookieValues.set(routingLocaleCookieName, 'es');
    const store = new BrowserConditionStore({
      locale: ['not-supported', 'pt-br'],
      _reload: vi.fn(),
      _localeRouting: localeRouting,
    });

    expect(cookieValues.get(currentLocaleCookieName)).toBe('pt-BR');
    expect(cookieValues.get(routingLocaleCookieName)).toBe('');
    store.setLocale('fr');

    store.updateLocale(['also-unsupported', 'fr-CA']);

    expect(cookieValues.get(currentLocaleCookieName)).toBe('fr');
    expect(cookieValues.get(routingLocaleCookieName)).toBe('');
    expect(store.getLocale()).toBe('fr');
  });

  it('keeps the latest request during rapid routed locale switches', () => {
    const reload = vi.fn();
    const store = new BrowserConditionStore({
      locale: 'en',
      _reload: reload,
      _localeRouting: localeRouting,
    });

    store.setLocale('fr');
    store.setLocale(['not-supported', 'es-MX']);

    expect(cookieValues.get(currentLocaleCookieName)).toBe('en');
    expect(cookieValues.get(routingLocaleCookieName)).toBe('es');
    expect(store.getLocale()).toBe('en');
    expect(reload.mock.calls.map(([state]) => state.locale)).toEqual([
      'fr',
      'es',
    ]);
  });

  it('retains region and enableI18n behavior with locale routing enabled', () => {
    const reload = vi.fn();
    const store = new BrowserConditionStore({
      locale: 'en',
      region: 'US',
      enableI18n: true,
      _reload: reload,
      _localeRouting: localeRouting,
    });
    store.setLocale('fr');
    reload.mockClear();

    store.setRegion('CA');
    store.setEnableI18n(false);

    expect(cookieValues.get(regionCookieName)).toBe('CA');
    expect(cookieValues.get(enableI18nCookieName)).toBe('false');
    expect(cookieValues.get(currentLocaleCookieName)).toBe('en');
    expect(cookieValues.get(routingLocaleCookieName)).toBe('fr');
    expect(reload).toHaveBeenNthCalledWith(1, {
      locale: 'en',
      region: 'CA',
      enableI18n: true,
    });
    expect(reload).toHaveBeenNthCalledWith(2, {
      locale: 'en',
      region: 'CA',
      enableI18n: false,
    });
  });

  it('does not create a pending cookie while routing is disabled', () => {
    const store = new BrowserConditionStore({
      locale: 'en',
      _reload: vi.fn(),
      _localeRouting: { ...localeRouting, isEnabled: () => false },
    });
    store.setLocale('fr');
    expect(cookieValues.get(currentLocaleCookieName)).toBe('fr');
    expect(cookieValues.has(routingLocaleCookieName)).toBe(false);
  });

  it('evaluates routing live and retires a pending request on an excluded path', () => {
    let routingEnabled = true;
    const reload = vi.fn();
    const store = new BrowserConditionStore({
      locale: 'en',
      _reload: reload,
      _localeRouting: {
        cookieName: routingLocaleCookieName,
        isEnabled: () => routingEnabled,
      },
    });

    store.setLocale('fr');
    expect(cookieValues.get(currentLocaleCookieName)).toBe('en');
    expect(cookieValues.get(routingLocaleCookieName)).toBe('fr');

    routingEnabled = false;
    store.setLocale('es');

    expect(cookieValues.get(currentLocaleCookieName)).toBe('es');
    expect(cookieValues.get(routingLocaleCookieName)).toBe('');
    expect(store.getLocale()).toBe('es');
    expect(cookieValues.get(defaultResetLocaleCookieName)).toBe('true');
    expect(reload).toHaveBeenLastCalledWith({
      locale: 'es',
      region: undefined,
      enableI18n: true,
    });
  });
});
