import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promptSelect } from '../../console/logging.js';
import {
  getPackageManager,
  NoPackageManagerError,
  PNPM,
} from '../packageManager.js';

vi.mock('../../console/logging.js', () => ({
  promptSelect: vi.fn(),
  exitSync: vi.fn(),
}));

describe('getPackageManager', () => {
  let cwd: string;
  const write = (name: string, content = '') =>
    fs.writeFileSync(path.join(cwd, name), content);
  const declare = (packageManager: unknown) =>
    write('package.json', JSON.stringify({ packageManager }));

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(tmpdir(), 'gt-package-manager-'));
    vi.mocked(promptSelect).mockReset();
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it.each([
    ['pnpm@10.20.0', 'pnpm'],
    ['pnpm@10.20.0+sha512.abc123', 'pnpm'],
    ['npm@11.0.0', 'npm'],
    ['yarn@1.22.22', 'yarn_v1'],
    ['yarn@4.9.1', 'yarn_v2'],
    ['bun@1.2.0', 'bun'],
    ['deno@2.0.0', 'deno'],
  ])(
    'detects %s before any install has created a lockfile',
    async (value, id) => {
      declare(value);
      vi.stubEnv('npm_config_user_agent', 'npm/11.0.0 node/v24.18.0');

      expect((await getPackageManager(cwd, undefined, true)).id).toBe(id);
      expect(promptSelect).not.toHaveBeenCalled();
    }
  );

  it('prioritizes the explicit override, then declared manager, over lockfiles', async () => {
    declare('pnpm@10.20.0');
    write('package-lock.json');
    write('yarn.lock', '# yarn lockfile v1');

    expect((await getPackageManager(cwd, undefined, true)).id).toBe('pnpm');
    expect((await getPackageManager(cwd, 'npm', true)).id).toBe('npm');
    expect((await getPackageManager(cwd, undefined, true)).id).toBe('pnpm');
    expect(promptSelect).not.toHaveBeenCalled();
  });

  it.each(['unknown@1.0.0', 'pnpm@latest', 'yarn@4.0.0@bad', 42, null])(
    'falls back to a unique lockfile for unsupported or invalid metadata %j',
    async (value) => {
      declare(value);
      write('pnpm-lock.yaml');
      expect((await getPackageManager(cwd, undefined, true)).id).toBe('pnpm');
    }
  );

  it.each([
    ['package-lock.json', '', 'npm'],
    ['npm-shrinkwrap.json', '', 'npm'],
    ['pnpm-lock.yaml', '', 'pnpm'],
    ['yarn.lock', '# yarn lockfile v1', 'yarn_v1'],
    ['yarn.lock', '__metadata:', 'yarn_v2'],
    ['bun.lock', '', 'bun'],
    ['bun.lockb', '', 'bun'],
    ['deno.lock', '', 'deno'],
  ])('detects %s without prompting', async (file, content, id) => {
    write(file, content);
    expect((await getPackageManager(cwd, undefined, true)).id).toBe(id);
    expect(promptSelect).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'does not guess when detection is unresolved (conflict: %s)',
    async (conflict) => {
      if (conflict) {
        write('package-lock.json');
        write('pnpm-lock.yaml');
      }
      await expect(
        getPackageManager(cwd, undefined, true)
      ).rejects.toBeInstanceOf(NoPackageManagerError);
      expect(promptSelect).not.toHaveBeenCalled();
      vi.mocked(promptSelect).mockResolvedValue(PNPM);
      expect(await getPackageManager(cwd)).toBe(PNPM);
      expect(promptSelect).toHaveBeenCalledOnce();
    }
  );

  describe('from a subfolder', () => {
    const app = () => path.join(cwd, 'apps', 'web');
    const writeAt = (dir: string, name: string, content: unknown = '') => {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, name),
        typeof content === 'string' ? content : JSON.stringify(content)
      );
    };
    beforeEach(() => writeAt(app(), 'package.json', { name: 'web' }));

    it('uses the pnpm workspace root of a member', async () => {
      writeAt(cwd, 'package.json', { packageManager: 'pnpm@10.20.0' });
      writeAt(cwd, 'pnpm-workspace.yaml', 'packages:\n  - apps/*\n');
      writeAt(cwd, 'pnpm-lock.yaml');
      expect((await getPackageManager(app(), undefined, true)).id).toBe('pnpm');
      expect((await getPackageManager(app(), 'bun', true)).id).toBe('bun');
    });

    it('uses the lockfile of an npm workspaces root', async () => {
      writeAt(cwd, 'package.json', { workspaces: ['apps/*'] });
      writeAt(cwd, 'package-lock.json');
      expect((await getPackageManager(app(), undefined, true)).id).toBe('npm');
    });

    it('prefers the member’s declared manager over the root', async () => {
      writeAt(cwd, 'package.json', { workspaces: ['apps/*'] });
      writeAt(cwd, 'package-lock.json');
      writeAt(app(), 'package.json', { packageManager: 'bun@1.2.0' });
      expect((await getPackageManager(app(), undefined, true)).id).toBe('bun');
    });

    it('prefers a nested app’s own lockfile over the parent’s', async () => {
      writeAt(cwd, 'package.json', { workspaces: ['apps/*'] });
      writeAt(cwd, 'package-lock.json');
      writeAt(app(), 'pnpm-lock.yaml');
      expect((await getPackageManager(app(), undefined, true)).id).toBe('pnpm');
    });

    it('ignores a parent project that is not a workspace root', async () => {
      writeAt(cwd, 'package.json', { name: 'unrelated' });
      writeAt(cwd, 'package-lock.json');
      await expect(
        getPackageManager(app(), undefined, true)
      ).rejects.toBeInstanceOf(NoPackageManagerError);
    });

    it('stops at the nearest parent with package manager evidence', async () => {
      writeAt(cwd, 'pnpm-workspace.yaml', 'packages:\n  - apps/*\n');
      writeAt(cwd, 'pnpm-lock.yaml');
      writeAt(path.join(cwd, 'apps'), 'package-lock.json');
      await expect(
        getPackageManager(app(), undefined, true)
      ).rejects.toBeInstanceOf(NoPackageManagerError);
    });
  });

  it('does not reuse another project’s selection in the same process', async () => {
    write('pnpm-lock.yaml');
    expect((await getPackageManager(cwd, undefined, true)).id).toBe('pnpm');
    const other = path.join(cwd, 'other');
    fs.mkdirSync(other);
    fs.writeFileSync(path.join(other, 'package-lock.json'), '');
    expect((await getPackageManager(other, undefined, true)).id).toBe('npm');
  });
});
