#!/usr/bin/env node

// Routes to proper binary based on platform. Binaries ship in per-platform
// optional dependencies (@generaltranslation/gt-<os>-<arch>); a local
// binaries/ directory is the fallback for development builds.

import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, chmodSync, statSync, realpathSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

export function detectPlatform(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): string | null {
  // Map Node.js platform/arch to our target names
  const platformMap: Record<string, Record<string, string>> = {
    darwin: {
      x64: 'darwin-x64',
      arm64: 'darwin-arm64',
    },
    linux: {
      x64: 'linux-x64',
      arm64: 'linux-arm64',
    },
    win32: {
      x64: 'win32-x64',
    },
  };

  return platformMap[platform]?.[arch] || null;
}

function binaryFileName(target: string): string {
  return target === 'win32-x64' ? 'gt-win32-x64.exe' : `gt-${target}`;
}

function platformPackageName(target: string): string {
  return `@generaltranslation/gt-${target}`;
}

function resolveBinary(target: string): string | null {
  // Installed layout: the platform-specific optional dependency
  try {
    return require.resolve(
      `${platformPackageName(target)}/${binaryFileName(target)}`
    );
  } catch {
    // Fall through to the development layout
  }

  // Development layout: binaries/ next to dist/ in the package root
  const localPath = join(
    __dirname,
    '..',
    '..',
    'binaries',
    binaryFileName(target)
  );
  if (existsSync(localPath)) {
    return localPath;
  }

  return null;
}

function defaultGetReport(): unknown {
  return typeof process.report?.getReport === 'function'
    ? process.report.getReport()
    : undefined;
}

// Prebuilt Linux binaries are glibc-only, and some package managers install the
// glibc package on musl systems anyway, so detect musl at runtime and take the JS
// fallback. Detection is best-effort: any ambiguity resolves to "glibc".
export function isMuslLinux(
  overrides: {
    platform?: NodeJS.Platform;
    getReport?: () => unknown;
    fileExists?: (path: string) => boolean;
  } = {}
): boolean {
  const platform = overrides.platform ?? process.platform;
  if (platform !== 'linux') {
    return false;
  }

  try {
    // Cheap primary check: Alpine ships this marker. Most Linux hosts run glibc and
    // lack the file, so they short-circuit before process.report.getReport() (~10ms).
    const fileExists = overrides.fileExists ?? existsSync;
    if (!fileExists('/etc/alpine-release')) {
      return false;
    }

    // Distinguish a real musl host from a glibc host that merely carries the marker.
    // Node sets header.glibcVersionRuntime on glibc builds and omits it on musl, so a
    // non-empty string means glibc. Any error resolves to musl; the marker pointed there.
    let glibcVersion: unknown;
    try {
      const getReport = overrides.getReport ?? defaultGetReport;
      const report = getReport() as
        | { header?: { glibcVersionRuntime?: unknown } }
        | undefined;
      glibcVersion = report?.header?.glibcVersionRuntime;
    } catch {
      glibcVersion = undefined;
    }
    return !(typeof glibcVersion === 'string' && glibcVersion.length > 0);
  } catch {
    return false;
  }
}

type FallbackDiagnostic = {
  whatHappened: string;
  fix?: string;
  details?: string;
};

export type ExecutionPlan =
  | { kind: 'fallback'; diagnostic: FallbackDiagnostic }
  | { kind: 'spawn'; binaryPath: string };

// Pure routing decision: pick the platform binary, the JS fallback, or an
// actionable failure. Kept free of I/O so both branches are unit-testable.
export function planBinaryExecution(
  overrides: {
    platform?: NodeJS.Platform;
    arch?: string;
    detectMusl?: () => boolean;
    resolve?: (target: string) => string | null;
  } = {}
): ExecutionPlan {
  const platform = overrides.platform ?? process.platform;
  const arch = overrides.arch ?? process.arch;

  const target = detectPlatform(platform, arch);
  if (!target) {
    return {
      kind: 'fallback',
      diagnostic: {
        whatHappened: `No prebuilt gt binary exists for your platform (${platform}-${arch})`,
      },
    };
  }

  // Detect musl before resolving or spawning: the glibc-only Linux binary can
  // be installed on Alpine/musl by package managers that ignore "libc".
  const detectMusl = overrides.detectMusl ?? (() => isMuslLinux({ platform }));
  if (detectMusl()) {
    return {
      kind: 'fallback',
      diagnostic: {
        whatHappened: `Prebuilt gt binaries require glibc, but this Linux system uses musl (for example Alpine)`,
      },
    };
  }

  const resolve = overrides.resolve ?? resolveBinary;
  const binaryPath = resolve(target);
  if (!binaryPath) {
    return {
      kind: 'fallback',
      diagnostic: {
        whatHappened: `Could not find the gt binary for your platform (${platform}-${arch})`,
        fix: `It ships in the optional dependency "${platformPackageName(
          target
        )}", which package managers install automatically; it can be missing when a lockfile was created with --omit=optional or on a different platform, so deleting node_modules and your lockfile then reinstalling usually restores it`,
      },
    };
  }

  return { kind: 'spawn', binaryPath };
}

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?)]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export type BinDiagnosticSeverity = 'Error' | 'Warning';

