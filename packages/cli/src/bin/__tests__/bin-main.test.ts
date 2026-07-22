import { describe, it, expect, beforeAll } from 'vitest';
import { execSync, spawnSync } from 'child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import {
  detectPlatform,
  isMuslLinux,
  planBinaryExecution,
  createBinDiagnostic,
  isProcessEntry,
} from '../bin-main.js';
// Dev-only import of the real core formatter to lock the launcher-local copy to
// it (see the parity suite below). The launcher never imports this at runtime;
// the test resolves the built bundle by relative path so it needs no extra
// dependency on either CLI package.
import { createDiagnosticMessage } from '../../../../core/dist/internal.mjs';

// Importing bin-main must not spawn a binary or fall back: the module guards
// its entry point behind isProcessEntry(), so pulling in the exported helpers
// here is side-effect free. If the guard regressed, this test file would run
// the launcher on import and these assertions would never be reached.

const launcherPath = fileURLToPath(
  new URL('../../../dist/bin/bin-main.js', import.meta.url)
);
const packageRoot = fileURLToPath(new URL('../../../', import.meta.url));
const jsFallbackPath = join(packageRoot, 'dist', 'main.js');

describe('detectPlatform', () => {
  it('maps supported platform/arch pairs to target names', () => {
    expect(detectPlatform('darwin', 'x64')).toBe('darwin-x64');
    expect(detectPlatform('darwin', 'arm64')).toBe('darwin-arm64');
    expect(detectPlatform('linux', 'x64')).toBe('linux-x64');
    expect(detectPlatform('linux', 'arm64')).toBe('linux-arm64');
    expect(detectPlatform('win32', 'x64')).toBe('win32-x64');
  });

  it('returns null for unsupported platform/arch pairs', () => {
    expect(detectPlatform('linux', 'ia32')).toBeNull();
    expect(detectPlatform('win32', 'arm64')).toBeNull();
    expect(detectPlatform('freebsd', 'x64')).toBeNull();
  });
});

describe('isMuslLinux', () => {
  it('is false on non-Linux platforms regardless of other signals', () => {
    expect(
      isMuslLinux({
        platform: 'darwin',
        getReport: () => ({ header: {} }),
        fileExists: () => true,
      })
    ).toBe(false);
    expect(
      isMuslLinux({
        platform: 'win32',
        getReport: () => ({ header: {} }),
        fileExists: () => true,
      })
    ).toBe(false);
  });

  it('short-circuits to false on Linux without the Alpine marker, without consulting the report', () => {
    let reportConsulted = false;
    const result = isMuslLinux({
      platform: 'linux',
      getReport: () => {
        reportConsulted = true;
        return { header: {} };
      },
      fileExists: () => false,
    });
    expect(result).toBe(false);
    // The expensive process.report.getReport() must not run on the common
    // glibc path (no marker present); the cheap marker check short-circuits.
    expect(reportConsulted).toBe(false);
  });

  it('is false on a glibc host that carries the Alpine marker (glibc signal wins)', () => {
    expect(
      isMuslLinux({
        platform: 'linux',
        getReport: () => ({ header: { glibcVersionRuntime: '2.31' } }),
        fileExists: (path) => path === '/etc/alpine-release',
      })
    ).toBe(false);
  });

  it('is true on musl Linux via the /etc/alpine-release marker', () => {
    expect(
      isMuslLinux({
        platform: 'linux',
        getReport: () => ({ header: {} }),
        fileExists: (path) => path === '/etc/alpine-release',
      })
    ).toBe(true);
  });

  it('treats a throwing report as non-glibc when the Alpine marker is present', () => {
    expect(
      isMuslLinux({
        platform: 'linux',
        getReport: () => {
          throw new Error('report unavailable');
        },
        fileExists: (path) => path === '/etc/alpine-release',
      })
    ).toBe(true);
  });

  it('never reaches the report when the Alpine marker is absent', () => {
    let reportConsulted = false;
    const result = isMuslLinux({
      platform: 'linux',
      getReport: () => {
        reportConsulted = true;
        throw new Error('report unavailable');
      },
      fileExists: () => false,
    });
    expect(result).toBe(false);
    expect(reportConsulted).toBe(false);
  });

  it('treats an empty-string glibc version as not-glibc (marker present, so musl)', () => {
    expect(
      isMuslLinux({
        platform: 'linux',
        getReport: () => ({ header: { glibcVersionRuntime: '' } }),
        fileExists: (path) => path === '/etc/alpine-release',
      })
    ).toBe(true);
  });
});

