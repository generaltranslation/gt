import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The real cache internals are under test here (unlike migrateEngineLoader.test.ts,
// which drives the resolution order through injected fakes): a temp HOME stands in
// for ~/.gt, and npm is a mock that "installs" whatever module tree the test wants.
const TEST_HOME = '/tmp/gt-loader-cache-test-home';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    default: { ...actual, homedir: () => TEST_HOME },
    homedir: () => TEST_HOME,
  };
});

import { spawnSync } from 'node:child_process';
import { installAndImport, runNpmInstall } from '../migrateEngineLoader.js';

const CACHE_DIR = path.join(TEST_HOME, '.gt', 'migrate-engine', '_0.1.0');
const PKG_DIR = path.join(
  CACHE_DIR,
  'node_modules',
  '@generaltranslation',
  'migrate'
);

/** A module tree that resolves but cannot be imported (its dep is absent). */
function writeBrokenPackage(): void {
  fs.mkdirSync(PKG_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(PKG_DIR, 'package.json'),
    JSON.stringify({
      name: '@generaltranslation/migrate',
      version: '0.1.0',
      main: 'index.cjs',
    })
  );
  fs.writeFileSync(
    path.join(PKG_DIR, 'index.cjs'),
    "module.exports = require('@babel/absent-transitive-dep');"
  );
}

/** A working module tree with the shape the loader checks for. */
function writeGoodPackage(): void {
  fs.mkdirSync(PKG_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(PKG_DIR, 'package.json'),
    JSON.stringify({
      name: '@generaltranslation/migrate',
      version: '0.1.0',
      main: 'index.cjs',
    })
  );
  fs.writeFileSync(
    path.join(PKG_DIR, 'index.cjs'),
    'module.exports = { runMigration() { return "ok"; }, MIGRATE_INTERFACE_VERSION: 1 };'
  );
}

function mockNpmInstallSuccess(): void {
  vi.mocked(spawnSync).mockImplementation((() => {
    writeGoodPackage();
    return { status: 0, stdout: '', stderr: '' };
  }) as unknown as typeof spawnSync);
}

describe('installAndImport cache internals', () => {
  beforeEach(() => {
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
    vi.mocked(spawnSync).mockReset();
  });
  afterEach(() => {
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
  });

  it('reinstalls over a partial tree left by an interrupted first fetch', async () => {
    // The interrupted install wrote a resolvable entry but no completion
    // marker; the loader must not trust it (adversary R1 P2: a poisoned cache
    // previously short-circuited the reinstall forever).
    writeBrokenPackage();
    mockNpmInstallSuccess();
    const mod = (await installAndImport()) as {
      runMigration: () => string;
    };
    expect(mod.runMigration()).toBe('ok');
    expect(vi.mocked(spawnSync)).toHaveBeenCalledTimes(1);
  });

  it('self-heals a marked cache whose import fails, reinstalling once', async () => {
    // Marker present but the tree is broken anyway (interleaved concurrent
    // first runs). One wipe-and-reinstall, then the healed engine loads.
    writeBrokenPackage();
    fs.writeFileSync(path.join(CACHE_DIR, '.install-complete'), '');
    mockNpmInstallSuccess();
    const mod = (await installAndImport()) as {
      runMigration: () => string;
    };
    expect(mod.runMigration()).toBe('ok');
    expect(vi.mocked(spawnSync)).toHaveBeenCalledTimes(1);
  });

  it('reinstalls a good-looking tree that lacks the completion marker', async () => {
    // Pins the marker check itself (re-attack F1): this tree resolves AND
    // imports cleanly, so the self-heal catch can never fire; only the marker
    // distrust triggers the reinstall. An interrupted npm can leave the
    // engine's own files complete while a lazily-required transitive dep is
    // missing, which is exactly the state the marker exists to catch.
    writeGoodPackage();
    mockNpmInstallSuccess();
    const mod = (await installAndImport()) as {
      runMigration: () => string;
    };
    expect(mod.runMigration()).toBe('ok');
    expect(vi.mocked(spawnSync)).toHaveBeenCalledTimes(1);
  });

  it('reuses a completed cache without touching npm', async () => {
    writeGoodPackage();
    fs.writeFileSync(path.join(CACHE_DIR, '.install-complete'), '');
    const mod = (await installAndImport()) as {
      runMigration: () => string;
    };
    expect(mod.runMigration()).toBe('ok');
    expect(vi.mocked(spawnSync)).not.toHaveBeenCalled();
  });

  it('runs npm through the shell on Windows with metacharacter args quoted', () => {
    // npm is npm.cmd on Windows: spawnSync cannot execute it directly and
    // newer Node refuses .cmd targets without a shell, so the first-run fetch
    // silently failed over to the devDependency diagnostic on every Windows
    // machine. cmd.exe gets Node's args unescaped, so the range (^ is a cmd
    // escape) and a cache path with spaces must arrive quoted.
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: '',
      stderr: '',
    } as unknown as ReturnType<typeof spawnSync>);
    runNpmInstall('C:\\Users\\John Doe\\.gt\\migrate-engine\\_0.1.0', 'win32');
    const [command, args, options] = vi.mocked(spawnSync).mock.calls[0] as [
      string,
      string[],
      { shell?: boolean },
    ];
    expect(command).toBe('npm');
    expect(options.shell).toBe(true);
    expect(args).toContain('"@generaltranslation/migrate@^0.1.0"');
    expect(args).toContain(
      '"C:\\Users\\John Doe\\.gt\\migrate-engine\\_0.1.0"'
    );
  });

  it('runs npm directly (no shell) on posix platforms', () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: '',
      stderr: '',
    } as unknown as ReturnType<typeof spawnSync>);
    runNpmInstall('/Users/dev/.gt/migrate-engine/_0.1.0', 'darwin');
    const [command, args, options] = vi.mocked(spawnSync).mock.calls[0] as [
      string,
      string[],
      { shell?: boolean },
    ];
    expect(command).toBe('npm');
    expect(options.shell).toBeUndefined();
    expect(args).toContain('@generaltranslation/migrate@^0.1.0');
    expect(args).toContain('/Users/dev/.gt/migrate-engine/_0.1.0');
  });

  it('propagates a failed install with npm stderr in the error', async () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: '',
      stderr: 'ETARGET no matching version',
    } as unknown as ReturnType<typeof spawnSync>);
    await expect(installAndImport()).rejects.toThrow(/ETARGET/);
  });
});