// Launcher-local diagnostic formatter. Importing createDiagnosticMessage from
// generaltranslation/internal would pull that whole barrel onto the hot path, so the
// canonical "<source> <Severity>: ..." shape is reproduced here with no dependencies.
export function createBinDiagnostic(input: {
  severity: BinDiagnosticSeverity;
  whatHappened: string;
  reassurance?: string;
  fix?: string;
  details?: string;
}): string {
  const detailText =
    input.details && input.details.trim()
      ? `Details: ${input.details}`
      : undefined;
  const message = [input.whatHappened, input.reassurance, input.fix, detailText]
    .filter((part): part is string => !!part && !!part.trim())
    .map(ensureSentence)
    .join(' ');
  return `gt ${input.severity}: ${message}`;
}

// The bin variant still ships the full JS implementation in dist/, so a
// missing or incompatible binary degrades to the JS CLI instead of failing
// outright.
function runJsFallback(diagnostic: FallbackDiagnostic): void {
  console.error(
    createBinDiagnostic({
      severity: 'Warning',
      whatHappened: diagnostic.whatHappened,
      fix: diagnostic.fix,
      details: diagnostic.details,
      reassurance: 'Falling back to the JS implementation of gt.',
    })
  );
  import('../main.js').catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
      console.error(
        createBinDiagnostic({
          severity: 'Error',
          whatHappened: 'The JS fallback failed to load',
          fix: 'Try deleting node_modules and your lockfile, then reinstalling',
          details: message,
        })
      );
    } else {
      console.error(
        createBinDiagnostic({
          severity: 'Error',
          whatHappened: 'The JS fallback threw while running',
          details: message,
        })
      );
    }
    process.exit(1);
  });
}

function routeToBinary(): void {
  const plan = planBinaryExecution();

  if (plan.kind === 'fallback') {
    runJsFallback(plan.diagnostic);
    return;
  }

  const { binaryPath } = plan;

  // Check and fix execute permissions if needed (Unix-like systems only)
  if (process.platform !== 'win32') {
    try {
      const stats = statSync(binaryPath);
      const isExecutable = !!(stats.mode & parseInt('100', 8)); // Check owner execute bit

      if (!isExecutable) {
        chmodSync(binaryPath, 0o755); // Make executable
      }
    } catch {
      // If we can't check/fix permissions, continue anyway
      // The spawn might still work or give a more meaningful error
    }
  }

  // Spawn the appropriate binary with all arguments
  const child = spawn(binaryPath, process.argv.slice(2), {
    stdio: 'inherit',
  });

  let settled = false;

  child.on('close', (code) => {
    if (settled) return;
    settled = true;
    // code might be null
    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    if (settled) return;
    settled = true;
    // 'error' fires only when the process could never be spawned, so degrading to the
    // JS fallback cannot double-run a side-effecting command. A binary that did start
    // and exited nonzero surfaces through 'close', where the exit code propagates.
    runJsFallback({
      whatHappened: 'The prebuilt gt binary could not be started',
      details: error instanceof Error ? error.message : String(error),
    });
  });

  return;
}

// True when this module is the process entry point rather than an import.
// import.meta.main only exists on Node >= 24.2.0; older lines fall back to comparing
// realpaths, since process.argv[1] is often an npm .bin symlink. Errors resolve false.
export function isProcessEntry(
  metaMain: boolean | undefined,
  moduleUrl: string,
  entryArg: string | undefined = process.argv[1]
): boolean {
  if (typeof metaMain === 'boolean') {
    return metaMain;
  }
  if (!entryArg) {
    return false;
  }
  try {
    return realpathSync(entryArg) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

// Entry point: only auto-run when invoked as the CLI, not when imported by
// tests.
if (isProcessEntry((import.meta as { main?: boolean }).main, import.meta.url)) {
  routeToBinary();
}
