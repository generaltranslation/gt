import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNextI18nCache } from '../../i18n-cache/NextI18nCache';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { initializeGT } from '../initGT';

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

  it('initializes the React Core config singleton', () => {
    initializeGT({
      i18nConfigParams: {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        localeCookieName: 'custom-locale',
      },
      nextI18nCacheParams: {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      },
    });

    expect(getI18nConfig().getLocaleCookieName()).toBe('custom-locale');
  });
});
