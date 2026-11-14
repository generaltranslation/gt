import { describe, expect, it } from 'vitest';
import { credentialEnvNames, resolveCredentials } from '../credentials';

describe('resolveCredentials', () => {
  const env = { GT_PROJECT_ID: 'env-project', GT_API_KEY: 'env-key' };

  it('names the environment variables', () => {
    expect(credentialEnvNames).toEqual({
      projectId: 'GT_PROJECT_ID',
      apiKey: 'GT_API_KEY',
    });
  });

  it('prefers the config over the environment, per credential', () => {
    expect(resolveCredentials({ projectId: 'project' }, env)).toEqual({
      projectId: 'project',
      apiKey: 'env-key',
    });
    expect(resolveCredentials({ apiKey: 'key' }, env)).toEqual({
      projectId: 'env-project',
      apiKey: 'key',
    });
  });

  it('treats an empty string as unset', () => {
    expect(resolveCredentials({ projectId: '', apiKey: '' }, env)).toEqual({
      projectId: 'env-project',
      apiKey: 'env-key',
    });
    expect(
      resolveCredentials({}, { GT_PROJECT_ID: '', GT_API_KEY: '' })
    ).toEqual({ projectId: undefined, apiKey: undefined });
  });

  it('returns both keys when nothing is set', () => {
    expect(resolveCredentials({}, {})).toEqual({
      projectId: undefined,
      apiKey: undefined,
    });
  });
});
