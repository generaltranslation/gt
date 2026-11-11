// Where the CLI learns an import alias from: tsconfig.json, package.json, the
// project's bundler config, or the `alias` option. An alias nothing declares
// is reported, and the rest of the project is still analyzed.
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import type { BundlerConfig } from '../../src/compiler/bundler-configs/bundler-config.js';
import { main } from '../../src/compiler/cli/index.js';
import {
  collect,
  greetingIn,
  readSnippets,
  useGreeting,
  writeProject,
} from '../helpers/fixture.js';

/** A re-export whose path does not name Paraglide. */
const I18N = {
  'src/i18n/index.ts': `export { m } from "../paraglide/messages.js";\n`,
};

describe('aliases a config file of the project declares', () => {
  test('tsconfig.json paths and package.json imports', async () => {
    const root = await writeProject('alias-tsconfig-package', {
      ...I18N,
      'package.json': `{ "name": "app", "type": "module", "imports": { "#i18n": "./src/i18n/index.ts", "#paraglide/*": "./src/paraglide/*" } }`,
      'tsconfig.json': `{ "compilerOptions": { "paths": { "~/*": ["./src/*"], "@i18n": ["./src/i18n/index.ts"] } } }`,
      'src/tsconfig-direct.ts': useGreeting('~/paraglide/messages.js'),
      'src/tsconfig-reexport.ts': useGreeting('@i18n'),
      'src/package-direct.ts': useGreeting('#paraglide/messages.js'),
      'src/package-reexport.ts': useGreeting('#i18n'),
    });
    expect(await collect(root)).toMatchObject({
      usages: [
        greetingIn('src/package-direct.ts'),
        greetingIn('src/package-reexport.ts'),
        greetingIn('src/tsconfig-direct.ts'),
        greetingIn('src/tsconfig-reexport.ts'),
      ],
      warnings: [],
    });
  });

  test("vite.config: aliases to Paraglide and to a re-export, a RegExp, a plugin's alias, and a path from the root", async () => {
    const root = await writeProject('alias-vite', {
      ...I18N,
      'vite.config.ts': `
        import path from "node:path";
        const src = path.resolve(import.meta.dirname, "src");
        const framework = {
          name: "framework",
          config: () => ({ resolve: { alias: { $lib: src } } }),
        };
        export default {
          resolve: {
            alias: [
              { find: "@i18n", replacement: path.join(src, "i18n/index.ts") },
              { find: "@", replacement: src },
              { find: /^~msg\\/(.*)$/, replacement: path.join(src, "paraglide/$1") },
            ],
          },
          plugins: [framework],
        };`,
      'src/direct.ts': useGreeting('@/paraglide/messages.js'),
      'src/reexport.ts': useGreeting('@i18n'),
      'src/regexp.ts': useGreeting('~msg/messages.js'),
      'src/plugin.ts': useGreeting('$lib/paraglide/messages.js'),
      'src/from-root.ts': useGreeting('/src/paraglide/messages.js'),
    });
    expect(await collect(root)).toEqual({
      usages: [
        greetingIn('src/direct.ts'),
        greetingIn('src/from-root.ts'),
        greetingIn('src/plugin.ts'),
        greetingIn('src/reexport.ts'),
        greetingIn('src/regexp.ts'),
      ],
      warnings: [],
      info: expect.arrayContaining([
        '[paraglide-context] import aliases are read from vite.config.ts',
      ]),
    });
  });

  test.each(['webpack.config.mjs', 'rspack.config.mjs'])('%s', async (file) => {
    const root = await writeProject(`alias-${file.split('.')[0]}`, {
      ...I18N,
      [file]: `
        import path from "node:path";
        const src = path.resolve(import.meta.dirname, "src");
        export default {
          resolve: {
            alias: {
              "@": src,
              "i18n$": path.join(src, "i18n/index.ts"),
              "~/*": path.join(src, "*"),
            },
          },
        };`,
      'src/direct.ts': useGreeting('@/paraglide/messages.js'),
      'src/reexport.ts': useGreeting('i18n'),
      'src/wildcard.ts': useGreeting('~/paraglide/messages.js'),
    });
    expect(await collect(root)).toMatchObject({
      usages: [
        greetingIn('src/direct.ts'),
        greetingIn('src/reexport.ts'),
        greetingIn('src/wildcard.ts'),
      ],
      warnings: [],
    });
  });

  test("a config in the bundler's root, below the project root", async () => {
    const root = await writeProject('alias-nested-root', {
      'app/vite.config.mjs': `
        import path from "node:path";
        export default { resolve: { alias: { "@": import.meta.dirname } } };`,
      'app/main.ts': useGreeting('@/../src/paraglide/messages.js'),
    });
    expect(await collect(root, { root: path.join(root, 'app') })).toMatchObject(
      {
        usages: [greetingIn('app/main.ts')],
        warnings: [],
      }
    );
  });

  test("the `alias` option comes before the config's aliases", async () => {
    const root = await writeProject('alias-option-first', {
      'vite.config.mjs': `export default { resolve: { alias: { "@": "/nowhere" } } };`,
      'src/a.ts': useGreeting('@/paraglide/messages.js'),
    });
    const alias = { '@': path.join(root, 'src') };
    expect(await collect(root, { alias })).toMatchObject({
      usages: [greetingIn('src/a.ts')],
      warnings: [],
    });
  });

  test('another bundler, as a `BundlerConfig`', async () => {
    const root = await writeProject('alias-custom-bundler', {
      'parcel.config.json': '{}',
      'src/a.ts': useGreeting('@/paraglide/messages.js'),
    });
    const parcel: BundlerConfig = {
      name: 'parcel',
      files: ['parcel.config.json'],
      read: async (file) => ({
        aliases: [{ find: '@', replacement: path.join(file, '../src') }],
      }),
    };
    expect(await collect(root, { bundlerConfigs: [parcel] })).toMatchObject({
      usages: [greetingIn('src/a.ts')],
      warnings: [],
    });
  });
});

