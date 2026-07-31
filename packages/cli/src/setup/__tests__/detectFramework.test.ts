import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchForPackageJson } from '../../utils/packageJson.js';
import { detectFramework } from '../detectFramework.js';
import { getFrameworkDisplayName } from '../frameworkUtils.js';

vi.mock('../../utils/packageJson.js', () => ({
  isPackageInstalled: vi.fn(
    (name: string, packageJson: Record<string, unknown>) => {
      const dependencies = {
        ...(packageJson.devDependencies as Record<string, string>),
        ...(packageJson.dependencies as Record<string, string>),
      };
      return dependencies[name] !== undefined;
    }
  ),
  searchForPackageJson: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('detectFramework Vue support', () => {
  it('detects a Vite Vue app using the Vue plugin signal', async () => {
    vi.mocked(searchForPackageJson).mockResolvedValue(
      packageJson('vite', 'vue', '@vitejs/plugin-vue')
    );

    const result = await detectFramework();

    expect(result).toEqual({ name: 'vite-vue', type: 'vue' });
    if (result.name) {
      expect(getFrameworkDisplayName(result)).toBe('Vite + Vue');
    }
  });

  it('does not classify an ambiguous React and Vue root as Vue', async () => {
    vi.mocked(searchForPackageJson).mockResolvedValue(
      packageJson('vite', 'vue', 'react')
    );

    await expect(detectFramework()).resolves.toEqual({
      name: 'vite',
      type: 'react',
    });
  });

  it('uses an unambiguous Vue plugin in a hybrid dependency root', async () => {
    vi.mocked(searchForPackageJson).mockResolvedValue(
      packageJson('vite', 'vue', 'react', '@vitejs/plugin-vue')
    );

    await expect(detectFramework()).resolves.toEqual({
      name: 'vite-vue',
      type: 'vue',
    });
  });

  it('keeps a root with both Vite plugins on the existing React path', async () => {
    vi.mocked(searchForPackageJson).mockResolvedValue(
      packageJson(
        'vite',
        'vue',
        'react',
        '@vitejs/plugin-vue',
        '@vitejs/plugin-react'
      )
    );

    await expect(detectFramework()).resolves.toEqual({
      name: 'vite',
      type: 'react',
    });
  });
});

function packageJson(...dependencies: string[]): Record<string, unknown> {
  return {
    dependencies: Object.fromEntries(
      dependencies.map((dependency) => [dependency, '1.0.0'])
    ),
  };
}
