import { Command } from 'commander';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logErrorAndExit } from '../../console/logging.js';
import { BaseCLI } from '../base.js';

vi.mock('../../console/logging.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../console/logging.js')>();
  return {
    ...actual,
    logErrorAndExit: vi.fn((message: string) => {
      throw new Error(message);
    }),
  };
});

describe('workspace root setup guard', () => {
  const originalCwd = process.cwd();
  let workspaceRoot: string;
  let packageJsonContents: string;

  beforeEach(() => {
    vi.clearAllMocks();
    workspaceRoot = mkdtempSync(path.join(tmpdir(), 'gt-workspace-setup-'));
    packageJsonContents = JSON.stringify(
      { name: 'example-monorepo', private: true },
      null,
      2
    );
    writeFileSync(
      path.join(workspaceRoot, 'package.json'),
      packageJsonContents
    );
    writeFileSync(
      path.join(workspaceRoot, 'pnpm-workspace.yaml'),
      "packages:\n  - 'apps/*'\n"
    );
    process.chdir(workspaceRoot);
    vi.spyOn(process, 'cwd').mockReturnValue(workspaceRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it.each(['init', 'configure'])(
    'stops %s before changing the workspace',
    async (command) => {
      const program = new Command();
      new BaseCLI(program, 'base');

      await expect(
        program.parseAsync([command], { from: 'user' })
      ).rejects.toThrow(
        'The setup wizard cannot run from a monorepo workspace root'
      );

      expect(logErrorAndExit).toHaveBeenCalledWith(
        expect.stringContaining(
          "Change to that app's directory and rerun `npx gt@latest`."
        )
      );
      expect(existsSync(path.join(workspaceRoot, 'gt.config.json'))).toBe(
        false
      );
      expect(
        readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8')
      ).toBe(packageJsonContents);
    }
  );

  it.each([
    [
      'a pnpm list with child packages',
      "packages:\n  - '.'\n  - 'apps/*'\n",
      {},
    ],
    ['package.json workspaces', undefined, { workspaces: ['packages/*'] }],
    [
      'Yarn workspaces.packages',
      undefined,
      { workspaces: { packages: ['packages/*'] } },
    ],
    ['an unreadable pnpm-workspace.yaml', 'packages: [\n', {}],
  ])('stops configure at a monorepo root with %s', async (_case, pnpm, pkg) => {
    if (pnpm === undefined)
      rmSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'));
    else writeFileSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'), pnpm);
    writeFileSync(
      path.join(workspaceRoot, 'package.json'),
      JSON.stringify({ name: 'example-monorepo', ...pkg })
    );

    const program = new Command();
    new BaseCLI(program, 'base');

    await expect(
      program.parseAsync(['configure', '--no-interactive'], { from: 'user' })
    ).rejects.toThrow(
      'The setup wizard cannot run from a monorepo workspace root'
    );
  });

  it.each([
    [
      'lists only the app itself',
      "packages:\n  - '.'\n\nenableGlobalVirtualStore: true\nhoist: false\n",
    ],
    ['only holds settings', 'enableGlobalVirtualStore: true\n'],
  ])(
    'runs setup in a single app whose pnpm-workspace.yaml %s',
    async (_case, pnpm) => {
      writeFileSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'), pnpm);

      for (const command of ['init', 'configure']) {
        const program = new Command();
        new BaseCLI(program, 'base');
        // Past the guard, the noninteractive run stops on its missing
        // answers before changing any file.
        await expect(
          program.parseAsync([command, '--no-interactive'], { from: 'user' })
        ).rejects.toThrow('Setup needs these options');
      }
      expect(existsSync(path.join(workspaceRoot, 'gt.config.json'))).toBe(
        false
      );
    }
  );

  it.each(['init', 'configure'])(
    'stops %s for Electron applications',
    async (command) => {
      packageJsonContents = JSON.stringify({
        name: 'example-electron-app',
        devDependencies: { electron: '^40.0.0' },
      });
      writeFileSync(
        path.join(workspaceRoot, 'package.json'),
        packageJsonContents
      );
      rmSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'));

      const program = new Command();
      new BaseCLI(program, 'base');

      await expect(
        program.parseAsync([command], { from: 'user' })
      ).rejects.toThrow(
        'The automatic setup wizard is not ready for Electron applications'
      );

      expect(logErrorAndExit).toHaveBeenCalledWith(
        expect.stringContaining('https://generaltranslation.com/docs/react')
      );
      expect(existsSync(path.join(workspaceRoot, 'gt.config.json'))).toBe(
        false
      );
      expect(
        readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8')
      ).toBe(packageJsonContents);
    }
  );
});
