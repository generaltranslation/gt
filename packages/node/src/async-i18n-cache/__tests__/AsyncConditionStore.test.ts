import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  I18nCache,
  initializeI18nConfig,
  setI18nCache,
} from 'gt-i18n/internal';
import { AsyncConditionStore } from '../AsyncConditionStore';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe('AsyncConditionStore', () => {
  afterEach(() => {
    resetGTGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function setTestCache() {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });
    setI18nCache(
      new I18nCache({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      })
    );
  }

  it('throws when reading the locale outside a scoped context', () => {
    setTestCache();
    const store = new AsyncConditionStore({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });

    expect(() => store.getLocale()).toThrow(
      'AsyncConditionStore: getLocale() called outside of a withGT() scope.'
    );
  });

  it('warns and falls back outside a scoped context in production', () => {
    setTestCache();
    vi.stubEnv('NODE_ENV', 'production');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new AsyncConditionStore({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });

    expect(store.getLocale()).toBe('en');
    expect(warnSpy).toHaveBeenCalledWith(
      'AsyncConditionStore: getLocale() called outside of a withGT() scope.'
    );
  });

  it('returns the scoped locale inside run()', () => {
    setTestCache();
    const store = new AsyncConditionStore({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });

    expect(store.run('fr', () => store.getLocale())).toBe('fr');
  });

  it('carries all scoped conditions inside run()', () => {
    setTestCache();
    const store = new AsyncConditionStore();

    const conditions = store.run(
      { locale: 'fr', region: 'CA', enableI18n: false },
      () => ({
        locale: store.getLocale(),
        region: store.getRegion(),
        enableI18n: store.getEnableI18n(),
      })
    );

    expect(conditions).toEqual({
      locale: 'fr',
      region: 'CA',
      enableI18n: false,
    });
  });

  it('updates conditions within the active scope', () => {
    setTestCache();
    const store = new AsyncConditionStore();

    const conditions = store.run('en', () => {
      store.setLocale('fr');
      store.setRegion('FR');
      store.setEnableI18n(false);
      return {
        locale: store.getLocale(),
        region: store.getRegion(),
        enableI18n: store.getEnableI18n(),
      };
    });

    expect(conditions).toEqual({
      locale: 'fr',
      region: 'FR',
      enableI18n: false,
    });
  });
});
