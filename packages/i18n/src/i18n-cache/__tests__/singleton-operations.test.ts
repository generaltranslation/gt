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
    resetI18nCacheGlobal();
  });

  it('throws when the i18n cache has not been initialized', async () => {
    const { getI18nCache } = await import('../singleton-operations');

    expect(() => getI18nCache()).toThrow(
      'getI18nCache(): I18nCache was not initialized. Call initializeGT() before accessing I18nCache.'
    );
  });

  it('shares the cache across module reloads', async () => {
    const { setI18nCache } = await import('../singleton-operations');
    const cache = createCacheStub();

    setI18nCache(cache);

    vi.resetModules();
    const { getI18nCache } = await import('../singleton-operations');

    expect(getI18nCache()).toBe(cache);
  });

  it('warns when overwriting an existing global cache', async () => {
    const { setI18nCache } = await import('../singleton-operations');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    setI18nCache(createCacheStub());
    setI18nCache(createCacheStub());

    expect(warn).toHaveBeenCalledWith(
      'gt-i18n: Overwriting global i18nCache singleton instance.'
    );
  });
});
