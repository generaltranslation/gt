import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectArtifact } from './artifact.mjs';
import { nativeOperations } from './io.mjs';

afterEach(() => vi.unstubAllGlobals());

describe('native release adapters', () => {
  it('treats files in the packages directory as non-package entries', async () => {
    const ops = nativeOperations();
    const root = await ops.temporaryDirectory();
    await fs.writeFile(path.join(root, 'README.md'), 'Package documentation');
    expect(await ops.exists(path.join(root, 'README.md/package.json'))).toBe(
      false
    );
    expect(await ops.exists(path.join(root, 'absent/package.json'))).toBe(
      false
    );
  });

  it('packs a real workspace dependency without running package scripts', async () => {
    const ops = nativeOperations();
    const root = await ops.temporaryDirectory();
    const appDirectory = path.join(root, 'packages/app');
    const coreDirectory = path.join(root, 'packages/core');
    await fs.mkdir(path.join(appDirectory, 'dist'), { recursive: true });
    await fs.mkdir(coreDirectory, { recursive: true });
    await fs.mkdir(path.join(appDirectory, 'node_modules/@fixture'), {
      recursive: true,
    });
    await fs.symlink(
      coreDirectory,
      path.join(appDirectory, 'node_modules/@fixture/core'),
      'dir'
    );
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ private: true, packageManager: 'pnpm@10.20.0' })
    );
    await fs.writeFile(
      path.join(root, 'pnpm-workspace.yaml'),
      "packages:\n  - 'packages/*'\n"
    );
    const source = {
      name: '@fixture/app',
      version: '1.0.0-auto-jsx.0',
      main: './dist/index.js',
      files: ['dist'],
      exports: { '.': './dist/index.js' },
      dependencies: { '@fixture/core': 'workspace:*' },
      scripts: {
        prepack: 'node -e "throw new Error(\'prepack must not run\')"',
        prepare: 'node -e "throw new Error(\'prepare must not run\')"',
      },
    };
    const core = { name: '@fixture/core', version: '2.0.0' };
    await fs.writeFile(
      path.join(appDirectory, 'package.json'),
      JSON.stringify(source)
    );
    await fs.writeFile(
      path.join(coreDirectory, 'package.json'),
      JSON.stringify(core)
    );
    await fs.writeFile(
      path.join(appDirectory, 'dist/index.js'),
      'export const fixture = true;\n'
    );
    const tarball = path.join(root, 'fixture.tgz');
    await ops.run(
      'pnpm',
      ['--config.ignore-scripts=true', 'pack', '--out', tarball, '--json'],
      { cwd: appDirectory }
    );
    const artifact = await inspectArtifact(
      ops,
      tarball,
      source,
      new Map([
        [source.name, { manifest: source }],
        [core.name, { manifest: core }],
      ])
    );
    expect(artifact.manifest.dependencies).toEqual({
      '@fixture/core': '2.0.0',
    });
    expect(artifact.integrity).toMatch(/^sha512-/);
    expect(await ops.exists(tarball)).toBe(true);
  });

  it('uses only the npm registry and returns absent packages only for 404', async () => {
    const fetch = vi.fn().mockResolvedValue({ status: 404 });
    vi.stubGlobal('fetch', fetch);
    expect(await nativeOperations().registry('@fixture/app')).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      'https://registry.npmjs.org/%40fixture%2Fapp',
      expect.objectContaining({
        headers: { accept: 'application/vnd.npm.install-v1+json' },
      })
    );
  });

  it.each([401, 403, 429, 500])(
    'fails closed on registry HTTP %s',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status, ok: false }));
      await expect(nativeOperations().registry('gt-next')).rejects.toThrow(
        `HTTP ${status}`
      );
    }
  );

  it.each([
    { name: 'wrong-package', versions: {} },
    { name: 'gt-next', versions: [] },
    { name: 'gt-next' },
  ])('rejects malformed registry metadata %j', async (metadata) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => metadata })
    );
    await expect(nativeOperations().registry('gt-next')).rejects.toThrow(
      'unexpected shape'
    );
  });
});
