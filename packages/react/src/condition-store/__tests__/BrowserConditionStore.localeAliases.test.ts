import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { BrowserConditionStore } from '../BrowserConditionStore';
import { createOrUpdateBrowserConditionStore } from '../createBrowserConditionStore';

const cookieValues = vi.hoisted(() => new Map<string, string>());

vi.mock('../cookies', () => ({
  getCookieValue: ({ cookieName }: { cookieName: string }) =>
    cookieValues.get(cookieName),
  setCookieValue: ({
    cookieName,
    value,
  }: {
    cookieName: string;
    value: string;
  }) => cookieValues.set(cookieName, value),
}));

function configureAliases() {
  // Match the canonical supported list emitted by services-enabled withGTConfig.
  return initializeI18nConfig({
    defaultLocale: 'en-US',
    locales: ['en-US', 'en-GB'],
    customMapping: {
      'en-us': { code: 'en-US' },
      'en-gb': { code: 'en-GB' },
    },
  });
}

describe('BrowserConditionStore locale aliases', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    cookieValues.clear();
    vi.stubGlobal('navigator', { languages: [] });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['en-GB', 'en-gb'])(
    'initializes the cookie and public locale as an alias from %s',
    (locale) => {
      const config = configureAliases();
      const store = new BrowserConditionStore({ locale });

      expect(cookieValues.get(config.getLocaleCookieName())).toBe('en-gb');
      expect(store.getLocale()).toBe('en-gb');
    }
  );

  it.each(['en-GB', 'en-gb'])(
    'returns the alias when an existing cookie contains %s without extra negotiation',
    (locale) => {
      const config = configureAliases();
      const store = new BrowserConditionStore({ locale: 'en-US' });
      cookieValues.set(config.getLocaleCookieName(), locale);
      const determineLocale = vi.spyOn(config, 'determineLocale');

      expect(store.getLocale()).toBe('en-gb');
      expect(determineLocale).toHaveBeenCalledTimes(1);
    }
  );

  it('persists and reloads with the alias when switching locales', () => {
    const config = configureAliases();
    const reload = vi.fn();
    const store = new BrowserConditionStore({
      locale: 'en-US',
      _reload: reload,
    });

    store.setLocale('en-GB');

    expect(cookieValues.get(config.getLocaleCookieName())).toBe('en-gb');
    expect(reload).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'en-gb' })
    );
  });

  it('uses aliases for server-provided updates and the default fallback', () => {
    const config = configureAliases();
    const store = createOrUpdateBrowserConditionStore({ locale: 'en-gb' });

    expect(store.getLocale()).toBe('en-gb');
    createOrUpdateBrowserConditionStore({ locale: 'en-US' });
    expect(cookieValues.get(config.getLocaleCookieName())).toBe('en-us');
    expect(store.getLocale()).toBe('en-us');

    store.updateLocale('de-DE');
    expect(cookieValues.get(config.getLocaleCookieName())).toBe('en-us');
    expect(store.getLocale()).toBe('en-us');
  });

  it('keeps canonical identifiers when no alias is configured', () => {
    const config = initializeI18nConfig({
      defaultLocale: 'en-US',
      locales: ['en-US', 'en-GB'],
    });
    const store = new BrowserConditionStore({ locale: 'en-gb' });

    expect(cookieValues.get(config.getLocaleCookieName())).toBe('en-GB');
    expect(store.getLocale()).toBe('en-GB');
  });
});
