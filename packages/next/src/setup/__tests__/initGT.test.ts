import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNextI18nCache } from '../../i18n-cache/NextI18nCache';
import { initializeGT } from '../initGT';
import { initializeGTServer } from '../initGT.server';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: {
    i18n?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

function resetI18nGlobals() {
  const globalObj = globalThis as TestGlobal;
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nConfig');
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nCache');
    Reflect.deleteProperty(
      globalObj.__generaltranslation.i18n,
      'conditionStore'
    );
  }
}

describe('initializeGT', () => {
  beforeEach(() => {
    resetI18nGlobals();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not replace an existing NextI18nCache', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const params = {
      i18nConfigParams: {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      },
      nextI18nCacheParams: {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      },
    };

    initializeGT(params);
    const cache = getNextI18nCache();

    initializeGT(params);

    expect(getNextI18nCache()).toBe(cache);
    warn.mockRestore();
  });

  it('initializes server state with custom request functions enabled', () => {
    vi.stubEnv('_GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED', 'true');
    vi.stubEnv('_GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED', 'true');
    const params = {
      i18nConfigParams: {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      },
      nextI18nCacheParams: {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      },
    };

    expect(() => initializeGTServer(params)).not.toThrow();
  });
});