describe('planBinaryExecution', () => {
  it('falls back to JS on musl (detected before resolving the binary)', () => {
    let resolveCalled = false;
    const plan = planBinaryExecution({
      platform: 'linux',
      arch: 'x64',
      detectMusl: () => true,
      resolve: () => {
        resolveCalled = true;
        return '/somewhere/gt-linux-x64';
      },
    });
    expect(plan.kind).toBe('fallback');
    if (plan.kind === 'fallback') {
      expect(plan.diagnostic.whatHappened).toContain('musl');
    }
    // Musl is detected before resolve/spawn, so the binary is never resolved.
    expect(resolveCalled).toBe(false);
  });

  it('spawns the resolved binary on glibc Linux (binary path unchanged)', () => {
    const plan = planBinaryExecution({
      platform: 'linux',
      arch: 'x64',
      detectMusl: () => false,
      resolve: (target) => `/somewhere/gt-${target}`,
    });
    expect(plan).toEqual({
      kind: 'spawn',
      binaryPath: '/somewhere/gt-linux-x64',
    });
  });

  it('consults detectMusl unconditionally, then spawns the resolved binary on a non-Linux platform', () => {
    let muslConsulted = false;
    const plan = planBinaryExecution({
      platform: 'darwin',
      arch: 'arm64',
      detectMusl: () => {
        muslConsulted = true;
        return false;
      },
      resolve: (target) => `/somewhere/gt-${target}`,
    });
    // planBinaryExecution always calls detectMusl; the non-Linux short-circuit
    // lives inside isMuslLinux (which returns false off Linux), not here. When
    // it reports false the resolved binary is spawned.
    expect(muslConsulted).toBe(true);
    expect(plan).toEqual({
      kind: 'spawn',
      binaryPath: '/somewhere/gt-darwin-arm64',
    });
  });

  it('falls back to JS on an unsupported platform', () => {
    const plan = planBinaryExecution({
      platform: 'freebsd',
      arch: 'x64',
      detectMusl: () => false,
      resolve: () => '/never',
    });
    expect(plan.kind).toBe('fallback');
    if (plan.kind === 'fallback') {
      expect(plan.diagnostic.whatHappened).toContain('No prebuilt gt binary');
    }
  });

  it('falls back to JS when the binary cannot be resolved', () => {
    const plan = planBinaryExecution({
      platform: 'linux',
      arch: 'x64',
      detectMusl: () => false,
      resolve: () => null,
    });
    expect(plan.kind).toBe('fallback');
    if (plan.kind === 'fallback') {
      expect(plan.diagnostic.whatHappened).toContain(
        'Could not find the gt binary'
      );
      expect(plan.diagnostic.fix).toContain('@generaltranslation/gt-linux-x64');
    }
  });
});

describe('createBinDiagnostic', () => {
  it('prefixes the source and severity and punctuates the body', () => {
    expect(
      createBinDiagnostic({
        severity: 'Warning',
        whatHappened:
          'No prebuilt gt binary exists for your platform (freebsd-x64)',
      })
    ).toBe(
      // A body ending in ")" is already sentence-terminal, matching core's
      // createDiagnosticMessage, so no extra period is appended.
      'gt Warning: No prebuilt gt binary exists for your platform (freebsd-x64)'
    );
  });

  it('orders whatHappened, reassurance, fix, then details', () => {
    expect(
      createBinDiagnostic({
        severity: 'Warning',
        whatHappened: 'Could not find the gt binary',
        reassurance: 'Falling back to the JS implementation of gt.',
        fix: 'reinstall the package',
        details: 'ENOENT',
      })
    ).toBe(
      'gt Warning: Could not find the gt binary. Falling back to the JS implementation of gt. reinstall the package. Details: ENOENT.'
    );
  });

  it('does not double-punctuate an already-terminated sentence', () => {
    expect(
      createBinDiagnostic({
        severity: 'Error',
        whatHappened: 'The JS fallback failed to load.',
      })
    ).toBe('gt Error: The JS fallback failed to load.');
  });

  it('omits empty optional fields', () => {
    expect(
      createBinDiagnostic({
        severity: 'Error',
        whatHappened: 'The JS fallback threw while running',
        details: '   ',
      })
    ).toBe('gt Error: The JS fallback threw while running.');
  });
});

