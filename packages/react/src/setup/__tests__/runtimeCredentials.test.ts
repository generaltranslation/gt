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

  // src/__tests__/vite.test.ts covers the values gtReact() injects.
  it('reads GT_PROJECT_ID and GT_API_KEY from process.env on a server', () => {
    process.env.NODE_ENV = 'development';
    vi.stubEnv('GT_PROJECT_ID', 'project-id');
    vi.stubEnv('GT_API_KEY', 'api-key');

    expect(addRuntimeCredentials({})).toMatchObject({
      projectId: 'project-id',
      apiKey: 'api-key',
    });
  });

  it('does not read GT_API_KEY from process.env in browser code', () => {
    process.env.NODE_ENV = 'development';
    vi.stubGlobal('window', {});
    vi.stubEnv('GT_API_KEY', 'api-key');

    expect(addRuntimeCredentials({}).apiKey).toBeUndefined();
  });

  it('keeps explicitly supplied credentials', () => {
    process.env.NODE_ENV = 'development';
    vi.stubEnv('GT_PROJECT_ID', 'project-id');
    vi.stubEnv('GT_API_KEY', 'api-key');

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
