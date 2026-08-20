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
    vi.spyOn(process, 'cwd').mockReturnValue(workspaceRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
