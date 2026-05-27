import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  I18nCache,
  initializeI18nConfig,
  setI18nCache,
} from 'gt-i18n/internal';
import { AsyncConditionStore } from '../AsyncConditionStore';

describe('AsyncConditionStore', () => {
  afterEach(() => {
    setTestCache();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function setTestCache() {
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
