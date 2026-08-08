import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Libraries } from '../../../types/libraries.js';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

vi.mock('../../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import fs from 'node:fs';
import { determineLibrary } from '../index.js';
import { logger } from '../../../console/logger.js';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockWarn = vi.mocked(logger.warn);

beforeEach(() => {
  vi.clearAllMocks();
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

    it('detects gt-node from package.json dependencies', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ dependencies: { 'gt-node': '1.0.0' } })
      );

      const result = determineLibrary();
      expect(result.library).toBe(Libraries.GT_NODE);
    });

    it('detects gt-vue from root dependencies', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ dependencies: { 'gt-vue': '0.1.0' } })
      );

      const result = determineLibrary();
      expect(result.library).toBe(Libraries.GT_VUE);
    });

    it('detects gt-vue from root devDependencies', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ devDependencies: { 'gt-vue': '0.1.0' } })
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
      'next-intl',
      'i18next',
    ])('keeps the existing %s priority over gt-vue', (library) => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: { [library]: '1.0.0', 'gt-vue': '0.1.0' },
        })
      );

      const result = determineLibrary();
      expect(result.library).toBe(library);
    });

    it('does not detect gt-vue from peer or optional dependencies', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          peerDependencies: { 'gt-vue': '^0.1.0' },
          optionalDependencies: { 'gt-vue': '0.1.0' },
        })
      );

      const result = determineLibrary();
      expect(result.library).toBe('base');
    });

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

    it.each([
      [
        'pyproject.toml',
        '[project]\ndependencies = ["gt-flask"]',
        Libraries.GT_FLASK,
      ],
      ['requirements.txt', 'gt-fastapi', Libraries.GT_FASTAPI],
    ])(
      'keeps Python detection ahead of gt-vue using %s',
      (pythonFile, pythonManifest, expectedLibrary) => {
        mockExistsSync.mockImplementation((filepath) => {
          const value = String(filepath);
          return value.endsWith('package.json') || value.endsWith(pythonFile);
        });
        mockReadFileSync.mockImplementation((filepath) =>
          String(filepath).endsWith('package.json')
            ? JSON.stringify({ dependencies: { 'gt-vue': '0.1.0' } })
            : pythonManifest
        );

        const result = determineLibrary();

        expect(result.library).toBe(expectedLibrary);
      }
    );

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
