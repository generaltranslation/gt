import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getParams } from '../shared';

let savedEnv: NodeJS.ProcessEnv;

function setConfigEnv() {
  process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS =
    JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      runtimeUrl: 'https://runtime.example.com',
    });
  process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
    cacheUrl: 'https://cache.example.com',
    renderSettings: { timeout: 123 },
    maxConcurrentRequests: 1,
    maxBatchSize: 2,
    batchInterval: 3,
    _versionId: 'version-id',
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

    const { i18nConfigParams, gtservicesEnabledParams, nextI18nCacheParams } =
      getParams();

    expect(i18nConfigParams).toMatchObject({
      projectId: 'project-id',
      apiKey: 'api-key',
      devApiKey: 'dev-key',
    });
    expect(gtservicesEnabledParams).toMatchObject({
      projectId: 'project-id',
      apiKey: 'api-key',
      devApiKey: 'dev-key',
    });
    expect(nextI18nCacheParams).toMatchObject({
      projectId: 'project-id',
      apiKey: 'api-key',
      devApiKey: 'dev-key',
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
});
