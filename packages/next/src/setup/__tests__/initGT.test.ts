import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNextI18nCache,
  NextI18nCache,
} from '../../i18n-cache/NextI18nCache';
import {
  getI18nConfig,
  getReactI18nCache,
  ReactI18nCache,
} from '@generaltranslation/react-core/pure';
import { initializeGT } from '../initGT';
import { initializeGTClient } from '../initGT.client';

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
    expect(cache).toBeInstanceOf(NextI18nCache);

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
        enableI18nCookieName: 'custom-enable-i18n',
      },
      nextI18nCacheParams: {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      },
    });

    expect(getI18nConfig().getLocaleCookieName()).toBe('custom-locale');
    expect(getI18nConfig().getEnableI18nCookieName()).toBe(
      'custom-enable-i18n'
    );
  });
});

describe('initializeGTClient', () => {
  beforeEach(() => {
    resetI18nGlobals();
    vi.restoreAllMocks();
  });

  it('uses the client-safe ReactI18nCache', () => {
    initializeGTClient({
      i18nConfigParams: {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      },
      nextI18nCacheParams: {},
    });

    const cache = getReactI18nCache();
    expect(cache).toBeInstanceOf(ReactI18nCache);
    expect(cache).not.toBeInstanceOf(NextI18nCache);
  });
});
