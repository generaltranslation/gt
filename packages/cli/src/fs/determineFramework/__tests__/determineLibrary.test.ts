import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Libraries } from '../../../types/libraries.js';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    realpathSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

vi.mock('fast-glob', () => ({
  default: {
    sync: vi.fn(),
  },
}));

vi.mock('../../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import fs from 'node:fs';
import fg from 'fast-glob';
import { determineLibrary } from '../index.js';
import {
  beginWorkspaceDiscoverySession,
  endWorkspaceDiscoverySession,
} from '../workspacePackages.js';
import { logger } from '../../../console/logger.js';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockRealpathSync = vi.mocked(fs.realpathSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockFgSync = vi.mocked(fg.sync);
const mockWarn = vi.mocked(logger.warn);

beforeEach(() => {
  vi.clearAllMocks();
  mockRealpathSync.mockImplementation((filePath) => String(filePath));
  vi.spyOn(process, 'cwd').mockReturnValue('/test-project');
});

describe('determineLibrary', () => {
  describe('JS detection (regression)', () => {
    it('detects gt-next from package.json dependencies', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ dependencies: { 'gt-next': '1.0.0' } })
      );

      const result = determineLibrary();
      expect(result.library).toBe(Libraries.GT_NEXT);
    });

    it('detects gt-react from package.json dependencies', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ dependencies: { 'gt-react': '1.0.0' } })
      );

      const result = determineLibrary();
      expect(result.library).toBe(Libraries.GT_REACT);
    });

    it('detects gt-vue from package.json dependencies', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ dependencies: { 'gt-vue': '1.0.0' } })
      );

      const result = determineLibrary();
      expect(result.library).toBe(Libraries.GT_VUE);
    });

    it('preserves gt-react priority in a hybrid dependency root', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: { 'gt-react': '1.0.0', 'gt-vue': '1.0.0' },
        })
      );

      const result = determineLibrary();
      expect(result.library).toBe(Libraries.GT_REACT);
      expect(result.additionalModules).toContain(Libraries.GT_VUE);
    });

    it('detects gt-vue declared as a peer dependency', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ peerDependencies: { 'gt-vue': '^0.1.0' } })
      );

      const result = determineLibrary();
      expect(result.library).toBe(Libraries.GT_VUE);
    });

    it('detects gt-vue declared as an optional dependency', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ optionalDependencies: { 'gt-vue': '^0.1.0' } })
      );

      const result = determineLibrary();
      expect(result.library).toBe(Libraries.GT_VUE);
    });

    it.each([
      Libraries.GT_NEXT,
      Libraries.GT_TANSTACK_START,
      Libraries.GT_REACT,
      Libraries.GT_REACT_NATIVE,
      Libraries.GT_NODE,
      'i18next',
      'next-intl',
    ] as const)(
      'does not widen root detection for a peer-only %s declaration',
      (library) => {
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(
          JSON.stringify({ peerDependencies: { [library]: '1.0.0' } })
        );

        expect(determineLibrary().library).toBe('base');
      }
    );

    it('detects gt-vue from npm and Yarn array workspaces', () => {
      mockExistsSync.mockImplementation(
        (filePath) => String(filePath) === '/test-project/package.json'
      );
      mockReadFileSync.mockImplementation((filePath) => {
        if (String(filePath) === '/test-project/package.json') {
          return JSON.stringify({ workspaces: ['packages/*'] });
        }
        return JSON.stringify({ dependencies: { 'gt-vue': '1.0.0' } });
      });
      mockFgSync.mockReturnValue(['/test-project/packages/web/package.json']);

      const result = determineLibrary();

      expect(result.library).toBe(Libraries.GT_VUE);
      expect(mockFgSync).toHaveBeenCalledWith(
        ['packages/*/package.json'],
        expect.objectContaining({
          cwd: '/test-project',
          followSymbolicLinks: false,
          ignore: ['**/node_modules/**'],
        })
      );
    });

    it('reuses workspace discovery during one CLI command', () => {
      mockExistsSync.mockImplementation(
        (filePath) => String(filePath) === '/test-project/package.json'
      );
      mockReadFileSync.mockImplementation((filePath) =>
        String(filePath) === '/test-project/package.json'
          ? JSON.stringify({ workspaces: ['apps/*'] })
          : JSON.stringify({ dependencies: { 'gt-vue': '1.0.0' } })
      );
      mockFgSync.mockReturnValue(['/test-project/apps/vue/package.json']);

      beginWorkspaceDiscoverySession();
      try {
        expect(determineLibrary().library).toBe(Libraries.GT_VUE);
        expect(determineLibrary().library).toBe(Libraries.GT_VUE);
      } finally {
        endWorkspaceDiscoverySession();
      }

      expect(mockFgSync).toHaveBeenCalledOnce();
    });

    it('accepts legal workspace directory names containing consecutive dots', () => {
      mockExistsSync.mockImplementation(
        (filePath) => String(filePath) === '/test-project/package.json'
      );
      mockReadFileSync.mockImplementation((filePath) =>
        String(filePath) === '/test-project/package.json'
          ? JSON.stringify({ workspaces: ['packages/foo..bar'] })
          : JSON.stringify({ dependencies: { 'gt-vue': '1.0.0' } })
      );
      mockFgSync.mockReturnValue([
        '/test-project/packages/foo..bar/package.json',
      ]);

      expect(determineLibrary().library).toBe(Libraries.GT_VUE);
      expect(mockFgSync).toHaveBeenCalledWith(
        ['packages/foo..bar/package.json'],
        expect.any(Object)
      );
    });

    it('preserves framework priority and mixed Vue handling across Yarn object workspaces', () => {
      mockExistsSync.mockImplementation(
        (filePath) => String(filePath) === '/test-project/package.json'
      );
      mockReadFileSync.mockImplementation((filePath) => {
        const filename = String(filePath);
        if (filename === '/test-project/package.json') {
          return JSON.stringify({
            workspaces: { packages: ['apps/*'] },
          });
        }
        if (filename.includes('/apps/react/')) {
          return JSON.stringify({ dependencies: { 'gt-react': '1.0.0' } });
        }
        return JSON.stringify({ dependencies: { 'gt-vue': '1.0.0' } });
      });
      mockFgSync.mockReturnValue([
        '/test-project/apps/vue/package.json',
        '/test-project/apps/react/package.json',
      ]);

      const result = determineLibrary();

      expect(result.library).toBe(Libraries.GT_REACT);
      expect(result.additionalModules).toContain(Libraries.GT_VUE);
    });

    it('preserves a root framework when a workspace declares a higher-priority framework', () => {
      mockExistsSync.mockImplementation(
        (filePath) => String(filePath) === '/test-project/package.json'
      );
      mockReadFileSync.mockImplementation((filePath) => {
        if (String(filePath) === '/test-project/package.json') {
          return JSON.stringify({
            workspaces: ['apps/*'],
            dependencies: {
              'gt-react': '1.0.0',
              'gt-tanstack-start': '1.0.0',
            },
          });
        }
        return JSON.stringify({ dependencies: { 'gt-next': '1.0.0' } });
      });
      mockFgSync.mockReturnValue(['/test-project/apps/next/package.json']);

      expect(determineLibrary().library).toBe(Libraries.GT_TANSTACK_START);
    });

    it.each([
      {
        fallbackField: 'peerDependencies',
        primaryField: 'dependencies',
      },
      {
        fallbackField: 'optionalDependencies',
        primaryField: 'devDependencies',
      },
    ] as const)(
      'prefers a runtime in $primaryField over a higher-priority declaration in $fallbackField',
      ({ fallbackField, primaryField }) => {
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(
          JSON.stringify({
            [fallbackField]: { 'gt-next': '1.0.0' },
            [primaryField]: { 'gt-tanstack-start': '1.0.0' },
          })
        );

        expect(determineLibrary().library).toBe(Libraries.GT_TANSTACK_START);
      }
    );

    it('does not promote a workspace-only React framework into the root CLI', () => {
      mockExistsSync.mockImplementation(
        (filePath) => String(filePath) === '/test-project/package.json'
      );
      mockReadFileSync.mockImplementation((filePath) =>
        String(filePath) === '/test-project/package.json'
          ? JSON.stringify({ workspaces: ['apps/*'] })
          : JSON.stringify({ dependencies: { 'gt-next': '1.0.0' } })
      );
      mockFgSync.mockReturnValue(['/test-project/apps/next/package.json']);

      expect(determineLibrary()).toEqual({
        library: 'base',
        additionalModules: [],
      });
    });

    it('does not enable inline mode for a React-only workspace aggregator', () => {
      mockExistsSync.mockImplementation(
        (filePath) => String(filePath) === '/test-project/package.json'
      );
      mockReadFileSync.mockImplementation((filePath) => {
        const filename = String(filePath);
        if (filename === '/test-project/package.json') {
          return JSON.stringify({ workspaces: ['apps/*'] });
        }
        return filename.includes('/next/')
          ? JSON.stringify({ dependencies: { 'gt-next': '1.0.0' } })
          : JSON.stringify({ dependencies: { 'gt-tanstack-start': '1.0.0' } });
      });
      mockFgSync.mockReturnValue([
        '/test-project/apps/next/package.json',
        '/test-project/apps/tanstack/package.json',
      ]);

      expect(determineLibrary()).toEqual({
        library: 'base',
        additionalModules: [],
      });
    });

    it.each(['i18next', 'next-intl'] as const)(
      'does not let workspace-only %s change root file semantics',
      (library) => {
        mockExistsSync.mockImplementation(
          (filePath) => String(filePath) === '/test-project/package.json'
        );
        mockReadFileSync.mockImplementation((filePath) =>
          String(filePath) === '/test-project/package.json'
            ? JSON.stringify({ workspaces: ['apps/*'] })
            : JSON.stringify({ dependencies: { [library]: '1.0.0' } })
        );
        mockFgSync.mockReturnValue([
          `/test-project/apps/${library}/package.json`,
        ]);

        expect(determineLibrary()).toEqual({
          library: 'base',
          additionalModules: [],
        });
      }
    );

    it('preserves a root runtime when optional workspace traversal fails', () => {
      mockExistsSync.mockImplementation(
        (filePath) => String(filePath) === '/test-project/package.json'
      );
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: { 'gt-react': '1.0.0' },
          workspaces: ['apps/*'],
        })
      );
      mockFgSync.mockImplementation(() => {
        throw new Error('EACCES');
      });

      expect(determineLibrary()).toEqual({
        library: Libraries.GT_REACT,
        additionalModules: [],
      });
    });

    it('treats an empty pnpm package list as authoritative', () => {
      mockExistsSync.mockImplementation((filePath) =>
        [
          '/test-project/package.json',
          '/test-project/pnpm-workspace.yaml',
        ].includes(String(filePath))
      );
      mockReadFileSync.mockImplementation((filePath) =>
        String(filePath).endsWith('pnpm-workspace.yaml')
          ? 'packages: []\n'
          : JSON.stringify({ workspaces: ['stale'] })
      );

      expect(determineLibrary().library).toBe('base');
      expect(mockFgSync).not.toHaveBeenCalled();
    });

    it('treats a catalog-only pnpm workspace as root-only', () => {
      mockExistsSync.mockImplementation((filePath) =>
        [
          '/test-project/package.json',
          '/test-project/pnpm-workspace.yaml',
        ].includes(String(filePath))
      );
      mockReadFileSync.mockImplementation((filePath) =>
        String(filePath).endsWith('pnpm-workspace.yaml')
          ? "catalog:\n  vue: '^3.5.0'\n"
          : JSON.stringify({ workspaces: ['stale'] })
      );
      mockFgSync.mockReturnValue(['/test-project/stale/package.json']);

      expect(determineLibrary().library).toBe('base');
      expect(mockFgSync).not.toHaveBeenCalled();
    });

    it.each(['# root-only workspace\n', 'packages: null\n'])(
      'treats root-only pnpm content as authoritative: %s',
      (workspaceYaml) => {
        mockExistsSync.mockImplementation((filePath) =>
          [
            '/test-project/package.json',
            '/test-project/pnpm-workspace.yaml',
          ].includes(String(filePath))
        );
        mockReadFileSync.mockImplementation((filePath) =>
          String(filePath).endsWith('pnpm-workspace.yaml')
            ? workspaceYaml
            : JSON.stringify({ workspaces: ['stale'] })
        );
        mockFgSync.mockReturnValue(['/test-project/stale/package.json']);

        expect(determineLibrary().library).toBe('base');
        expect(mockFgSync).not.toHaveBeenCalled();
      }
    );

    it('uses pnpm workspace patterns instead of stale package.json patterns', () => {
      mockExistsSync.mockImplementation((filePath) =>
        [
          '/test-project/package.json',
          '/test-project/pnpm-workspace.yaml',
        ].includes(String(filePath))
      );
      mockReadFileSync.mockImplementation((filePath) => {
        const filename = String(filePath);
        if (filename.endsWith('pnpm-workspace.yaml')) {
          return "packages:\n  - 'apps/*'\n";
        }
        if (filename === '/test-project/package.json') {
          return JSON.stringify({ workspaces: ['stale'] });
        }
        return JSON.stringify({ dependencies: { 'gt-vue': '1.0.0' } });
      });
      mockFgSync.mockReturnValue(['/test-project/apps/vue/package.json']);

      expect(determineLibrary().library).toBe(Libraries.GT_VUE);
      expect(mockFgSync).toHaveBeenCalledWith(
        ['apps/*/package.json'],
        expect.any(Object)
      );
    });

    it('detects gt-vue from pnpm workspace declarations', () => {
      mockExistsSync.mockImplementation((filePath) =>
        [
          '/test-project/package.json',
          '/test-project/pnpm-workspace.yaml',
        ].includes(String(filePath))
      );
      mockReadFileSync.mockImplementation((filePath) => {
        const filename = String(filePath);
        if (filename.endsWith('pnpm-workspace.yaml')) {
          return "packages:\n  - 'apps/*'\n  - '!apps/legacy'\n";
        }
        if (filename === '/test-project/package.json') {
          return JSON.stringify({ devDependencies: { gt: '1.0.0' } });
        }
        return JSON.stringify({ peerDependencies: { 'gt-vue': '^0.1.0' } });
      });
      mockFgSync.mockReturnValue(['/test-project/apps/web/package.json']);

      const result = determineLibrary();

      expect(result.library).toBe(Libraries.GT_VUE);
      expect(mockFgSync).toHaveBeenCalledWith(
        ['apps/*/package.json', '!apps/legacy/package.json'],
        expect.any(Object)
      );
    });

    it('does not scan when declared workspace patterns have no matches', () => {
      mockExistsSync.mockImplementation(
        (filePath) => String(filePath) === '/test-project/package.json'
      );
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ workspaces: ['packages/*'] })
      );
      mockFgSync.mockReturnValue([]);

      expect(determineLibrary().library).toBe('base');
      expect(mockFgSync).toHaveBeenCalledOnce();
    });

    it('ignores malformed and missing workspace manifests without losing root detection', () => {
      mockExistsSync.mockImplementation(
        (filePath) => String(filePath) === '/test-project/package.json'
      );
      mockReadFileSync.mockImplementation((filePath) => {
        const filename = String(filePath);
        if (filename === '/test-project/package.json') {
          return JSON.stringify({
            dependencies: { 'gt-node': '1.0.0' },
            workspaces: ['packages/*'],
          });
        }
        if (filename.includes('/malformed/')) return '{"dependencies": [';
        throw new Error('missing package manifest');
      });
      mockFgSync.mockReturnValue([
        '/test-project/packages/malformed/package.json',
        '/test-project/packages/missing/package.json',
      ]);

      expect(determineLibrary().library).toBe(Libraries.GT_NODE);
    });

    it('ignores malformed pnpm workspace configuration', () => {
      mockExistsSync.mockImplementation((filePath) =>
        [
          '/test-project/package.json',
          '/test-project/pnpm-workspace.yaml',
        ].includes(String(filePath))
      );
      mockReadFileSync.mockImplementation((filePath) =>
        String(filePath).endsWith('pnpm-workspace.yaml')
          ? 'packages: [unterminated'
          : JSON.stringify({ dependencies: { express: '4.0.0' } })
      );

      expect(determineLibrary().library).toBe('base');
      expect(mockFgSync).not.toHaveBeenCalled();
    });

    it('rejects workspace patterns and matches outside the root or under node_modules', () => {
      mockExistsSync.mockImplementation(
        (filePath) => String(filePath) === '/test-project/package.json'
      );
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          workspaces: ['../outside/*', 'node_modules/*'],
        })
      );
      mockFgSync.mockReturnValue([
        '/outside/hidden/package.json',
        '/test-project/node_modules/hidden/package.json',
      ]);

      expect(determineLibrary().library).toBe('base');
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('rejects Windows paths, glob traversal, and symlink targets outside the root', () => {
      mockExistsSync.mockImplementation(
        (filePath) => String(filePath) === '/test-project/package.json'
      );
      mockReadFileSync.mockImplementation((filePath) => {
        if (String(filePath) === '/test-project/package.json') {
          return JSON.stringify({
            workspaces: [
              'C:\\outside\\*',
              '{../outside,packages}/*',
              'packages/*',
            ],
          });
        }
        return JSON.stringify({ dependencies: { 'gt-vue': '1.0.0' } });
      });
      mockFgSync.mockReturnValue([
        '/test-project/packages/symlink/package.json',
      ]);
      mockRealpathSync.mockImplementation((filePath) =>
        String(filePath).includes('/packages/symlink/')
          ? '/outside/package.json'
          : String(filePath)
      );

      expect(determineLibrary().library).toBe('base');
      expect(mockFgSync).toHaveBeenCalledWith(
        ['packages/*/package.json'],
        expect.any(Object)
      );
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('ignores malformed workspace declarations instead of scanning recursively', () => {
      mockExistsSync.mockImplementation(
        (filePath) => String(filePath) === '/test-project/package.json'
      );
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ workspaces: { packages: 'packages/*' } })
      );

      expect(determineLibrary().library).toBe('base');
      expect(mockFgSync).not.toHaveBeenCalled();
    });

    it('detects gt-node from package.json dependencies', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ dependencies: { 'gt-node': '1.0.0' } })
      );

      const result = determineLibrary();
      expect(result.library).toBe(Libraries.GT_NODE);
    });

    it('preserves gt-node extraction when Vue is the primary framework', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: { 'gt-node': '1.0.0', 'gt-vue': '1.0.0' },
        })
      );

      expect(determineLibrary()).toEqual({
        library: Libraries.GT_VUE,
        additionalModules: [Libraries.GT_NODE],
      });
    });

    it.each([
      Libraries.GT_NEXT,
      Libraries.GT_TANSTACK_START,
      Libraries.GT_REACT,
      Libraries.GT_REACT_NATIVE,
    ])(
      'preserves gt-node extraction when %s is primary alongside Vue',
      (primaryLibrary) => {
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(
          JSON.stringify({
            dependencies: {
              [primaryLibrary]: '1.0.0',
              'gt-node': '1.0.0',
              'gt-vue': '1.0.0',
            },
          })
        );

        expect(determineLibrary()).toEqual({
          library: primaryLibrary,
          additionalModules: [Libraries.GT_NODE, Libraries.GT_VUE],
        });
      }
    );

    it("returns 'base' when package.json has no GT dependencies", () => {
      mockExistsSync.mockImplementation((path) => {
        if (String(path).endsWith('package.json')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ dependencies: { express: '4.0.0' } })
      );

      const result = determineLibrary();
      expect(result.library).toBe('base');
    });

    it("returns 'base' without warning when no JS or Python project file exists", () => {
      mockExistsSync.mockReturnValue(false);

      const result = determineLibrary();

      expect(result.library).toBe('base');
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it('detects i18next-icu as additional module', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: { 'gt-react': '1.0.0', 'i18next-icu': '2.0.0' },
        })
      );

      const result = determineLibrary();
      expect(result.additionalModules).toContain('i18next-icu');
    });
  });

  describe('Python detection (integration)', () => {
    it('prefers a root Python framework over a workspace JS framework', () => {
      mockExistsSync.mockImplementation((filePath) =>
        ['/test-project/package.json', '/test-project/pyproject.toml'].includes(
          String(filePath)
        )
      );
      mockReadFileSync.mockImplementation((filePath) => {
        const filename = String(filePath);
        if (filename === '/test-project/package.json') {
          return JSON.stringify({ workspaces: ['apps/*'] });
        }
        if (filename === '/test-project/pyproject.toml') {
          return '[project]\ndependencies = ["gt-flask"]';
        }
        return JSON.stringify({ dependencies: { 'gt-next': '1.0.0' } });
      });
      mockFgSync.mockReturnValue(['/test-project/apps/next/package.json']);

      expect(determineLibrary()).toEqual({
        library: Libraries.GT_FLASK,
        additionalModules: [],
      });
    });

    it('preserves a root i18next-icu module when Python is primary', () => {
      mockExistsSync.mockImplementation((filePath) =>
        ['/test-project/package.json', '/test-project/pyproject.toml'].includes(
          String(filePath)
        )
      );
      mockReadFileSync.mockImplementation((filePath) =>
        String(filePath) === '/test-project/package.json'
          ? JSON.stringify({ dependencies: { 'i18next-icu': '2.0.0' } })
          : '[project]\ndependencies = ["gt-flask"]'
      );

      expect(determineLibrary()).toEqual({
        library: Libraries.GT_FLASK,
        additionalModules: ['i18next-icu'],
      });
    });

    it('detects gt-flask from pyproject.toml', () => {
      mockExistsSync.mockImplementation((path) => {
        if (String(path).endsWith('pyproject.toml')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(`[project]
dependencies = [
  "gt-flask>=1.0.0",
  "flask",
]
`);

      const result = determineLibrary();
      expect(result.library).toBe(Libraries.GT_FLASK);
    });

    it('detects gt-flask from requirements.txt', () => {
      mockExistsSync.mockImplementation((path) => {
        if (String(path).endsWith('requirements.txt')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue('flask\ngt-flask>=1.0.0\nrequests\n');

      const result = determineLibrary();
      expect(result.library).toBe(Libraries.GT_FLASK);
    });

    it('detects gt-fastapi from setup.py', () => {
      mockExistsSync.mockImplementation((path) => {
        if (String(path).endsWith('setup.py')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(`
from setuptools import setup
setup(
    name="myapp",
    install_requires=["gt-fastapi>=1.0.0", "uvicorn"],
)
`);

      const result = determineLibrary();
      expect(result.library).toBe(Libraries.GT_FASTAPI);
    });

    it('prefers JS package.json detection over Python', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation((path) => {
        if (String(path).endsWith('package.json')) {
          return JSON.stringify({ dependencies: { 'gt-react': '1.0.0' } });
        }
        if (String(path).endsWith('pyproject.toml')) {
          return '[project]\ndependencies = ["gt-flask"]';
        }
        return '';
      });

      const result = determineLibrary();
      expect(result.library).toBe(Libraries.GT_REACT);
    });

    it('falls through pyproject.toml -> requirements.txt -> setup.py', () => {
      mockExistsSync.mockImplementation((path) => {
        if (String(path).endsWith('pyproject.toml')) return true;
        if (String(path).endsWith('requirements.txt')) return true;
        if (String(path).endsWith('setup.py')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((path) => {
        if (String(path).endsWith('pyproject.toml')) {
          return '[project]\ndependencies = ["flask"]';
        }
        if (String(path).endsWith('requirements.txt')) {
          return 'flask\ngt-flask\n';
        }
        return '';
      });

      const result = determineLibrary();
      expect(result.library).toBe(Libraries.GT_FLASK);
    });

    it("returns 'base' when Python dep files exist but contain no GT packages", () => {
      mockExistsSync.mockImplementation((path) => {
        if (String(path).endsWith('pyproject.toml')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(
        '[project]\ndependencies = ["flask", "sqlalchemy"]'
      );

      const result = determineLibrary();
      expect(result.library).toBe('base');
    });
  });
});
