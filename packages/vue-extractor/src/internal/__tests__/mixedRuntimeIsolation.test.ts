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
