import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectVueProject } from '../../detect.js';
import { inspectVueProject } from '../../inspect.js';
import { extractFromVueProject } from '../../project.js';
import {
  createProjectFixture,
  linkInstalledVue,
  removeProjectFixture,
} from './projectTestUtils.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    removeProjectFixture(directory);
  }
});

describe('local Vue wrapper consumer usage', () => {
  it('does not promote React through an unused public Vue subpath', () => {
    const root = createMultiFrameworkFixture({
      'src/App.tsx': `
        import { ReactT } from '@fixture/multi';
        export const App = () => <ReactT>React</ReactT>;
      `,
      'src/Unrelated.vue': '<template>Not a GT component</template>',
    });

    expect(detectVueProject(root)).toBe(false);
    expect(inspectVueProject(root)).toMatchObject({
      hasVueScopes: false,
      rootOwnsVue: false,
    });
  });

  it('promotes a consumer that uses the exact Vue subpath export', () => {
    const root = createMultiFrameworkFixture({
      'src/App.tsx': `
        import { VueT } from '@fixture/multi/vue';
        export const App = () => <VueT>Vue</VueT>;
      `,
    });

    expect(detectVueProject(root)).toBe(true);
    expect(inspectVueProject(root)).toMatchObject({
      hasVueScopes: true,
      rootOwnsVue: true,
    });
  });

  it('distinguishes ordinary and GT-derived named exports at one entry', () => {
    const ordinaryRoot = createRootEntryFixture(`
      import { ReactT } from '@fixture/mixed-root';
      export const App = () => <ReactT>React</ReactT>;
    `);
    const vueRoot = createRootEntryFixture(`
      import { VueT } from '@fixture/mixed-root';
      export const App = () => <VueT>Vue</VueT>;
    `);

    expect(detectVueProject(ordinaryRoot)).toBe(false);
    expect(detectVueProject(vueRoot)).toBe(true);
  });

  it('reads a wrapper import used by an SFC template without a Vue compiler', () => {
    const root = createMultiFrameworkFixture({
      'src/App.vue': `<script setup lang="ts">
import { VueT } from '@fixture/multi/vue';
</script>
<template><vue-t>SFC wrapper</vue-t></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('ignores namespace names found only in style, comments, and text', () => {
    const root = createMultiFrameworkFixture({
      'src/App.vue': `<script setup lang="ts">
import * as Mixed from '@fixture/multi/vue';
</script>
<template>
  <!-- Mixed.VueT -->
  <p>Mixed.VueT</p>
</template>
<style>.Mixed.VueT { color: red; }</style>`,
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it('recognizes an exact namespace component used by an SFC template', () => {
    const root = createMultiFrameworkFixture({
      'src/App.vue': `<script setup lang="ts">
import * as Mixed from '@fixture/multi/vue';
</script>
<template><Mixed.VueT>Namespace wrapper</Mixed.VueT></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('matches the dependency binding name for an aliased local package', () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: '@fixture/app',
        dependencies: { 'vue-alias': 'file:./vendor/multi' },
      }),
      'vendor/multi/package.json': JSON.stringify({
        name: '@fixture/multi',
        version: '1.0.0',
        exports: { './vue': './src/vue.ts' },
        dependencies: { 'gt-vue': '*' },
      }),
      'vendor/multi/src/vue.ts': "export { T as VueT } from 'gt-vue';\n",
      'src/App.tsx': `
        import { VueT } from 'vue-alias/vue';
        export const App = () => <VueT>Aliased</VueT>;
      `,
    });
    linkPackage(root, '', 'vue-alias', 'vendor/multi');

    expect(detectVueProject(root)).toBe(true);
  });

  it('propagates through source-used transitive wrapper re-exports', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: '@fixture/root',
        private: true,
        workspaces: ['packages/*', 'apps/*'],
      }),
      'packages/base/package.json': JSON.stringify({
        name: '@fixture/base',
        version: '1.0.0',
        exports: './src/index.ts',
        dependencies: { 'gt-vue': '*' },
      }),
      'packages/base/src/index.ts': "export { T as BaseT } from 'gt-vue';\n",
      'packages/wrapper/package.json': JSON.stringify({
        name: '@fixture/wrapper',
        version: '1.0.0',
        exports: './src/index.ts',
        dependencies: { '@fixture/base': 'workspace:*' },
      }),
      'packages/wrapper/src/index.ts':
        "export { BaseT as WrapperT } from '@fixture/base';\n",
      'apps/docs/package.json': JSON.stringify({
        name: '@fixture/docs',
        dependencies: { '@fixture/wrapper': 'workspace:*' },
      }),
      'apps/docs/src/App.vue': `<script setup lang="ts">
import { WrapperT } from '@fixture/wrapper';
</script>
<template><WrapperT>Transitive wrapper</WrapperT></template>`,
    });
    linkPackage(root, 'packages/wrapper', '@fixture/base', 'packages/base');
    linkPackage(root, 'apps/docs', '@fixture/wrapper', 'packages/wrapper');
    linkInstalledVue(root);

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Transitive wrapper',
    ]);
  });

  it('does not infer namespace use from an ordinary member', () => {
    const ordinaryRoot = createRootEntryFixture(`
      import * as Mixed from '@fixture/mixed-root';
      export const App = () => <Mixed.ReactT>React</Mixed.ReactT>;
    `);
    const vueRoot = createRootEntryFixture(`
      import * as Mixed from '@fixture/mixed-root';
      export const App = () => <Mixed.VueT>Vue</Mixed.VueT>;
    `);

    expect(detectVueProject(ordinaryRoot)).toBe(false);
    expect(detectVueProject(vueRoot)).toBe(true);
  });

  it('recognizes an exact member destructured from a package namespace', () => {
    const root = createRootEntryFixture(`
      import * as Mixed from '@fixture/mixed-root';
      const { VueT } = Mixed;
      export const App = () => <VueT>Vue</VueT>;
    `);

    expect(detectVueProject(root)).toBe(true);
  });

  it('recognizes an exact member used through an immutable namespace alias', () => {
    const root = createRootEntryFixture(`
      import * as Wrapper from '@fixture/mixed-root';
      const Alias = Wrapper;
      export const App = () => <Alias.VueT>Vue</Alias.VueT>;
    `);

    expect(detectVueProject(root)).toBe(true);
  });

  it('recognizes a top-level namespace alias used by an SFC template', () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: '@fixture/react-app',
        dependencies: {
          '@fixture/mixed-root': 'file:./vendor/mixed-root',
        },
      }),
      'vendor/mixed-root/package.json': JSON.stringify({
        name: '@fixture/mixed-root',
        version: '1.0.0',
        exports: './src/index.ts',
        dependencies: { 'gt-vue': '*' },
      }),
      'vendor/mixed-root/src/index.ts': `
        export { T as VueT } from 'gt-vue';
        export { T as ReactT } from 'gt-react';
      `,
      'src/App.vue': `<script setup>
import * as Wrapper from '@fixture/mixed-root';
const Alias = Wrapper;
</script>
<template><Alias.VueT>Vue</Alias.VueT></template>`,
    });
    linkPackage(root, '', '@fixture/mixed-root', 'vendor/mixed-root');

    expect(detectVueProject(root)).toBe(true);
  });

  it.each([
    `
      import * as Wrapper from '@fixture/mixed-root';
      const Alias = Wrapper;
      export const App = () => <Alias.ReactT>React</Alias.ReactT>;
    `,
    `
      import * as Wrapper from '@fixture/mixed-root';
      const Alias = Wrapper;
      export function render(Alias) {
        return <Alias.VueT>Shadowed</Alias.VueT>;
      }
      export const App = () => <Alias.ReactT>React</Alias.ReactT>;
    `,
    `
      import * as Wrapper from '@fixture/mixed-root';
      let Alias = Wrapper;
      Alias = { VueT: String };
      export const App = () => <Alias.VueT>Mutated</Alias.VueT>;
    `,
    `
      import * as Wrapper from '@fixture/mixed-root';
      const Alias = Wrapper;
      Alias.VueT = String;
      export const App = () => <Alias.VueT>Mutated member</Alias.VueT>;
    `,
  ])('rejects an unsafe or ordinary namespace alias: %s', (source) => {
    const root = createRootEntryFixture(source);

    expect(detectVueProject(root)).toBe(false);
  });

  it('fails closed when a consumer reexports a mixed namespace container', () => {
    const root = createRootEntryFixture(
      "export * as Components from '@fixture/mixed-root';"
    );

    expect(detectVueProject(root)).toBe(false);
  });

  it('fails closed for a mixed wrapper-created namespace export', () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: '@fixture/react-app',
        dependencies: { '@fixture/container': 'file:./vendor/container' },
      }),
      'vendor/container/package.json': JSON.stringify({
        name: '@fixture/container',
        version: '1.0.0',
        exports: './src/index.ts',
        dependencies: { 'gt-vue': '*' },
      }),
      'vendor/container/src/index.ts':
        "export * as Components from './components';\n",
      'vendor/container/src/components.ts': `
        export { T as VueT } from 'gt-vue';
        export { T as ReactT } from 'gt-react';
      `,
      'src/App.tsx': `
        import { Components } from '@fixture/container';
        export const App = () => <Components.ReactT>React</Components.ReactT>;
      `,
    });
    linkPackage(root, '', '@fixture/container', 'vendor/container');

    expect(detectVueProject(root)).toBe(false);
  });

  it('ignores wrapper imports that exist only in generated artifacts', () => {
    const root = createMultiFrameworkFixture({
      '.turbo/generated.ts': `
        import { VueT } from '@fixture/multi/vue';
        void VueT;
      `,
      'dist/generated.js': `
        import { VueT } from '@fixture/multi/vue';
        void VueT;
      `,
      'src/App.tsx': 'export const App = () => <main>React</main>;',
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it('ignores a generated public entry that imports a wrapper', () => {
    const root = createMultiFrameworkFixture({
      'package.json': JSON.stringify({
        name: '@fixture/react-app',
        main: './dist/index.js',
        dependencies: { '@fixture/multi': 'file:./vendor/multi' },
      }),
      'dist/index.js': `
        import { VueT } from '@fixture/multi/vue';
        export { VueT };
      `,
      'src/App.tsx': 'export const App = () => <main>React</main>;',
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it('does not follow a default source directory symlink outside the package', () => {
    const outside = createFixture({
      'src/App.tsx': `
        import { VueT } from '@fixture/multi/vue';
        export const App = () => <VueT>Outside</VueT>;
      `,
    });
    const root = createMultiFrameworkFixture({});
    fs.symlinkSync(path.join(outside, 'src'), path.join(root, 'src'), 'dir');

    expect(detectVueProject(root)).toBe(false);
  });

  it('keeps direct gt-vue ownership independent of source imports', () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: '@fixture/direct-vue',
        dependencies: { 'gt-vue': '*' },
      }),
    });

    expect(detectVueProject(root)).toBe(true);
  });
});

function createMultiFrameworkFixture(
  sourceFiles: Record<string, string>
): string {
  const root = createFixture({
    'package.json': JSON.stringify({
      name: '@fixture/react-app',
      dependencies: { '@fixture/multi': 'file:./vendor/multi' },
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
    'vendor/multi/src/vue.ts': "export { T as VueT } from 'gt-vue';\n",
    ...sourceFiles,
  });
  linkPackage(root, '', '@fixture/multi', 'vendor/multi');
  return root;
}

function createRootEntryFixture(appSource: string): string {
  const root = createFixture({
    'package.json': JSON.stringify({
      name: '@fixture/react-app',
      dependencies: { '@fixture/mixed-root': 'file:./vendor/mixed-root' },
    }),
    'vendor/mixed-root/package.json': JSON.stringify({
      name: '@fixture/mixed-root',
      version: '1.0.0',
      exports: './src/index.ts',
      dependencies: { 'gt-vue': '*' },
    }),
    'vendor/mixed-root/src/index.ts': `
      export { T as VueT } from 'gt-vue';
      export { T as ReactT } from 'gt-react';
    `,
    'src/App.tsx': appSource,
  });
  linkPackage(root, '', '@fixture/mixed-root', 'vendor/mixed-root');
  return root;
}

function createFixture(files: Record<string, string>): string {
  const root = createProjectFixture(files);
  temporaryDirectories.push(root);
  return root;
}

function linkPackage(
  root: string,
  consumerDirectory: string,
  bindingName: string,
  targetDirectory: string
): void {
  const destination = path.join(
    root,
    consumerDirectory,
    'node_modules',
    ...bindingName.split('/')
  );
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.symlinkSync(path.join(root, targetDirectory), destination, 'dir');
}
