import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getParams } from '../shared';

let savedEnv: NodeJS.ProcessEnv;

function setConfigEnv() {
  process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS =
    JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
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
    process.env.GT_PROJECT_ID = 'project-id';
    process.env.GT_API_KEY = 'api-key';
    process.env.GT_DEV_API_KEY = 'dev-key';

    const { i18nConfigParams, nextI18nCacheParams } = getParams();

    expect(i18nConfigParams).toMatchObject({
      projectId: 'project-id',
      apiKey: 'api-key',
      devApiKey: 'dev-key',
      cacheUrl: 'https://cache.example.com',
      localeCookieName: 'custom-locale',
      enableI18nCookieName: 'custom-enable-i18n',
    });
    expect(nextI18nCacheParams).toMatchObject({
      projectId: 'project-id',
      apiKey: 'api-key',
      devApiKey: 'dev-key',
      cacheExpiryTime: 12345,
    });
  });

  it('prefers public project and dev credentials when present', () => {
    process.env.GT_PROJECT_ID = 'private-project-id';
    process.env.NEXT_PUBLIC_GT_PROJECT_ID = 'public-project-id';
    process.env.GT_DEV_API_KEY = 'private-dev-key';
    process.env.NEXT_PUBLIC_GT_DEV_API_KEY = 'public-dev-key';

    const { i18nConfigParams } = getParams();

    expect(i18nConfigParams.projectId).toBe('public-project-id');
    expect(i18nConfigParams.devApiKey).toBe('public-dev-key');
  });

  it('lets the i18n cache choose the remote translation loader', () => {
    updateClientConfig({
      _disableDevHotReload: true,
      cacheExpiryTime: 0,
    });

    const { i18nConfigParams, nextI18nCacheParams } = getParams();

    expect(i18nConfigParams._disableDevHotReload).toBe(true);
    expect(nextI18nCacheParams.cacheExpiryTime).toBe(0);
    expect(nextI18nCacheParams._versionId).toBe('version-id');
    expect(nextI18nCacheParams.loadTranslations).toBeUndefined();
  });
});
