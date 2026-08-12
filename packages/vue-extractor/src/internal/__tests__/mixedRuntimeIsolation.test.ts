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
          import { T, msg, t, useGT, useMessages } from '${runtime}';
          const gt = useGT();
          const m = useMessages();
          gt('React-family function');
          m(msg('React-family message'));
          t('React-family immediate translation');
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
        `export { T, msg, t, useGT, useMessages } from '${runtime}';`
      );
      const source = `
        import { T, msg, t, useGT, useMessages } from '@app/runtime';
        const gt = useGT();
        const m = useMessages();
        gt('Locally reexported function');
        m(msg('Locally reexported message'));
        t('Locally reexported immediate translation');
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

  it('ignores unresolved GT-shaped aliases without gt-vue ownership', async () => {
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
    expect(output.errors).toEqual([]);
  });

  it.each(['cjs', 'cts'])(
    'ignores an ordinary helper imported from a local .%s module',
    async (extension) => {
      write(
        `ordinary.${extension}`,
        `exports.useGT = () => (source) => source;`
      );
      const output = await extractFromVueSource(
        `import { useGT } from './ordinary.${extension}';
         const gt = useGT();
         gt('Ordinary CommonJS string');`,
        path.join(fixtureRoot, 'ReactView.tsx'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([]);
    }
  );

  it.each([
    {
      entry: `import { ordinary } from './mixed';
        import { useGT } from '@missing/gt';
        ordinary();
        const gt = useGT();
        gt('Ordinary named import');`,
      filename: 'NamedConsumer.tsx',
      module: `import { msg } from 'gt-vue';
        void msg;
        export function ordinary() { return 'ordinary'; }`,
    },
    {
      entry: `import * as mixed from './mixed';
        import { useGT } from '@missing/gt';
        mixed.ordinary();
        const gt = useGT();
        gt('Ordinary namespace import');`,
      filename: 'NamespaceConsumer.tsx',
      module: `export { msg } from 'gt-vue';
        export function ordinary() { return 'ordinary'; }`,
    },
    {
      entry: `import { ordinary } from './mixed';
        import { useGT } from '@missing/gt';
        const label: string = ordinary();
        const gt = useGT();
        gt(label);`,
      filename: 'TypedConsumer.js',
      module: `import { msg } from 'gt-vue';
        void msg;
        export function ordinary() { return 'ordinary'; }`,
    },
  ])(
    'does not inherit gt-vue ownership from an unrelated local export ($filename)',
    async ({ entry, filename, module }) => {
      write('mixed.ts', module);
      const output = await extractFromVueSource(
        entry,
        path.join(fixtureRoot, filename),
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

  it.each([
    {
      expected: 'Found conditional JSX content',
      source: `const condition = true;
        export const View = () => (
          <mixed.T>{condition ? 'First' : 'Second'}</mixed.T>
        );`,
    },
    {
      expected: 'Vue render function',
      source: `export const View = () =>
        mixed.h(mixed.T, null, 'Render text');`,
    },
  ])(
    'preserves the $expected diagnostic for a used GT member of a mixed namespace',
    async ({ expected, source }) => {
      write(
        'mixed.ts',
        `export { T } from 'gt-vue';
         export { h } from 'vue';
         export function ordinary() { return 'ordinary'; }`
      );
      const output = await extractFromVueSource(
        `import * as mixed from './mixed'; ${source}`,
        path.join(fixtureRoot, 'NamespaceError.tsx'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([expect.stringContaining(expected)]);
    }
  );

  it('keeps unresolved aliases fail-closed after gt-vue ownership is proven', async () => {
    const output = await extractFromVueSource(
      `
        import { msg } from 'gt-vue';
        import { useGT } from '@missing/gt';
        void msg;
        const gt = useGT();
        gt('Unresolved message');
      `,
      path.join(fixtureRoot, 'OwnedUnresolved.ts'),
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

  it('does not treat a type-only gt-vue import as runtime ownership', async () => {
    const output = await extractFromVueSource(
      `
        import { type GTFunction } from 'gt-vue';
        import { useGT } from '@theme/gt';
        const gt: GTFunction = useGT();
        gt('Ordinary theme string');
      `,
      path.join(fixtureRoot, 'TypeOnly.tsx'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule: () => undefined,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('does not treat a Flow typeof gt-vue import as runtime ownership', async () => {
    const output = await extractFromVueSource(
      `
        import typeof { GTFunction } from 'gt-vue';
        import { useGT } from '@theme/gt';
        const gt: GTFunction = useGT();
        gt('Ordinary Flow theme string');
      `,
      path.join(fixtureRoot, 'TypeOnlyFlow.js'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule: () => undefined,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('does not treat a type-only import-equals as runtime ownership', async () => {
    const output = await extractFromVueSource(
      `import type GT = require('gt-vue');
       import { useGT } from '@theme/gt';
       const gt = useGT();
       gt('Ordinary import-equals theme string');
       void (0 as unknown as GT.GTFunction);`,
      path.join(fixtureRoot, 'TypeOnlyImportEquals.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule: () => undefined,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('keeps mixed type and value gt-vue imports runtime-owned', async () => {
    const output = await extractFromVueSource(
      `import { type GTFunction, msg } from 'gt-vue';
       const message: GTFunction | string = msg('Mixed import message');
       void message;`,
      path.join(fixtureRoot, 'MixedTypeValue.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule: () => undefined,
      }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Mixed import message',
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

  it.each([
    {
      source: `import { t } from '@missing/gt'; t('Unresolved named t');`,
      title: 'named',
    },
    {
      source: `import * as GT from '@missing/gt'; GT.t('Unresolved namespace t');`,
      title: 'namespace',
    },
  ])(
    'ignores an unresolved custom $title t() import without gt-vue ownership',
    async ({ source }) => {
      const output = await extractFromVueSource(
        source,
        path.join(fixtureRoot, 'UnresolvedOrdinaryT.ts'),
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

  it.each([
    {
      source: `import { msg } from 'gt-vue';
        import { t } from '@missing/gt';
        void msg;
        t('Unresolved named t');`,
      title: 'named',
    },
    {
      source: `import { msg } from 'gt-vue';
        import * as GT from '@missing/gt';
        void msg;
        GT.t('Unresolved namespace t');`,
      title: 'namespace',
    },
    {
      source: `import { msg } from 'gt-vue';
        const runtime = getRuntime();
        const { t } = await import(runtime);
        void msg;
        t('Unresolved dynamic t');`,
      title: 'dynamic',
    },
  ])(
    'keeps an unresolved custom $title t() import ordinary alongside gt-vue ownership',
    async ({ source }) => {
      const output = await extractFromVueSource(
        source,
        path.join(fixtureRoot, 'UnresolvedT.ts'),
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

  it('extracts gt-vue while ignoring a colocated React runtime', async () => {
    const output = await extractFromVueSource(
      `
        import { T as VueT, t as vueT, useGT as useVueGT } from 'gt-vue';
        import { T as ReactT, t as reactT, useGT as useReactGT } from 'gt-react';
        const vueGT = useVueGT();
        const reactGT = useReactGT();
        vueGT('Vue function');
        vueT('Vue immediate translation');
        reactGT('React function');
        reactT('React immediate translation');
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
      'Vue immediate translation',
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

  it('does not hide unsupported dynamic gt-vue t() provenance', async () => {
    const output = await extractFromVueSource(
      `async function load() {
        const GT = await import('gt-vue');
        GT.t('Dynamic translation');
      }
      void load();`,
      path.join(fixtureRoot, 'dynamic-t.ts'),
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

  it('does not hide a used gt-vue member from a dynamic local namespace', async () => {
    write(
      'dynamic-barrel.ts',
      `export { msg } from 'gt-vue';
       export function ordinary() { return 'ordinary'; }`
    );
    const output = await extractFromVueSource(
      `const GT = await import('./dynamic-barrel');
       GT.msg('Dynamic local string');`,
      path.join(fixtureRoot, 'dynamic-local.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it.each([
    `const key = 'msg'; GT[key]('Computed dynamic local');`,
    `const Alias = GT; Alias.msg('Aliased dynamic local');`,
    `const { msg } = GT; msg('Destructured dynamic local');`,
    `const consume = (value) => value.msg('Forwarded dynamic local'); consume(GT);`,
  ])(
    'retains ownership through a proven dynamic namespace flow',
    async (usage) => {
      write(
        'dynamic-flow.ts',
        `export { msg } from 'gt-vue';
         export function ordinary() { return 'ordinary'; }`
      );
      const output = await extractFromVueSource(
        `const GT = await import('./dynamic-flow'); ${usage}`,
        path.join(fixtureRoot, 'dynamic-flow-consumer.ts'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([
        expect.stringContaining('possible gt-vue string function alias'),
      ]);
    }
  );

  it('does not inherit ownership from an unused dynamic namespace member', async () => {
    write(
      'dynamic-mixed.ts',
      `export { msg } from 'gt-vue';
       export function ordinary() { return 'ordinary'; }`
    );
    const output = await extractFromVueSource(
      `const mixed = await import('./dynamic-mixed');
       mixed.ordinary();`,
      path.join(fixtureRoot, 'dynamic-ordinary.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it.each([
    {
      expected: 'Direct require message',
      source: `require('gt-vue').msg('Direct require message');`,
    },
    {
      expected: 'Direct require translation',
      source: `require('gt-vue').t('Direct require translation');`,
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

  it.each(REACT_FAMILY_RUNTIMES)(
    'does not let a %s call opt TypeScript-in-JavaScript into Vue parsing',
    async (runtime) => {
      const output = await extractFromVueSource(
        `import { useGT } from '${runtime}';
        const gt = useGT();
        const label: string = gt('React typed JavaScript');
        void label;`,
        path.join(fixtureRoot, 'typed.js'),
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

  it('keeps a gt-vue import after malformed syntax fail-closed', async () => {
    const output = await extractFromVueSource(
      `const broken = @;
       import { msg } from 'gt-vue';
       msg('Owned after syntax error');`,
      path.join(fixtureRoot, 'broken-before-import.js'),
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

  it('keeps a gt-vue import before a multiline syntax error fail-closed', async () => {
    const output = await extractFromVueSource(
      `import { msg } from 'gt-vue';
       const broken = (
         @
       );`,
      path.join(fixtureRoot, 'multiline-error-after-import.js'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('Could not parse a gt-vue script block'),
    ]);
  });

  it.each([
    `import * as GT from './multiline-barrel';
     const broken = (\n@\n);
     GT.msg('Static namespace after error');`,
    `const GT = await import('./multiline-barrel');
     const broken = (\n@\n);
     GT.msg('Dynamic namespace after error');`,
    `const { msg } = await import('./multiline-barrel');
     const broken = (\n@\n);
     msg('Dynamic binding after error');`,
  ])(
    'retains local-barrel ownership across a later multiline syntax error',
    async (source) => {
      write(
        'multiline-barrel.ts',
        `export { msg } from 'gt-vue';
         export function ordinary() { return 'ordinary'; }`
      );
      const output = await extractFromVueSource(
        source,
        path.join(fixtureRoot, 'multiline-local-error.ts'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([
        expect.stringContaining('Could not parse a gt-vue script block'),
      ]);
    }
  );

  it.each(['static import', 'local barrel'])(
    'does not exhaust malformed ownership recovery before a later %s',
    async (kind) => {
      const barrelPath = write(
        'src/many-errors-barrel.ts',
        `export { msg as defineMessage } from 'gt-vue';`
      );
      const reference =
        kind === 'static import'
          ? `import { msg } from 'gt-vue'; msg('Owned after many errors');`
          : `import { defineMessage } from '@app/many-errors';
             defineMessage('Owned local after many errors');`;
      const malformed = Array.from(
        { length: 20 },
        (_, index) => `const broken${index} = @;`
      ).join('\n');
      const output = await extractFromVueSource(
        `${malformed}\n${reference}`,
        path.join(fixtureRoot, 'src', `many-errors-${kind}.js`),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
          resolveModule(specifier) {
            return specifier === '@app/many-errors' ? barrelPath : undefined;
          },
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([
        expect.stringContaining('Could not parse a gt-vue script block'),
      ]);
    }
  );

  it('keeps a direct CommonJS call after malformed syntax fail-closed', async () => {
    const malformed = Array.from(
      { length: 20 },
      (_, index) => `const broken${index} = @;`
    ).join('\n');
    const output = await extractFromVueSource(
      `${malformed}
       require('gt-vue').msg('Owned CommonJS call');`,
      path.join(fixtureRoot, 'broken-before-require.js'),
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

  it.each(['direct import', 'dynamic import', 'local barrel'])(
    'recovers a later %s after malformed TSX',
    async (kind) => {
      const barrelPath = write(
        'src/tsx-recovery-barrel.ts',
        `export { msg as defineMessage } from 'gt-vue';`
      );
      const reference =
        kind === 'direct import'
          ? `import { msg } from 'gt-vue'; msg('Owned direct import');`
          : kind === 'dynamic import'
            ? `const { msg } = await import('gt-vue'); msg('Owned dynamic import');`
            : `import { defineMessage } from '@app/tsx-recovery';
               defineMessage('Owned local barrel');`;
      const output = await extractFromVueSource(
        `type Props = { label: string };
         const View = (props: Props) => <div>{props.label}</div>;
         const broken = @;
         ${reference}`,
        path.join(
          fixtureRoot,
          'src',
          `broken-${kind.replaceAll(' ', '-')}.tsx`
        ),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
          resolveModule(specifier) {
            return specifier === '@app/tsx-recovery' ? barrelPath : undefined;
          },
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([
        expect.stringContaining('Could not parse a gt-vue script block'),
      ]);
    }
  );

  it('keeps a local gt-vue barrel after malformed syntax fail-closed', async () => {
    const barrelPath = write(
      'src/later-barrel.ts',
      `export { msg as defineMessage } from 'gt-vue';`
    );
    const output = await extractFromVueSource(
      `const broken = @;
       import { defineMessage } from '@app/later-i18n';
       defineMessage('Owned through later barrel');`,
      path.join(fixtureRoot, 'src', 'broken-before-barrel.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule(specifier) {
          return specifier === '@app/later-i18n' ? barrelPath : undefined;
        },
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('Could not parse a gt-vue script block'),
    ]);
  });

  it.each([
    `import * as GT from './later-namespace-barrel'; GT.msg('Static namespace');`,
    `const GT = await import('./later-namespace-barrel'); GT.msg('Dynamic namespace');`,
  ])(
    'keeps a local namespace declared after malformed syntax fail-closed',
    async (reference) => {
      write(
        'later-namespace-barrel.ts',
        `export { msg } from 'gt-vue'; export const ordinary = 'ordinary';`
      );
      const output = await extractFromVueSource(
        `const broken = @; ${reference}`,
        path.join(fixtureRoot, 'broken-before-namespace.ts'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([
        expect.stringContaining('Could not parse a gt-vue script block'),
      ]);
    }
  );

  it('keeps a nested dynamic local namespace around malformed syntax fail-closed', async () => {
    write(
      'nested-dynamic-barrel.ts',
      `export { msg } from 'gt-vue'; export const ordinary = 'ordinary';`
    );
    const output = await extractFromVueSource(
      `async function load() {
         const GT = await import('./nested-dynamic-barrel');
         const broken = @;
         GT.msg('Nested dynamic namespace');
       }`,
      path.join(fixtureRoot, 'broken-nested-dynamic.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('Could not parse a gt-vue script block'),
    ]);
  });

  it('bounds ownership recovery for a long malformed statement', async () => {
    const malformedEntries = Array.from(
      { length: 1_000 },
      (_, index) => `${index};`
    ).join('\n');
    const output = await extractFromVueSource(
      `const broken = (\n${malformedEntries}\n@\n);
       import { msg } from 'gt-vue';`,
      path.join(fixtureRoot, 'long-broken.js'),
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

  it.each([
    `// import { msg } from 'gt-vue'\nconst broken = @;`,
    `const text = "import { msg } from 'gt-vue'"; const broken = @;`,
    "const pattern = /import { msg } from 'gt-vue'/; const broken = @;",
    "const text = `import { msg } from 'gt-vue'`; const broken = @;",
    `const text = "unterminated\nimport { msg } from 'gt-vue';`,
    "const text = `unterminated\nimport { msg } from 'gt-vue';",
    `/* unterminated\nimport { msg } from 'gt-vue';`,
    `const view = <div>unterminated\nimport { msg } from 'gt-vue';`,
  ])(
    'ignores a malformed module with only a GT import lookalike',
    async (source) => {
      const output = await extractFromVueSource(
        source,
        path.join(fixtureRoot, 'lookalike.js'),
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

  it.each([
    `export { msg } from 'gt-vue';`,
    `export * from 'gt-vue';`,
    `export * as GT from 'gt-vue';`,
  ])(
    'keeps a malformed runtime re-export fail-closed: %s',
    async (runtimeExport) => {
      const source = `${runtimeExport} const broken = @;`;
      const output = await extractFromVueSource(
        source,
        path.join(fixtureRoot, 'malformed-runtime-barrel.ts'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([
        expect.stringContaining('Could not parse a gt-vue script block'),
      ]);
    }
  );

  it.each([
    `export type { GTFunction } from 'gt-vue';`,
    `export { type GTFunction } from 'gt-vue';`,
  ])(
    'ignores a malformed TypeScript barrel with only a type re-export: %s',
    async (typeExport) => {
      const source = `${typeExport} const broken = @;`;
      const output = await extractFromVueSource(
        source,
        path.join(fixtureRoot, 'malformed-type-barrel.ts'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([]);
    }
  );

  it('ignores a malformed Flow barrel with only a type re-export', async () => {
    const source = `export type { GTFunction } from 'gt-vue'; const broken = @;`;
    const output = await extractFromVueSource(
      source,
      path.join(fixtureRoot, 'malformed-flow-barrel.js'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it.each(['msg', 't'])(
    'fails closed for %s through a malformed gt-vue re-export barrel',
    async (exportName) => {
      write(
        'malformed-import-barrel.ts',
        `export { ${exportName} } from 'gt-vue'; const broken = @;`
      );
      const source = `import { ${exportName} } from './malformed-import-barrel';
        ${exportName}('Owned through a malformed barrel');`;
      const output = await extractFromVueSource(
        source,
        path.join(fixtureRoot, 'malformed-barrel-consumer.ts'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([
        expect.stringContaining('possible gt-vue string function alias'),
      ]);
    }
  );

  it('fails closed through a local malformed re-export chain', async () => {
    write('runtime-base.ts', `export { msg } from 'gt-vue';`);
    write(
      'malformed-chain-barrel.ts',
      `export { msg as defineMessage } from './runtime-base'; const broken = @;`
    );
    const source = `import { defineMessage } from './malformed-chain-barrel';
      defineMessage('Owned through a malformed chain');`;
    const output = await extractFromVueSource(
      source,
      path.join(fixtureRoot, 'malformed-chain-consumer.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it('fails closed through a malformed namespace re-export', async () => {
    write(
      'malformed-namespace-barrel.ts',
      `export * as GT from 'gt-vue'; const broken = @;`
    );
    const source = `import { GT } from './malformed-namespace-barrel';
      GT.msg('Owned through a malformed namespace');`;
    const output = await extractFromVueSource(
      source,
      path.join(fixtureRoot, 'malformed-namespace-consumer.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it('does not inherit malformed namespace ownership from an unused GT member', async () => {
    write(
      'malformed-mixed-barrel.ts',
      `export { msg } from 'gt-vue';
       export function ordinary() { return 'ordinary'; }
       const broken = @;`
    );
    const source = `import * as mixed from './malformed-mixed-barrel';
      import { useGT } from '@ordinary/hooks';
      mixed.ordinary();
      const gt = useGT();
      gt('Ordinary unresolved message');`;
    const output = await extractFromVueSource(
      source,
      path.join(fixtureRoot, 'malformed-mixed-consumer.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
        resolveModule: () => undefined,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it.each([
    `const alias = mixed; alias.msg('Aliased malformed namespace');`,
    `const { msg } = mixed; msg('Destructured malformed namespace');`,
    `function consume(value) { value.msg('Forwarded malformed namespace'); }
     consume(mixed);`,
  ])(
    'fails closed when a malformed static namespace escapes direct analysis',
    async (usage) => {
      write(
        'malformed-static-namespace.ts',
        `export { msg } from 'gt-vue'; const broken = @;`
      );
      const source = `import * as mixed from './malformed-static-namespace';
        ${usage}`;
      const output = await extractFromVueSource(
        source,
        path.join(fixtureRoot, 'malformed-static-namespace-consumer.ts'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([
        expect.stringContaining('malformed local module'),
      ]);
    }
  );

  it('fails closed for a component renamed by a malformed barrel', async () => {
    write(
      'malformed-component-barrel.ts',
      `export { T as Translate } from 'gt-vue'; const broken = @;`
    );
    const source = `import { Translate } from './malformed-component-barrel';
      export const View = () => <Translate>Malformed component</Translate>;`;
    const output = await extractFromVueSource(
      source,
      path.join(fixtureRoot, 'malformed-component-consumer.tsx'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors.length).toBeGreaterThan(0);
  });

  it.each([
    `export const View = () => <mixed.T>Direct namespace JSX</mixed.T>;`,
    `const alias = mixed;
     export const View = () => <alias.T>Aliased namespace JSX</alias.T>;`,
  ])(
    'fails closed for JSX reached through a malformed static namespace',
    async (usage) => {
      write(
        'malformed-jsx-namespace.ts',
        `export { T } from 'gt-vue'; const broken = @;`
      );
      const source = `import * as mixed from './malformed-jsx-namespace';
        ${usage}`;
      const output = await extractFromVueSource(
        source,
        path.join(fixtureRoot, 'malformed-jsx-namespace-consumer.tsx'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors.length).toBeGreaterThan(0);
    }
  );

  it('does not inherit ownership from a malformed React re-export', async () => {
    write(
      'malformed-react-barrel.ts',
      `export { msg } from 'gt-react'; const broken = @;`
    );
    const source = `import { msg } from './malformed-react-barrel';
      msg('React message through malformed barrel');`;
    const output = await extractFromVueSource(
      source,
      path.join(fixtureRoot, 'malformed-react-consumer.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it.each(
    REACT_FAMILY_RUNTIMES.flatMap((runtime) => [
      {
        barrel: `export { T, msg, t, useGT } from '${runtime}'; const broken = @;`,
        consumer: `import { T, msg, t, useGT } from './malformed-runtime';
          msg('Malformed named React message');
          t('Malformed named React translation');
          useGT()('Malformed named React function');
          export const View = () => <T>Malformed named React rich text</T>;`,
        route: 'named',
        runtime,
      },
      {
        barrel: `export * from '${runtime}'; const broken = @;`,
        consumer: `import { T, msg, t, useGT } from './malformed-runtime';
          msg('Malformed star React message');
          t('Malformed star React translation');
          useGT()('Malformed star React function');
          export const View = () => <T>Malformed star React rich text</T>;`,
        route: 'star',
        runtime,
      },
      {
        barrel: `export * as Runtime from '${runtime}'; const broken = @;`,
        consumer: `import { Runtime } from './malformed-runtime';
          Runtime.msg('Malformed namespace React message');
          Runtime.t('Malformed namespace React translation');
          Runtime.useGT()('Malformed namespace React function');
          export const View = () => (
            <Runtime.T>Malformed namespace React rich text</Runtime.T>
          );`,
        route: 'namespace',
        runtime,
      },
    ])
  )(
    'preserves ordinary $runtime provenance through a malformed $route re-export',
    async ({ barrel, consumer }) => {
      write('malformed-runtime.ts', barrel);
      const output = await extractFromVueSource(
        `import { msg as vueMsg } from 'gt-vue';
         void vueMsg;
         ${consumer}`,
        path.join(fixtureRoot, 'malformed-runtime-consumer.tsx'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([]);
    }
  );

  it.each([
    {
      barrel: `export { msg, t } from './ordinary-runtime'; const broken = @;`,
      route: 'named',
    },
    {
      barrel: `export * from './ordinary-runtime'; const broken = @;`,
      route: 'star',
    },
  ])(
    'preserves local exact identities through a malformed $route re-export',
    async ({ barrel }) => {
      write(
        'ordinary-runtime.ts',
        `export const msg = (source) => source;
         export const t = (source) => source;`
      );
      write('malformed-ordinary.ts', barrel);
      const output = await extractFromVueSource(
        `import { T as VueT } from 'gt-vue';
         import { msg, t } from './malformed-ordinary';
         void VueT;
         msg('Malformed ordinary message');
         t('Malformed ordinary translation');`,
        path.join(fixtureRoot, 'malformed-ordinary-consumer.ts'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([]);
    }
  );

  it('preserves recovered identity-helper semantics for a proven translator', async () => {
    write('identity-helper.ts', `export const pass = (value) => value;`);
    write(
      'malformed-identity-helper.ts',
      `export { pass } from './identity-helper'; const broken = @;`
    );
    const output = await extractFromVueSource(
      `import { useGT } from 'gt-vue';
       import { pass } from './malformed-identity-helper';
       const gt = useGT();
       [gt].map(pass)[0]('Recovered identity callback');`,
      path.join(fixtureRoot, 'malformed-identity-helper-consumer.ts'),
      {
        projectRoot: fixtureRoot,
        requireGTProvenance: true,
      }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Recovered identity callback',
    ]);
  });

  it.each(REACT_FAMILY_RUNTIMES)(
    'preserves an immutable local msg alias to %s through a malformed re-export',
    async (runtime) => {
      write(
        'aliased-runtime.ts',
        `import { msg as runtimeMsg } from '${runtime}';
         export const msg = runtimeMsg;`
      );
      write(
        'malformed-aliased-runtime.ts',
        `export { msg } from './aliased-runtime'; const broken = @;`
      );
      const output = await extractFromVueSource(
        `import { T as VueT } from 'gt-vue';
         import { msg } from './malformed-aliased-runtime';
         void VueT;
         msg('Malformed aliased React message');`,
        path.join(fixtureRoot, 'malformed-aliased-runtime-consumer.ts'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([]);
    }
  );

  it.each([
    {
      module: `import { msg as runtimeMsg } from 'gt-vue';
        export const msg = runtimeMsg;`,
      title: 'gt-vue alias',
    },
    {
      module: `import { msg as runtimeMsg } from '@missing/runtime';
        export const msg = runtimeMsg;`,
      title: 'unresolved alias',
    },
    {
      module: `import { msg as runtimeMsg } from 'gt-react';
        export let msg = runtimeMsg;
        msg = (source) => source;`,
      title: 'mutable React-family alias',
    },
    {
      module: `import * as ReactGT from 'gt-react';
        import { msg as vueMsg } from 'gt-vue';
        export const msg = ReactGT[vueMsg('Hidden key')];`,
      title: 'computed React-family namespace member',
    },
  ])(
    'keeps a local $title behind a malformed barrel fail-closed',
    async ({ module }) => {
      write('unsafe-aliased-runtime.ts', module);
      write(
        'malformed-unsafe-alias.ts',
        `export { msg } from './unsafe-aliased-runtime'; const broken = @;`
      );
      const output = await extractFromVueSource(
        `import { T as VueT } from 'gt-vue';
         import { msg } from './malformed-unsafe-alias';
         void VueT;
         msg('Unsafe malformed alias');`,
        path.join(fixtureRoot, 'malformed-unsafe-alias-consumer.ts'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([
        expect.stringContaining('possible gt-vue string function alias'),
      ]);
    }
  );

  it.each([
    {
      expectError: false,
      malformed: `export * from './ordinary-star-source'; const broken = @;`,
      title: 'all-ordinary contributors',
    },
    {
      expectError: true,
      malformed: `export { msg } from 'gt-vue'; const broken = @;`,
      title: 'an ordinary and a gt-vue contributor',
    },
    {
      expectError: true,
      malformed: `export * from '@missing/runtime'; const broken = @;`,
      title: 'an ordinary and an unknown contributor',
    },
  ])(
    'keeps a valid outer star barrel sound with $title',
    async ({ expectError, malformed }) => {
      write(
        'ordinary-star-source.ts',
        `export const msg = (source) => source;`
      );
      write('malformed-star-source.ts', malformed);
      write(
        'valid-outer-star.ts',
        `export * from './ordinary-star-source';
         export * from './malformed-star-source';`
      );
      const output = await extractFromVueSource(
        `import { T as VueT } from 'gt-vue';
         import { msg } from './valid-outer-star';
         void VueT;
         msg('Valid outer star message');`,
        path.join(fixtureRoot, 'valid-outer-star-consumer.ts'),
        {
          projectRoot: fixtureRoot,
          requireGTProvenance: true,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual(
        expectError
          ? [expect.stringContaining('possible gt-vue string function alias')]
          : []
      );
    }
  );

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
