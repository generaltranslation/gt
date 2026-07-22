import {
  spawnSync,
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
} from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import { logger } from '../../console/logger.js';
import { logErrorAndExit } from '../../console/logging.js';
import type * as MigrateEngine from '@generaltranslation/migrate';

type Engine = typeof MigrateEngine;

/**
 * The engine version range the CLI fetches on demand. It tracks the engine's
 * minor line: bump it when the CLI depends on a newer engine minor. The cache
 * directory is keyed on this range, so a CLI upgrade that moves the line
 * re-fetches instead of reusing a stale engine.
 */
export const ENGINE_RANGE = '^0.1.0';

/**
 * The engine interface version this CLI is built against. It must equal the
 * engine's exported MIGRATE_INTERFACE_VERSION; a mismatch is a hard error that
 * names both versions and tells the user to update gt.
 */
export const EXPECTED_INTERFACE_VERSION = 1;

const PACKAGE_NAME = '@generaltranslation/migrate';

/**
 * The globalThis key a compiled binary registers its embedded engine under (see
 * src/bin/bin-entry.ts). A binary has no npm to fetch from, so it bundles the
 * engine and the loader reads it here before any other resolution. Symbol.for
 * keeps the key stable even if the loader module is instantiated more than once.
 */
export const BUNDLED_MIGRATE_ENGINE = Symbol.for(
  'generaltranslation.migrate.bundledEngine'
);

function readBundledEngine(): unknown {
  return (globalThis as Record<symbol, unknown>)[BUNDLED_MIGRATE_ENGINE];
}

/**
 * The seams loadMigrateEngine uses to find the engine, injected so the unit
 * tests can drive each path (found in the workspace, resolved from the user's
 * project, fetched into the tool cache, offline) without a registry or a real
 * npm. The defaults are the production implementations below.
 */
export interface LoaderDeps {
  /** import the engine the way the monorepo resolves it (workspace devDep). */
  importWorkspace(): Promise<unknown>;
  /** resolve + import the engine from the user's own project deps. */
  importFromProject(cwd: string): Promise<unknown>;
  /** install the engine into the tool cache on first run, then import it. */
  installAndImport(): Promise<unknown>;
  /** end the run with a diagnostic (process.exit in production). */
  fail(message: string): never;
}

export const defaultLoaderDeps: LoaderDeps = {
  importWorkspace: () => import(PACKAGE_NAME),
  importFromProject: (cwd) => importFromProject(cwd),
  installAndImport: () => installAndImport(),
  fail: (message) => logErrorAndExit(message),
};

/**
 * Loads the `gt migrate` engine on demand. Resolution order:
 *   0. an engine embedded in a compiled binary and registered on globalThis
 *      (binaries carry the engine because they have no npm to fetch from);
 *   1. the workspace / a devDependency (`import('@generaltranslation/migrate')`),
 *      which resolves in this monorepo and in any project that pinned it;
 *   2. the user's project, resolved explicitly from their package.json;
 *   3. a one-time install into `~/.gt/migrate-engine/<range>/`, imported from
 *      there.
 * A failure at every step exits through the CLI's standard diagnostic telling
 * the user to add the engine as a devDependency and re-run (never a raw stack
 * trace). After loading, the engine's interface version is checked against the
 * CLI's expectation; a mismatch is a hard error naming both versions.
 */
export async function loadMigrateEngine(
  cwd: string,
  deps: LoaderDeps = defaultLoaderDeps
): Promise<Engine> {
  let mod: unknown = readBundledEngine();
  if (!normalizeEngine(mod)) {
    try {
      mod = await deps.importWorkspace();
    } catch {
      try {
        mod = await deps.importFromProject(cwd);
      } catch {
        try {
          mod = await deps.installAndImport();
        } catch (error) {
          deps.fail(
            createDiagnosticMessage({
              source: 'gt',
              severity: 'Error',
              whatHappened: `Could not load or install the gt migrate engine (${PACKAGE_NAME})`,
              fix: `Add ${PACKAGE_NAME} as a devDependency with your package manager (for example \`npm install --save-dev ${PACKAGE_NAME}\`) and re-run \`gt migrate\`.`,
              wayOut:
                'This usually means the machine is offline or npm is unavailable; installing the engine yourself avoids the on-demand fetch. The on-demand copy lives under ~/.gt/migrate-engine and is safe to delete.',
              details: formatDiagnosticErrorDetails(error),
            })
          );
        }
      }
    }
  }

  const engine = normalizeEngine(mod);
  if (!engine) {
    deps.fail(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: `The loaded ${PACKAGE_NAME} module does not export runMigration, so it is not a usable migrate engine`,
        fix: `Reinstall ${PACKAGE_NAME} (or remove a broken copy from your project) and re-run \`gt migrate\`.`,
      })
    );
  }

  if (engine.MIGRATE_INTERFACE_VERSION !== EXPECTED_INTERFACE_VERSION) {
    deps.fail(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: `The installed ${PACKAGE_NAME} speaks migrate interface version ${String(
          engine.MIGRATE_INTERFACE_VERSION
        )}, but this gt CLI expects version ${EXPECTED_INTERFACE_VERSION}`,
        fix: `Update gt (and ${PACKAGE_NAME}, if you pinned it as a devDependency) so their versions line up, then re-run.`,
      })
    );
  }

  return engine;
}

