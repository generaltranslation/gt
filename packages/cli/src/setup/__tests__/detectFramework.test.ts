import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchForPackageJson } from '../../utils/packageJson.js';
import { detectFramework } from '../detectFramework.js';
import { getFrameworkDisplayName } from '../frameworkUtils.js';

vi.mock('../../utils/packageJson.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/packageJson.js')>()),
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

  it('detects Nuxt without requiring a direct Vite dependency', async () => {
    vi.mocked(searchForPackageJson).mockResolvedValue(
      packageJson('nuxt', 'vue')
    );

    const result = await detectFramework();

    expect(result).toEqual({ name: 'nuxt', type: 'vue' });
    if (result.name) {
      expect(getFrameworkDisplayName(result)).toBe('Nuxt');
    }
  });

  it('detects Nuxt without requiring a direct Vue dependency', async () => {
    vi.mocked(searchForPackageJson).mockResolvedValue(packageJson('nuxt'));

    await expect(detectFramework()).resolves.toEqual({
      name: 'nuxt',
      type: 'vue',
    });
  });

  it('detects Nuxt without interpreting dependency ranges', async () => {
    vi.mocked(searchForPackageJson).mockResolvedValue({
      dependencies: { nuxt: 'workspace:*', vue: 'catalog:' },
    });

    await expect(detectFramework()).resolves.toEqual({
      name: 'nuxt',
      type: 'vue',
    });
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

  it('recognizes the React SWC plugin in a hybrid Vite root', async () => {
    vi.mocked(searchForPackageJson).mockResolvedValue(
      packageJson(
        'vite',
        'vue',
        'react',
        '@vitejs/plugin-vue',
        '@vitejs/plugin-react-swc'
      )
    );

    await expect(detectFramework()).resolves.toEqual({
      name: 'vite',
      type: 'react',
    });
  });
});

describe('detectFramework dependency compatibility', () => {
  it.each(['peerDependencies', 'optionalDependencies'] as const)(
    'does not let Next.js in %s override an installed Vite React app',
    async (field) => {
      vi.mocked(searchForPackageJson).mockResolvedValue({
        dependencies: { react: '^19.0.0', vite: '^7.0.0' },
        [field]: { next: '^16.0.0' },
      });

      await expect(detectFramework()).resolves.toEqual({
        name: 'vite',
        type: 'react',
      });
    }
  );

  it.each(['gatsby', '@redwoodjs/core', 'nuxt'])(
    'does not treat a peer-only %s declaration as installed',
    async (frameworkPackage) => {
      vi.mocked(searchForPackageJson).mockResolvedValue({
        dependencies: { react: '^19.0.0', vite: '^7.0.0' },
        peerDependencies: { [frameworkPackage]: '*' },
      });

      await expect(detectFramework()).resolves.toEqual({
        name: 'vite',
        type: 'react',
      });
    }
  );

  it('continues to detect Next.js from installed dependencies', async () => {
    vi.mocked(searchForPackageJson).mockResolvedValue({
      dependencies: { next: '^16.0.0', react: '^19.0.0' },
    });

    await expect(detectFramework()).resolves.toEqual({
      name: 'next-app',
      type: 'react',
    });
  });

  it.each(['peerDependencies', 'optionalDependencies'] as const)(
    'detects a Vite Vue library with Vue in %s',
    async (field) => {
      vi.mocked(searchForPackageJson).mockResolvedValue({
        devDependencies: { vite: '^7.0.0' },
        [field]: { vue: '^3.5.0' },
      });

      await expect(detectFramework()).resolves.toEqual({
        name: 'vite-vue',
        type: 'vue',
      });
    }
  );

  it('does not let peer-only Vue signals reclassify an installed React app', async () => {
    vi.mocked(searchForPackageJson).mockResolvedValue({
      dependencies: { react: '^19.0.0', vite: '^7.0.0' },
      peerDependencies: {
        '@vitejs/plugin-vue': '^6.0.0',
        vue: '^3.5.0',
      },
    });

    await expect(detectFramework()).resolves.toEqual({
      name: 'vite',
      type: 'react',
    });
  });

  it('does not prefer Vue when both frameworks are peer dependencies', async () => {
    vi.mocked(searchForPackageJson).mockResolvedValue({
      devDependencies: { vite: '^7.0.0' },
      peerDependencies: { react: '^19.0.0', vue: '^3.5.0' },
    });

    await expect(detectFramework()).resolves.toEqual({
      name: 'vite',
      type: 'react',
    });
  });

  it('uses an unopposed Vue plugin for a dual-peer Vue library', async () => {
    vi.mocked(searchForPackageJson).mockResolvedValue({
      devDependencies: {
        '@vitejs/plugin-vue': '^6.0.0',
        vite: '^7.0.0',
      },
      peerDependencies: { react: '^19.0.0', vue: '^3.5.0' },
    });

    await expect(detectFramework()).resolves.toEqual({
      name: 'vite-vue',
      type: 'vue',
    });
  });

  it('honors an installed React plugin when React is peer-only', async () => {
    vi.mocked(searchForPackageJson).mockResolvedValue({
      devDependencies: {
        '@vitejs/plugin-react-swc': '^4.0.0',
        vite: '^7.0.0',
        vue: '^3.5.0',
      },
      peerDependencies: { react: '^19.0.0' },
    });

    await expect(detectFramework()).resolves.toEqual({
      name: 'vite',
      type: 'react',
    });
  });
});

function packageJson(...dependencies: string[]): Record<string, unknown> {
  return {
    dependencies: Object.fromEntries(
      dependencies.map((dependency) => [
        dependency,
        dependency === 'nuxt'
          ? '^4.0.0'
          : dependency === 'vue'
            ? '^3.5.0'
            : '1.0.0',
      ])
    ),
  };
}
