import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Mock dependencies before importing the module
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

vi.mock('fast-glob', () => ({
  default: {
    sync: vi.fn(),
  },
}));

vi.mock('../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import fg from 'fast-glob';
import { logger } from '../../console/logger.js';
import { checkMonorepoVersionConsistency } from '../monorepoVersionCheck.js';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockFgSync = vi.mocked(fg.sync);

describe('checkMonorepoVersionConsistency', () => {
  const originalCwd = process.cwd;
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    process.cwd = () => '/repo/packages/app-a';
    process.exit = vi.fn() as any;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    process.exit = originalExit;
  });

  it('should silently return if no lockfile is found', () => {
    mockExistsSync.mockReturnValue(false);
    checkMonorepoVersionConsistency();
    expect(process.exit).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should silently return if only one package exists', () => {
    setupMocks({
      packageDirs: ['/repo/packages/app-a'],
      packages: {
        '/repo/packages/app-a': {
          name: 'app-a',
          dependencies: { 'gt-react': '^10.11.0' },
        },
      },
      installedVersions: {
        '/repo/packages/app-a': { 'gt-react': '10.11.7' },
      },
    });

    checkMonorepoVersionConsistency();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('should silently return when all GT package versions match', () => {
    setupMocks({
      packageDirs: ['/repo/packages/app-a', '/repo/packages/app-b'],
      packages: {
        '/repo/packages/app-a': {
          name: 'app-a',
          dependencies: { 'gt-react': '^10.11.0' },
        },
        '/repo/packages/app-b': {
          name: 'app-b',
          dependencies: { 'gt-react': '^10.11.0' },
        },
      },
      installedVersions: {
        '/repo/packages/app-a': { 'gt-react': '10.11.7' },
        '/repo/packages/app-b': { 'gt-react': '10.11.7' },
      },
    });

    checkMonorepoVersionConsistency();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('should exit with code 1 when GT package versions mismatch', () => {
    setupMocks({
      packageDirs: ['/repo/packages/app-a', '/repo/packages/app-b'],
      packages: {
        '/repo/packages/app-a': {
          name: 'app-a',
          dependencies: { 'gt-react': '^10.5.0' },
        },
        '/repo/packages/app-b': {
          name: 'app-b',
          dependencies: { 'gt-react': '^10.11.0' },
        },
      },
      installedVersions: {
        '/repo/packages/app-a': { 'gt-react': '10.5.3' },
        '/repo/packages/app-b': { 'gt-react': '10.11.7' },
      },
    });

    checkMonorepoVersionConsistency();
    expect(logger.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should detect mismatches in transitive GT dependencies like react-core', () => {
    setupMocks({
      packageDirs: ['/repo/packages/app-a', '/repo/packages/app-b'],
      packages: {
        '/repo/packages/app-a': {
          name: 'app-a',
          dependencies: {
            'gt-react': '^10.5.0',
            '@generaltranslation/react-core': '^1.3.0',
          },
        },
        '/repo/packages/app-b': {
          name: 'app-b',
          dependencies: {
            'gt-react': '^10.11.0',
            '@generaltranslation/react-core': '^1.5.0',
          },
        },
      },
      installedVersions: {
        '/repo/packages/app-a': {
          'gt-react': '10.5.3',
          '@generaltranslation/react-core': '1.3.2',
        },
        '/repo/packages/app-b': {
          'gt-react': '10.11.7',
          '@generaltranslation/react-core': '1.5.7',
        },
      },
    });

    checkMonorepoVersionConsistency();
    expect(logger.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should ignore packages that do not depend on GT packages', () => {
    setupMocks({
      packageDirs: ['/repo/packages/app-a', '/repo/packages/utils'],
      packages: {
        '/repo/packages/app-a': {
          name: 'app-a',
          dependencies: { 'gt-react': '^10.11.0' },
        },
        '/repo/packages/utils': {
          name: 'utils',
          dependencies: { lodash: '^4.0.0' },
        },
      },
      installedVersions: {
        '/repo/packages/app-a': { 'gt-react': '10.11.7' },
      },
    });

    checkMonorepoVersionConsistency();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('should detect root via package-lock.json', () => {
    setupMocks({
      lockfile: 'package-lock.json',
      packageDirs: ['/repo/packages/app-a', '/repo/packages/app-b'],
      packages: {
        '/repo/packages/app-a': {
          name: 'app-a',
          dependencies: { 'gt-react': '^10.5.0' },
        },
        '/repo/packages/app-b': {
          name: 'app-b',
          dependencies: { 'gt-react': '^10.11.0' },
        },
      },
      installedVersions: {
        '/repo/packages/app-a': { 'gt-react': '10.5.3' },
        '/repo/packages/app-b': { 'gt-react': '10.11.7' },
      },
    });

    checkMonorepoVersionConsistency();
    expect(logger.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should detect root via yarn.lock', () => {
    setupMocks({
      lockfile: 'yarn.lock',
      packageDirs: ['/repo/packages/app-a', '/repo/packages/app-b'],
      packages: {
        '/repo/packages/app-a': {
          name: 'app-a',
          dependencies: { 'gt-next': '^6.10.0' },
        },
        '/repo/packages/app-b': {
          name: 'app-b',
          dependencies: { 'gt-next': '^6.13.0' },
        },
      },
      installedVersions: {
        '/repo/packages/app-a': { 'gt-next': '6.10.2' },
        '/repo/packages/app-b': { 'gt-next': '6.13.8' },
      },
    });

    checkMonorepoVersionConsistency();
    expect(logger.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should detect root via bun.lock', () => {
    setupMocks({
      lockfile: 'bun.lock',
      packageDirs: ['/repo/packages/app-a', '/repo/packages/app-b'],
      packages: {
        '/repo/packages/app-a': {
          name: 'app-a',
          dependencies: { 'gt-react': '^10.5.0' },
        },
        '/repo/packages/app-b': {
          name: 'app-b',
          dependencies: { 'gt-react': '^10.11.0' },
        },
      },
      installedVersions: {
        '/repo/packages/app-a': { 'gt-react': '10.5.3' },
        '/repo/packages/app-b': { 'gt-react': '10.11.7' },
      },
    });

    checkMonorepoVersionConsistency();
    expect(logger.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should group multiple packages with the same version together', () => {
    setupMocks({
      packageDirs: [
        '/repo/packages/app-a',
        '/repo/packages/app-b',
        '/repo/packages/app-c',
      ],
      packages: {
        '/repo/packages/app-a': {
          name: 'app-a',
          dependencies: { 'gt-react': '^10.5.0' },
        },
        '/repo/packages/app-b': {
          name: 'app-b',
          dependencies: { 'gt-react': '^10.11.0' },
        },
        '/repo/packages/app-c': {
          name: 'app-c',
          dependencies: { 'gt-react': '^10.11.0' },
        },
      },
      installedVersions: {
        '/repo/packages/app-a': { 'gt-react': '10.5.3' },
        '/repo/packages/app-b': { 'gt-react': '10.11.7' },
        '/repo/packages/app-c': { 'gt-react': '10.11.7' },
      },
    });

    checkMonorepoVersionConsistency();
    expect(process.exit).toHaveBeenCalledWith(1);

    const errorMessage = vi.mocked(logger.error).mock.calls[0][0];
    expect(errorMessage).toContain('app-b');
    expect(errorMessage).toContain('app-c');
    expect(errorMessage).toContain('app-a');
  });
});

// Helper to set up common mock patterns
function setupMocks(config: {
  lockfile?: string;
  packageDirs: string[];
  packages: Record<
    string,
    {
      name: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }
  >;
  installedVersions: Record<string, Record<string, string>>;
}) {
  const {
    lockfile = 'pnpm-lock.yaml',
    packageDirs,
    packages,
    installedVersions,
  } = config;

  mockExistsSync.mockImplementation((p: unknown) => {
    const pStr = String(p);

    // Lockfile detection at monorepo root
    if (pStr === path.join('/repo', lockfile)) return true;

    // Package directory package.json files
    for (const dir of packageDirs) {
      if (pStr === path.join(dir, 'package.json')) return true;
    }

    // Installed package versions in node_modules
    for (const [wsDir, pkgs] of Object.entries(installedVersions)) {
      for (const pkgName of Object.keys(pkgs)) {
        if (
          pStr === path.join(wsDir, 'node_modules', pkgName, 'package.json')
        ) {
          return true;
        }
      }
    }

    return false;
  });

  mockReadFileSync.mockImplementation((p: unknown) => {
    const pStr = String(p);

    // Package directory package.json files
    for (const [dir, pkgJson] of Object.entries(packages)) {
      if (pStr === path.join(dir, 'package.json')) {
        return JSON.stringify(pkgJson);
      }
    }

    // Installed package versions
    for (const [wsDir, pkgs] of Object.entries(installedVersions)) {
      for (const [pkgName, version] of Object.entries(pkgs)) {
        if (
          pStr === path.join(wsDir, 'node_modules', pkgName, 'package.json')
        ) {
          return JSON.stringify({ name: pkgName, version });
        }
      }
    }

    return '';
  });

  // fg.sync returns package.json paths for scanned directories (excluding root)
  mockFgSync.mockReturnValue(
    packageDirs.map((dir) => path.join(dir, 'package.json'))
  );
}
