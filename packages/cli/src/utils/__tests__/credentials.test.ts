import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  areCredentialsSet,
  getDevelopmentEnvNames,
  setCredentials,
} from '../credentials.js';

describe('setCredentials', () => {
  let appDirectory: string;
  const envPath = () => path.join(appDirectory, '.env.local');
  const readEnv = () => fs.readFileSync(envPath(), 'utf8');

  beforeEach(() => {
    appDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-credentials-'));
  });

  afterEach(() => {
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  it('writes only the project ID and the prefixed hot-reload key', async () => {
    await setCredentials(
      { projectId: 'project-id', apiKey: 'gtx-api-key' },
      'vite',
      appDirectory
    );

    expect(readEnv()).toBe(
      'VITE_GT_PROJECT_ID=project-id\nVITE_GT_DEV_API_KEY=gtx-api-key\n'
    );
    expect(fs.readFileSync(path.join(appDirectory, '.gitignore'), 'utf8')).toBe(
      '.env.local\n'
    );
  });

  it.each([
    ['next-pages', 'NEXT_PUBLIC_'],
    ['gatsby', 'GATSBY_'],
    ['react', 'REACT_APP_'],
    ['redwood', 'REDWOOD_ENV_'],
    ['next-app', ''],
    [undefined, ''],
  ] as const)(
    'prefixes variables for %s with "%s"',
    async (framework, prefix) => {
      await setCredentials(
        { projectId: 'project-id', apiKey: 'gtx-api-key' },
        framework,
        appDirectory
      );

      expect(readEnv()).toBe(
        `${prefix}GT_PROJECT_ID=project-id\n${prefix}GT_DEV_API_KEY=gtx-api-key\n`
      );
    }
  );

  it('preserves unrelated lines, comments, and the production key byte for byte', async () => {
    const existing =
      '# app settings\n\n\nDATABASE_URL=postgres://localhost/app\nexport GT_API_KEY=gtx-production-key\nGT_PROJECT_ID=old-project\nOTHER="quoted value" # trailing comment';
    fs.writeFileSync(envPath(), existing);

    await setCredentials(
      { projectId: 'new-project', apiKey: 'gtx-dev-key' },
      'next-app',
      appDirectory
    );

    expect(readEnv()).toBe(
      '# app settings\n\n\nDATABASE_URL=postgres://localhost/app\nexport GT_API_KEY=gtx-production-key\nGT_PROJECT_ID=new-project\nOTHER="quoted value" # trailing comment\nGT_DEV_API_KEY=gtx-dev-key\n'
    );
    expect(fs.existsSync(path.join(appDirectory, '.gitignore'))).toBe(false);
  });

  it('replaces stale duplicates so a rerun leaves exactly one assignment each', async () => {
    fs.writeFileSync(
      envPath(),
      'GT_DEV_API_KEY=stale-1\nKEEP=1\nGT_DEV_API_KEY=stale-2\n'
    );

    await setCredentials(
      { projectId: 'project-id', apiKey: 'gtx-first' },
      undefined,
      appDirectory
    );
    await setCredentials(
      { projectId: 'project-id', apiKey: 'gtx-second' },
      undefined,
      appDirectory
    );

    expect(readEnv()).toBe(
      'GT_DEV_API_KEY=gtx-second\nKEEP=1\nGT_PROJECT_ID=project-id\n'
    );
  });

  it('leaves another framework prefix and same-suffix names alone', async () => {
    fs.writeFileSync(
      envPath(),
      'VITE_GT_PROJECT_ID=vite-project\nMY_GT_DEV_API_KEY=not-ours\n'
    );

    await setCredentials(
      { projectId: 'project-id', apiKey: 'gtx-api-key' },
      'next-pages',
      appDirectory
    );

    expect(readEnv()).toBe(
      'VITE_GT_PROJECT_ID=vite-project\nMY_GT_DEV_API_KEY=not-ours\nNEXT_PUBLIC_GT_PROJECT_ID=project-id\nNEXT_PUBLIC_GT_DEV_API_KEY=gtx-api-key\n'
    );
  });

  it('rejects and leaves the file alone when the write fails', async () => {
    fs.writeFileSync(envPath(), 'KEEP=1\n');
    vi.spyOn(fs.promises, 'writeFile').mockRejectedValueOnce(
      new Error('EACCES: permission denied')
    );

    await expect(
      setCredentials(
        { projectId: 'project-id', apiKey: 'gtx-api-key' },
        'vite',
        appDirectory
      )
    ).rejects.toThrow('EACCES');
    expect(readEnv()).toBe('KEEP=1\n');
    vi.restoreAllMocks();
  });
});

describe('areCredentialsSet', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shares the writer naming for each framework', () => {
    expect(getDevelopmentEnvNames('vite')).toEqual({
      projectId: 'VITE_GT_PROJECT_ID',
      devApiKey: 'VITE_GT_DEV_API_KEY',
    });
    expect(getDevelopmentEnvNames(undefined)).toEqual({
      projectId: 'GT_PROJECT_ID',
      devApiKey: 'GT_DEV_API_KEY',
    });
  });

  it('is complete with a project and the framework development key', () => {
    vi.stubEnv('VITE_GT_DEV_API_KEY', 'gtx-dev');
    expect(areCredentialsSet({ projectId: 'project-id' }, 'vite')).toBe(true);
    expect(areCredentialsSet({ projectId: 'project-id' }, 'next-app')).toBe(
      false
    );
  });

  it('is complete with a project and an explicit production key', () => {
    expect(
      areCredentialsSet({ projectId: 'project-id', apiKey: 'gtx-prod' }, 'vite')
    ).toBe(true);
  });

  it('is incomplete without a project ID even when a key exists', () => {
    vi.stubEnv('GT_DEV_API_KEY', 'gtx-dev');
    expect(areCredentialsSet({ apiKey: 'gtx-prod' })).toBe(false);
    expect(areCredentialsSet({})).toBe(false);
  });
});
