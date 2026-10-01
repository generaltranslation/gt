import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';
import { logger } from '../../console/logger.js';
import { installPackage } from '../installPackage.js';
import { NPM, PNPM, type PackageManager } from '../packageManager.js';

vi.mock('../../console/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const IGNORED_BUILDS_OUTPUT =
  '[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.27.7, @scope/native@1.0.0\n\nRun "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.';

/** pnpm 11.28.3 stdout with `FORCE_COLOR=1`: brackets, code and message are colored separately. */
const COLORED_IGNORED_BUILDS_OUTPUT =
  '\u001b[41m\u001b[31m[\u001b[39m\u001b[49m\u001b[41m\u001b[30mERR_PNPM_IGNORED_BUILDS\u001b[39m\u001b[49m\u001b[41m\u001b[31m]\u001b[39m\u001b[49m \u001b[31mIgnored build scripts: esbuild@0.27.7\u001b[39m\n\nRun "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.';

/** pnpm 11.28.3 stdout when an allowed postinstall echoes the marker and fails. */
const LIFECYCLE_FAILURE_OUTPUT = `.../node_modules/failing-native postinstall$ echo '[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: nested@1.0.0'; exit 1
.../node_modules/failing-native postinstall: [ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: nested@1.0.0
.../node_modules/failing-native postinstall: Failed
[ELIFECYCLE] Command failed with exit code 1.`;

let cwd: string;

/** A package manager stand-in that prints `output` to stdout and exits with code 1. */
function createFailingPnpm(
  output: string,
  packageManager: PackageManager = PNPM
) {
  const command = path.join(cwd, 'fake-package-manager.sh');
  fs.writeFileSync(
    command,
    `#!/bin/sh\ncat <<'EOF'\n${output}\nEOF\nexit 1\n`,
    { mode: 0o755 }
  );
  return { ...packageManager, name: command };
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
    expect(warning).toContain('may fail');
    expect(warning).toContain('`allowBuilds` in pnpm-workspace.yaml');
    const entries = [...warning.matchAll(/`([^`]+: false)`/g)].map(
      (match) => `  ${match[1]}`
    );
    expect(YAML.parse(`allowBuilds:\n${entries.join('\n')}`)).toEqual({
      allowBuilds: { esbuild: false, '@scope/native': false },
    });
    expect(warning).toContain('`pnpm approve-builds`');
  });

  it('warns instead of failing when pnpm colors its ignored-builds error', async () => {
    writeInstalledPackage('gt');

    await expect(
      installPackage(
        'gt',
        createFailingPnpm(COLORED_IGNORED_BUILDS_OUTPUT),
        true,
        cwd
      )
    ).resolves.toBeUndefined();

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.warn).mock.calls[0][0]).toContain(
      '`"esbuild": false`'
    );
  });

  it('classifies the end of an install log longer than the capture limit', async () => {
    writeInstalledPackage('gt');
    const verboseLog = 'Progress: resolved 1, reused 1, downloaded 0\n'.repeat(
      30_000
    );

    await expect(
      installPackage(
        'gt',
        createFailingPnpm(`${verboseLog}${IGNORED_BUILDS_OUTPUT}`),
        true,
        cwd
      )
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
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

  it.each([
    ['a lifecycle script failed', LIFECYCLE_FAILURE_OUTPUT],
    [
      'pnpm also reported another error',
      `${IGNORED_BUILDS_OUTPUT}\n[ERR_PNPM_FETCH_404] Not Found`,
    ],
  ])('fails when pnpm ignored build scripts but %s', async (_case, output) => {
    writeInstalledPackage('gt');

    await expect(
      installPackage('gt', createFailingPnpm(output), true, cwd)
    ).rejects.toThrow('Process exited with code 1');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('fails when a non-pnpm package manager prints the ignored-builds text', async () => {
    writeInstalledPackage('gt');

    await expect(
      installPackage(
        'gt',
        createFailingPnpm(IGNORED_BUILDS_OUTPUT, NPM),
        true,
        cwd
      )
    ).rejects.toThrow('Process exited with code 1');
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
