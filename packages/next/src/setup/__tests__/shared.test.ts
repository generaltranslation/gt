import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getParams } from '../shared';

let savedEnv: NodeJS.ProcessEnv;

function setConfigEnv() {
  process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS =
    JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
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

    const { i18nConfigParams, nextI18nCacheParams } = getParams();

    expect(i18nConfigParams).toMatchObject({
      localeMatcher: 'lookup',
      projectId: 'project-id',
      apiKey: 'api-key',
      cacheUrl: 'https://cache.example.com',
      localeCookieName: 'custom-locale',
      enableI18nCookieName: 'custom-enable-i18n',
    });
    expect(nextI18nCacheParams).toMatchObject({
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

  it.each(['production', 'test'])(
    'passes GT_API_KEY to the server runtime when NODE_ENV is %s',
    (nodeEnv) => {
      process.env.NODE_ENV = nodeEnv;
      process.env.GT_PROJECT_ID = 'project-id';
      process.env.GT_API_KEY = 'api-key';

      const { i18nConfigParams, nextI18nCacheParams } = getParams();

      expect(i18nConfigParams.apiKey).toBe('api-key');
      expect(nextI18nCacheParams.apiKey).toBe('api-key');
    }
  );

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

  it('logs and ignores an env config that is not valid JSON', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS = '{';

    const { i18nConfigParams } = getParams();

    expect(i18nConfigParams.defaultLocale).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(
        'NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS is not valid JSON'
      )
    );
    error.mockRestore();
  });
});