/**
 * Pulls the callable engine out of a loaded module, tolerating CJS/ESM interop
 * (the engine may arrive as the namespace or wrapped under `.default`). Returns
 * null when neither shape exposes runMigration.
 */
function normalizeEngine(mod: unknown): Engine | null {
  const candidates = [mod, (mod as { default?: unknown } | null)?.default];
  for (const candidate of candidates) {
    if (
      candidate &&
      typeof (candidate as { runMigration?: unknown }).runMigration ===
        'function'
    ) {
      return candidate as Engine;
    }
  }
  return null;
}

async function importFromProject(cwd: string): Promise<unknown> {
  const require = createRequire(path.join(cwd, 'package.json'));
  const resolved = require.resolve(PACKAGE_NAME);
  return import(pathToFileURL(resolved).href);
}

/** The range-keyed tool-cache directory the engine is installed into. */
function cacheDir(): string {
  // The range can carry characters that are awkward in a path (the leading ^);
  // encode it so the directory name is portable.
  const key = ENGINE_RANGE.replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(os.homedir(), '.gt', 'migrate-engine', key);
}

/**
 * Written into the cache dir only after npm exits 0, so an interrupted fetch
 * leaves no marker and the next run reinstalls instead of trusting a partial
 * tree (which can resolve yet fail to import).
 */
const INSTALL_MARKER = '.install-complete';

/** @internal exported for the cache-internals unit tests */
export async function installAndImport(): Promise<unknown> {
  const dir = cacheDir();
  // Reuse an already-fetched engine (the range key means a stale one only
  // survives while the range is unchanged).
  const resolved = resolveInCache(dir);
  if (!resolved) {
    // One plain line before the (silent, piped) npm call so the first run does
    // not appear to hang.
    logger.message(`Fetching ${PACKAGE_NAME} (first run only)...`);
    return importFresh(freshInstall(dir));
  }
  try {
    return await importFresh(resolved);
  } catch {
    // A cache that resolves but cannot be imported is corrupt (an interrupted
    // install predating the marker, or two first runs interleaving their
    // writes). Wipe it and reinstall once; a second failure propagates to the
    // standard diagnostic.
    logger.message(
      `Reinstalling ${PACKAGE_NAME} (the cached copy was broken)...`
    );
    return importFresh(freshInstall(dir));
  }
}

/**
 * Clears the cache dir, installs the engine into it, and marks the install
 * complete. Wiping first means an interleaved or interrupted earlier install
 * can never contribute files to the tree npm builds now. Returns the resolved
 * engine entry.
 */
function freshInstall(dir: string): string {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // npm ships with node, so it is used even when the project uses
  // pnpm/yarn/bun: this is a tool cache, not a mutation of the user's
  // project. Fully non-interactive with output piped, never inherited.
  const result = runNpmInstall(dir);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      (result.stderr || result.stdout || '').trim() ||
        `npm install exited with code ${String(result.status)}`
    );
  }
  fs.writeFileSync(path.join(dir, INSTALL_MARKER), '');
  const resolvedAfterInstall = resolveInCache(dir);
  if (!resolvedAfterInstall) {
    throw new Error(`${PACKAGE_NAME} was not found in ${dir} after install`);
  }
  return resolvedAfterInstall;
}

/**
 * Spawns the tool-cache npm install. On Windows npm is npm.cmd, which
 * spawnSync cannot execute directly (and newer Node refuses .cmd targets
 * without a shell), so the call runs through the shell there. cmd.exe receives
 * Node's args unescaped, so the two values that can carry spaces or cmd
 * metacharacters (the cache path, and the version range whose ^ is a cmd
 * escape character) are quoted; double quotes cannot appear in Windows paths.
 *
 * @internal exported for the platform-invocation unit tests
 */
export function runNpmInstall(
  dir: string,
  platform: NodeJS.Platform = process.platform
): SpawnSyncReturns<string> {
  const args = [
    'install',
    `${PACKAGE_NAME}@${ENGINE_RANGE}`,
    '--prefix',
    dir,
    '--no-save',
    '--no-audit',
    '--no-fund',
    '--loglevel=error',
  ];
  const options: SpawnSyncOptionsWithStringEncoding = {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  };
  if (platform === 'win32') {
    return spawnSync(
      'npm',
      args.map((arg) => (/[\s^]/.test(arg) ? `"${arg}"` : arg)),
      { ...options, shell: true }
    );
  }
  return spawnSync('npm', args, options);
}

/**
 * Imports the engine under a unique URL. A failed import is cached as errored
 * for the process lifetime under its exact URL, so a healed cache must be
 * imported under a fresh one; the query string is inert for resolution.
 */
function importFresh(resolved: string): Promise<unknown> {
  return import(`${pathToFileURL(resolved).href}?installed=${Date.now()}`);
}

/** Resolves the engine's entry inside the tool-cache dir, or null when absent. */
function resolveInCache(dir: string): string | null {
  try {
    // An unmarked tree is a partial install; do not trust it (see
    // INSTALL_MARKER).
    if (!fs.existsSync(path.join(dir, INSTALL_MARKER))) return null;
    // createRequire's base file need not exist; only its directory is used as
    // the resolution root, so `<dir>/node_modules` is searched.
    const require = createRequire(path.join(dir, 'noop.js'));
    return require.resolve(PACKAGE_NAME);
  } catch {
    return null;
  }
}
