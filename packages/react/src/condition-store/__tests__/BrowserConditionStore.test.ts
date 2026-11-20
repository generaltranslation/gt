import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { defaultResetLocaleCookieName } from 'gt-i18n/internal/cookies';
import { BrowserConditionStore } from '../BrowserConditionStore';
import { createOrUpdateBrowserConditionStore } from '../createBrowserConditionStore';
import { stubDocumentCookie } from './stubDocumentCookie';

const cookieValues = new Map<string, string>();

function configure() {
  return initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr', 'es'],
  });
}

function configureAliases() {
  // Match the configured spelling retained by services-enabled withGTConfig.
  return initializeI18nConfig({
    defaultLocale: 'en-us',
    locales: ['en-us', 'en-gb'],
    customMapping: {
      'en-us': { code: 'en-US' },
      'en-gb': { code: 'en-GB' },
    },
  });
}

beforeEach(async () => {
  // Ends the task of the previous test.
  await Promise.resolve();
  Reflect.deleteProperty(globalThis, '__generaltranslation');
  cookieValues.clear();
  stubDocumentCookie(cookieValues);
  vi.stubGlobal('navigator', { languages: [] });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, '__generaltranslation');
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('BrowserConditionStore', () => {
  it('persists the initial locale, region, and enableI18n state', () => {
    configure();
    new BrowserConditionStore({
      locale: 'fr',
      region: 'CA',
      enableI18n: false,
    });

    expect(Object.fromEntries(cookieValues)).toEqual({
      'generaltranslation.locale': 'fr',
      'generaltranslation.region': 'CA',
      'generaltranslation.enable-i18n': 'false',
    });
  });

  it('uses I18nConfig cookie names', () => {
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
      localeCookieName: 'custom-locale',
      regionCookieName: 'custom-region',
      enableI18nCookieName: 'custom-enable-i18n',
    });
    const conditionStore = new BrowserConditionStore({
      locale: 'fr',
      region: 'CA',
      enableI18n: false,
      _reload: vi.fn(),
    });

    expect(Object.fromEntries(cookieValues)).toEqual({
      'custom-locale': 'fr',
      'custom-region': 'CA',
      'custom-enable-i18n': 'false',
    });

    conditionStore.setLocale('es');
    expect(cookieValues.get('custom-locale')).toBe('es');
  });

  it('signals locale resets when users set a locale', () => {
    const config = configure();
    const conditionStore = new BrowserConditionStore({
      locale: 'en',
      _reload: vi.fn(),
    });
    expect(cookieValues.has(defaultResetLocaleCookieName)).toBe(false);

    conditionStore.setLocale('fr');

    expect(cookieValues.get(config.getLocaleCookieName())).toBe('fr');
    expect(cookieValues.get(defaultResetLocaleCookieName)).toBe('true');
  });

  it('continues to read the locale cookie in SPA mode', () => {
    const config = configure();
    const conditionStore = new BrowserConditionStore({ locale: 'en' });
    cookieValues.set(config.getLocaleCookieName(), 'fr');

    expect(conditionStore.getLocale()).toBe('fr');
  });

  it('follows the cookie from one task to the next, and a custom reader within a task', async () => {
    const cookieName = configure().getLocaleCookieName();
    let custom = 'es';
    const conditionStore = new BrowserConditionStore({ locale: 'en' });
    const withGetter = new BrowserConditionStore({
      locale: 'en',
      _getLocale: () => custom,
    });

    expect(conditionStore.getLocale()).toBe('en');
    cookieValues.set(cookieName, 'fr');
    await Promise.resolve();
    expect(conditionStore.getLocale()).toBe('fr');
    expect(withGetter.getLocale()).toBe('fr');

    cookieValues.delete(cookieName);
    await Promise.resolve();
    expect(conditionStore.getLocale()).toBe('en');
    expect(withGetter.getLocale()).toBe('es');
    custom = 'fr';
    expect(withGetter.getLocale()).toBe('fr');
    expect(conditionStore.getLocale()).toBe('en');
  });

  it.each([
    { name: 'real timers', fakeTimers: false },
    // Fake timers hold queueMicrotask and timers, not a promise.
    { name: 'fake timers', fakeTimers: true },
  ])(
    'sees a cookie that other code writes in the next task, with $name',
    async ({ fakeTimers }) => {
      if (fakeTimers) {
        vi.useFakeTimers({
          toFake: ['queueMicrotask', 'setTimeout', 'setImmediate'],
        });
      }
      const config = configure();
      const conditionStore = new BrowserConditionStore({ locale: 'en' });
      expect(conditionStore.getLocale()).toBe('en');
      expect(conditionStore.getEnableI18n()).toBe(true);

      document.cookie = `${config.getLocaleCookieName()}=fr;path=/`;
      document.cookie = `${config.getEnableI18nCookieName()}=false;path=/`;
      expect(conditionStore.getLocale()).toBe('en');
      expect(conditionStore.getEnableI18n()).toBe(true);

      await Promise.resolve();
      expect(conditionStore.getLocale()).toBe('fr');
      expect(conditionStore.getEnableI18n()).toBe(false);
    }
  );

  it('sees a cookie it writes in the same task', () => {
    configure();
    const conditionStore = new BrowserConditionStore({ locale: 'en' });
    expect(conditionStore.getLocale()).toBe('en');
    expect(conditionStore.getEnableI18n()).toBe(true);
    expect(conditionStore.getRegion()).toBeUndefined();

    conditionStore.updateLocale('fr');
    conditionStore.updateEnableI18n(false);
    conditionStore.updateRegion('CA');

    expect(conditionStore.getLocale()).toBe('fr');
    expect(conditionStore.getEnableI18n()).toBe(false);
    expect(conditionStore.getRegion()).toBe('CA');
  });

  it('follows the navigator from one task to the next', async () => {
    const cookieName = configure().getLocaleCookieName();
    const conditionStore = new BrowserConditionStore({ locale: 'en' });
    cookieValues.delete(cookieName);
    await Promise.resolve();

    vi.stubGlobal('navigator', { languages: ['fr-CA'] });
    expect(conditionStore.getLocale()).toBe('fr');
    vi.stubGlobal('navigator', { languages: ['es-MX'] });
    expect(conditionStore.getLocale()).toBe('fr');
    await Promise.resolve();
    expect(conditionStore.getLocale()).toBe('es');
  });

  it('reads the locale of a browser that keeps no cookie, from its first read', async () => {
    vi.resetModules();
    const fresh = await import('../BrowserConditionStore');
    const cookieName = configure().getLocaleCookieName();
    vi.stubGlobal('navigator', { languages: ['es-MX'] });
    const conditionStore = new fresh.BrowserConditionStore({ locale: 'fr' });
    cookieValues.delete(cookieName);

    expect(conditionStore.getLocale()).toBe('es');
  });

  it('matches the locale again for another config', () => {
    const cookieName = configure().getLocaleCookieName();
    const conditionStore = new BrowserConditionStore({ locale: 'en' });
    cookieValues.set(cookieName, 'es');
    expect(conditionStore.getLocale()).toBe('es');

    Reflect.deleteProperty(globalThis, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    expect(conditionStore.getLocale()).toBe('en');
  });

  it('falls back to _getEnableI18n, then true, when the enableI18n cookie is missing', () => {
    const cookieName = configure().getEnableI18nCookieName();
    const withGetter = new BrowserConditionStore({
      locale: 'en',
      _getEnableI18n: () => false,
    });
    const withoutGetter = new BrowserConditionStore({ locale: 'en' });
    cookieValues.delete(cookieName);

    expect(withGetter.getEnableI18n()).toBe(false);
    expect(withoutGetter.getEnableI18n()).toBe(true);
  });
});

describe('createOrUpdateBrowserConditionStore enableI18n', () => {
  it.each([
    {
      name: 'uses the prop before the persisted cookie',
      cookie: 'true',
      params: { enableI18n: false },
      expected: 'false',
    },
    {
      name: 'uses the persisted cookie when the prop is omitted',
      cookie: 'false',
      params: {},
      expected: 'false',
    },
    {
      name: 'uses _getEnableI18n when the prop and cookie are omitted',
      cookie: undefined,
      params: { _getEnableI18n: () => false },
      expected: 'false',
    },
    {
      name: 'defaults to true without a prop, cookie, or getter',
      cookie: undefined,
      params: {},
      expected: 'true',
    },
  ])('$name', ({ cookie, params, expected }) => {
    const cookieName = configure().getEnableI18nCookieName();
    if (cookie !== undefined) cookieValues.set(cookieName, cookie);

    createOrUpdateBrowserConditionStore({ locale: 'fr', ...params });

    expect(cookieValues.get(cookieName)).toBe(expected);
  });
});

describe('BrowserConditionStore locale aliases', () => {
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
