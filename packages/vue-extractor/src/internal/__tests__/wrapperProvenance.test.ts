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

  it.each(['createGT', 'initializeGTSPA', 'useLocale', 'useSetLocale'])(
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

  it('follows an immutable local alias exported under a wrapper name', () => {
    const root = createPackage({
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
    const root = createPackage({
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
    const root = createPackage({
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
    const root = createPackage({
      'package.json': JSON.stringify({
        name: '@fixture/vue-namespace-wrapper',
        exports: './src/index.ts',
      }),
      'src/index.ts': source,
    });

    expect(exposesGT(root)).toBe(true);
  });

  it('follows an exact leaf destructured from an imported GT namespace', () => {
    const root = createPackage({
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
      const root = createPackage({
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
      const root = createPackage({
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
    const root = createPackage({
      'package.json': JSON.stringify({
        name: '@fixture/namespace-container',
        exports: './src/index.ts',
      }),
      'src/index.ts': source,
    });

    expect(exposesGT(root)).toBe(false);
  });

  it('retains an exact primitive selected from a namespace', () => {
    const root = createPackage({
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
