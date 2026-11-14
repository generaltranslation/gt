import { resolveConfig } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gtVue } from '../vite';

async function resolveCredentialDefines(command: 'serve' | 'build') {
  const { define = {} } = await resolveConfig(
    { configFile: false, envFile: false, plugins: [gtVue()] },
    command
  );
  return {
    projectId: define['import.meta.env.GT_PROJECT_ID'],
    apiKey: define['import.meta.env.GT_API_KEY'],
  };
}

describe('gtVue', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exposes the API key to the dev server only', async () => {
    vi.stubEnv('GT_PROJECT_ID', 'project-id');
    vi.stubEnv('GT_API_KEY', 'SENTINEL_KEY');

    expect(gtVue().name).toBe('gt-vue');
    expect(await resolveCredentialDefines('serve')).toEqual({
      projectId: JSON.stringify('project-id'),
      apiKey: JSON.stringify('SENTINEL_KEY'),
    });
    expect(await resolveCredentialDefines('build')).toEqual({
      projectId: JSON.stringify('project-id'),
      apiKey: undefined,
    });
  });

  it('names gt-vue when envPrefix would inline GT_API_KEY', async () => {
    await expect(
      resolveConfig(
        { configFile: false, envPrefix: ['GT_'], plugins: [gtVue()] },
        'build'
      )
    ).rejects.toThrow('gtVue()');
  });
});
