import fs from 'node:fs';
import path from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { createProjectModuleResolver } from '../project/moduleResolver.js';
import {
  createProjectFixture,
  removeProjectFixture,
} from './projectTestUtils.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    removeProjectFixture(directory);
  }
});

describe('project module resolution', () => {
  it('matches Vite default extension precedence', () => {
    const root = createFixture({
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
    const root = createFixture({
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
    const root = createFixture({
      'src/importer.ts': '',
      'src/message.ts': '',
    });
    const resolveModule = createProjectModuleResolver();

    expectResolved(
      resolveModule('./message.js', path.join(root, 'src/importer.ts')),
      path.join(root, 'src/message.ts')
    );
  });

  it('selects import exports instead of CommonJS exports', () => {
    const root = createFixture({
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
    const root = createFixture({
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
    const root = createFixture({
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
    const root = createFixture({
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
    const root = createFixture({
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
    const root = createFixture({
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
    const root = createFixture({
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
    const root = createFixture({
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
    const root = createFixture({
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
    const root = createFixture({
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
});

function createFixture(files: Record<string, string>): string {
  const root = createProjectFixture(files);
  temporaryDirectories.push(root);
  return root;
}

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
