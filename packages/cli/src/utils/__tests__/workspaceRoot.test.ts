import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getWorkspaceRootSetupError,
  isWorkspaceRoot,
} from '../workspaceRoot.js';

describe('workspace root detection', () => {
  let testDirectory: string;

  beforeEach(() => {
    testDirectory = mkdtempSync(path.join(tmpdir(), 'gt-workspace-root-'));
  });

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true });
  });

  it('detects a pnpm workspace root', () => {
    writeFileSync(
      path.join(testDirectory, 'pnpm-workspace.yaml'),
      "packages:\n  - 'apps/*'\n"
    );

    expect(isWorkspaceRoot(testDirectory)).toBe(true);
    expect(getWorkspaceRootSetupError(testDirectory)).toContain(
      "Change to that app's directory and rerun `npx gt@latest`."
    );
  });

  it.each([
    { workspaces: ['apps/*'] },
    { workspaces: { packages: ['apps/*'] } },
  ])('detects package.json workspaces', (packageJson) => {
    writeFileSync(
      path.join(testDirectory, 'package.json'),
      JSON.stringify(packageJson)
    );

    expect(isWorkspaceRoot(testDirectory)).toBe(true);
  });

  it('allows setup inside a workspace app', () => {
    const appDirectory = path.join(testDirectory, 'apps', 'web');
    mkdirSync(appDirectory, { recursive: true });
    writeFileSync(
      path.join(testDirectory, 'pnpm-workspace.yaml'),
      "packages:\n  - 'apps/*'\n"
    );
    writeFileSync(
      path.join(appDirectory, 'package.json'),
      JSON.stringify({ name: 'web', private: true })
    );

    expect(isWorkspaceRoot(appDirectory)).toBe(false);
    expect(getWorkspaceRootSetupError(appDirectory)).toBeUndefined();
  });

  it('allows setup in a standalone package', () => {
    writeFileSync(
      path.join(testDirectory, 'package.json'),
      JSON.stringify({ name: 'standalone-app', private: true })
    );

    expect(isWorkspaceRoot(testDirectory)).toBe(false);
  });
});
