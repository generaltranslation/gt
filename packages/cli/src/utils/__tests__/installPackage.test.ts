import { EventEmitter } from 'node:events';
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
    await installPackage('gt', PNPM, true, '/project');

    expect(spawnMock).toHaveBeenCalledWith(
      'pnpm',
      ['add', 'gt', '--save-dev', '--ignore-workspace-root-check'],
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
});