describe('aliases no config declares', () => {
  const files = {
    ...I18N,
    'src/found.ts': useGreeting('./paraglide/messages.js'),
    'src/direct.ts': useGreeting('@/paraglide/messages.js'),
    'src/reexport.ts': useGreeting('@i18n'),
    'src/from-root.ts': useGreeting('/src/paraglide/messages.js'),
    // Unresolved too, but never aliases.
    'src/others.ts': `import "./missing.js";\nimport "virtual:pwa-register";\nimport "node:fs";\nimport "fs";\n`,
    // Nor are a generated file's imports.
    '.nuxt/imports.d.ts': `export { useHead } from "#app/composables/head";\n`,
  };
  const unresolved =
    '3 import(s) could not be resolved, so usages through them are missed: ' +
    '"/src/paraglide/messages.js" (src/from-root.ts), "@/paraglide/messages.js" (src/direct.ts), "@i18n" (src/reexport.ts). ' +
    'If they are aliases, declare them in tsconfig.json "paths" or pass them with --alias: ';

  test('without a bundler config: the rest is analyzed, the imports are reported', async () => {
    const root = await writeProject('alias-unknown', files);
    const { usages, warnings } = await collect(root);
    expect(usages).toEqual([greetingIn('src/found.ts')]);
    expect(warnings).toHaveLength(3);
    // The collector's own warning, for imports whose path names Paraglide.
    expect(warnings).toContain(
      '[paraglide-context] could not resolve "@/paraglide/messages.js" from src/direct.ts; usages through it are not recorded'
    );
    expect(warnings).toContain(
      '[paraglide-context] could not resolve "/src/paraglide/messages.js" from src/from-root.ts; usages through it are not recorded'
    );
    expect(warnings.at(-1)).toBe(
      `[paraglide-context] ${unresolved}no vite, webpack, or rspack config was found to read them from.`
    );
  });

  test('the `alias` option declares them', async () => {
    const root = await writeProject('alias-option', files);
    const alias = {
      '@i18n': path.join(root, 'src/i18n/index.ts'),
      '@': path.join(root, 'src'),
      '/src': path.join(root, 'src'),
    };
    expect(await collect(root, { alias })).toMatchObject({
      usages: [
        greetingIn('src/direct.ts'),
        greetingIn('src/found.ts'),
        greetingIn('src/from-root.ts'),
        greetingIn('src/reexport.ts'),
      ],
      warnings: [],
    });
  });

  test('a bundler config that cannot be read', async () => {
    const root = await writeProject('alias-unreadable', {
      ...files,
      'vite.config.mjs': `throw new Error("NO_ENV is not set");`,
    });
    const { usages, warnings } = await collect(root);
    expect(usages).toEqual([greetingIn('src/found.ts')]);
    expect(warnings).toContainEqual(
      expect.stringMatching(
        /^\[paraglide-context\] vite\.config\.mjs could not be read, so its aliases are unknown: .*NO_ENV is not set/s
      )
    );
    expect(warnings).toContain(
      `[paraglide-context] ${unresolved}vite.config.mjs could not be read.`
    );
  });

  test('a bundler config that is not read: `bundlerConfigs: []`, --no-bundler-config', async () => {
    const root = await writeProject('alias-not-read', {
      'vite.config.mjs': `export default { resolve: { alias: { "@": import.meta.dirname + "/src" } } };`,
      'src/a.ts': useGreeting('@/paraglide/messages.js'),
    });
    const { usages, warnings } = await collect(root, { bundlerConfigs: [] });
    expect(usages).toEqual([]);
    expect(warnings).toContainEqual(
      expect.stringContaining('--alias: no bundler config is read.')
    );

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await main([root, '--no-bundler-config'])).toBe(0);
    expect(await readSnippets(root)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('--alias: no bundler config is read.')
    );
    expect(await main([root])).toBe(0);
    expect(await readSnippets(root)).toEqual([greetingIn('src/a.ts')]);
    warn.mockRestore();
  });

  test('with a bundler config read, unresolved imports are its virtual modules, not unknown aliases', async () => {
    const root = await writeProject('alias-known', {
      'vite.config.mjs': `export default {};`,
      'src/a.ts': `import "$app/stores";\n${useGreeting('./paraglide/messages.js')}`,
    });
    expect(await collect(root)).toMatchObject({
      usages: [greetingIn('src/a.ts')],
      warnings: [],
    });
  });
});

test('a long list of unresolved imports is cut', async () => {
  const root = await writeProject('alias-many', {
    'src/a.ts': Array.from(
      { length: 8 },
      (_, i) => `import "@alias${i}/a.js";`
    ).join('\n'),
  });
  const { warnings } = await collect(root);
  expect(warnings).toContainEqual(
    expect.stringMatching(
      /^\[paraglide-context\] 8 import\(s\) could not be resolved.*"@alias4\/a\.js" \(src\/a\.ts\), and 3 more\. /
    )
  );
});
