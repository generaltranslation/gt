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
import { Libraries, REACT_LIBRARIES } from '../../types/libraries.js';

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
    checkMonorepoVersionConsistency(REACT_LIBRARIES);
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
    });

    checkMonorepoVersionConsistency(REACT_LIBRARIES);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('should silently return when all GT package version specifiers match', () => {
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
    });

    checkMonorepoVersionConsistency(REACT_LIBRARIES);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('should silently return when gt-react and gt-react-native version specifiers match', () => {
    setupMocks({
      packageDirs: ['/repo/packages/app-a', '/repo/packages/app-b'],
      packages: {
        '/repo/packages/app-a': {
          name: 'app-a',
          dependencies: { 'gt-react': '^10.19.3' },
        },
        '/repo/packages/app-b': {
          name: 'app-b',
          dependencies: { 'gt-react-native': '^10.19.3' },
        },
      },
    });

    checkMonorepoVersionConsistency(REACT_LIBRARIES);
    expect(process.exit).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should not enforce gt-react and gt-react-native sync when both versions are below 10.19.1', () => {
    setupMocks({
      packageDirs: ['/repo/packages/app-a', '/repo/packages/app-b'],
      packages: {
        '/repo/packages/app-a': {
          name: 'app-a',
          dependencies: { 'gt-react': '^10.18.0' },
        },
        '/repo/packages/app-b': {
          name: 'app-b',
          dependencies: { 'gt-react-native': '^10.19.0' },
        },
      },
    });

    checkMonorepoVersionConsistency(REACT_LIBRARIES);
    expect(process.exit).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should exit with code 1 when GT package version specifiers mismatch', () => {
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
    });

    checkMonorepoVersionConsistency(REACT_LIBRARIES);
    expect(logger.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should exit with code 1 when gt-react and gt-react-native version specifiers mismatch at or above 10.19.1', () => {
    setupMocks({
      packageDirs: ['/repo/packages/app-a', '/repo/packages/app-b'],
      packages: {
        '/repo/packages/app-a': {
          name: 'app-a',
          dependencies: { 'gt-react': '^10.19.1' },
        },
        '/repo/packages/app-b': {
          name: 'app-b',
          dependencies: { 'gt-react-native': '^10.18.0' },
        },
      },
    });

    checkMonorepoVersionConsistency(REACT_LIBRARIES);
    expect(logger.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);

    const errorMessage = vi.mocked(logger.error).mock.calls[0][0];
    expect(errorMessage).toContain('gt-react / gt-react-native');
    expect(errorMessage).toContain('gt-react in app-a');
    expect(errorMessage).toContain('gt-react-native in app-b');
  });

  it('should not compare gt-react with gt-react-native unless both libraries are checked', () => {
    setupMocks({
      packageDirs: ['/repo/packages/app-a', '/repo/packages/app-b'],
      packages: {
        '/repo/packages/app-a': {
          name: 'app-a',
          dependencies: { 'gt-react': '^10.19.3' },
        },
        '/repo/packages/app-b': {
          name: 'app-b',
          dependencies: { 'gt-react-native': '^10.18.0' },
        },
      },
    });

    checkMonorepoVersionConsistency([Libraries.GT_REACT]);
    expect(process.exit).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
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
    });

    checkMonorepoVersionConsistency(REACT_LIBRARIES);
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
    });

    checkMonorepoVersionConsistency(REACT_LIBRARIES);
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
    });

    checkMonorepoVersionConsistency(REACT_LIBRARIES);
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
    });

    checkMonorepoVersionConsistency(REACT_LIBRARIES);
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
    });

    checkMonorepoVersionConsistency(REACT_LIBRARIES);
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
    });

    checkMonorepoVersionConsistency(REACT_LIBRARIES);
    expect(process.exit).toHaveBeenCalledWith(1);

    const errorMessage = vi.mocked(logger.error).mock.calls[0][0];
    expect(errorMessage).toContain('app-b');
    expect(errorMessage).toContain('app-c');
    expect(errorMessage).toContain('app-a');
  });

  it('should work without node_modules installed (no deps)', () => {
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
    });

    // No node_modules exist at all — should still detect mismatch from package.json
    checkMonorepoVersionConsistency(REACT_LIBRARIES);
    expect(logger.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
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
}) {
  const { lockfile = 'pnpm-lock.yaml', packageDirs, packages } = config;

  mockExistsSync.mockImplementation((p: unknown) => {
    const pStr = String(p);

    // Lockfile detection at monorepo root
    if (pStr === path.join('/repo', lockfile)) return true;

    // Package directory package.json files
    for (const dir of packageDirs) {
      if (pStr === path.join(dir, 'package.json')) return true;
    }

    return false;
  });

  mockReadFileSync.mockImplementation((p: unknown) => {
    const pStr = String(p);

    for (const [dir, pkgJson] of Object.entries(packages)) {
      if (pStr === path.join(dir, 'package.json')) {
        return JSON.stringify(pkgJson);
      }
    }

    return '';
  });

  // fg.sync returns package.json paths for scanned directories (excluding root)
  mockFgSync.mockReturnValue(
    packageDirs.map((dir) => path.join(dir, 'package.json'))
  );
}
