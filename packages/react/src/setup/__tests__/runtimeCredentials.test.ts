import { afterEach, describe, expect, it, vi } from 'vitest';
import { addRuntimeCredentials } from '../runtimeCredentials';

const originalNodeEnv = process.env.NODE_ENV;

describe('runtime credentials', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('reads Vite runtime credentials in development', () => {
    process.env.NODE_ENV = 'development';
    vi.stubEnv('VITE_GT_PROJECT_ID', 'vite-project-id');
    vi.stubEnv('VITE_GT_DEV_API_KEY', 'vite-dev-api-key');

    expect(addRuntimeCredentials({})).toMatchObject({
      projectId: 'vite-project-id',
      apiKey: 'vite-dev-api-key',
    });
  });

  it('keeps explicitly supplied credentials', () => {
    process.env.NODE_ENV = 'development';
    vi.stubEnv('VITE_GT_PROJECT_ID', 'vite-project-id');
    vi.stubEnv('VITE_GT_DEV_API_KEY', 'vite-dev-api-key');

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

  it('does not read the Vite key outside development', () => {
    process.env.NODE_ENV = 'production';
    vi.stubEnv('VITE_GT_PROJECT_ID', 'vite-project-id');
    vi.stubEnv('VITE_GT_DEV_API_KEY', 'vite-dev-api-key');

    expect(addRuntimeCredentials({})).toMatchObject({
      projectId: 'vite-project-id',
      apiKey: undefined,
    });
  });

  it('ignores an explicit API key in production browser code and warns', () => {
    process.env.NODE_ENV = 'production';
    vi.stubGlobal('window', {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(
      addRuntimeCredentials({ projectId: 'project-id', apiKey: 'leaked-key' })
    ).toMatchObject({ projectId: 'project-id', apiKey: undefined });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('An API key reached production browser code')
    );
  });

  it('keeps an explicit API key on a production server', () => {
    process.env.NODE_ENV = 'production';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(addRuntimeCredentials({ apiKey: 'server-key' }).apiKey).toBe(
      'server-key'
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
