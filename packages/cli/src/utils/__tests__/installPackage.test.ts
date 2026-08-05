import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installPackage } from '../installPackage.js';
import { NPM, PNPM } from '../packageManager.js';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const spawnMock = vi.mocked(spawn);

function mockSuccessfulInstall(): void {
  spawnMock.mockImplementation(() => {
    const childProcess = new EventEmitter();
    Object.assign(childProcess, { stderr: new EventEmitter() });
    queueMicrotask(() => childProcess.emit('close', 0));
    return childProcess as ReturnType<typeof spawn>;
  });
}

describe('installPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuccessfulInstall();
  });

  it('passes package manager flags to the install command', async () => {
    const packageManager = {
      ...PNPM,
      flags: ['--ignore-workspace-root-check', '--strict-peer-dependencies'],
    };

    await installPackage('gt', packageManager, true, '/project');

    expect(spawnMock).toHaveBeenCalledWith(
      'pnpm',
      [
        'add',
        'gt',
        '--save-dev',
        '--ignore-workspace-root-check',
        '--strict-peer-dependencies',
      ],
      {
        stdio: ['pipe', 'ignore', 'pipe'],
        cwd: '/project',
      }
    );
  });

  it('does not add an empty package manager flag', async () => {
    await installPackage('gt', NPM, true, '/project');

    expect(spawnMock).toHaveBeenCalledWith(
      'npm',
      ['install', 'gt', '--save-dev'],
      {
        stdio: ['pipe', 'ignore', 'pipe'],
        cwd: '/project',
      }
    );
  });

  it('allows the GT build dependency in pnpm allowBuilds workspaces', async () => {
    const projectDirectory = mkdtempSync(
      path.join(tmpdir(), 'gt-pnpm-allow-builds-')
    );
    writeFileSync(
      path.join(projectDirectory, 'pnpm-workspace.yaml'),
      'allowBuilds:\n  esbuild: true\n'
    );

    try {
      await installPackage('gt', PNPM, true, projectDirectory);

      expect(spawnMock).toHaveBeenCalledWith(
        'pnpm',
        [
          'add',
          'gt',
          '--save-dev',
          '--ignore-workspace-root-check',
          '--allow-build=tree-sitter-python',
        ],
        {
          stdio: ['pipe', 'ignore', 'pipe'],
          cwd: projectDirectory,
        }
      );
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('preserves an existing pnpm build decision', async () => {
    const projectDirectory = mkdtempSync(
      path.join(tmpdir(), 'gt-pnpm-allow-builds-')
    );
    writeFileSync(
      path.join(projectDirectory, 'pnpm-workspace.yaml'),
      'allowBuilds:\n  tree-sitter-python: false\n'
    );

    try {
      await installPackage('gt', PNPM, true, projectDirectory);

      expect(spawnMock).toHaveBeenCalledWith(
        'pnpm',
        ['add', 'gt', '--save-dev', '--ignore-workspace-root-check'],
        {
          stdio: ['pipe', 'ignore', 'pipe'],
          cwd: projectDirectory,
        }
      );
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });
});
