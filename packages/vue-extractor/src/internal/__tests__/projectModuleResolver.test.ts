import fs from 'node:fs';
import path from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from '../../index.js';
import { readJavaScriptPackageManifest } from '../project/manifest.js';
import { createProjectModuleResolver } from '../project/moduleResolver.js';
import {
  resolveVueProjectAliasConfiguration,
  resolveVueProjectAliases,
} from '../project/viteAliases.js';
import { packagePubliclyExposesGT } from '../project/wrapperProvenance.js';
import { createTestProject, writeProjectFiles } from './projectTestUtils.js';

describe('project module resolution', () => {
  it('matches Vite default extension precedence', () => {
    const root = createTestProject({
      'src/importer.ts': '',
      'src/message.js': '',
      'src/message.ts': '',
      'src/component.vue': '',
      'src/component.ts': '',
    });
    const resolveModule = createProjectModuleResolver();
    const importer = path.join(root, 'src/importer.ts');

    expectResolved(
      resolveModule('./message', importer),
      path.join(root, 'src/message.js')
    );
    expectResolved(
      resolveModule('./component', importer),
      path.join(root, 'src/component.ts')
    );
  });

  it('does not add the Vue SFC extension implicitly', () => {
    const root = createTestProject({
      'src/importer.ts': '',
      'src/OnlyVue.vue': '',
    });
    const resolveModule = createProjectModuleResolver();

    expect(
      resolveModule('./OnlyVue', path.join(root, 'src/importer.ts'))
    ).toBeUndefined();
    expectResolved(
      resolveModule('./OnlyVue.vue', path.join(root, 'src/importer.ts')),
      path.join(root, 'src/OnlyVue.vue')
    );
  });

  it('resolves TypeScript source for an explicit JavaScript import', () => {
    const root = createTestProject({
      'src/importer.ts': '',
      'src/message.ts': '',
    });
    const resolveModule = createProjectModuleResolver();

    expectResolved(
      resolveModule('./message.js', path.join(root, 'src/importer.ts')),
      path.join(root, 'src/message.ts')
    );
  });

  it.each(['tsconfig.json', 'jsconfig.json'])(
    'uses an explicit %s instead of the nearest discovered config',
    (configName) => {
      const root = createTestProject({
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: { '@fixture/target': ['src/discovered.ts'] },
          },
        }),
        [`config/${configName}`]: JSON.stringify({
          compilerOptions: {
            baseUrl: '..',
            paths: { '@fixture/target': ['src/explicit.ts'] },
          },
        }),
        'src/importer.ts': '',
        'src/discovered.ts': '',
        'src/explicit.ts': '',
      });
      const importer = path.join(root, 'src/importer.ts');

      expectResolved(
        createProjectModuleResolver()('@fixture/target', importer),
        path.join(root, 'src/discovered.ts')
      );
      expectResolved(
        createProjectModuleResolver(undefined, {
          tsconfigPath: path.join(root, 'config', configName),
        })('@fixture/target', importer),
        path.join(root, 'src/explicit.ts')
      );
    }
  );

  it('selects import exports instead of CommonJS exports', () => {
    const root = createTestProject({
      'src/importer.ts': '',
      'node_modules/example/package.json': JSON.stringify({
        name: 'example',
        exports: {
          '.': {
            require: './require.cjs',
            import: './import.js',
            default: './default.js',
          },
        },
      }),
      'node_modules/example/require.cjs': '',
      'node_modules/example/import.js': '',
      'node_modules/example/default.js': '',
    });
    const resolveModule = createProjectModuleResolver();

    expectResolved(
      resolveModule('example', path.join(root, 'src/importer.ts')),
      path.join(root, 'node_modules/example/import.js')
    );
    expectResolved(
      resolveModule('example', path.join(root, 'src/importer.cts')),
      path.join(root, 'node_modules/example/require.cjs')
    );
  });

  it('uses Vite module precedence for a CommonJS browser entry', () => {
    const root = createTestProject({
      'src/importer.ts': '',
      'node_modules/example/package.json': JSON.stringify({
        name: 'example',
        browser: './browser.js',
        module: './module.js',
        main: './main.js',
      }),
      'node_modules/example/browser.js': '',
      'node_modules/example/module.js': '',
      'node_modules/example/main.js': '',
    });
    const resolveModule = createProjectModuleResolver();

    expectResolved(
      resolveModule('example', path.join(root, 'src/importer.ts')),
      path.join(root, 'node_modules/example/module.js')
    );
    expectResolved(
      resolveModule('example', path.join(root, 'src/importer.cts')),
      path.join(root, 'node_modules/example/browser.js')
    );
  });

  it('uses a browser entry when it contains ESM syntax', () => {
    const root = createTestProject({
      'src/importer.ts': '',
      'node_modules/example/package.json': JSON.stringify({
        name: 'example',
        browser: './browser.js',
        module: './module.js',
        main: './main.js',
      }),
      'node_modules/example/browser.js': 'export const target = "browser";',
      'node_modules/example/module.js': 'export const target = "module";',
      'node_modules/example/main.js': 'module.exports = "main";',
    });
    const resolveModule = createProjectModuleResolver();

    expectResolved(
      resolveModule('example', path.join(root, 'src/importer.ts')),
      path.join(root, 'node_modules/example/browser.js')
    );
  });

  it('applies browser object remaps to package-internal imports', () => {
    const root = createTestProject({
      'src/importer.ts': '',
      'node_modules/example/package.json': JSON.stringify({
        name: 'example',
        browser: {
          './server.js': './browser.js',
        },
      }),
      'node_modules/example/index.js': '',
      'node_modules/example/server.js': '',
      'node_modules/example/browser.js': '',
    });
    const resolveModule = createProjectModuleResolver();

    expectResolved(
      resolveModule(
        './server.js',
        path.join(root, 'node_modules/example/index.js')
      ),
      path.join(root, 'node_modules/example/browser.js')
    );
    expectResolved(
      resolveModule('example/server.js', path.join(root, 'src/importer.ts')),
      path.join(root, 'node_modules/example/browser.js')
    );
  });

  it('maps JavaScript package export targets back to TypeScript source', () => {
    const root = createTestProject({
      'src/importer.ts': '',
      'node_modules/example/package.json': JSON.stringify({
        name: 'example',
        exports: {
          '.': './src/index.js',
          './jsx': './src/view.jsx',
        },
      }),
      'node_modules/example/src/index.ts': '',
      'node_modules/example/src/view.tsx': '',
    });
    const resolveModule = createProjectModuleResolver();

    expectResolved(
      resolveModule('example', path.join(root, 'src/importer.ts')),
      path.join(root, 'node_modules/example/src/index.ts')
    );
    expectResolved(
      resolveModule('example/jsx', path.join(root, 'src/importer.ts')),
      path.join(root, 'node_modules/example/src/view.tsx')
    );
  });

  it('maps emitted self-reference exports back to package TypeScript source', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/self-package',
        exports: { './runtime': './dist/runtime.js' },
      }),
      'src/importer.ts': '',
      'dist/runtime.ts': '',
    });
    const resolveModule = createProjectModuleResolver();

    expectResolved(
      resolveModule(
        '@fixture/self-package/runtime',
        path.join(root, 'src/importer.ts')
      ),
      path.join(root, 'dist/runtime.ts')
    );
  });

  it('does not treat an ancestor beyond a malformed package boundary as self', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/outer-package',
        exports: { './runtime': './dist/runtime.js' },
      }),
      'dist/runtime.ts': '',
      'nested/package.json': '{ malformed',
      'nested/src/importer.ts': '',
    });
    const resolveModule = createProjectModuleResolver();

    expect(
      resolveModule(
        '@fixture/outer-package/runtime',
        path.join(root, 'nested/src/importer.ts')
      )
    ).toBeUndefined();
  });

  it('expands Vite mode conditions deterministically', () => {
    const root = createTestProject({
      'src/importer.ts': '',
      'node_modules/example/package.json': JSON.stringify({
        name: 'example',
        exports: {
          '.': {
            development: './development.js',
            production: './production.js',
            default: './default.js',
          },
        },
      }),
      'node_modules/example/development.js': '',
      'node_modules/example/production.js': '',
      'node_modules/example/default.js': '',
    });
    const importer = path.join(root, 'src/importer.ts');

    expectResolved(
      createProjectModuleResolver(['development|production'])(
        'example',
        importer
      ),
      path.join(root, 'node_modules/example/development.js')
    );
    expectResolved(
      createProjectModuleResolver(['development|production', 'production'])(
        'example',
        importer
      ),
      path.join(root, 'node_modules/example/production.js')
    );
  });

  it('does not bypass package exports encapsulation', () => {
    const root = createTestProject({
      'src/importer.ts': '',
      'node_modules/example/package.json': JSON.stringify({
        name: 'example',
        browser: { './private.js': './index.js' },
        exports: {
          '.': './index.js',
        },
      }),
      'node_modules/example/index.js': '',
      'node_modules/example/private.js': '',
    });
    const resolveModule = createProjectModuleResolver();

    expect(
      resolveModule('example/private.js', path.join(root, 'src/importer.ts'))
    ).toBeUndefined();
    expectResolved(
      resolveModule('example', path.join(root, 'src/importer.ts')),
      path.join(root, 'node_modules/example/index.js')
    );
  });

  it('matches Vite for package conditions, browser remaps, and source recovery', async () => {
    const root = createTestProject({
      'package.json': JSON.stringify({ name: 'vite-resolution-fixture' }),
      'src/importer.ts': '',
      'src/importer.cts': '',
      'node_modules/conditional/package.json': JSON.stringify({
        name: 'conditional',
        exports: {
          '.': {
            require: './require.cjs',
            import: './import.js',
          },
        },
      }),
      'node_modules/conditional/require.cts': '',
      'node_modules/conditional/import.js': '',
      'node_modules/browser-map/package.json': JSON.stringify({
        name: 'browser-map',
        browser: { './server.js': './browser.js' },
      }),
      'node_modules/browser-map/index.js': '',
      'node_modules/browser-map/server.js': '',
      'node_modules/browser-map/browser.js': '',
      'node_modules/browser-entry/package.json': JSON.stringify({
        name: 'browser-entry',
        browser: './browser.js',
        module: './module.js',
        main: './main.js',
      }),
      'node_modules/browser-entry/browser.js': 'module.exports = "browser";',
      'node_modules/browser-entry/module.js': 'export const target = "module";',
      'node_modules/browser-entry/main.js': 'module.exports = "main";',
      'node_modules/typed-export/package.json': JSON.stringify({
        name: 'typed-export',
        exports: {
          '.': './src/index.js',
          './public': './src/public.js',
        },
      }),
      'node_modules/typed-export/src/index.ts': '',
      'node_modules/typed-export/src/public.ts': '',
      'node_modules/typed-export/src/private.ts': '',
    });
    const resolveModule = createProjectModuleResolver();
    const esmImporter = path.join(root, 'src/importer.ts');
    const cjsImporter = path.join(root, 'src/importer.cts');
    const packageImporter = path.join(
      root,
      'node_modules/browser-map/index.js'
    );

    await withViteResolver(root, async (resolveWithVite) => {
      await expectViteParity(
        resolveModule('conditional', esmImporter),
        await resolveWithVite('conditional', esmImporter)
      );
      await expectViteParity(
        resolveModule('conditional', cjsImporter),
        await resolveWithVite('conditional', cjsImporter, true)
      );
      await expectViteParity(
        resolveModule('./server.js', packageImporter),
        await resolveWithVite('./server.js', packageImporter)
      );
      await expectViteParity(
        resolveModule('browser-entry', esmImporter),
        await resolveWithVite('browser-entry', esmImporter)
      );
      await expectViteParity(
        resolveModule('browser-entry', cjsImporter),
        await resolveWithVite('browser-entry', cjsImporter, true)
      );
      await expectViteParity(
        resolveModule('typed-export', esmImporter),
        await resolveWithVite('typed-export', esmImporter)
      );
      await expectViteParity(
        resolveModule('typed-export/public', esmImporter),
        await resolveWithVite('typed-export/public', esmImporter)
      );
      expect(
        resolveModule('typed-export/private', esmImporter)
      ).toBeUndefined();
      expect(
        await resolveWithVite('typed-export/private', esmImporter)
      ).toBeUndefined();
    });
  });

  function expectResolved(actual: string | undefined, expected: string): void {
    expect(actual).toBeDefined();
    expect(fs.realpathSync(actual!)).toBe(fs.realpathSync(expected));
  }

  async function withViteResolver(
    root: string,
    run: (
      resolve: (
        specifier: string,
        importer: string,
        isRequire?: boolean
      ) => Promise<string | undefined>
    ) => Promise<void>
  ): Promise<void> {
    const server = await createServer({
      configFile: false,
      logLevel: 'silent',
      optimizeDeps: { noDiscovery: true },
      root,
      server: { middlewareMode: true },
    });
    try {
      await run((specifier, importer, isRequire = false) =>
        resolveWithVite(server, specifier, importer, isRequire)
      );
    } finally {
      await server.close();
    }
  }

  async function resolveWithVite(
    server: ViteDevServer,
    specifier: string,
    importer: string,
    isRequire: boolean
  ): Promise<string | undefined> {
    try {
      const resolved = await server.pluginContainer.resolveId(
        specifier,
        importer,
        isRequire
          ? { custom: { 'node-resolve': { isRequire: true } } }
          : undefined
      );
      return resolved?.id.split(/[?#]/, 1)[0];
    } catch {
      return undefined;
    }
  }

  async function expectViteParity(
    actual: string | undefined,
    vite: string | undefined
  ): Promise<void> {
    expect(actual).toBeDefined();
    expect(vite).toBeDefined();
    expect(fs.realpathSync(actual!)).toBe(fs.realpathSync(vite!));
  }
});

