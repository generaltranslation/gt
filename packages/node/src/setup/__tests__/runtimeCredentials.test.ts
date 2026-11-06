import { afterEach, describe, expect, it, vi } from 'vitest';
import { addRuntimeCredentials } from '../runtimeCredentials';

describe('runtime credentials', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads GT_PROJECT_ID and GT_API_KEY, not GT_DEV_API_KEY', () => {
    vi.stubEnv('GT_PROJECT_ID', 'env-project-id');
    vi.stubEnv('GT_API_KEY', undefined);
    vi.stubEnv('GT_DEV_API_KEY', 'env-dev-api-key');

    expect(addRuntimeCredentials({})).toMatchObject({
      projectId: 'env-project-id',
      apiKey: undefined,
    });

    vi.stubEnv('GT_API_KEY', 'env-api-key');
    expect(addRuntimeCredentials({}).apiKey).toBe('env-api-key');
  });

  it('keeps explicitly supplied credentials over the environment', () => {
    vi.stubEnv('GT_PROJECT_ID', 'env-project-id');
    vi.stubEnv('GT_API_KEY', 'env-api-key');
    vi.stubEnv('NODE_ENV', 'development');

    expect(
      addRuntimeCredentials({
        projectId: 'explicit-project-id',
        apiKey: 'explicit-api-key',
      })
    ).toMatchObject({
      projectId: 'explicit-project-id',
      apiKey: 'explicit-api-key',
    });
  });

  it('leaves credentials undefined when neither params nor env are present', () => {
    vi.stubEnv('GT_PROJECT_ID', undefined);
    vi.stubEnv('GT_API_KEY', undefined);

    expect(addRuntimeCredentials({})).toMatchObject({
      projectId: undefined,
      apiKey: undefined,
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
