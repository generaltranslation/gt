import { afterEach, describe, expect, it, vi } from 'vitest';
import { addRuntimeCredentials } from '../runtimeCredentials';

const originalNodeEnv = process.env.NODE_ENV;

describe('runtime credentials', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('reads Vite runtime credentials in development', () => {
    process.env.NODE_ENV = 'development';
    vi.stubEnv('VITE_GT_PROJECT_ID', 'vite-project-id');
    vi.stubEnv('VITE_GT_DEV_API_KEY', 'vite-dev-api-key');

    expect(addRuntimeCredentials({})).toMatchObject({
      projectId: 'vite-project-id',
      devApiKey: 'vite-dev-api-key',
    });
  });

  it('keeps explicitly supplied credentials', () => {
    process.env.NODE_ENV = 'development';
    vi.stubEnv('VITE_GT_PROJECT_ID', 'vite-project-id');
    vi.stubEnv('VITE_GT_DEV_API_KEY', 'vite-dev-api-key');

    expect(
      addRuntimeCredentials({
        projectId: 'explicit-project-id',
        devApiKey: 'explicit-dev-api-key',
      })
    ).toMatchObject({
      projectId: 'explicit-project-id',
      devApiKey: 'explicit-dev-api-key',
    });
  });

  it('does not read the dev api key outside development', () => {
    process.env.NODE_ENV = 'production';
    vi.stubEnv('VITE_GT_PROJECT_ID', 'vite-project-id');
    vi.stubEnv('VITE_GT_DEV_API_KEY', 'vite-dev-api-key');

    expect(addRuntimeCredentials({})).toMatchObject({
      projectId: 'vite-project-id',
      devApiKey: undefined,
    });
  });
});
