import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installPackage } from '../installPackage.js';
import { PNPM } from '../packageManager.js';

describe('installPackage in a pnpm workspace root', () => {
  let testDirectory: string;
  let workspaceRoot: string;

  beforeEach(() => {
    testDirectory = mkdtempSync(path.join(tmpdir(), 'gt-pnpm-workspace-'));
    workspaceRoot = path.join(testDirectory, 'example-monorepo');

    mkdirSync(path.join(workspaceRoot, 'apps', 'app'), { recursive: true });
    mkdirSync(path.join(workspaceRoot, 'packages', 'dependency'), {
      recursive: true,
    });

    writeFileSync(
      path.join(workspaceRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'example-monorepo',
          private: true,
          packageManager: 'pnpm@10.20.0',
          devDependencies: { 'example-app': 'workspace:*' },
        },
        null,
        2
      )
    );
    writeFileSync(
      path.join(workspaceRoot, 'pnpm-workspace.yaml'),
      "packages:\n  - 'apps/*'\n  - 'packages/*'\n"
    );
    writeFileSync(
      path.join(workspaceRoot, 'apps', 'app', 'package.json'),
      JSON.stringify({ name: 'example-app', private: true }, null, 2)
    );
    writeFileSync(
      path.join(workspaceRoot, 'packages', 'dependency', 'package.json'),
      JSON.stringify({ name: 'example-dependency', private: true }, null, 2)
    );
  });

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true });
  });

  it('bypasses the workspace-root guard with the package manager flags', async () => {
    const dependencySpecifier = 'example-dependency@workspace:*';
    const workspaceInstall = spawnSync(
      PNPM.name,
      ['install', '--ignore-scripts'],
      {
        cwd: workspaceRoot,
        encoding: 'utf8',
      }
    );

    expect(workspaceInstall.status).toBe(0);

    const unpatchedInstall = spawnSync(
      PNPM.name,
      [PNPM.installCommand, dependencySpecifier, PNPM.devDependencyFlag],
      {
        cwd: workspaceRoot,
        encoding: 'utf8',
      }
    );

    const unpatchedOutput = `${unpatchedInstall.stdout}\n${unpatchedInstall.stderr}`;
    expect(unpatchedInstall.status, unpatchedOutput).not.toBe(0);
    expect(unpatchedOutput).toContain('ERR_PNPM_ADDING_TO_ROOT');

    await installPackage(dependencySpecifier, PNPM, true, workspaceRoot);

    const packageJson = JSON.parse(
      readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8')
    ) as { devDependencies?: Record<string, string> };
    expect(packageJson.devDependencies?.['example-dependency']).toBe(
      'workspace:*'
    );
  });
});