// The launcher reimplements core's createDiagnosticMessage locally to stay a
// dependency-free hot path (a static generaltranslation/internal import would
// pull the whole barrel onto every invocation). This suite locks that copy to
// core: if core's formatter changes part ordering, punctuation, or the Details
// prefix, one of these assertions fails so the two drift loudly instead of
// silently. createBinDiagnostic hardcodes the "gt" source, so the core call is
// given the same source.
describe('createBinDiagnostic parity with core createDiagnosticMessage', () => {
  const cases: {
    name: string;
    input: Parameters<typeof createBinDiagnostic>[0];
  }[] = [
    {
      name: 'whatHappened only, ")"-terminated (no appended period)',
      input: {
        severity: 'Warning',
        whatHappened:
          'No prebuilt gt binary exists for your platform (freebsd-x64)',
      },
    },
    {
      name: 'all optional fields populated',
      input: {
        severity: 'Warning',
        whatHappened: 'Could not find the gt binary',
        reassurance: 'Falling back to the JS implementation of gt.',
        fix: 'reinstall the package',
        details: 'ENOENT',
      },
    },
    {
      name: 'Error severity, already period-terminated whatHappened',
      input: {
        severity: 'Error',
        whatHappened: 'The JS fallback failed to load.',
      },
    },
    {
      name: 'Error severity, whatHappened plus Details only',
      input: {
        severity: 'Error',
        whatHappened: 'The JS fallback threw while running',
        details: 'boom',
      },
    },
    {
      name: 'whitespace-only Details is dropped',
      input: {
        severity: 'Warning',
        whatHappened: 'The prebuilt gt binary could not be started',
        details: '   ',
      },
    },
    {
      name: 'whatHappened plus fix, no reassurance or details',
      input: {
        severity: 'Error',
        whatHappened: 'The JS fallback failed to load',
        fix: 'Try deleting node_modules and your lockfile, then reinstalling',
      },
    },
    {
      name: 'whatHappened plus reassurance, musl fallback wording',
      input: {
        severity: 'Warning',
        whatHappened:
          'Prebuilt gt binaries require glibc, but this Linux system uses musl (for example Alpine)',
        reassurance: 'Falling back to the JS implementation of gt.',
      },
    },
  ];

  it.each(cases)('matches core for: $name', ({ input }) => {
    expect(createBinDiagnostic(input)).toBe(
      createDiagnosticMessage({ source: 'gt', ...input })
    );
  });
});

// The 17 helper tests above import the module, so isProcessEntry (the entry
// guard) is never exercised as the *process entry* by them. These tests drive
// the guard directly, including the pre-Node-24.2 path where import.meta.main
// is undefined. On commit b63dfe69d the guard was a bare `import.meta.main`
// with no fallback, so the undefined-metaMain cases below would report "not the
// entry" and the CLI would silently no-op; here they must report the entry.
describe('isProcessEntry', () => {
  it('uses import.meta.main directly when it is a boolean (Node >= 24.2)', () => {
    expect(isProcessEntry(true, import.meta.url, '/anything')).toBe(true);
    expect(isProcessEntry(false, import.meta.url, '/anything')).toBe(false);
  });

  it('falls back to a realpath comparison when import.meta.main is undefined', () => {
    const self = fileURLToPath(import.meta.url);
    // Launched directly on a Node without import.meta.main: argv[1] is this
    // very module, so it is the entry.
    expect(isProcessEntry(undefined, import.meta.url, self)).toBe(true);
    // A different entry module means we were imported, not run directly.
    expect(
      isProcessEntry(undefined, import.meta.url, join(tmpdir(), 'not-me.js'))
    ).toBe(false);
    // No process entry argument at all resolves to false, never throws.
    expect(isProcessEntry(undefined, import.meta.url, undefined)).toBe(false);
  });

  it('resolves a .bin-style symlink on the pre-24.2 fallback path', () => {
    const self = fileURLToPath(import.meta.url);
    const dir = mkdtempSync(join(tmpdir(), 'binlink-'));
    const link = join(dir, 'cli');
    symlinkSync(self, link);
    try {
      // argv[1] is the symlink (the npm .bin shape) while import.meta.url is the
      // realpath. A naive URL compare would return false here; resolving the
      // realpath on both sides makes the symlinked launcher match.
      expect(isProcessEntry(undefined, import.meta.url, link)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// End-to-end coverage of the actual production wiring: run the BUILT launcher
// as a subprocess (the shape npm publishes as bin) and confirm it routes. On a
// box with no platform binary it prints the fallback diagnostic on stderr and
// hands off to the JS CLI (its usage on stdout). A silent no-op, which is how
// the pre-24.2 import.meta.main regression manifested, would exit 0 with empty
// output and fail these assertions.
describe('built launcher entry point (integration)', () => {
  beforeAll(() => {
    if (!existsSync(launcherPath) || !existsSync(jsFallbackPath)) {
      // The launcher only exists after a build. Build once here so the test
      // exercises the real entry instead of being skipped; in CI turbo builds
      // the package before tests run, so this is a no-op there.
      execSync('pnpm run build', { cwd: packageRoot, stdio: 'ignore' });
    }
  }, 300000);

  it('routes to the JS fallback when run directly as the process entry', () => {
    const result = spawnSync(process.execPath, [launcherPath, '--help'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stderr).toContain('Falling back to the JS implementation of');
  });

  it('routes when invoked through a .bin-style symlink (the published shape)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'binlink-'));
    const link = join(dir, 'cli');
    symlinkSync(launcherPath, link);
    try {
      const result = spawnSync(process.execPath, [link, '--help'], {
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stderr).toContain(
        'Falling back to the JS implementation of'
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
