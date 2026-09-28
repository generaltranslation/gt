import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { initializeGTServer } from '../initGT.server';
import { getParams } from '../shared';

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
    resetI18nGlobals();
  });

  it('enables server development hot reload with only public runtime credentials', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('GT_PROJECT_ID', undefined);
    vi.stubEnv('GT_API_KEY', undefined);
    vi.stubEnv('GT_DEV_API_KEY', undefined);
    vi.stubEnv('NEXT_PUBLIC_GT_PROJECT_ID', 'project-id');
    vi.stubEnv('NEXT_PUBLIC_GT_DEV_API_KEY', 'gtx-development-key');
    vi.stubEnv(
      'NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
      JSON.stringify({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      })
    );

    expect(getParams().nextI18nCacheParams).toMatchObject({
      projectId: 'project-id',
      devApiKey: 'gtx-development-key',
      apiKey: undefined,
    });
    initializeGTServer();

    expect(getNextI18nCache()).toBeInstanceOf(NextI18nCache);
    expect(getI18nConfig().isDevHotReloadEnabled()).toBe(true);
    expect(process.env.GT_API_KEY).toBeUndefined();
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
