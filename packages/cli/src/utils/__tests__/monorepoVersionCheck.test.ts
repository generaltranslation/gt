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

  it('should silently return if not in a monorepo', () => {
    mockExistsSync.mockReturnValue(false);
    checkMonorepoVersionConsistency();
    expect(process.exit).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should silently return if only one workspace exists', () => {
    // Walk up: /repo/packages/app-a -> /repo/packages -> /repo
    mockExistsSync.mockImplementation((p: any) => {
      if (p === '/repo/pnpm-workspace.yaml') return true;
      return false;
    });

    mockReadFileSync.mockImplementation((p: any) => {
      if (p === '/repo/pnpm-workspace.yaml') {
        return 'packages:\n  - "packages/*"\n';
      }
      return '';
    });

    // Only one workspace found
    mockFgSync.mockReturnValue(['/repo/packages/app-a/package.json']);

    checkMonorepoVersionConsistency();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('should silently return when all GT package versions match', () => {
    setupMonorepoMocks({
      workspaces: ['/repo/packages/app-a', '/repo/packages/app-b'],
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
    setupMonorepoMocks({
      workspaces: ['/repo/packages/app-a', '/repo/packages/app-b'],
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
    setupMonorepoMocks({
      workspaces: ['/repo/packages/app-a', '/repo/packages/app-b'],
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

  it('should ignore workspaces that do not depend on GT packages', () => {
    setupMonorepoMocks({
      workspaces: ['/repo/packages/app-a', '/repo/packages/utils'],
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

  it('should detect monorepo root via package.json workspaces (npm/yarn style)', () => {
    mockExistsSync.mockImplementation((p: any) => {
      const pStr = String(p);
      // No pnpm-workspace.yaml anywhere
      if (pStr.endsWith('pnpm-workspace.yaml')) return false;
      // Monorepo root has package.json with workspaces
      if (pStr === '/repo/package.json') return true;
      // Workspace package.json files
      if (pStr === '/repo/packages/app-a/package.json') return true;
      if (pStr === '/repo/packages/app-b/package.json') return true;
      // Installed versions
      if (
        pStr ===
        '/repo/packages/app-a/node_modules/gt-react/package.json'
      )
        return true;
      if (
        pStr ===
        '/repo/packages/app-b/node_modules/gt-react/package.json'
      )
        return true;
      return false;
    });

    mockReadFileSync.mockImplementation((p: any) => {
      const pStr = String(p);
      if (pStr === '/repo/package.json') {
        return JSON.stringify({
          name: 'my-monorepo',
          workspaces: ['packages/*'],
        });
      }
      if (pStr === '/repo/packages/app-a/package.json') {
        return JSON.stringify({
          name: 'app-a',
          dependencies: { 'gt-react': '^10.5.0' },
        });
      }
      if (pStr === '/repo/packages/app-b/package.json') {
        return JSON.stringify({
          name: 'app-b',
          dependencies: { 'gt-react': '^10.11.0' },
        });
      }
      if (
        pStr ===
        '/repo/packages/app-a/node_modules/gt-react/package.json'
      ) {
        return JSON.stringify({ name: 'gt-react', version: '10.5.3' });
      }
      if (
        pStr ===
        '/repo/packages/app-b/node_modules/gt-react/package.json'
      ) {
        return JSON.stringify({ name: 'gt-react', version: '10.11.7' });
      }
      return '';
    });

    mockFgSync.mockReturnValue([
      '/repo/packages/app-a/package.json',
      '/repo/packages/app-b/package.json',
    ]);

    checkMonorepoVersionConsistency();
    expect(logger.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should handle yarn-style workspaces.packages field', () => {
    mockExistsSync.mockImplementation((p: any) => {
      const pStr = String(p);
      if (pStr.endsWith('pnpm-workspace.yaml')) return false;
      if (pStr === '/repo/package.json') return true;
      if (pStr === '/repo/packages/app-a/package.json') return true;
      if (pStr === '/repo/packages/app-b/package.json') return true;
      if (
        pStr ===
        '/repo/packages/app-a/node_modules/gt-next/package.json'
      )
        return true;
      if (
        pStr ===
        '/repo/packages/app-b/node_modules/gt-next/package.json'
      )
        return true;
      return false;
    });

    mockReadFileSync.mockImplementation((p: any) => {
      const pStr = String(p);
      if (pStr === '/repo/package.json') {
        return JSON.stringify({
          name: 'my-monorepo',
          workspaces: { packages: ['packages/*'] },
        });
      }
      if (pStr === '/repo/packages/app-a/package.json') {
        return JSON.stringify({
          name: 'app-a',
          dependencies: { 'gt-next': '^6.10.0' },
        });
      }
      if (pStr === '/repo/packages/app-b/package.json') {
        return JSON.stringify({
          name: 'app-b',
          dependencies: { 'gt-next': '^6.13.0' },
        });
      }
      if (
        pStr ===
        '/repo/packages/app-a/node_modules/gt-next/package.json'
      ) {
        return JSON.stringify({ name: 'gt-next', version: '6.10.2' });
      }
      if (
        pStr ===
        '/repo/packages/app-b/node_modules/gt-next/package.json'
      ) {
        return JSON.stringify({ name: 'gt-next', version: '6.13.8' });
      }
      return '';
    });

    mockFgSync.mockReturnValue([
      '/repo/packages/app-a/package.json',
      '/repo/packages/app-b/package.json',
    ]);

    checkMonorepoVersionConsistency();
    expect(logger.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should silently return if pnpm-workspace.yaml is malformed', () => {
    mockExistsSync.mockImplementation((p: any) => {
      const pStr = String(p);
      if (pStr === '/repo/pnpm-workspace.yaml') return true;
      // No package.json with workspaces fallback
      if (pStr === '/repo/package.json') return true;
      return false;
    });

    mockReadFileSync.mockImplementation((p: any) => {
      const pStr = String(p);
      if (pStr === '/repo/pnpm-workspace.yaml') {
        return '{{{{not valid yaml at all';
      }
      if (pStr === '/repo/package.json') {
        // No workspaces field — so no fallback
        return JSON.stringify({ name: 'my-repo' });
      }
      return '';
    });

    checkMonorepoVersionConsistency();
    expect(process.exit).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should pass negation globs as ignore patterns to fast-glob', () => {
    mockExistsSync.mockImplementation((p: any) => {
      const pStr = String(p);
      if (pStr === '/repo/pnpm-workspace.yaml') return true;
      return false;
    });

    mockReadFileSync.mockImplementation((p: any) => {
      const pStr = String(p);
      if (pStr === '/repo/pnpm-workspace.yaml') {
        return 'packages:\n  - "packages/*"\n  - "!packages/internal"\n';
      }
      return '';
    });

    mockFgSync.mockReturnValue([]);

    checkMonorepoVersionConsistency();

    expect(mockFgSync).toHaveBeenCalledWith(
      ['packages/*/package.json'],
      expect.objectContaining({
        ignore: ['**/node_modules/**', 'packages/internal/package.json'],
      })
    );
  });

  it('should group multiple workspaces with the same version together', () => {
    setupMonorepoMocks({
      workspaces: [
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
    // Both app-b and app-c should be grouped under the same version
    expect(errorMessage).toContain('app-b');
    expect(errorMessage).toContain('app-c');
    expect(errorMessage).toContain('app-a');
  });
});

// Helper to set up common mock patterns
function setupMonorepoMocks(config: {
  workspaces: string[];
  packages: Record<string, any>;
  installedVersions: Record<string, Record<string, string>>;
}) {
  const { workspaces, packages, installedVersions } = config;

  mockExistsSync.mockImplementation((p: any) => {
    const pStr = String(p);

    // Monorepo root detection: walk up from cwd
    if (pStr === '/repo/pnpm-workspace.yaml') return true;

    // Workspace package.json files
    for (const ws of workspaces) {
      if (pStr === path.join(ws, 'package.json')) return true;
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

  mockReadFileSync.mockImplementation((p: any) => {
    const pStr = String(p);

    if (pStr === '/repo/pnpm-workspace.yaml') {
      return 'packages:\n  - "packages/*"\n';
    }

    // Workspace package.json files
    for (const [wsDir, pkgJson] of Object.entries(packages)) {
      if (pStr === path.join(wsDir, 'package.json')) {
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

  mockFgSync.mockReturnValue(
    workspaces.map((ws) => path.join(ws, 'package.json'))
  );
}
