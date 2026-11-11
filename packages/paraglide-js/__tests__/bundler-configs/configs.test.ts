import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import {
  applyAliases,
  type ImportAlias,
} from '../../src/compiler/bundler-configs/alias.js';
import type { BundlerConfig } from '../../src/compiler/bundler-configs/bundler-config.js';
import { defaultBundlerConfigs } from '../../src/compiler/bundler-configs/index.js';
import { probeBundlerConfig } from '../../src/compiler/bundler-configs/probe.js';
import { viteConfig } from '../../src/compiler/bundler-configs/vite.js';
import {
  rspackConfig,
  webpackConfig,
} from '../../src/compiler/bundler-configs/webpack.js';
import { projectPackages } from '../../src/compiler/project/packages.js';
import { NO_PACKAGES } from '../../src/compiler/languages/language.js';
import { writeFiles } from '../helpers/files.js';

// Inside the package, so that its `vite` is the project's.
const TMP = path.join(import.meta.dirname, '.tmp');
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

async function write(
  name: string,
  files: Record<string, string>
): Promise<string> {
  const root = path.join(TMP, name);
  await fs.rm(root, { recursive: true, force: true });
  await writeFiles(root, files);
  return root;
}

const PACKAGE = { 'package.json': `{ "name": "app", "type": "module" }` };

describe('vite', () => {
  test('resolve.alias as a record, the root, and aliases that plugins add', async () => {
    const root = await write('vite-record', {
      ...PACKAGE,
      'vite.config.ts': `
        import path from "node:path";
        const kit = {
          name: "kit",
          config: () => ({ resolve: { alias: { $lib: path.resolve("src/lib") } } }),
        };
        export default {
          resolve: { alias: { "@i18n": path.resolve(import.meta.dirname, "src/i18n") } },
          plugins: [kit],
        };`,
    });
    const nodeEnv = process.env.NODE_ENV;
    const resolution = await viteConfig.read(
      path.join(root, 'vite.config.ts'),
      projectPackages(root)
    );
    expect(resolution).toMatchObject({ rootDirectory: root });
    expect('aliases' in resolution && resolution.aliases).toEqual(
      expect.arrayContaining([
        { find: '@i18n', replacement: path.join(root, 'src/i18n') },
        { find: '$lib', replacement: path.resolve('src/lib') },
      ])
    );
    expect(process.env.NODE_ENV).toBe(nodeEnv);
  });

  test.each([
    ['absolute', (root: string) => JSON.stringify(path.join(root, 'client'))],
    ['relative to the config', () => '"./client"'],
    [
      'set by a plugin',
      () =>
        'undefined, plugins: [{ name: "p", config: () => ({ root: "client" }) }]',
    ],
  ])('the root the config declares: %s', async (_name, declaredRoot) => {
    const root = await write('vite-root', PACKAGE);
    await writeFiles(root, {
      'vite.config.mjs': `export default { root: ${declaredRoot(root)} };`,
    });
    const resolution = await viteConfig.read(
      path.join(root, 'vite.config.mjs'),
      projectPackages(root)
    );
    expect(resolution).toMatchObject({
      rootDirectory: path.join(root, 'client'),
    });
  });

  test('resolve.alias as a list, with a RegExp', async () => {
    const root = await write('vite-list', {
      ...PACKAGE,
      'vite.config.mjs': `export default { resolve: { alias: [{ find: /^~msg\\/(.*)$/, replacement: "/app/paraglide/$1" }] } };`,
    });
    const resolution = await viteConfig.read(
      path.join(root, 'vite.config.mjs'),
      projectPackages(root)
    );
    expect('aliases' in resolution && resolution.aliases).toContainEqual({
      find: /^~msg\/(.*)$/,
      replacement: '/app/paraglide/$1',
    });
  });

  test.each([
    ['5', 'vite5'],
    ['6', 'vite6'],
    ['7', 'vite7'],
  ])(
    "the project's own Vite, whatever its version: Vite %s",
    async (version, name) => {
      const root = await write(`vite-${version}`, {
        ...PACKAGE,
        'vite.config.mjs': `export default { resolve: { alias: { "@": "/app/src" } } };`,
      });
      const vite: unknown = await import(name);
      const resolution = await viteConfig.read(
        path.join(root, 'vite.config.mjs'),
        { load: async <T>() => vite as T }
      );
      expect(resolution).toMatchObject({ rootDirectory: root });
      expect('aliases' in resolution && resolution.aliases).toContainEqual({
        find: '@',
        replacement: '/app/src',
      });
    }
  );

  test('without Vite in the project, the config is not read', async () => {
    expect(await viteConfig.read('/app/vite.config.ts', NO_PACKAGES)).toEqual({
      error: 'vite is not installed in the project',
    });
  });
});