describe('malformed nearest package boundaries', () => {
  it('does not resolve a parent package past a malformed nearest install', () => {
    const fixture = createNestedPackageFixture();
    const resolveModule = createProjectModuleResolver();

    expect(resolveModule('wrapper', fixture.importer)).toBeUndefined();
  });

  it('does not inherit gt-vue provenance from the shadowed parent package', async () => {
    const fixture = createNestedPackageFixture();
    const source = `
      import { T } from 'wrapper';
      export const App = () => <T>Wrong parent message</T>;
    `;
    fs.writeFileSync(fixture.importer, source);

    const output = await extractFromVueSource(source, fixture.importer, {
      projectRoot: fixture.root,
      requireGTProvenance: true,
      resolveModule: createProjectModuleResolver(),
    });

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  function createNestedPackageFixture(): {
    importer: string;
    root: string;
  } {
    const root = createTestProject();
    const localWrapper = path.join(root, 'packages/wrapper');
    const parentLink = path.join(root, 'node_modules/wrapper');
    const nearestWrapper = path.join(root, 'apps/client/node_modules/wrapper');
    const importer = path.join(root, 'apps/client/src/App.tsx');
    for (const directory of [
      localWrapper,
      path.dirname(parentLink),
      nearestWrapper,
      path.dirname(importer),
    ]) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: '@fixture/root' })
    );
    fs.writeFileSync(
      path.join(localWrapper, 'package.json'),
      JSON.stringify({
        name: 'wrapper',
        version: '1.0.0',
        exports: './index.ts',
      })
    );
    fs.writeFileSync(
      path.join(localWrapper, 'index.ts'),
      "export { T } from 'gt-vue';\n"
    );
    fs.symlinkSync(localWrapper, parentLink, 'dir');
    fs.writeFileSync(path.join(nearestWrapper, 'package.json'), '{malformed');
    fs.writeFileSync(
      path.join(nearestWrapper, 'index.js'),
      'export const T = String;\n'
    );
    fs.writeFileSync(importer, 'export {};\n');
    return { importer, root };
  }
});

