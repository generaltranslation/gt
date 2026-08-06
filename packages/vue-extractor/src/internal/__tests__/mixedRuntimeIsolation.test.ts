import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

const REACT_FAMILY_RUNTIMES = [
  'gt-react',
  'gt-next',
  'gt-react-native',
  'gt-tanstack-start',
] as const;

const OTHER_NON_VUE_GT_RUNTIMES = [
  {
    importNames: 'useGT, useMessages',
    source: '@generaltranslation/react-core/hooks',
    usage: `
      const gt = useGT();
      const m = useMessages();
      gt('React core function');
      m('React core message');
    `,
  },
  { importNames: 'msg', source: 'gt-node', usage: `msg('Node message');` },
  { importNames: 'msg', source: 'gt-i18n', usage: `msg('i18n message');` },
] as const;

let fixtureRoot: string;

beforeEach(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-mixed-'));
});

afterEach(() => {
  fs.rmSync(fixtureRoot, { force: true, recursive: true });
});

describe('mixed-runtime isolation', () => {
  it.each(REACT_FAMILY_RUNTIMES)(
    'does not diagnose React-family APIs imported from %s',
    async (runtime) => {
      const output = await extractFromVueSource(
        `
          import { T, msg, useGT, useMessages } from '${runtime}';
          const gt = useGT();
          const m = useMessages();
          gt('React-family function');
          m(msg('React-family message'));
          export const View = () => <T>React-family rich text</T>;
        `,
        path.join(fixtureRoot, 'View.tsx'),
        {
          projectRoot: fixtureRoot,
          resolveModule: () => undefined,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([]);
    }
  );

  it.each(OTHER_NON_VUE_GT_RUNTIMES)(
    'does not diagnose GT-shaped APIs from $source',
    async ({ importNames, source, usage }) => {
      const output = await extractFromVueSource(
        `import { ${importNames} } from '${source}'; ${usage}`,
        path.join(fixtureRoot, 'ordinary.ts'),
        {
          projectRoot: fixtureRoot,
          resolveModule: () => undefined,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([]);
    }
  );

  it.each(REACT_FAMILY_RUNTIMES)(
    'preserves ordinary provenance for local reexports from %s',
    async (runtime) => {
      const barrelPath = write(
        'runtime.ts',
        `export { T, msg, useGT, useMessages } from '${runtime}';`
      );
      const source = `
        import { T, msg, useGT, useMessages } from '@app/runtime';
        const gt = useGT();
        const m = useMessages();
        gt('Locally reexported function');
        m(msg('Locally reexported message'));
        export const View = () => <T>Locally reexported rich text</T>;
      `;
      const filePath = write('View.tsx', source);
      const output = await extractFromVueSource(source, filePath, {
        projectRoot: fixtureRoot,
        resolveModule(specifier) {
          return specifier === '@app/runtime' ? barrelPath : undefined;
        },
      });

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([]);
    }
  );

  it('keeps unknown custom GT-shaped aliases fail-closed', async () => {
    const output = await extractFromVueSource(
      `
        import { T as Translate, msg as defineMessage } from '@missing/gt';
        defineMessage('Unresolved message');
        export const View = () => <Translate>Unresolved rich text</Translate>;
      `,
      path.join(fixtureRoot, 'Unresolved.tsx'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule: () => undefined,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it('keeps unresolved custom component aliases fail-closed in templates', async () => {
    const output = await extractFromVueSource(
      `
        <script setup>
          import { T as Translate } from '@missing/gt';
        </script>
        <template><Translate>Unresolved rich text</Translate></template>
      `,
      path.join(fixtureRoot, 'Unresolved.vue'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule: () => undefined,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue component alias'),
    ]);
  });

  it('extracts gt-vue while ignoring a colocated React runtime', async () => {
    const output = await extractFromVueSource(
      `
        import { T as VueT, useGT as useVueGT } from 'gt-vue';
        import { T as ReactT, useGT as useReactGT } from 'gt-react';
        const vueGT = useVueGT();
        const reactGT = useReactGT();
        vueGT('Vue function');
        reactGT('React function');
        export const View = () => (
          <><VueT>Vue rich text</VueT><ReactT>React rich text</ReactT></>
        );
      `,
      path.join(fixtureRoot, 'Mixed.js'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule: () => undefined,
      }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Vue function',
      'Vue rich text',
    ]);
  });
});

describe('standalone script provenance gating', () => {
  it.each([
    {
      expected: ['Namespace string', 'Namespace rich'],
      file: 'namespace.tsx',
      source: `import * as GT from 'gt-vue';
        GT.msg('Namespace string');
        export const View = () => <GT.T>Namespace rich</GT.T>;`,
    },
    {
      expected: ['Require string'],
      file: 'required.cjs',
      source: `const { msg } = require('gt-vue'); msg('Require string');`,
    },
  ])('retains supported gt-vue provenance in $file', async (fixture) => {
    const output = await extractFromVueSource(
      fixture.source,
      path.join(fixtureRoot, fixture.file),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule: () => undefined,
      }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual(
      fixture.expected
    );
  });

  it('does not hide unsupported dynamic gt-vue provenance', async () => {
    const output = await extractFromVueSource(
      `async function load() {
        const GT = await import('gt-vue');
        GT.msg('Dynamic string');
      }
      void load();`,
      path.join(fixtureRoot, 'dynamic.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule: () => undefined,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it.each([
    {
      expected: 'Direct require message',
      source: `require('gt-vue').msg('Direct require message');`,
    },
    {
      expected: 'Direct require function',
      source: `require('gt-vue').useGT()('Direct require function');`,
    },
    {
      expected: 'Direct require messages function',
      source: `require('gt-vue').useMessages()('Direct require messages function');`,
    },
  ])(
    'retains a supported CommonJS call chain for $expected',
    async ({ expected, source }) => {
      const output = await extractFromVueSource(
        source,
        path.join(fixtureRoot, 'direct-require.cjs'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
          resolveModule: () => undefined,
        }
      );

      expect(output.errors).toEqual([]);
      expect(output.results.map(({ source: message }) => message)).toEqual([
        expected,
      ]);
    }
  );

  it.each([
    {
      file: 'ReactView.ts',
      source: `import { T } from 'gt-react'; export const View = () => <T>React</T>;`,
    },
    {
      file: 'typed.js',
      source: `export const label: string = 'React';`,
    },
  ])(
    'ignores unowned React-valid syntax in $file',
    async ({ file, source }) => {
      const output = await extractFromVueSource(
        source,
        path.join(fixtureRoot, file),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
          resolveModule: () => undefined,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([]);
    }
  );

  it('does not make an unrelated Flow-typed React file Vue-fatal', async () => {
    const output = await extractFromVueSource(
      `import { msg } from 'gt-react';
      type Props = {| name: string |};
      msg('React Flow');`,
      path.join(fixtureRoot, 'flow.js'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule: () => undefined,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('keeps an unparseable direct gt-vue import fail-closed', async () => {
    const output = await extractFromVueSource(
      `import { msg } from 'gt-vue'; msg('Owned'); const broken = @;`,
      path.join(fixtureRoot, 'broken.js'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule: () => undefined,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('Could not parse a gt-vue script block'),
    ]);
  });

  it('keeps an unparseable local gt-vue barrel fail-closed', async () => {
    const barrelPath = write(
      'src/broken-barrel.ts',
      `export { msg as defineMessage } from 'gt-vue';`
    );
    const output = await extractFromVueSource(
      `import { defineMessage } from '@app/i18n';
      defineMessage('Owned through barrel');
      const broken = @;`,
      path.join(fixtureRoot, 'src', 'broken-entry.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule(specifier) {
          return specifier === '@app/i18n' ? barrelPath : undefined;
        },
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('Could not parse a gt-vue script block'),
    ]);
  });

  it.each(['ts', 'mts', 'cts'])(
    'recognizes a local barrel before an angle-bracket assertion in .%s',
    async (extension) => {
      const barrelPath = write(
        'src/assertion-barrel.ts',
        `export { msg as defineMessage } from 'gt-vue';`
      );
      const source = `import { defineMessage } from './barrel';
        const count = <number>1;
        void count;
        defineMessage('Angle assertion message');`;
      const output = await extractFromVueSource(
        source,
        path.join(fixtureRoot, 'src', `assertion.${extension}`),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
          resolveModule(specifier) {
            return specifier === './barrel' ? barrelPath : undefined;
          },
        }
      );

      expect(output.errors).toEqual([]);
      expect(output.results.map(({ source: message }) => message)).toEqual([
        'Angle assertion message',
      ]);
    }
  );

  it('treats an installed opaque package useGT export as ordinary', async () => {
    const packageEntry = write(
      'node_modules/unrelated-hooks/index.cjs',
      `exports.useGT = () => (value) => value;`
    );
    const source = `
      import { useGT } from 'unrelated-hooks';
      const ordinary = useGT();
      ordinary('Not a translation');
    `;
    const output = await extractFromVueSource(
      source,
      path.join(fixtureRoot, 'ordinary.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule(specifier) {
          return specifier === 'unrelated-hooks' ? packageEntry : undefined;
        },
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('treats an installed ESM package useGT export as ordinary', async () => {
    const packageEntry = write(
      'node_modules/unrelated-esm/index.js',
      `export function useGT() { return (value) => value; }`
    );
    const source = `
      import { useGT } from 'unrelated-esm';
      const ordinary = useGT();
      ordinary('Not a translation');
    `;
    const output = await extractFromVueSource(
      source,
      path.join(fixtureRoot, 'ordinary-esm.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule(specifier) {
          return specifier === 'unrelated-esm' ? packageEntry : undefined;
        },
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('proves gt-vue provenance through a local barrel', async () => {
    const barrelPath = write(
      'src/i18n.ts',
      `export { msg as defineMessage } from 'gt-vue';`
    );
    const source = `
      import { defineMessage } from '@app/i18n';
      defineMessage('Local wrapper message');
    `;
    const output = await extractFromVueSource(
      source,
      path.join(fixtureRoot, 'src', 'message.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule(specifier) {
          return specifier === '@app/i18n' ? barrelPath : undefined;
        },
      }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source: message }) => message)).toEqual([
      'Local wrapper message',
    ]);
  });

  it.skipIf(process.platform === 'win32')(
    'recognizes a local workspace barrel through a node_modules symlink',
    async () => {
      const workspaceEntry = write(
        'packages/i18n/index.ts',
        `export { msg as defineMessage } from 'gt-vue';`
      );
      const linkedPackage = path.join(
        fixtureRoot,
        'node_modules',
        '@app',
        'i18n'
      );
      fs.mkdirSync(path.dirname(linkedPackage), { recursive: true });
      fs.symlinkSync(path.dirname(workspaceEntry), linkedPackage, 'dir');
      const source = `
        import { defineMessage } from '@app/i18n';
        defineMessage('Symlinked workspace message');
      `;
      const output = await extractFromVueSource(
        source,
        path.join(fixtureRoot, 'src', 'symlinked-message.ts'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
          resolveModule(specifier) {
            return specifier === '@app/i18n'
              ? path.join(linkedPackage, 'index.ts')
              : undefined;
          },
        }
      );

      expect(output.errors).toEqual([]);
      expect(output.results.map(({ source: message }) => message)).toEqual([
        'Symlinked workspace message',
      ]);
    }
  );

  it.skipIf(process.platform === 'win32')(
    'recognizes a symlinked workspace barrel outside the metadata project root',
    async () => {
      const outsideWorkspace = fs.mkdtempSync(
        path.join(os.tmpdir(), 'gt-vue-outside-workspace-')
      );
      try {
        const workspaceEntry = path.join(outsideWorkspace, 'index.ts');
        fs.writeFileSync(
          workspaceEntry,
          `export { msg as defineMessage } from 'gt-vue';`
        );
        const linkedPackage = path.join(
          fixtureRoot,
          'node_modules',
          '@app',
          'i18n'
        );
        fs.mkdirSync(path.dirname(linkedPackage), { recursive: true });
        fs.symlinkSync(outsideWorkspace, linkedPackage, 'dir');
        const source = `import { defineMessage } from '@app/i18n';
          defineMessage('Outside workspace message');`;
        const output = await extractFromVueSource(
          source,
          path.join(fixtureRoot, 'src', 'outside-workspace.ts'),
          {
            projectRoot: fixtureRoot,
            requireGTProvenance: true,
            resolveModule(specifier) {
              return specifier === '@app/i18n'
                ? path.join(linkedPackage, 'index.ts')
                : undefined;
            },
          }
        );

        expect(output.errors).toEqual([]);
        expect(output.results.map(({ source: message }) => message)).toEqual([
          'Outside workspace message',
        ]);
      } finally {
        fs.rmSync(outsideWorkspace, { force: true, recursive: true });
      }
    }
  );
});

describe('JavaScript JSX parsing', () => {
  it.each([
    { extension: '.js', moduleSyntax: 'export const View = ViewNode;' },
    { extension: '.mjs', moduleSyntax: 'export const View = ViewNode;' },
    { extension: '.cjs', moduleSyntax: 'module.exports = ViewNode;' },
  ])('accepts CRA-style JSX in $extension files', async (fixture) => {
    const output = await extractFromVueSource(
      `
        import { T } from 'gt-react';
        const ViewNode = () => <T>React rich text</T>;
        ${fixture.moduleSyntax}
      `,
      path.join(fixtureRoot, `View${fixture.extension}`),
      {
        projectRoot: fixtureRoot,
        resolveModule: () => undefined,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it.each([
    { language: '', name: 'implicit JavaScript' },
    { language: ' lang="js"', name: 'explicit JavaScript' },
  ])('accepts JSX in an SFC $name script', async ({ language }) => {
    const output = await extractFromVueSource(
      `
        <script${language}>
          import { T } from 'gt-react';
          const View = () => <T>React rich text</T>;
        </script>
        <template><View /></template>
      `,
      path.join(fixtureRoot, 'View.vue'),
      {
        projectRoot: fixtureRoot,
        resolveModule: () => undefined,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('continues to require TSX for JSX in TypeScript files', async () => {
    const output = await extractFromVueSource(
      `export const View = () => <div>TypeScript JSX</div>;`,
      path.join(fixtureRoot, 'View.ts'),
      { projectRoot: fixtureRoot }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('Could not parse a gt-vue script block'),
    ]);
  });
});

/** Writes one local module used by the read-only resolver tests. */
function write(relativePath: string, source: string): string {
  const filePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source);
  return filePath;
}
