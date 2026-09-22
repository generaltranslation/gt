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

  it.each([
    'OTHER="first\nGT_PROJECT_ID=embedded\nlast"\n',
    'OTHER="first\nGT_DEV_API_KEY=embedded\nlast"\n',
    'GT_PROJECT_ID="old\nproject"\n',
    // A later duplicate hides the multiline value from dotenv's parsed map.
    'GT_PROJECT_ID="old\nproject"\nGT_PROJECT_ID=stale\n',
    'GT_DEV_API_KEY="old\nkey"\nGT_DEV_API_KEY=stale\n',
    "GT_PROJECT_ID='old\nproject'\nGT_PROJECT_ID=stale\n",
    'GT_PROJECT_ID="a\\"\nGT_PROJECT_ID=b\nc"\nGT_PROJECT_ID=stale\n',
  ])(
    'rejects unsafe multiline edits without changing the file: %j',
    async (existing) => {
      fs.writeFileSync(envPath(), existing);

      await expect(
        setCredentials(
          { projectId: 'project-id', apiKey: 'gtx-api-key' },
          undefined,
          appDirectory
        )
      ).rejects.toThrow('Cannot safely update .env.local');
      expect(readEnv()).toBe(existing);
    }
  );

  it('preserves unrelated multiline values when appending credentials', async () => {
    const existing = 'OTHER="first\nlast"\n';
    fs.writeFileSync(envPath(), existing);

    await setCredentials(
      { projectId: 'project-id', apiKey: 'gtx-api-key' },
      undefined,
      appDirectory
    );

    expect(readEnv()).toBe(
      `${existing}GT_PROJECT_ID=project-id\nGT_DEV_API_KEY=gtx-api-key\n`
    );
  });

  it('replaces a quoted single-line value that escapes its own quote', async () => {
    fs.writeFileSync(envPath(), 'GT_PROJECT_ID="old \\" project"\nKEEP=1\n');

    await setCredentials(
      { projectId: 'project-id', apiKey: 'gtx-api-key' },
      undefined,
      appDirectory
    );

    expect(readEnv()).toBe(
      'GT_PROJECT_ID=project-id\nKEEP=1\nGT_DEV_API_KEY=gtx-api-key\n'
    );
  });

  describe('persistence', () => {
    const existing = 'KEEP=1\nDATABASE_URL=postgres://localhost/app\n';
    const write = () =>
      setCredentials(
        { projectId: 'project-id', apiKey: 'gtx-api-key' },
        'vite',
        appDirectory
      );
    const temporaryFiles = () =>
      fs.readdirSync(appDirectory).filter((name) => name.endsWith('.tmp'));
    const mode = (file: string) => fs.statSync(file).mode & 0o777;

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('keeps the original bytes and cleans up after a partial write', async () => {
      fs.writeFileSync(envPath(), existing);
      const realWriteFile = fs.promises.writeFile;
      vi.spyOn(fs.promises, 'writeFile').mockImplementationOnce(
        async (file, data, options) => {
          await realWriteFile(file, String(data).slice(0, 5), options);
          throw new Error('ENOSPC: no space left on device');
        }
      );

      await expect(write()).rejects.toThrow('ENOSPC');
      expect(readEnv()).toBe(existing);
      expect(temporaryFiles()).toEqual([]);
    });

    it('keeps the original bytes and cleans up when the rename fails', async () => {
      fs.writeFileSync(envPath(), existing);
      vi.spyOn(fs.promises, 'rename').mockRejectedValueOnce(
        new Error('EPERM: operation not permitted')
      );

      await expect(write()).rejects.toThrow('EPERM');
      expect(readEnv()).toBe(existing);
      expect(temporaryFiles()).toEqual([]);
    });

    it('creates a new file readable only by the owner', async () => {
      await write();

      expect(mode(envPath())).toBe(0o600);
      expect(temporaryFiles()).toEqual([]);
    });

    it('preserves the permissions of an existing file', async () => {
      fs.writeFileSync(envPath(), existing, { mode: 0o644 });

      await write();

      expect(mode(envPath())).toBe(0o644);
      expect(readEnv()).toContain('KEEP=1\n');
    });

    it('updates the referent of a symlinked .env.local, not the link', async () => {
      const sharedDirectory = path.join(appDirectory, 'shared');
      const referent = path.join(sharedDirectory, '.env');
      fs.mkdirSync(sharedDirectory);
      fs.writeFileSync(referent, existing, { mode: 0o640 });
      fs.symlinkSync(referent, envPath());

      await write();

      expect(fs.lstatSync(envPath()).isSymbolicLink()).toBe(true);
      expect(fs.readlinkSync(envPath())).toBe(referent);
      expect(fs.readFileSync(referent, 'utf8')).toBe(
        `${existing}VITE_GT_PROJECT_ID=project-id\nVITE_GT_DEV_API_KEY=gtx-api-key\n`
      );
      expect(mode(referent)).toBe(0o640);
      expect(fs.readdirSync(sharedDirectory)).toEqual(['.env']);
      expect(fs.existsSync(path.join(appDirectory, '.gitignore'))).toBe(false);
    });

    it('fails closed on a dangling symlink without writing anything', async () => {
      fs.symlinkSync(path.join(appDirectory, 'missing.env'), envPath());

      await expect(write()).rejects.toThrow('is not a regular file');
      expect(fs.existsSync(path.join(appDirectory, 'missing.env'))).toBe(false);
      expect(fs.existsSync(path.join(appDirectory, '.gitignore'))).toBe(false);
      expect(temporaryFiles()).toEqual([]);
    });

    it('fails closed when .env.local is a directory', async () => {
      fs.mkdirSync(envPath());

      await expect(write()).rejects.toThrow('is not a regular file');
      expect(fs.readdirSync(envPath())).toEqual([]);
      expect(fs.existsSync(path.join(appDirectory, '.gitignore'))).toBe(false);
    });
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

  it.each(['next-app', undefined] as const)(
    'is complete with a project and an explicit server key for %s',
    (framework) => {
      expect(
        areCredentialsSet(
          { projectId: 'project-id', apiKey: 'gtx-prod' },
          framework
        )
      ).toBe(true);
    }
  );

  it.each(['vite', 'next-pages', 'gatsby', 'react', 'redwood'] as const)(
    'treats the tooling key as no browser runtime key for %s',
    (framework) => {
      expect(
        areCredentialsSet(
          { projectId: 'project-id', apiKey: 'gtx-tooling' },
          framework
        )
      ).toBe(false);
    }
  );

  it('is incomplete without a project ID even when a key exists', () => {
    vi.stubEnv('GT_DEV_API_KEY', 'gtx-dev');
    expect(areCredentialsSet({ apiKey: 'gtx-prod' })).toBe(false);
    expect(areCredentialsSet({})).toBe(false);
  });
});
