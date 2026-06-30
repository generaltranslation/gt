import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createGtNextApp,
  getNextSteps,
  getPackageManager,
  toPackageName,
} from './index.js';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'create-gt-next-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        recursive: true,
        force: true,
      })
    )
  );
});

describe('createGtNextApp', () => {
  it('copies the template and updates the package name', async () => {
    const cwd = await createTemporaryDirectory();

    const result = await createGtNextApp({
      cwd,
      targetDir: 'Test App',
      packageManager: 'npm',
    });

    const packageJson = JSON.parse(
      await readFile(path.join(result.targetDir, 'package.json'), 'utf8')
    ) as { name: string; dependencies: Record<string, string> };

    await expect(
      stat(path.join(result.targetDir, '.gitignore'))
    ).resolves.toBeDefined();
    await expect(
      stat(path.join(result.targetDir, 'src/app/page.tsx'))
    ).resolves.toBeDefined();
    expect(packageJson.name).toBe('test-app');
    expect(packageJson.dependencies['gt-next']).toBe('latest');
  });

  it('rejects non-empty directories', async () => {
    const cwd = await createTemporaryDirectory();
    const targetDir = path.join(cwd, 'existing-app');
    await mkdir(targetDir);
    await writeFile(path.join(targetDir, 'file.txt'), 'content');

    await expect(
      createGtNextApp({
        cwd,
        targetDir: 'existing-app',
        packageManager: 'npm',
      })
    ).rejects.toThrow('is not empty');
  });
});

describe('toPackageName', () => {
  it('normalizes user provided names for package.json', () => {
    expect(toPackageName('My GT Next App')).toBe('my-gt-next-app');
    expect(toPackageName('.')).toBe('my-gt-next-app');
  });
});

describe('getPackageManager', () => {
  it('detects common package managers from the user agent', () => {
    expect(getPackageManager('pnpm/10.20.0 npm/? node/?')).toBe('pnpm');
    expect(getPackageManager('yarn/1.22.22 npm/? node/?')).toBe('yarn');
    expect(getPackageManager('bun/1.2.0 npm/? node/?')).toBe('bun');
    expect(getPackageManager('npm/11.0.0 node/?')).toBe('npm');
  });
});

describe('getNextSteps', () => {
  it('prints package-manager-specific install and dev commands', () => {
    const cwd = path.join(os.tmpdir(), 'project');
    const targetDir = path.join(cwd, 'app');

    expect(getNextSteps(targetDir, 'pnpm', cwd)).toEqual([
      'cd app',
      'pnpm install',
      'pnpm dev',
    ]);
    expect(getNextSteps(targetDir, 'npm', cwd)).toEqual([
      'cd app',
      'npm install',
      'npm run dev',
    ]);
    expect(getNextSteps(path.join(cwd, 'test app'), 'npm', cwd)[0]).toBe(
      "cd 'test app'"
    );
  });
});
