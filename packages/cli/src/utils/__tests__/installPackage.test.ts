import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../console/logger.js';
import { installPackage } from '../installPackage.js';
import { PNPM } from '../packageManager.js';

vi.mock('../../console/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const IGNORED_BUILDS_OUTPUT =
  '[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.27.7, @scope/native@1.0.0\n\nRun "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.';

let cwd: string;

/** A pnpm stand-in that prints `output` to stdout and exits with code 1. */
function createFailingPnpm(output: string) {
  const command = path.join(cwd, 'fake-pnpm.sh');
  fs.writeFileSync(
    command,
    `#!/bin/sh\ncat <<'EOF'\n${output}\nEOF\nexit 1\n`,
    { mode: 0o755 }
  );
  return { ...PNPM, name: command };
}

function writeInstalledPackage(packageName: string) {
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ devDependencies: { [packageName]: '^1.0.0' } })
  );
  const packageDir = path.join(cwd, 'node_modules', packageName);
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(path.join(packageDir, 'package.json'), '{}');
}

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-install-package-'));
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe('installPackage', () => {
  it('warns instead of failing when pnpm only ignored build scripts', async () => {
    writeInstalledPackage('gt');

    await expect(
      installPackage('gt', createFailingPnpm(IGNORED_BUILDS_OUTPUT), true, cwd)
    ).resolves.toBeUndefined();

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const warning = vi.mocked(logger.warn).mock.calls[0][0];
    expect(warning).toContain('esbuild, @scope/native');
    expect(warning).toContain('gt was installed');
    expect(warning).toContain('`esbuild: false`, `@scope/native: false`');
    expect(warning).toContain('`allowBuilds` in pnpm-workspace.yaml');
    expect(warning).toContain('`pnpm approve-builds`');
  });

  it('fails when pnpm ignored build scripts but the package is missing', async () => {
    await expect(
      installPackage('gt', createFailingPnpm(IGNORED_BUILDS_OUTPUT), true, cwd)
    ).rejects.toThrow('Process exited with code 1');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('fails on other pnpm errors even when the package is installed', async () => {
    writeInstalledPackage('gt');

    await expect(
      installPackage(
        'gt',
        createFailingPnpm('[ERR_PNPM_FETCH_404] Not Found'),
        true,
        cwd
      )
    ).rejects.toThrow('Process exited with code 1');
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