describe('resolveVueProjectAliases', () => {
  it('distinguishes definitely absent aliases from incomplete analysis', () => {
    const withoutConfig = createTestProject({});
    const withoutAliases = createTestProject({
      'vite.config.ts': `export default defineConfig({ server: { port: 3000 } });`,
    });
    const explicitlyAbsent = createTestProject({
      'vite.config.ts': `export default defineConfig({ resolve: { alias: undefined } });`,
    });
    const absentResolve = createTestProject({
      'vite.config.ts': `export default defineConfig({ resolve: null });`,
    });
    const malformed = createTestProject({
      'vite.config.ts': `export default defineConfig({ resolve: { alias:`,
    });
    const dynamicRoot = createTestProject({
      'vite.config.ts': `export default defineConfig(getConfig());`,
    });
    const knownAliases = createTestProject({
      'vite.config.ts': `export default { resolve: { alias: { '@': './src' } } };`,
    });

    expect(resolveVueProjectAliasConfiguration(withoutConfig)).toEqual({
      aliases: new Map(),
      complete: true,
    });
    expect(resolveVueProjectAliasConfiguration(withoutAliases)).toEqual({
      aliases: new Map(),
      complete: true,
    });
    expect(resolveVueProjectAliasConfiguration(explicitlyAbsent)).toEqual({
      aliases: new Map(),
      complete: true,
    });
    expect(resolveVueProjectAliasConfiguration(absentResolve)).toEqual({
      aliases: new Map(),
      complete: true,
    });
    expect(resolveVueProjectAliasConfiguration(malformed)).toEqual({
      aliases: new Map(),
      complete: false,
    });
    expect(resolveVueProjectAliasConfiguration(dynamicRoot)).toEqual({
      aliases: new Map(),
      complete: false,
    });
    expect(resolveVueProjectAliasConfiguration(knownAliases)).toEqual({
      aliases: new Map([['@', './src']]),
      complete: true,
    });
  });

  it('marks unreadable-shaped and escaping active config incomplete', () => {
    const directoryConfig = createTestProject({});
    fs.mkdirSync(path.join(directoryConfig, 'vite.config.js'));
    const dynamicSpread = createTestProject({
      'vite.config.ts': `
        const shared = getConfig();
        export default { ...shared, resolve: { alias: { '@': './src' } } };
      `,
    });
    const escapedRoot = createTestProject({
      'vite.config.ts': `
        const config = { resolve: { alias: { '@': './src' } } };
        consume(config);
        export default config;
      `,
    });

    for (const root of [directoryConfig, dynamicSpread, escapedRoot]) {
      expect(resolveVueProjectAliasConfiguration(root)).toEqual({
        aliases: new Map(),
        complete: false,
      });
    }
  });

  it('preserves relative replacements while evaluating explicit path expressions', () => {
    const root = createTestProject({
      'vite.config.ts': `
        import path from 'node:path';
        import { defineConfig } from 'vite';
        const source = path.resolve(__dirname, 'src');
        const shared = {
          '@': source,
          '#literal': './literal',
        } as const;
        const aliases = {
          ...shared,
          '@feature': path.resolve(__dirname, 'features'),
        } satisfies Record<string, string>;
        const resolve = { alias: aliases };
        const config = { resolve };
        export default defineConfig(config);
      `,
    });

    expect(Object.fromEntries(resolveVueProjectAliases(root))).toEqual({
      '#literal': './literal',
      '@': path.join(root, 'src'),
      '@feature': path.join(root, 'features'),
    });
  });

  it('retains callback-local scope for aliases and URL expressions', () => {
    const root = createTestProject({
      'vite.config.mts': `
        import { defineConfig } from 'vite';
        import { fileURLToPath as toPath } from 'node:url';
        export default defineConfig(() => {
          const source = toPath(new URL('./src', import.meta.url));
          const shared = [{ find: '@first', replacement: './first' }] as const;
          const aliases = [
            ...shared,
            { find: '@', replacement: source },
          ];
          return { resolve: { alias: aliases } };
        });
      `,
    });

    expect([...resolveVueProjectAliases(root)]).toEqual([
      ['@first', './first'],
      ['@', path.join(root, 'src')],
    ]);
  });

  it('resolves the URL constructor imported by the standard Vite scaffold', () => {
    const root = createTestProject({
      'vite.config.ts': `
        import { fileURLToPath, URL } from 'node:url';
        import { defineConfig } from 'vite';
        export default defineConfig({
          resolve: {
            alias: {
              '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
          },
        });
      `,
    });

    expect([...resolveVueProjectAliases(root)]).toEqual([
      ['@', path.join(root, 'src')],
    ]);
  });

  it('does not resolve a helper shadowed by a callback parameter', () => {
    const root = createTestProject({
      'vite.config.ts': `
        import path from 'node:path';
        import { defineConfig } from 'vite';
        export default defineConfig((path) => ({
          resolve: { alias: { '@': path.resolve(__dirname, 'wrong') } },
        }));
      `,
    });

    expect(resolveVueProjectAliasConfiguration(root)).toEqual({
      aliases: new Map(),
      complete: false,
      potentialAliasKeys: new Set(['@']),
    });
  });

  it('does not trust a mutated path helper', () => {
    const root = createTestProject({
      'vite.config.cjs': `
        const nodePath = require('node:path');
        nodePath.resolve = () => '/wrong';
        module.exports = {
          resolve: { alias: { '@': nodePath.resolve(__dirname, 'src') } },
        };
      `,
    });

    expect(resolveVueProjectAliasConfiguration(root)).toEqual({
      aliases: new Map(),
      complete: false,
      potentialAliasKeys: new Set(['@']),
    });
  });

  it('reads only resolve.alias from a Vite config', () => {
    const root = createTestProject({
      'vite.config.ts': `
        export default defineConfig({
          alias: { '@top-level': './ignored-top-level' },
          resolve: { alias: { '@vite': './vite' } },
          vite: { resolve: { alias: { '@nested': './ignored-nested' } } },
        });
      `,
    });

    expect([...resolveVueProjectAliases(root)]).toEqual([['@vite', './vite']]);
  });

  it('preserves configured array order and the first duplicate', () => {
    const root = createTestProject({
      'vite.config.ts': `
        export default {
          resolve: {
            alias: [
              { find: '@wide/specific', replacement: './specific' },
              { find: '@wide', replacement: './wide-first' },
              { find: '@wide', replacement: './wide-second' },
            ],
          },
        };
      `,
    });

    expect([...resolveVueProjectAliases(root)]).toEqual([
      ['@wide/specific', './specific'],
      ['@wide', './wide-first'],
    ]);
  });

  it('synthesizes Nuxt aliases and applies object-form override precedence', () => {
    const root = createTestProject({
      'nuxt.config.ts': `
        import { fileURLToPath } from 'node:url';
        import { defineNuxtConfig as define } from 'nuxt';
        const src = fileURLToPath(new URL('./src', import.meta.url));
        export default define({
          alias: {
            '#shared': './shared',
            '@': './nuxt-source',
          },
          vite: {
            resolve: {
              alias: {
                '@': src,
                '@client': './client',
              },
            },
          },
        });
      `,
    });

    expect([
      ...resolveVueProjectAliases(root, { nuxtMajorVersion: 3 }),
    ]).toEqual([
      ['~', trailingSlash(root)],
      ['@', path.join(root, 'src')],
      ['~~', trailingSlash(root)],
      ['@@', trailingSlash(root)],
      ['#shared', './shared'],
      ['@client', './client'],
    ]);
  });

  it('prepends nested Vite arrays when Nuxt merges unlike alias forms', () => {
    const root = createTestProject({
      'nuxt.config.ts': `
        export default defineNuxtConfig({
          alias: {
            '@wide': './nuxt-wide',
            '#shared': './shared',
          },
          vite: {
            resolve: {
              alias: [
                { find: '@wide/specific', replacement: './specific' },
                { find: '@wide', replacement: './vite-wide' },
              ],
            },
          },
        });
      `,
    });

    expect([
      ...resolveVueProjectAliases(root, { nuxtMajorVersion: 3 }),
    ]).toEqual([
      ['@wide/specific', './specific'],
      ['@wide', './vite-wide'],
      ['~', trailingSlash(root)],
      ['@', trailingSlash(root)],
      ['~~', trailingSlash(root)],
      ['@@', trailingSlash(root)],
      ['#shared', './shared'],
    ]);
  });

  it('uses Nuxt 3, Nuxt 4, compatibility, and explicit srcDir semantics', () => {
    const nuxt3 = createTestProject({
      'app/App.vue': '<template />',
      'nuxt.config.ts': 'export default defineNuxtConfig({});',
    });
    const nuxt4 = createTestProject({
      'app/App.vue': '<template />',
      'nuxt.config.ts': 'export default defineNuxtConfig({});',
    });
    const compatibility = createTestProject({
      'app/App.vue': '<template />',
      'nuxt.config.ts': `export default defineNuxtConfig({ future: { compatibilityVersion: 4 } });`,
    });
    const explicit = createTestProject({
      'nuxt.config.ts': `export default defineNuxtConfig({ srcDir: 'src' });`,
    });
    const emptySource = createTestProject({
      'app/App.vue': '<template />',
      'nuxt.config.ts': `export default defineNuxtConfig({ srcDir: '' });`,
    });

    expect(
      resolveVueProjectAliases(nuxt3, { nuxtMajorVersion: 3 }).get('@')
    ).toBe(trailingSlash(nuxt3));
    expect(
      resolveVueProjectAliases(nuxt4, { nuxtMajorVersion: 4 }).get('@')
    ).toBe(trailingSlash(path.join(nuxt4, 'app')));
    expect(
      resolveVueProjectAliases(compatibility, { nuxtMajorVersion: 3 }).get('@')
    ).toBe(trailingSlash(path.join(compatibility, 'app')));
    expect(
      resolveVueProjectAliases(explicit, { nuxtMajorVersion: 3 }).get('@')
    ).toBe(trailingSlash(path.join(explicit, 'src')));
    expect(
      resolveVueProjectAliases(emptySource, { nuxtMajorVersion: 4 }).get('@')
    ).toBe(trailingSlash(path.join(emptySource, 'app')));
  });

  it('requires a known Nuxt generation when srcDir uses versioned defaults', () => {
    const unknownDefault = createTestProject({
      'nuxt.config.ts': `export default defineNuxtConfig({});`,
    });
    const explicitSource = createTestProject({
      'nuxt.config.ts': `export default defineNuxtConfig({ srcDir: 'src' });`,
    });

    expect(resolveVueProjectAliasConfiguration(unknownDefault)).toEqual({
      aliases: new Map(),
      complete: false,
    });
    expect(resolveVueProjectAliasConfiguration(explicitSource).complete).toBe(
      true
    );
  });

  it('uses the Nuxt 4 legacy-layout fallback when app is effectively empty', () => {
    const root = createTestProject({
      'app/router.options.ts': 'export default {}',
      'nuxt.config.ts': 'export default defineNuxtConfig({});',
      'pages/index.vue': '<template />',
    });

    expect(
      resolveVueProjectAliases(root, { nuxtMajorVersion: 4 }).get('@')
    ).toBe(trailingSlash(root));
  });

  it.each([
    `srcDir: '../outside'`,
    `rootDir: '../outside'`,
    `srcDir: getSourceDirectory()`,
    `future: getFutureOptions()`,
  ])('fails closed for an unsafe Nuxt directory configuration: %s', (entry) => {
    const root = createTestProject({
      'nuxt.config.ts': `export default defineNuxtConfig({ ${entry}, alias: { '@safe': './safe' } });`,
    });

    expect(resolveVueProjectAliases(root, { nuxtMajorVersion: 4 })).toEqual(
      new Map()
    );
  });

  it('rejects a Nuxt srcDir beneath a symlink that escapes the package', () => {
    const outside = createTestProject({});
    const root = createTestProject({
      'nuxt.config.ts': `export default defineNuxtConfig({ srcDir: 'linked/src' });`,
    });
    fs.symlinkSync(outside, path.join(root, 'linked'), 'dir');

    expect(resolveVueProjectAliases(root, { nuxtMajorVersion: 4 })).toEqual(
      new Map()
    );
  });

  it('uses the same filename precedence and ambiguity policy as compiler config', () => {
    const vite = createTestProject({
      'vite.config.js': `export default { resolve: { alias: { '@': './js' } } };`,
      'vite.config.mjs': `export default { resolve: { alias: { '@': './mjs' } } };`,
      'vite.config.ts': `export default { resolve: { alias: { '@': './ts' } } };`,
    });
    const nuxt = createTestProject({
      'nuxt.config.mjs': `export default defineNuxtConfig({ alias: { '#which': './mjs' } });`,
      'nuxt.config.ts': `export default defineNuxtConfig({ alias: { '#which': './ts' } });`,
    });
    const ambiguous = createTestProject({
      'nuxt.config.ts': `export default defineNuxtConfig({ alias: { '@': './nuxt' } });`,
      'vite.config.ts': `export default { resolve: { alias: { '@': './vite' } } };`,
    });

    expect(resolveVueProjectAliases(vite).get('@')).toBe('./js');
    expect(
      resolveVueProjectAliases(nuxt, { nuxtMajorVersion: 3 }).get('#which')
    ).toBe('./ts');
    expect(resolveVueProjectAliasConfiguration(ambiguous)).toEqual({
      aliases: new Map(),
      complete: false,
    });
  });

  it('supports CommonJS helper aliases and config exports', () => {
    const root = createTestProject({
      'vite.config.cjs': `
        const vite = require('vite');
        const nodePath = require('node:path');
        const { resolve: resolvePath } = require('path');
        const aliases = {
          '@': nodePath.resolve(__dirname, 'src'),
          '@server': resolvePath(__dirname, 'server'),
        };
        module.exports = vite.defineConfig({ resolve: { alias: aliases } });
      `,
    });

    expect(Object.fromEntries(resolveVueProjectAliases(root))).toEqual({
      '@': path.join(root, 'src'),
      '@server': path.join(root, 'server'),
    });
  });

  it('never executes config code', () => {
    const root = createTestProject({});
    const marker = path.join(root, 'executed.txt');
    writeProjectFiles(root, {
      'vite.config.js': `
        import fs from 'node:fs';
        fs.writeFileSync(${JSON.stringify(marker)}, 'executed');
        throw new Error('config execution is forbidden');
        export default defineConfig({
          resolve: { alias: { '@': './src' } },
        });
      `,
    });

    expect(resolveVueProjectAliases(root).get('@')).toBe('./src');
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('marks a dynamic replacement incomplete without returning partial aliases', () => {
    const root = createTestProject({
      'vite.config.ts': `
        export default {
          resolve: {
            alias: {
              '@static': './static',
              '@dynamic': getReplacement(),
            },
          },
        };
      `,
    });

    expect(resolveVueProjectAliasConfiguration(root)).toEqual({
      aliases: new Map(),
      complete: false,
      potentialAliasKeys: new Set(['@static', '@dynamic']),
      potentialAliases: new Map([['@static', new Set(['./static'])]]),
    });
    expect(resolveVueProjectAliases(root)).toEqual(new Map());
  });

  it.each([
    [`aliases['@'] = './after';`, false],
    [`aliases.extra = './extra';`, false],
    [`delete aliases['@'];`, false],
    [`Object.assign(aliases, { '@': './after' });`, true],
    [`consume(aliases);`, true],
    [`const escaped = aliases; consume(escaped);`, true],
    [`consume({ alias: aliases });`, true],
    [`const holder = { alias: aliases }; consume(holder);`, true],
    [`const registry = [aliases]; consume(registry);`, true],
  ])(
    'fails closed when an alias binding mutates or escapes: %s',
    (escape, hasKey) => {
      const root = createTestProject({
        'vite.config.ts': `
        const aliases = { '@': './before' };
        ${escape}
        export default { resolve: { alias: aliases } };
      `,
      });

      expect(resolveVueProjectAliasConfiguration(root)).toEqual({
        aliases: new Map(),
        complete: false,
        ...(hasKey && {
          potentialAliases: new Map([['@', new Set(['./before'])]]),
        }),
        ...(hasKey && { potentialAliasKeys: new Set(['@']) }),
      });
    }
  );

  it.each([
    [
      'before a dynamic override',
      `{ '@i18n': './base', ...getAliases() }`,
      './base',
    ],
    [
      'after a dynamic spread',
      `{ ...getAliases(), '@i18n': './fixed' }`,
      './fixed',
    ],
    [
      'beside a dynamic array spread',
      `[{ find: '@i18n', replacement: './fixed' }, ...getAliases()]`,
      './fixed',
    ],
  ])('retains a static alias key %s', (_label, aliases, replacement) => {
    const root = createTestProject({
      'vite.config.ts': `
        export default { resolve: { alias: ${aliases} } };
      `,
    });

    expect(resolveVueProjectAliasConfiguration(root)).toEqual({
      aliases: new Map(),
      complete: false,
      potentialAliasKeys: new Set(['@i18n']),
      potentialAliases: new Map([['@i18n', new Set([replacement])]]),
    });
    expect(resolveVueProjectAliases(root)).toEqual(new Map());
  });

  it('fails closed when a dynamic spread can change alias precedence', () => {
    const root = createTestProject({
      'vite.config.ts': `
        const dynamic = getAliases();
        const aliases = { '@static': './static', ...dynamic };
        export default { resolve: { alias: aliases } };
      `,
    });

    expect(resolveVueProjectAliasConfiguration(root)).toEqual({
      aliases: new Map(),
      complete: false,
      potentialAliasKeys: new Set(['@static']),
      potentialAliases: new Map([['@static', new Set(['./static'])]]),
    });
  });

  it('preserves every static candidate for a duplicated incomplete alias', () => {
    const root = createTestProject({
      'vite.config.ts': `
        export default {
          resolve: {
            alias: [
              { find: '@i18n', replacement: './first' },
              ...getAliases(),
              { find: '@i18n', replacement: './second' },
            ],
          },
        };
      `,
    });

    expect(resolveVueProjectAliasConfiguration(root)).toEqual({
      aliases: new Map(),
      complete: false,
      potentialAliasKeys: new Set(['@i18n']),
      potentialAliases: new Map([['@i18n', new Set(['./first', './second'])]]),
    });
    expect(resolveVueProjectAliases(root)).toEqual(new Map());
  });

  it.each([
    [`{ find: '@', replacement: './src', customResolver() {} }`, true],
    [`{ find: '@', replacement: './src', customResolver: undefined }`, true],
    [`{ find: /^@/, replacement: './src' }`, false],
  ])(
    'fails closed for alias behavior that string mappings cannot model: %s',
    (alias, hasKey) => {
      const root = createTestProject({
        'vite.config.ts': `export default { resolve: { alias: [${alias}] } };`,
      });

      expect(resolveVueProjectAliasConfiguration(root)).toEqual({
        aliases: new Map(),
        complete: false,
        ...(hasKey && {
          potentialAliases: new Map([['@', new Set(['./src'])]]),
        }),
        ...(hasKey && { potentialAliasKeys: new Set(['@']) }),
      });
    }
  );

  it('uses only an explicit in-package Vite config when supplied', () => {
    const root = createTestProject({
      'vite.config.ts': `export default { resolve: { alias: { '@': './default' } } };`,
      'config/preview.config.ts': `export default { resolve: { alias: { '@': '../preview' } } };`,
    });
    const outside = createTestProject({
      'vite.config.ts': `export default { resolve: { alias: { '@': './outside' } } };`,
    });

    expect(
      resolveVueProjectAliases(root, {
        viteConfigPath: 'config/preview.config.ts',
      }).get('@')
    ).toBe('../preview');
    expect(
      resolveVueProjectAliasConfiguration(root, {
        viteConfigPath: path.join(outside, 'vite.config.ts'),
      })
    ).toEqual({ aliases: new Map(), complete: false });
    expect(
      resolveVueProjectAliasConfiguration(root, { viteConfigPath: '' })
    ).toEqual({ aliases: new Map(), complete: false });
  });

  function trailingSlash(directory: string): string {
    return `${directory.replaceAll(path.sep, '/')}/`;
  }
});

describe('local Vue wrapper provenance', () => {
  it('follows an import-only exact public subpath through local barrels', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/wrapper',
        exports: {
          '.': { import: './src/ordinary.ts' },
          './gt': {
            require: './src/ordinary.cjs',
            import: './src/gt.ts',
          },
        },
      }),
      'src/ordinary.ts': "export const ordinary = 'ordinary';\n",
      'src/ordinary.cjs': "module.exports = require('gt-vue');\n",
      'src/gt.ts': "export { LocalT } from './barrel';\n",
      'src/barrel.ts': "export { T as LocalT } from 'gt-vue';\n",
    });

    expect(exposesGT(root)).toBe(true);
  });

  it.each([
    'createGT',
    'initializeGT',
    'initializeGTSPA',
    'useLocale',
    'useSetLocale',
  ])('recognizes the non-extraction runtime export %s', (exportName) => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/runtime-wrapper',
        exports: './src/index.ts',
      }),
      'src/index.ts': `export { ${exportName} } from 'gt-vue';\n`,
    });

    expect(exposesGT(root)).toBe(true);
  });

  it('follows an immutable local alias exported under a wrapper name', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/derived-wrapper',
        exports: './src/index.ts',
      }),
      'src/index.ts': `
        import { T } from 'gt-vue';
        export const WrapperT = T;
      `,
    });

    expect(exposesGT(root)).toBe(true);
  });

  it.each([
    "import { T } from 'gt-vue'; export default T;",
    "import { T } from 'gt-vue'; const Alias = T; export default Alias;",
    "import { T } from 'gt-vue'; const Alias = T; export { Alias as default };",
  ])('follows a default alias: %s', (source) => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/default-wrapper',
        exports: './src/index.ts',
      }),
      'src/index.ts': source,
    });

    expect(exposesGT(root)).toBe(true);
  });

  it.each([
    `
      import { T } from 'gt-vue';
      import { h } from 'vue';
      export const WrapperT = (props) => h(T, props);
    `,
    `
      import { T } from 'gt-vue';
      import { defineComponent, h } from 'vue';
      export const WrapperT = defineComponent({
        setup(props) {
          return () => h(T, props);
        },
      });
    `,
    `
      import { T } from 'gt-vue';
      export const WrapperT = (props) => <T>{props.children}</T>;
    `,
    `
      import * as GT from 'gt-vue';
      export const WrapperT = (props) => <GT.T>{props.children}</GT.T>;
    `,
  ])('recognizes a public wrapper component: %s', (source) => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/component-wrapper',
        exports: './src/index.tsx',
      }),
      'src/index.tsx': source,
    });

    expect(exposesGT(root)).toBe(true);
  });

  it.each([
    `
      import { T } from 'gt-vue';
      import * as Vue from 'vue';
      export const WrapperT = (props) => Vue.h(T, props);
    `,
    `
      import { T } from 'gt-vue';
      import * as Vue from 'vue';
      export const WrapperT = (props) => Vue.createVNode(T, props);
    `,
    `
      import { T } from 'gt-vue';
      import * as Vue from 'vue';
      export const WrapperT = Vue.defineComponent({
        setup(props) {
          return () => Vue.h(T, props);
        },
      });
    `,
  ])('recognizes a namespace-imported Vue helper: %s', (source) => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/vue-namespace-wrapper',
        exports: './src/index.ts',
      }),
      'src/index.ts': source,
    });

    expect(exposesGT(root)).toBe(true);
  });

  it('follows an exact leaf destructured from an imported GT namespace', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/destructured-wrapper',
        exports: './src/index.ts',
      }),
      'src/index.ts': `
        import * as GT from 'gt-vue';
        const { T: WrapperT } = GT;
        export { WrapperT };
      `,
    });

    expect(exposesGT(root)).toBe(true);
  });

  it.each(['gt-react', 'gt-next', 'gt-react-native', 'gt-tanstack-start'])(
    'does not treat the %s namespace as gt-vue wrapper provenance',
    (runtime) => {
      const root = createTestProject({
        'package.json': JSON.stringify({
          name: '@fixture/react-family-wrapper',
          exports: './src/index.tsx',
        }),
        'src/index.tsx': `
          import * as GT from '${runtime}';
          export const WrapperT = () => <GT.T>React wrapper</GT.T>;
        `,
      });

      expect(exposesGT(root)).toBe(false);
    }
  );

  it.each([
    `
      import { T } from 'gt-vue';
      export const ordinary = (T) => T;
    `,
    `
      import { T } from 'gt-vue';
      export const ordinary = () => {
        void T;
        return 'ordinary';
      };
    `,
    `
      import { T } from 'gt-vue';
      let Alias = T;
      Alias = String;
      export { Alias };
    `,
    `
      import { T } from 'gt-vue';
      export const ordinary = unknownFactory(T);
    `,
    `
      import * as GT from 'gt-vue';
      export const WrapperT = (GT) => <GT.T>Shadowed wrapper</GT.T>;
    `,
    `
      import * as GT from 'gt-vue';
      const { ...Rest } = GT;
      export const WrapperT = Rest.T;
    `,
    `
      import * as GT from 'gt-vue';
      const key = 'T';
      const { [key]: WrapperT } = GT;
      export { WrapperT };
    `,
    `
      import * as GT from 'gt-vue';
      let { T: WrapperT } = GT;
      WrapperT = String;
      export { WrapperT };
    `,
    `
      import * as GT from 'gt-vue';
      GT.T = String;
      const { T: WrapperT } = GT;
      export { WrapperT };
    `,
    `
      import * as GT from 'gt-react';
      const { T: WrapperT } = GT;
      export { WrapperT };
    `,
    `
      import { T } from 'gt-vue';
      import * as Vue from 'vue';
      Vue.h = unknownFactory;
      export const WrapperT = () => Vue.h(T);
    `,
    `
      import { T } from 'gt-vue';
      import * as Vue from 'react';
      export const WrapperT = () => Vue.h(T);
    `,
  ])(
    'does not infer wrapper provenance from an unsafe derivation: %s',
    (source) => {
      const root = createTestProject({
        'package.json': JSON.stringify({
          name: '@fixture/unsafe-wrapper',
          exports: './src/index.tsx',
        }),
        'src/index.tsx': source,
      });

      expect(exposesGT(root)).toBe(false);
    }
  );

  it.each([
    "export * as Components from 'gt-vue';",
    "import * as GT from 'gt-vue'; export const Components = GT;",
  ])('does not promote a namespace container to a GT leaf: %s', (source) => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/namespace-container',
        exports: './src/index.ts',
      }),
      'src/index.ts': source,
    });

    expect(exposesGT(root)).toBe(false);
  });

  it('retains an exact primitive selected from a namespace', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/namespace-leaf',
        exports: './src/index.ts',
      }),
      'src/index.ts':
        "import * as GT from 'gt-vue'; export const WrapperT = GT.T;",
    });

    expect(exposesGT(root)).toBe(true);
  });

  it('rejects nonexistent gt-vue value exports', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/invalid-wrapper',
        exports: './src/index.ts',
      }),
      'src/index.ts': "export { NotActuallyExported } from 'gt-vue';\n",
    });

    expect(exposesGT(root)).toBe(false);
  });

  it('expands conditional wildcard exports through the import branch', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/wildcard-wrapper',
        exports: {
          './*': {
            require: './cjs/*.cjs',
            import: './src/*.ts',
          },
        },
      }),
      'cjs/runtime.cjs': "module.exports = require('ordinary');\n",
      'src/runtime.ts': "export { createGT } from 'gt-vue';\n",
    });

    expect(exposesGT(root)).toBe(true);
  });

  it('maps repeated wildcard captures to the same public subpath', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/repeated-wildcard',
        exports: { './pair/*': './src/*/copy-*.ts' },
      }),
      'src/runtime/copy-runtime.ts': "export { useLocale } from 'gt-vue';\n",
      'src/runtime/copy-other.ts': "export const ordinary = 'ordinary';\n",
    });

    expect(exposesGT(root)).toBe(true);
  });

  it('maps emitted wildcard JavaScript targets to TypeScript source', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/source-wildcard',
        exports: { './*': './dist/*.js' },
      }),
      'dist/runtime.ts': "export { useSetLocale } from 'gt-vue';\n",
    });

    expect(exposesGT(root)).toBe(true);
  });

  it('does not use an inactive wildcard require branch as provenance', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/conditional-wildcard',
        exports: {
          './*': {
            import: './src/*.ts',
            require: './cjs/*.js',
          },
        },
      }),
      'src/runtime.ts': "export const ordinary = 'ordinary';\n",
      'cjs/runtime.js': "export { createGT } from 'gt-vue';\n",
    });

    expect(exposesGT(root)).toBe(false);
  });

  it('honors an exact export that shadows a wildcard target', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/shadowed-wildcard',
        exports: {
          './secret': './src/ordinary.ts',
          './*': './src/*.ts',
        },
      }),
      'src/ordinary.ts': "export const ordinary = 'ordinary';\n",
      'src/secret.ts': "export { createGT } from 'gt-vue';\n",
    });

    expect(exposesGT(root)).toBe(false);
  });

  it('ignores private and out-of-package wildcard targets', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/contained-wildcard',
        exports: {
          './public/*': './src/public/*.ts',
          './escape/*': '../outside/*.ts',
        },
      }),
      'src/public/ordinary.ts': "export const ordinary = 'ordinary';\n",
      'src/private.ts': "export { createGT } from 'gt-vue';\n",
    });

    expect(exposesGT(root)).toBe(false);
  });

  it('ignores malformed wildcard targets', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/malformed-wildcard',
        exports: { './*': [null, 42, 'src/*.ts'] },
      }),
      'src/runtime.ts': "export { createGT } from 'gt-vue';\n",
    });

    expect(exposesGT(root)).toBe(false);
  });

  it('does not follow wildcard targets through a symlink outside the package', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/symlink-wildcard',
        exports: { './*': './src/*.ts' },
      }),
    });
    const outside = createTestProject({
      'index.ts': "export { createGT } from 'gt-vue';\n",
    });
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.symlinkSync(outside, path.join(root, 'src/escape'), 'dir');

    expect(exposesGT(root)).toBe(false);
  });

  it('fails closed after the finite wildcard file budget is exhausted', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/oversized-wildcard',
        exports: { './*': './src/*.ts' },
      }),
    });
    const sourceDirectory = path.join(root, 'src');
    fs.mkdirSync(sourceDirectory, { recursive: true });
    for (let index = 0; index <= 2_000; index += 1) {
      fs.writeFileSync(
        path.join(sourceDirectory, `${index}.ts`),
        index === 2_000
          ? "export { createGT } from 'gt-vue';\n"
          : "export const ordinary = 'ordinary';\n"
      );
    }

    expect(exposesGT(root)).toBe(false);
  });

  it('does not treat internal gt-vue use as a public wrapper API', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/ordinary',
        exports: { '.': { import: './src/index.ts' } },
        dependencies: { 'gt-vue': '*' },
      }),
      'src/index.ts': `
        import { T } from 'gt-vue';
        void T;
        export const ordinary = 'ordinary';
      `,
    });

    expect(exposesGT(root)).toBe(false);
  });

  it('uses the import condition rather than a GT require branch', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/conditional',
        exports: {
          '.': {
            import: './src/ordinary.ts',
            require: './src/gt.js',
          },
        },
      }),
      'src/ordinary.ts': "export const ordinary = 'ordinary';\n",
      'src/gt.js': "export { T } from 'gt-vue';\n",
    });

    expect(exposesGT(root)).toBe(false);
  });

  it('fails closed when the public entrypoint is malformed', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/malformed',
        exports: './src/index.ts',
      }),
      'src/index.ts': "export { T } from 'gt-vue'; const broken = @;\n",
    });

    expect(exposesGT(root)).toBe(false);
  });

  it('does not treat a type-only gt-vue reexport as runtime provenance', () => {
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/type-wrapper',
        exports: './src/index.ts',
      }),
      'src/index.ts':
        "export type { CreateGTOptions, GTPlugin } from 'gt-vue';\n",
    });

    expect(exposesGT(root)).toBe(false);
  });

  function exposesGT(root: string): boolean {
    const manifest = readJavaScriptPackageManifest(
      path.join(root, 'package.json')
    );
    if (!manifest) throw new Error('Expected a valid fixture manifest');
    return packagePubliclyExposesGT(root, manifest);
  }
});
