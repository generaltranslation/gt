import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig, setI18nCache } from 'gt-i18n/internal';
import { I18nCache } from 'gt-i18n/internal/i18n-cache';
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
});
