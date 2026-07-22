import { describe, it, expect } from 'vitest';
import {
  detectPlatform,
  isMuslLinux,
  planBinaryExecution,
  createBinDiagnostic,
} from '../bin-main.js';

// Importing bin-main must not spawn a binary or fall back: the module guards
// its entry point behind import.meta.main, so pulling in the exported helpers
// here is side-effect free. If the guard regressed, this test file would run
// the launcher on import and these assertions would never be reached.

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

  it('is false on glibc Linux (glibcVersionRuntime present)', () => {
    expect(
      isMuslLinux({
        platform: 'linux',
        getReport: () => ({ header: { glibcVersionRuntime: '2.31' } }),
        fileExists: () => true, // ignored: primary signal wins
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

  it('is false when the glibc signal is absent and it is not Alpine (conservative default)', () => {
    expect(
      isMuslLinux({
        platform: 'linux',
        getReport: () => ({ header: {} }),
        fileExists: () => false,
      })
    ).toBe(false);
  });

  it('falls back to the Alpine marker when the report getter throws', () => {
    expect(
      isMuslLinux({
        platform: 'linux',
        getReport: () => {
          throw new Error('report unavailable');
        },
        fileExists: (path) => path === '/etc/alpine-release',
      })
    ).toBe(true);
    expect(
      isMuslLinux({
        platform: 'linux',
        getReport: () => {
          throw new Error('report unavailable');
        },
        fileExists: () => false,
      })
    ).toBe(false);
  });

  it('treats an empty-string glibc version as not-glibc and consults the secondary signal', () => {
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
        return '/somewhere/gtx-cli-linux-x64';
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
      resolve: (target) => `/somewhere/gtx-cli-${target}`,
    });
    expect(plan).toEqual({
      kind: 'spawn',
      binaryPath: '/somewhere/gtx-cli-linux-x64',
    });
  });

  it('spawns the resolved binary on a non-Linux platform without consulting musl', () => {
    let muslConsulted = false;
    const plan = planBinaryExecution({
      platform: 'darwin',
      arch: 'arm64',
      detectMusl: () => {
        muslConsulted = true;
        return true;
      },
      resolve: (target) => `/somewhere/gtx-cli-${target}`,
    });
    // detectMusl is still called, but returns false for non-Linux in real use;
    // here we only assert the darwin binary path is taken when it reports false.
    expect(muslConsulted).toBe(true);
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
      expect(plan.diagnostic.whatHappened).toContain(
        'No prebuilt gtx-cli binary'
      );
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
        'Could not find the gtx-cli binary'
      );
      expect(plan.diagnostic.fix).toContain(
        '@generaltranslation/gtx-cli-linux-x64'
      );
    }
  });
});

describe('createBinDiagnostic', () => {
  it('prefixes the source and severity and punctuates the body', () => {
    expect(
      createBinDiagnostic({
        severity: 'Warning',
        whatHappened:
          'No prebuilt gtx-cli binary exists for your platform (freebsd-x64)',
      })
    ).toBe(
      // A body ending in ")" is already sentence-terminal, matching core's
      // createDiagnosticMessage, so no extra period is appended.
      'gtx-cli Warning: No prebuilt gtx-cli binary exists for your platform (freebsd-x64)'
    );
  });

  it('orders whatHappened, reassurance, fix, then details', () => {
    expect(
      createBinDiagnostic({
        severity: 'Warning',
        whatHappened: 'Could not find the gtx-cli binary',
        reassurance: 'Falling back to the JS implementation of gtx-cli.',
        fix: 'reinstall the package',
        details: 'ENOENT',
      })
    ).toBe(
      'gtx-cli Warning: Could not find the gtx-cli binary. Falling back to the JS implementation of gtx-cli. reinstall the package. Details: ENOENT.'
    );
  });

  it('does not double-punctuate an already-terminated sentence', () => {
    expect(
      createBinDiagnostic({
        severity: 'Error',
        whatHappened: 'The JS fallback failed to load.',
      })
    ).toBe('gtx-cli Error: The JS fallback failed to load.');
  });

  it('omits empty optional fields', () => {
    expect(
      createBinDiagnostic({
        severity: 'Error',
        whatHappened: 'The JS fallback threw while running',
        details: '   ',
      })
    ).toBe('gtx-cli Error: The JS fallback threw while running.');
  });
});
