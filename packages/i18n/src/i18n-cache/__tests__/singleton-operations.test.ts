import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { I18nCache } from '../I18nCache';
import type { Translation } from '../translations-manager/utils/types/translation-data';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: {
    i18n?: {
      i18nCache?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

function resetI18nCacheGlobal() {
  const globalObj = globalThis as TestGlobal;
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nCache');
  }
}

function createCacheStub(): I18nCache<Translation> {
  return {} as I18nCache<Translation>;
}

describe('i18n cache singleton operations', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetI18nCacheGlobal();
  });

  it('throws when the i18n cache has not been initialized', async () => {
    const { getI18nCache, isI18nCacheInitialized } =
      await import('../singleton-operations');

    expect(isI18nCacheInitialized()).toBe(false);
    expect(() => getI18nCache()).toThrow(
      'Cannot read I18nCache before it has been initialized'
    );
  });

  it('shares the cache across module reloads', async () => {
    const { setI18nCache } = await import('../singleton-operations');
    const cache = createCacheStub();

    setI18nCache(cache);

    vi.resetModules();
    const { getI18nCache, isI18nCacheInitialized } =
      await import('../singleton-operations');

    expect(isI18nCacheInitialized()).toBe(true);
    expect(getI18nCache()).toBe(cache);
  });

  it('preserves an existing global cache', async () => {
    const { getI18nCache, setI18nCache } =
      await import('../singleton-operations');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = createCacheStub();

    setI18nCache(cache);
    setI18nCache(createCacheStub());

    expect(getI18nCache()).toBe(cache);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns about an existing global cache when debug logging is enabled', async () => {
    vi.stubEnv('_GENERALTRANSLATION_LOG_LEVEL', 'DEBUG');
    const { getI18nCache, setI18nCache } =
      await import('../singleton-operations');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = createCacheStub();

    setI18nCache(cache);
    setI18nCache(createCacheStub());

    expect(getI18nCache()).toBe(cache);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Global i18nCache singleton instance was already initialized'
      )
    );
  });
});
