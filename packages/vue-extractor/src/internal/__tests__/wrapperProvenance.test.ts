import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readJavaScriptPackageManifest } from '../project/manifest.js';
import { packagePubliclyExposesGT } from '../project/wrapperProvenance.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('local Vue wrapper provenance', () => {
  it('follows an import-only exact public subpath through local barrels', () => {
    const root = createPackage({
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

  it.each(['createGT', 'useLocale', 'useSetLocale'])(
    'recognizes the non-extraction runtime export %s',
    (exportName) => {
      const root = createPackage({
        'package.json': JSON.stringify({
          name: '@fixture/runtime-wrapper',
          exports: './src/index.ts',
        }),
        'src/index.ts': `export { ${exportName} } from 'gt-vue';\n`,
      });

      expect(exposesGT(root)).toBe(true);
    }
  );

  it('rejects nonexistent gt-vue value exports', () => {
    const root = createPackage({
      'package.json': JSON.stringify({
        name: '@fixture/invalid-wrapper',
        exports: './src/index.ts',
      }),
      'src/index.ts': "export { NotActuallyExported } from 'gt-vue';\n",
    });

    expect(exposesGT(root)).toBe(false);
  });

  it('expands conditional wildcard exports through the import branch', () => {
    const root = createPackage({
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
    const root = createPackage({
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
    const root = createPackage({
      'package.json': JSON.stringify({
        name: '@fixture/source-wildcard',
        exports: { './*': './dist/*.js' },
      }),
      'dist/runtime.ts': "export { useSetLocale } from 'gt-vue';\n",
    });

    expect(exposesGT(root)).toBe(true);
  });

  it('does not use an inactive wildcard require branch as provenance', () => {
    const root = createPackage({
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
    const root = createPackage({
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
    const root = createPackage({
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
    const root = createPackage({
      'package.json': JSON.stringify({
        name: '@fixture/malformed-wildcard',
        exports: { './*': [null, 42, 'src/*.ts'] },
      }),
      'src/runtime.ts': "export { createGT } from 'gt-vue';\n",
    });

    expect(exposesGT(root)).toBe(false);
  });

  it('does not follow wildcard targets through a symlink outside the package', () => {
    const root = createPackage({
      'package.json': JSON.stringify({
        name: '@fixture/symlink-wildcard',
        exports: { './*': './src/*.ts' },
      }),
    });
    const outside = createPackage({
      'index.ts': "export { createGT } from 'gt-vue';\n",
    });
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.symlinkSync(outside, path.join(root, 'src/escape'), 'dir');

    expect(exposesGT(root)).toBe(false);
  });

  it('fails closed after the finite wildcard file budget is exhausted', () => {
    const root = createPackage({
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
    const root = createPackage({
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
    const root = createPackage({
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
    const root = createPackage({
      'package.json': JSON.stringify({
        name: '@fixture/malformed',
        exports: './src/index.ts',
      }),
      'src/index.ts': "export { T } from 'gt-vue'; const broken = @;\n",
    });

    expect(exposesGT(root)).toBe(false);
  });

  it('does not treat a type-only gt-vue reexport as runtime provenance', () => {
    const root = createPackage({
      'package.json': JSON.stringify({
        name: '@fixture/type-wrapper',
        exports: './src/index.ts',
      }),
      'src/index.ts':
        "export type { CreateGTOptions, GTPlugin } from 'gt-vue';\n",
    });

    expect(exposesGT(root)).toBe(false);
  });
});

function exposesGT(root: string): boolean {
  const manifest = readJavaScriptPackageManifest(
    path.join(root, 'package.json')
  );
  if (!manifest) throw new Error('Expected a valid fixture manifest');
  return packagePubliclyExposesGT(root, manifest);
}

function createPackage(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-wrapper-'));
  temporaryDirectories.push(root);
  for (const [relativePath, source] of Object.entries(files)) {
    const file = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
  }
  return root;
}
