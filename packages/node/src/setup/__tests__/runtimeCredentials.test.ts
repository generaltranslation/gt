import { afterEach, describe, expect, it, vi } from 'vitest';
import { addRuntimeCredentials } from '../runtimeCredentials';

describe('runtime credentials', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads credentials from the environment for all three variables', () => {
    vi.stubEnv('GT_PROJECT_ID', 'env-project-id');
    vi.stubEnv('GT_API_KEY', 'env-api-key');
    vi.stubEnv('GT_DEV_API_KEY', 'env-dev-api-key');

    expect(addRuntimeCredentials({})).toMatchObject({
      projectId: 'env-project-id',
      apiKey: 'env-api-key',
      devApiKey: 'env-dev-api-key',
    });
  });

  it('keeps explicitly supplied credentials over the environment', () => {
    vi.stubEnv('GT_PROJECT_ID', 'env-project-id');
    vi.stubEnv('GT_API_KEY', 'env-api-key');
    vi.stubEnv('GT_DEV_API_KEY', 'env-dev-api-key');

    expect(
      addRuntimeCredentials({
        projectId: 'explicit-project-id',
        apiKey: 'explicit-api-key',
        devApiKey: 'explicit-dev-api-key',
      })
    ).toMatchObject({
      projectId: 'explicit-project-id',
      apiKey: 'explicit-api-key',
      devApiKey: 'explicit-dev-api-key',
    });
  });

  it('leaves credentials undefined when neither params nor env are present', () => {
    vi.stubEnv('GT_PROJECT_ID', undefined);
    vi.stubEnv('GT_API_KEY', undefined);
    vi.stubEnv('GT_DEV_API_KEY', undefined);

    expect(addRuntimeCredentials({})).toMatchObject({
      projectId: undefined,
      apiKey: undefined,
      devApiKey: undefined,
    });
  });

  it('treats an empty-string env var as falsy and does not override an explicit param', () => {
    vi.stubEnv('GT_API_KEY', '');

    expect(addRuntimeCredentials({ apiKey: 'explicit-api-key' })).toMatchObject(
      { apiKey: 'explicit-api-key' }
    );
  });

  it('lets an empty-string explicit param fall back to the env value', () => {
    vi.stubEnv('GT_API_KEY', 'env-api-key');

    expect(addRuntimeCredentials({ apiKey: '' })).toMatchObject({
      apiKey: 'env-api-key',
    });
  });

  it('preserves other config fields when adding credentials', () => {
    vi.stubEnv('GT_PROJECT_ID', 'env-project-id');

    expect(
      addRuntimeCredentials({
        defaultLocale: 'en-US',
        locales: ['en-US', 'fr'],
      })
    ).toMatchObject({
      defaultLocale: 'en-US',
      locales: ['en-US', 'fr'],
      projectId: 'env-project-id',
    });
  });
});
