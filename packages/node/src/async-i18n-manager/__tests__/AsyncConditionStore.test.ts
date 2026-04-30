import { afterEach, describe, expect, it, vi } from 'vitest';
import { AsyncConditionStore } from '../AsyncConditionStore';

describe('AsyncConditionStore', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('throws when reading the locale outside a scoped context', () => {
    const store = new AsyncConditionStore({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });

    expect(() => store.getLocale()).toThrow(
      'AsyncConditionStore: getLocale() called outside of a withGT() scope.'
    );
  });

  it('warns and falls back outside a scoped context in production', () => {
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
    const store = new AsyncConditionStore({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });

    expect(store.run('fr', () => store.getLocale())).toBe('fr');
  });
});
