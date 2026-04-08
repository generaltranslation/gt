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

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);

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
