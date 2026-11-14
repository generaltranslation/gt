import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('enables server development hot reload with GT_PROJECT_ID and GT_API_KEY', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('GT_PROJECT_ID', 'project-id');
    vi.stubEnv('GT_API_KEY', 'gtx-development-key');
    vi.stubEnv(
      'NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
      JSON.stringify({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      })
    );

    expect(getParams().i18nCacheParams).toMatchObject({
      projectId: 'project-id',
      apiKey: 'gtx-development-key',
    });
    initializeGTServer();

    expect(getReactI18nCache()).toBeInstanceOf(ReactI18nCache);
    expect(getI18nConfig().isDevHotReloadEnabled()).toBe(true);
  });

  it('does not replace an existing ReactI18nCache', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const params = {
      i18nConfigParams: {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      },
      i18nCacheParams: {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      },
    };

    initializeGT(params);
    const cache = getReactI18nCache();
    expect(cache).toBeInstanceOf(ReactI18nCache);

    initializeGT(params);

    expect(getReactI18nCache()).toBe(cache);
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
      i18nCacheParams: {
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
      i18nCacheParams: {},
    });

    const cache = getReactI18nCache();
    expect(cache).toBeInstanceOf(ReactI18nCache);
  });
});

let savedEnv: NodeJS.ProcessEnv;

function setConfigEnv() {
  process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS =
    JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      timeZone: 'Asia/Tokyo',
      localeMatcher: 'lookup',
      runtimeUrl: 'https://runtime.example.com',
      cacheUrl: 'https://cache.example.com',
      renderSettings: { timeout: 123 },
      headersAndCookies: {
        localeCookieName: 'custom-locale',
        enableI18nCookieName: 'custom-enable-i18n',
      },
      maxConcurrentRequests: 1,
      maxBatchSize: 2,
      batchInterval: 3,
      cacheExpiryTime: 12345,
      _versionId: 'version-id',
    });
}

function updateClientConfig(config: Record<string, unknown>) {
  process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS =
    JSON.stringify({
      ...JSON.parse(
        process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}'
      ),
      ...config,
    });
}

describe('getParams', () => {
  beforeEach(() => {
    savedEnv = { ...process.env };
    process.env = {};
    setConfigEnv();
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('reads runtime credentials directly from process.env', () => {
    process.env.NODE_ENV = 'development';
    process.env.GT_PROJECT_ID = 'project-id';
    process.env.GT_API_KEY = 'api-key';

    const { i18nConfigParams, i18nCacheParams } = getParams();

    expect(i18nConfigParams).toMatchObject({
      localeMatcher: 'lookup',
      projectId: 'project-id',
      apiKey: 'api-key',
      cacheUrl: 'https://cache.example.com',
      timeZone: 'Asia/Tokyo',
      localeCookieName: 'custom-locale',
      enableI18nCookieName: 'custom-enable-i18n',
    });
    expect(i18nCacheParams).toMatchObject({
      projectId: 'project-id',
      apiKey: 'api-key',
      cacheExpiryTime: 12345,
    });
  });

  it('does not read the NEXT_PUBLIC_ credentials earlier setups used', () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_GT_PROJECT_ID = 'legacy-project-id';
    process.env.NEXT_PUBLIC_GT_DEV_API_KEY = 'legacy-dev-key';

    const { i18nConfigParams } = getParams();

    expect(i18nConfigParams.projectId).toBeUndefined();
    expect(i18nConfigParams.apiKey).toBeUndefined();
  });

  it('does not read GT_DEV_API_KEY', () => {
    process.env.NODE_ENV = 'development';
    process.env.GT_PROJECT_ID = 'project-id';
    process.env.GT_DEV_API_KEY = 'dev-key';

    const { i18nConfigParams } = getParams();

    expect(i18nConfigParams.apiKey).toBeUndefined();
  });

  it('uses the project ID withGTConfig() serialized, then GT_PROJECT_ID', () => {
    process.env.NODE_ENV = 'production';

    updateClientConfig({ projectId: 'config-project-id' });
    expect(getParams().i18nConfigParams.projectId).toBe('config-project-id');
    expect(getParams().i18nCacheParams.projectId).toBe('config-project-id');

    updateClientConfig({ projectId: undefined });
    process.env.GT_PROJECT_ID = 'env-project-id';
    expect(getParams().i18nConfigParams.projectId).toBe('env-project-id');
  });

  it.each(['production', 'test'])(
    'passes GT_API_KEY to the server runtime when NODE_ENV is %s',
    (nodeEnv) => {
      process.env.NODE_ENV = nodeEnv;
      process.env.GT_PROJECT_ID = 'project-id';
      process.env.GT_API_KEY = 'api-key';

      const { i18nConfigParams, i18nCacheParams } = getParams();

      expect(i18nConfigParams.apiKey).toBe('api-key');
      expect(i18nCacheParams.apiKey).toBe('api-key');
    }
  );

  it('lets the i18n cache choose the remote translation loader', () => {
    updateClientConfig({
      _disableDevHotReload: true,
      cacheExpiryTime: 0,
    });

    const { i18nConfigParams, i18nCacheParams } = getParams();

    expect(i18nConfigParams._disableDevHotReload).toBe(true);
    expect(i18nCacheParams.cacheExpiryTime).toBe(0);
    expect(i18nCacheParams._versionId).toBe('version-id');
    expect(i18nCacheParams.loadTranslations).toBeUndefined();
  });
});
