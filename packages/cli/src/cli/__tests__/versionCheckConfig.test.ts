import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeCLI } from '../node.js';
import { ReactCLI } from '../react.js';

class ProcessExit extends Error {
  constructor(readonly code: number) {
    super(`process.exit(${code})`);
  }
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

describe('monorepo version check with an explicit config', () => {
  const originalCwd = process.cwd();
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(tmpdir(), 'gt-version-check-'));
    fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), '');
    for (const [app, version] of [
      ['a', '10.20.0'],
      ['b', '10.21.0'],
    ]) {
      writeJson(path.join(root, 'apps', app, 'package.json'), {
        name: app,
        dependencies: { 'gt-react': version, 'gt-node': version },
      });
    }
    writeJson(path.join(root, 'apps/a/src/gt.config.json'), {
      skipVersionCheck: true,
    });
    process.chdir(path.join(root, 'apps/a'));
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new ProcessExit(Number(code));
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  async function run(
    createCli: (program: Command) => { init(): void },
    args: string[]
  ): Promise<boolean> {
    const program = new Command().exitOverride();
    createCli(program).init();
    let ran = false;
    program.commands
      .find((command) => command.name() === 'validate')!
      .action(() => {
        ran = true;
      });
    await program.parseAsync(['validate', ...args], { from: 'user' });
    return ran;
  }

  it('reports a JSON result when the version check stops onboarding', async () => {
    const listeners = process.listeners('exit');
    const stdout: string[] = [];
    const writeSync = fs.writeSync;
    vi.spyOn(fs, 'writeSync').mockImplementation(((
      fd: number,
      data: string,
      ...rest: unknown[]
    ) => {
      if (fd !== process.stdout.fd) {
        return (writeSync as (...args: unknown[]) => number)(fd, data, ...rest);
      }
      stdout.push(String(data));
      return String(data).length;
    }) as typeof fs.writeSync);
    const program = new Command().exitOverride();
    new ReactCLI(program, 'gt-react');

    await expect(
      program.parseAsync(['init', '--json'], { from: 'user' })
    ).rejects.toThrow('process.exit(1)');
    // Run the exit-time reporting the mocked process.exit skipped.
    for (const listener of process.listeners('exit')) {
      if (listeners.includes(listener)) continue;
      process.removeListener('exit', listener);
      (listener as (code: number) => void)(1);
    }

    expect(stdout.map((line) => JSON.parse(line))).toEqual([
      {
        type: 'result',
        command: 'init',
        outcome: 'failed',
        completedSteps: [],
        error: expect.stringContaining('10.21.0'),
      },
    ]);
  });

  it.each([
    ['React', (program: Command) => new ReactCLI(program, 'gt-react')],
    ['Node', (program: Command) => new NodeCLI(program, 'gt-node')],
  ])(
    'honors skipVersionCheck from --config in the %s CLI',
    async (_name, createCli) => {
      await expect(run(createCli, [])).rejects.toThrow('process.exit(1)');
      await expect(
        run(createCli, ['--config', 'src/gt.config.json'])
      ).resolves.toBe(true);
      // Commands also accept the path without its extension.
      await expect(run(createCli, ['--config', 'src/gt.config'])).resolves.toBe(
        true
      );
    }
  );
});
