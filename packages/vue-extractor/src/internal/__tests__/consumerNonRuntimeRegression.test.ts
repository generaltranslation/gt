import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectVueProject } from '../../detect.js';
import { extractFromVueProject } from '../../project.js';
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

describe('non-runtime local Vue wrapper references', () => {
  it.each([
    [
      'd.ts',
      `
        import { VueT } from '@fixture/multi/vue';
        export declare const component: typeof VueT;
      `,
    ],
    [
      'd.mts',
      `
        import VueT from '@fixture/multi/vue';
        export declare const component: typeof VueT;
      `,
    ],
    [
      'd.cts',
      `
        import * as Mixed from '@fixture/multi/vue';
        export declare const component: typeof Mixed.VueT;
      `,
    ],
  ])('ignores wrapper imports in .%s declarations', (extension, source) => {
    const root = createConsumerFixture({
      [`src/index.${extension}`]: source,
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it('ignores value re-exports from declaration files', () => {
    const root = createConsumerFixture({
      'src/index.d.ts': "export { VueT } from '@fixture/multi/vue';\n",
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it('ignores a declaration file selected as a public import entry', () => {
    const root = createConsumerFixture(
      {
        'types/index.d.ts': "export { VueT } from '@fixture/multi/vue';\n",
      },
      {
        exports: { '.': { import: './types/index.d.ts' } },
      }
    );

    expect(detectVueProject(root)).toBe(false);
  });

  it.each([
    ['main', { main: './lib/index.js' }],
    ['exports import', { exports: { '.': { import: './lib/index.js' } } }],
  ])('ignores a stale lib entry selected through %s', (_name, manifest) => {
    const root = createConsumerFixture(
      {
        'lib/index.js': "export { VueT } from '@fixture/multi/vue';\n",
        'src/App.tsx': 'export const App = () => <main>React</main>;\n',
      },
      manifest
    );

    expect(detectVueProject(root)).toBe(false);
  });

  it.each([
    [
      'a named import in a TypeScript type query',
      'src/App.ts',
      `
        import { VueT } from '@fixture/multi/vue';
        export type Component = typeof VueT;
      `,
    ],
    [
      'a default import in a TypeScript type query',
      'src/App.ts',
      `
        import VueT from '@fixture/multi/vue';
        export interface Options { component: typeof VueT }
      `,
    ],
    [
      'a named import in a satisfies type argument',
      'src/App.ts',
      `
        import { VueT } from '@fixture/multi/vue';
        export const options = {} satisfies Record<string, typeof VueT>;
      `,
    ],
    [
      'a named import in a Flow type query',
      'src/App.js',
      `
        import { VueT } from '@fixture/multi/vue';
        export type Component = typeof VueT;
      `,
    ],
    [
      'a namespace import in a TypeScript type query',
      'src/App.ts',
      `
        import * as Mixed from '@fixture/multi/vue';
        export type Component = typeof Mixed.VueT;
      `,
    ],
    [
      'an explicit type import',
      'src/App.ts',
      `
        import type { VueT } from '@fixture/multi/vue';
        export type Component = typeof VueT;
      `,
    ],
    [
      'a locally imported value in a type-only export',
      'src/App.ts',
      `
        import { VueT } from '@fixture/multi/vue';
        export type { VueT };
      `,
    ],
    [
      'a locally imported value in an inline type-only export',
      'src/App.ts',
      `
        import { VueT } from '@fixture/multi/vue';
        export { type VueT };
      `,
    ],
  ])('ignores %s', (_name, file, source) => {
    const root = createConsumerFixture({ [file]: source });

    expect(detectVueProject(root)).toBe(false);
  });

  it('does not make an unrelated SFC require a Vue compiler', async () => {
    const root = createConsumerFixture({
      'src/index.d.ts': `
        import { VueT } from '@fixture/multi/vue';
        export declare const component: typeof VueT;
      `,
      'src/Unrelated.vue': '<template>Ordinary fixture</template>',
    });

    expect(detectVueProject(root)).toBe(false);
    await expect(extractFromVueProject({ cwd: root })).resolves.toMatchObject({
      errors: [],
      updates: [],
    });
  });
});

describe('runtime local Vue wrapper references', () => {
  it('preserves a named wrapper used in TSX', () => {
    const root = createConsumerFixture({
      'src/App.tsx': `
        import { VueT } from '@fixture/multi/vue';
        export const App = () => <VueT>Vue</VueT>;
      `,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves a wrapper used as a script value', () => {
    const root = createConsumerFixture({
      'src/App.ts': `
        import { VueT } from '@fixture/multi/vue';
        export const component = VueT;
      `,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves a runtime wrapper re-export', () => {
    const root = createConsumerFixture({
      'src/index.ts': "export { VueT } from '@fixture/multi/vue';\n",
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves a named wrapper used only in an SFC template', () => {
    const root = createConsumerFixture({
      'src/App.vue': `<script setup lang="ts">
import { VueT } from '@fixture/multi/vue';
</script>
<template><vue-t>Template wrapper</vue-t></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves template usage when script references are type-only', () => {
    const root = createConsumerFixture({
      'src/App.vue': `<script setup lang="ts">
import { VueT } from '@fixture/multi/vue';
type Component = typeof VueT;
</script>
<template><VueT>Template wrapper</VueT></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves source usage when a stale lib entry also exists', () => {
    const root = createConsumerFixture(
      {
        'lib/index.js': "export { VueT } from '@fixture/multi/vue';\n",
        'src/App.tsx': `
          import { VueT } from '@fixture/multi/vue';
          export const App = () => <VueT>Source wrapper</VueT>;
        `,
      },
      { main: './lib/index.js' }
    );

    expect(detectVueProject(root)).toBe(true);
  });
});

function createConsumerFixture(
  sourceFiles: Record<string, string>,
  manifest: Record<string, unknown> = {}
): string {
  const root = createProjectFixture({
    'package.json': JSON.stringify({
      name: '@fixture/react-app',
      dependencies: { '@fixture/multi': 'file:./vendor/multi' },
      ...manifest,
    }),
    'vendor/multi/package.json': JSON.stringify({
      name: '@fixture/multi',
      version: '1.0.0',
      exports: {
        '.': './src/react.ts',
        './vue': './src/vue.ts',
      },
      dependencies: { 'gt-vue': '*' },
    }),
    'vendor/multi/src/react.ts': "export { T as ReactT } from 'gt-react';\n",
    'vendor/multi/src/vue.ts':
      "export { T as VueT, T as default } from 'gt-vue';\n",
    ...sourceFiles,
  });
  temporaryDirectories.push(root);

  const destination = path.join(root, 'node_modules/@fixture/multi');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.symlinkSync(path.join(root, 'vendor/multi'), destination, 'dir');
  return root;
}