describe('webpack and rspack', () => {
  const read = async (name: string, file: string, config: string) => {
    const root = await write(name, { ...PACKAGE, [file]: config });
    const bundler = file.startsWith('rspack') ? rspackConfig : webpackConfig;
    return bundler.read(path.join(root, file), NO_PACKAGES);
  };

  test('resolve.alias as a record: paths, `name$`, lists of paths, ignored imports', async () => {
    expect(
      await read(
        'webpack-record',
        'webpack.config.js',
        `export default { resolve: { alias: {
          "@": "/app/src",
          "i18n$": "/app/src/i18n.ts",
          fallbacks: ["/app/a", "/app/b"],
          ignored: false,
        } } };`
      )
    ).toEqual({
      aliases: [
        { find: '@', replacement: '/app/src', exact: false },
        { find: 'i18n', replacement: '/app/src/i18n.ts', exact: true },
        { find: 'fallbacks', replacement: '/app/a', exact: false },
      ],
    });
  });

  test('resolve.alias as a list', async () => {
    expect(
      await read(
        'webpack-list',
        'webpack.config.mjs',
        `export default { resolve: { alias: [
          { name: "@", alias: "/app/src" },
          { name: "i18n", alias: "/app/src/i18n.ts", onlyModule: true },
        ] } };`
      )
    ).toEqual({
      aliases: [
        { find: '@', replacement: '/app/src', exact: false },
        { find: 'i18n', replacement: '/app/src/i18n.ts', exact: true },
      ],
    });
  });

  test('a name with one `*` stands for any text, which replaces the `*` of the path', async () => {
    const { aliases } = (await read(
      'webpack-wildcard',
      'webpack.config.js',
      `export default { resolve: { alias: {
        "@/*": "/app/src/*",
        "*.svg": "/app/icons/*.js",
        "all/*": "/app/$one",
        "twice/*": "/app/*/$*",
        "exact/*$": "/app/exact",
        "a/*/*": "/app/two",
      } } };`
    )) as { aliases: ImportAlias[] };

    expect(aliases).toEqual([
      { find: /^@\/(.*)$/, replacement: '/app/src/$1' },
      { find: /^(.*)\.svg$/, replacement: '/app/icons/$1.js' },
      { find: /^all\/(.*)$/, replacement: '/app/$$one' },
      // As in webpack, only the first `*` of the path is the match.
      { find: /^twice\/(.*)$/, replacement: '/app/$1/$$*' },
      { find: 'exact/*', replacement: '/app/exact', exact: true },
      { find: 'a/*/*', replacement: '/app/two', exact: false },
    ]);
    const specifiers = [
      '@/ui/a.js',
      'logo.svg',
      'all/b',
      'twice/b',
      'exact/b',
      'a/b/c',
    ];
    const resolved = specifiers.map((specifier) =>
      applyAliases(specifier, aliases)
    );
    expect(resolved).toEqual([
      '/app/src/ui/a.js',
      '/app/icons/logo.js',
      '/app/$one',
      '/app/b/$*',
      'exact/b',
      'a/b/c',
    ]);
  });

  test('a CommonJS config that is a function; of several configs, the first', async () => {
    expect(
      await read(
        'webpack-function',
        'webpack.config.cjs',
        `module.exports = [
          (env, argv) => ({ resolve: { alias: { mode: "/app/" + argv.mode } } }),
          { resolve: { alias: { second: "/app/second" } } },
        ];`
      )
    ).toEqual({
      aliases: [{ find: 'mode', replacement: '/app/production', exact: false }],
    });
  });

  test('rspack.config.*; a config without aliases', async () => {
    expect(
      await read(
        'rspack',
        'rspack.config.mjs',
        `export default async () => ({ entry: "./src/main.js" });`
      )
    ).toEqual({ aliases: [] });
    expect(rspackConfig.files).toContain('rspack.config.ts');
  });

  test('a file that exports no config', async () => {
    expect(
      await read('webpack-empty', 'webpack.config.mjs', `export default 1;`)
    ).toEqual({ error: 'it exports no config' });
  });
});

describe('probeBundlerConfig', () => {
  const fake = (name: string, alias: string): BundlerConfig => ({
    name,
    files: [`${name}.config.js`],
    read: async () => ({ aliases: [{ find: alias, replacement: '/app' }] }),
  });

  test('no config file', async () => {
    const root = await write('probe-none', PACKAGE);
    expect(
      await probeBundlerConfig([root], defaultBundlerConfigs, NO_PACKAGES)
    ).toEqual({ type: 'none' });
  });

  test('the first directory with a config, then the first bundler', async () => {
    const root = await write('probe-order', {
      'app/b.config.js': '',
      'a.config.js': '',
      'b.config.js': '',
    });
    const bundlers = [fake('a', '@a'), fake('b', '@b')];
    expect(
      await probeBundlerConfig(
        [path.join(root, 'app'), root],
        bundlers,
        NO_PACKAGES
      )
    ).toMatchObject({
      type: 'read',
      file: path.join(root, 'app/b.config.js'),
      resolution: { aliases: [{ find: '@b' }] },
    });
    expect(
      await probeBundlerConfig([root], bundlers, NO_PACKAGES)
    ).toMatchObject({ file: path.join(root, 'a.config.js') });
  });

  test('a config that throws, or cannot be read, is unreadable', async () => {
    const root = await write('probe-unreadable', {
      ...PACKAGE,
      'webpack.config.mjs': `throw new Error("no env");`,
    });
    expect(
      await probeBundlerConfig([root], defaultBundlerConfigs, NO_PACKAGES)
    ).toEqual({
      type: 'unreadable',
      file: path.join(root, 'webpack.config.mjs'),
      reason: 'no env',
    });

    const vite = await write('probe-no-vite', {
      ...PACKAGE,
      'vite.config.ts': 'export default {};',
    });
    expect(
      await probeBundlerConfig([vite], defaultBundlerConfigs, NO_PACKAGES)
    ).toMatchObject({
      type: 'unreadable',
      reason: 'vite is not installed in the project',
    });
  });
});
