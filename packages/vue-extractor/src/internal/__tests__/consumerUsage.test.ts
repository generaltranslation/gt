import fs from 'node:fs';
import path from 'node:path';
import { compile } from '@vue/compiler-dom';
import {
  compileScript,
  parse,
  version as vueCompilerVersion,
} from '@vue/compiler-sfc';
import { afterAll, describe, expect, it } from 'vitest';
import { detectVueProject } from '../../detect.js';
import { inspectVueProject } from '../../inspect.js';
import { extractFromVueProject } from '../../project.js';
import {
  createProjectFixture,
  createTestProject,
  linkInstalledVue,
  removeProjectFixture,
  writeProjectFiles,
} from './projectTestUtils.js';

let sharedApp: string | undefined;

afterAll(() => {
  if (sharedApp) removeProjectFixture(sharedApp);
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
    const ordinaryRoot = createRootEntryFixture({
      'src/App.tsx': `
      import { ReactT } from '@fixture/mixed-root';
      export const App = () => <ReactT>React</ReactT>;
    `,
    });
    const vueRoot = createRootEntryFixture({
      'src/App.tsx': `
      import { VueT } from '@fixture/mixed-root';
      export const App = () => <VueT>Vue</VueT>;
    `,
    });

    expect(detectVueProject(ordinaryRoot)).toBe(false);
    expect(detectVueProject(vueRoot)).toBe(true);
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

  it('matches the dependency binding name for an aliased local package', () => {
    const root = createTestProject({
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
    const root = createTestProject({
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
    const ordinaryRoot = createRootEntryFixture({
      'src/App.tsx': `
      import * as Mixed from '@fixture/mixed-root';
      export const App = () => <Mixed.ReactT>React</Mixed.ReactT>;
    `,
    });
    const vueRoot = createRootEntryFixture({
      'src/App.tsx': `
      import * as Mixed from '@fixture/mixed-root';
      export const App = () => <Mixed.VueT>Vue</Mixed.VueT>;
    `,
    });

    expect(detectVueProject(ordinaryRoot)).toBe(false);
    expect(detectVueProject(vueRoot)).toBe(true);
  });

  it('recognizes an exact member destructured from a package namespace', () => {
    const root = createRootEntryFixture({
      'src/App.tsx': `
      import * as Mixed from '@fixture/mixed-root';
      const { VueT } = Mixed;
      export const App = () => <VueT>Vue</VueT>;
    `,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('recognizes an exact member used through an immutable namespace alias', () => {
    const root = createRootEntryFixture({
      'src/App.tsx': `
      import * as Wrapper from '@fixture/mixed-root';
      const Alias = Wrapper;
      export const App = () => <Alias.VueT>Vue</Alias.VueT>;
    `,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('recognizes a top-level namespace alias used by an SFC template', () => {
    const root = createRootEntryFixture({
      'src/App.vue': `<script setup>
import * as Wrapper from '@fixture/mixed-root';
const Alias = Wrapper;
</script>
<template><Alias.VueT>Vue</Alias.VueT></template>`,
    });

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
    const root = createRootEntryFixture({ 'src/App.tsx': source });

    expect(detectVueProject(root)).toBe(false);
  });

  it('fails closed when a consumer reexports a mixed namespace container', () => {
    const root = createRootEntryFixture({
      'src/App.tsx': "export * as Components from '@fixture/mixed-root';",
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it('fails closed for a mixed wrapper-created namespace export', () => {
    const root = createTestProject({
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
    const root = createMultiFrameworkFixture(
      {
        'dist/index.js': `
        import { VueT } from '@fixture/multi/vue';
        export { VueT };
      `,
        'src/App.tsx': 'export const App = () => <main>React</main>;',
      },
      { main: './dist/index.js' }
    );

    expect(detectVueProject(root)).toBe(false);
  });

  it('does not follow a default source directory symlink outside the package', () => {
    const outside = createTestProject({
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
    const root = createTestProject({
      'package.json': JSON.stringify({
        name: '@fixture/direct-vue',
        dependencies: { 'gt-vue': '*' },
      }),
    });

    expect(detectVueProject(root)).toBe(true);
  });
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
    const root = multiFrameworkApp({
      [`src/index.${extension}`]: source,
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it('ignores value re-exports from declaration files', () => {
    const root = multiFrameworkApp({
      'src/index.d.ts': "export { VueT } from '@fixture/multi/vue';\n",
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it('ignores a declaration file selected as a public import entry', () => {
    const root = multiFrameworkApp(
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
    const root = multiFrameworkApp(
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
    const root = multiFrameworkApp({ [file]: source });

    expect(detectVueProject(root)).toBe(false);
  });

  it.each([
    {
      importSource: "import { VueT } from '@fixture/multi/vue';",
      name: 'a named ordinary-script import',
      template: '<VueT />',
    },
    {
      importSource: "import VueT from '@fixture/multi/vue';",
      name: 'a default ordinary-script import',
      template: '<VueT />',
    },
    {
      importSource: "import * as Mixed from '@fixture/multi/vue';",
      name: 'a namespace ordinary-script import',
      template: '<Mixed.VueT />',
    },
  ])('does not expose $name to the template', ({ importSource, template }) => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script>
${importSource}
export default {};
</script>
<template>${template}</template>`,
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it.each([
    {
      importSource: "import { VueT } from '@fixture/multi/vue';",
      name: 'a named import shadowed by a camel setup binding',
      setupSource: "const vueT = 'section';",
      template: '<vue-t />',
    },
    {
      importSource: "import VueT from '@fixture/multi/vue';",
      name: 'a default import shadowed by a camel setup binding',
      setupSource: "const vueT = 'section';",
      template: '<vue-t />',
    },
    {
      importSource: "import * as Mixed from '@fixture/multi/vue';",
      name: 'a namespace import shadowed by a camel setup binding',
      setupSource: "const mixed = { VueT: 'section' };",
      template: '<mixed.VueT />',
    },
    {
      importSource: "import { VueT as LocalT } from '@fixture/multi/vue';",
      name: 'a named import shadowed by an exact setup binding',
      setupSource: "const LocalT = 'section';",
      template: '<LocalT />',
    },
    {
      importSource: "import LocalT from '@fixture/multi/vue';",
      name: 'a default import shadowed by an exact setup binding',
      setupSource: "const LocalT = 'section';",
      template: '<LocalT />',
    },
    {
      importSource: "import * as Mixed from '@fixture/multi/vue';",
      name: 'a namespace import shadowed by an exact setup binding',
      setupSource: "const Mixed = { VueT: 'section' };",
      template: '<Mixed.VueT />',
    },
  ])(
    'does not expose $name to the template',
    ({ importSource, setupSource, template }) => {
      const root = multiFrameworkApp({
        'src/App.vue': `<script>
${importSource}
export default {};
</script>
<script setup>${setupSource}</script>
<template>${template}</template>`,
      });

      expect(detectVueProject(root)).toBe(false);
    }
  );

  it('does not treat an uppercase SETUP attribute as script setup', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script SETUP>
import { VueT } from '@fixture/multi/vue';
export default {};
</script>
<template><VueT /></template>`,
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it('does not activate Vue for a compiler-option-ambiguous props binding', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script setup>
import { VueT } from '@fixture/multi/vue';
const { vueT } = defineProps(['vueT']);
</script>
<template><vue-t /></template>`,
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it('does not activate Vue for a version-ambiguous slots binding', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script setup>
import { VueT as vueT } from '@fixture/multi/vue';
const VueT = defineSlots();
</script>
<template><vue-t /></template>`,
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it.each(['reactive', 'ref', 'computed', 'shallowRef', 'customRef', 'toRef'])(
    'shares the %s helper alias from ordinary script with script setup',
    (helper) => {
      const root = multiFrameworkApp({
        'src/App.vue': `<script>
import { ${helper} as makeLocal } from 'vue';
export default {};
</script>
<script setup>
import { VueT as vueT } from '@fixture/multi/vue';
const VueT = makeLocal({});
</script>
<template><vue-t /></template>`,
      });

      expect(detectVueProject(root)).toBe(false);
    }
  );

  it.each(['reactive', 'ref'])(
    'shares the %s helper alias from script setup with ordinary script',
    (helper) => {
      const root = multiFrameworkApp({
        'src/App.vue': `<script>
import { VueT as vueT } from '@fixture/multi/vue';
const VueT = makeLocal({});
export default {};
</script>
<script setup>
import { ${helper} as makeLocal } from 'vue';
</script>
<template><vue-t /></template>`,
      });

      expect(detectVueProject(root)).toBe(false);
    }
  );

  it.each([
    {
      name: 'a shorthand setup return',
      setupBody: "const vueT = 'section'; return { vueT };",
    },
    {
      name: 'an aliased setup return',
      setupBody: "const local = 'section'; return { vueT: local };",
    },
  ])('lets $name outrank a normalized wrapper import', ({ setupBody }) => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script>
import { VueT } from '@fixture/multi/vue';
export default { setup() { ${setupBody} } };
</script>
<script setup>const ready = true;</script>
<template><vue-t /></template>`,
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it.each([
    ['defineProps', 'defineProps({})'],
    ['defineEmits', 'defineEmits([])'],
    ['defineSlots', 'defineSlots()'],
    ['defineExpose', 'defineExpose({})'],
    ['defineOptions', "defineOptions({ name: 'Fixture' })"],
    ['withDefaults', 'withDefaults(defineProps(), {})'],
  ])(
    'ignores a wrapper aliased to the compiler-consumed %s macro',
    (macro, call) => {
      const root = multiFrameworkApp({
        'src/App.vue': `<script setup>
import { VueT as ${macro} } from '@fixture/multi/vue';
${call};
</script>
<template><main /></template>`,
      });

      expect(detectVueProject(root)).toBe(false);
    }
  );

  it.each([
    ['defineProps', 'const value = defineProps({})'],
    ['defineEmits', 'const value = defineEmits([])'],
    ['defineSlots', 'const value = defineSlots()'],
    ['withDefaults', 'const value = withDefaults(defineProps(), {})'],
  ])(
    'ignores a wrapper aliased to assigned compiler macro %s',
    (macro, statement) => {
      const root = multiFrameworkApp({
        'src/App.vue': `<script setup>
import { VueT as ${macro} } from '@fixture/multi/vue';
${statement};
</script>
<template><main /></template>`,
      });

      expect(detectVueProject(root)).toBe(false);
    }
  );

  it('ignores a setup macro call resolved from the ordinary script block', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script>
import { VueT as defineProps } from '@fixture/multi/vue';
export default {};
</script>
<script setup>const props = defineProps({});</script>
<template><main /></template>`,
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it('does not make an unrelated SFC require a Vue compiler', async () => {
    const root = createMultiFrameworkFixture({
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
  it('preserves an ordinary-script import registered as a component', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script>
import { VueT } from '@fixture/multi/vue';
export default { components: { VueT } };
</script>
<template><VueT /></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves an ordinary-script import referenced from script setup', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script>
import { VueT } from '@fixture/multi/vue';
export default {};
</script>
<script setup>
const component = VueT;
</script>
<template><component :is="component" /></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves an ordinary namespace member referenced from script setup', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script>
import * as Mixed from '@fixture/multi/vue';
export default {};
</script>
<script setup>
const component = Mixed.VueT;
</script>
<template><component :is="component" /></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves a script-setup import referenced from ordinary script', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script>
const component = VueT;
export default { components: { component } };
</script>
<script setup>
import { VueT } from '@fixture/multi/vue';
</script>
<template><component /></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves a script-setup namespace referenced from ordinary script', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script>
const component = Mixed.VueT;
export default { components: { component } };
</script>
<script setup>
import * as Mixed from '@fixture/multi/vue';
</script>
<template><component /></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves a script-setup import rendered from ordinary-script TSX', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script lang="tsx">
const view = () => <VueT />;
export default {};
</script>
<script setup lang="tsx">
import { VueT } from '@fixture/multi/vue';
</script>
<template><component :is="view" /></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('uses the last Vue helper alias across both SFC script blocks', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script>
import { ref as oldRef } from 'vue';
const VueT = oldRef({});
export default {};
</script>
<script setup>
import { ref as newRef } from 'vue';
import { VueT as vueT } from '@fixture/multi/vue';
</script>
<template><vue-t /></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it.each([
    {
      name: 'a template component',
      source: `defineProps({});`,
      template: '<defineProps />',
    },
    {
      name: 'an additional ordinary setup reference',
      source: `defineProps({}); const runtime = defineProps;`,
      template: '<main />',
    },
    {
      name: 'a nested setup call',
      source: `function runtime() { defineProps({}); }`,
      template: '<main />',
    },
  ])(
    'preserves a macro-named wrapper used as $name',
    ({ source, template }) => {
      const root = multiFrameworkApp({
        'src/App.vue': `<script setup>
import { VueT as defineProps } from '@fixture/multi/vue';
${source}
</script>
<template>${template}</template>`,
      });

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it('preserves a macro-named wrapper called from ordinary script', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script>
import { VueT as defineProps } from '@fixture/multi/vue';
const runtime = defineProps({});
export default { runtime };
</script>
<template><main /></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves defineModel because Vue 3.3 consumption is optional', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script setup>
import { VueT as defineModel } from '@fixture/multi/vue';
const model = defineModel();
</script>
<template><main /></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves an ordinary namespace member rendered from script-setup TSX', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script lang="tsx">
import * as Mixed from '@fixture/multi/vue';
export default {};
</script>
<script setup lang="tsx">
const view = () => <Mixed.VueT />;
</script>
<template><component :is="view" /></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it.each([
    {
      importSource: "import { VueT } from '@fixture/multi/vue';",
      name: 'a named ordinary import',
      template: '<VueT />',
    },
    {
      importSource: "import VueT from '@fixture/multi/vue';",
      name: 'a default ordinary import',
      template: '<VueT />',
    },
    {
      importSource: "import * as Mixed from '@fixture/multi/vue';",
      name: 'an ordinary namespace import',
      template: '<Mixed.VueT />',
    },
  ])(
    'preserves $name when a script-setup block exposes it',
    ({ importSource, template }) => {
      const root = multiFrameworkApp({
        'src/App.vue': `<script>
${importSource}
export default {};
</script>
<script setup>const ready = true;</script>
<template>${template}</template>`,
      });

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it.each(['setup', 'setup=""', 'setup="false"'])(
    'recognizes the lowercase script attribute %s',
    (setupAttribute) => {
      const root = multiFrameworkApp({
        'src/App.vue': `<script ${setupAttribute}>
import { VueT } from '@fixture/multi/vue';
</script>
<template><VueT /></template>`,
      });

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it('preserves a wrapper used as a script value', () => {
    const root = multiFrameworkApp({
      'src/App.ts': `
        import { VueT } from '@fixture/multi/vue';
        export const component = VueT;
      `,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves a runtime wrapper re-export', () => {
    const root = multiFrameworkApp({
      'src/index.ts': "export { VueT } from '@fixture/multi/vue';\n",
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves a named wrapper used only in an SFC template', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script setup lang="ts">
import { VueT } from '@fixture/multi/vue';
</script>
<template><vue-t>Template wrapper</vue-t></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves template usage when script references are type-only', () => {
    const root = multiFrameworkApp({
      'src/App.vue': `<script setup lang="ts">
import { VueT } from '@fixture/multi/vue';
type Component = typeof VueT;
</script>
<template><VueT>Template wrapper</VueT></template>`,
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('preserves source usage when a stale lib entry also exists', () => {
    const root = multiFrameworkApp(
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

  it('preserves source usage in a nested src/es directory', () => {
    const root = multiFrameworkApp(
      {
        'src/es/index.ts': `
          import { VueT } from '@fixture/multi/vue';
          export const component = VueT;
        `,
      },
      { module: './src/es/index.ts' }
    );

    expect(detectVueProject(root)).toBe(true);
  });
});

describe('Vue wrapper use in consumer templates', () => {
  it.each([
    {
      name: 'an HTML-commented script block',
      source: `
        <!--
        <script setup>
        import { VueT } from '@fixture/multi/vue';
        </script>
        -->
        <template><main>React-owned application</main></template>
      `,
    },
    {
      name: 'an HTML-commented template block',
      source: `
        <script setup>
        import * as Mixed from '@fixture/multi/vue';
        </script>
        <!-- <template><Mixed.VueT>Inactive</Mixed.VueT></template> -->
        <template><main>React-owned application</main></template>
      `,
    },
  ])('ignores $name', ({ source }) => {
    const root = sfcApp(source);

    expect(detectVueProject(root)).toBe(false);
  });

  it.each([
    {
      name: 'a string literal',
      expression: "'Mixed.VueT'",
    },
    {
      name: 'template literal text',
      expression: '`Mixed.VueT`',
    },
    {
      name: 'a JavaScript comment',
      expression: "/* Mixed.VueT */ 'ordinary'",
    },
    {
      name: 'a shadowed callback parameter',
      expression: '[1].map((Mixed) => Mixed.VueT)',
    },
  ])('ignores namespace spelling in $name', ({ expression }) => {
    const root = sfcApp(`
      <script setup>
      import * as Mixed from '@fixture/multi/vue';
      </script>
      <template><main :title="${expression}">Ordinary</main></template>
    `);

    expect(detectVueProject(root)).toBe(false);
  });

  it.each([
    {
      name: 'a tag-shaped string in a directive',
      template: `<main :title="'<Mixed.VueT>'">Ordinary</main>`,
    },
    {
      name: 'a tag-shaped string in an interpolation',
      template: `<main>{{ '<Mixed.VueT>' }}</main>`,
    },
    {
      name: 'directive-shaped plain text',
      template: `<pre>Example :title="Mixed.VueT"</pre>`,
    },
    {
      name: 'tag-shaped textarea text',
      template: `<textarea><Mixed.VueT /></textarea>`,
    },
    {
      name: 'a slot binding used by a descendant dynamic component',
      template: `<Child v-slot="{ Mixed }"><component :is="Mixed.VueT" /></Child>`,
    },
    {
      name: 'a loop binding used by a descendant dynamic component',
      template: `<main v-for="Mixed in values"><component :is="Mixed.VueT" /></main>`,
    },
    {
      name: 'a loop binding used by a same-element dynamic component',
      template: `<component v-for="Mixed in values" :is="Mixed.VueT" />`,
    },
    {
      name: 'a loop binding declared after a same-element dynamic component',
      template: `<component :is="Mixed.VueT" v-for="Mixed in values" />`,
    },
  ])('ignores namespace spelling in $name', ({ template }) => {
    const root = sfcApp(`
      <script setup>
      import * as Mixed from '@fixture/multi/vue';
      const values = [];
      </script>
      <template>${template}</template>
    `);

    expect(detectVueProject(root)).toBe(false);
  });

  it.each([
    {
      name: 'a direct member expression',
      template: '<component :is="Mixed.VueT" />',
    },
    {
      name: 'an optional member expression',
      template: '<component :is="Mixed?.VueT" />',
    },
    {
      name: 'a statically computed member expression',
      template: `<component :is="Mixed['VueT']" />`,
    },
    {
      name: 'a dynamic bind argument',
      template: `<main :[Mixed.VueT]="true" />`,
    },
    {
      name: 'a dynamic event argument',
      template: `<main v-on:[Mixed.VueT]="handler" />`,
    },
    {
      name: 'a namespace component tag',
      template: '<Mixed.VueT>Active</Mixed.VueT>',
    },
    {
      name: 'an outer namespace beneath an unrelated loop binding',
      template: `<main v-for="item in values"><component :is="Mixed.VueT" /></main>`,
    },
    {
      name: 'an outer namespace after a same-named loop binding closes',
      template: `<section><main v-for="Mixed in values"></main><component :is="Mixed.VueT" /></section>`,
    },
    {
      name: 'an outer namespace in same-element v-if before v-for',
      template: `<component v-if="Mixed.VueT" v-for="Mixed in values" :is="'div'" />`,
    },
    {
      name: 'an outer namespace in same-element v-if after v-for',
      template: `<component v-for="Mixed in values" v-if="Mixed.VueT" :is="'div'" />`,
    },
    {
      name: 'a member after a nested template closes',
      template: `
        <section>
          <template #header><h1>Header</h1></template>
          <Mixed.VueT>Active after nested template</Mixed.VueT>
        </section>
      `,
    },
  ])('recognizes $name', ({ template }) => {
    const root = sfcApp(`
      <script setup>
      import * as Mixed from '@fixture/multi/vue';
      </script>
      <template>${template}</template>
    `);

    expect(detectVueProject(root)).toBe(true);
  });

  it.each([
    'Button',
    'Component',
    'LinearGradient',
    'Math',
    'Slot',
    'Template',
    'keepalive',
    'transitiongroup',
  ])('recognizes <%s> as a component with Vue-exact casing', (name) => {
    const root = sfcApp(`
      <script setup>
      import { VueT as ${name} } from '@fixture/multi/vue';
      </script>
      <template><${name}>Active component</${name}></template>
    `);

    expect(detectVueProject(root)).toBe(true);
  });

  it.each([
    'button',
    'linearGradient',
    'math',
    'BaseTransition',
    'KeepAlive',
    'Teleport',
    'TransitionGroup',
  ])('does not treat native or built-in <%s> as import usage', (name) => {
    const root = sfcApp(`
      <script setup>
      import { VueT as ${name} } from '@fixture/multi/vue';
      </script>
      <template><${name}>Platform element</${name}></template>
    `);

    expect(detectVueProject(root)).toBe(false);
  });
});

describe('Vue wrapper use in lexically scoped component tags', () => {
  it.each([
    {
      name: 'a namespace beneath a slot binding',
      template: '<Child v-slot="{ Mixed }"><Mixed.VueT /></Child>',
    },
    {
      name: 'a named component beneath a slot binding',
      template: '<Child v-slot="{ VueT }"><VueT /></Child>',
    },
    {
      name: 'a namespace beneath a simple v-for binding',
      template: '<main v-for="Mixed in rows"><Mixed.VueT /></main>',
    },
    {
      name: 'a named component beneath a simple v-for binding',
      template: '<main v-for="VueT in rows"><VueT /></main>',
    },
    {
      name: 'a namespace on the element declaring its v-for binding',
      template: '<Mixed.VueT v-for="Mixed in rows" />',
    },
    {
      name: 'a named component on the element declaring its v-for binding',
      template: '<VueT v-for="VueT in rows" />',
    },
    {
      name: 'a parenthesized v-for binding',
      template: '<main v-for="(Mixed, index) in rows"><Mixed.VueT /></main>',
    },
    {
      name: 'a parenthesized array v-for binding',
      template: '<main v-for="([Mixed], index) in rows"><Mixed.VueT /></main>',
    },
    {
      name: 'a parenthesized object v-for binding',
      template:
        '<main v-for="({ Mixed }, index) in rows"><Mixed.VueT /></main>',
    },
    {
      name: 'a parenthesized v-for binding used by a dynamic component',
      template:
        '<main v-for="(Mixed, index) in rows"><component :is="Mixed.VueT" /></main>',
    },
  ])('does not attribute $name to the wrapper import', ({ template }) => {
    const root = scopeApp(template);

    expect(detectVueProject(root)).toBe(false);
  });

  it.each(['component', 'Component'])(
    'does not treat dynamic <%s> as an import use',
    (component) => {
      const root = scopeApp(`<${component} :is="'div'" />`);

      expect(detectVueProject(root)).toBe(false);
    }
  );

  it.each(['component', 'Component'])(
    'retains imported static <%s> as a runtime use',
    (component) => {
      const root = scopeApp(`<${component} />`);

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it.each(['COMPONENT', 'cOmPoNeNt'])(
    'retains imported non-builtin casing <%s> with an is binding',
    (component) => {
      const root = scopeApp(`<${component} :is="'div'" />`);

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it.each(['component', 'Component'])(
    'retains imported static <%s> when boolean is has no value',
    (component) => {
      const root = scopeApp(`<${component} is />`);

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it('does not attribute a dot-shorthand dynamic component to a static component import', () => {
    const root = scopeApp(
      `<component .is="'div'" />`,
      "import { VueT as component } from '@fixture/multi/vue';"
    );

    expect(detectVueProject(root)).toBe(false);
  });

  it('tracks a wrapper passed through the dot-shorthand dynamic component expression', () => {
    const root = scopeApp(
      '<component .is="VueT" />',
      "import { VueT } from '@fixture/multi/vue';"
    );

    expect(detectVueProject(root)).toBe(true);
  });

  it.each([
    {
      imports: "import { VueT } from '@fixture/multi/vue';",
      name: 'a named component from a native element',
      template: '<div is="vue:VueT" />',
    },
    {
      imports: "import * as Mixed from '@fixture/multi/vue';",
      name: 'a namespace component from a native element',
      template: '<div is="vue:Mixed.VueT" />',
    },
    {
      imports: "import { VueT } from '@fixture/multi/vue';",
      name: 'a named component from a Vue builtin',
      template: '<Teleport is="vue:VueT" />',
    },
    {
      imports: "import { VueT as div } from '@fixture/multi/vue';",
      name: 'a native-named component target',
      template: '<main is="vue:div" />',
    },
    {
      imports: "import { VueT as slot } from '@fixture/multi/vue';",
      name: 'a slot-named component target',
      template: '<main is="vue:slot" />',
    },
    {
      imports: "import { VueT as template } from '@fixture/multi/vue';",
      name: 'a template-named component target',
      template: '<main is="vue:template" />',
    },
  ])('tracks $name selected by static vue:is', ({ imports, template }) => {
    const root = scopeApp(template, imports);

    expect(detectVueProject(root)).toBe(true);
  });

  it.each([
    {
      name: 'a wrapper source tag replaced by a native target',
      template: '<VueT is="vue:div" />',
    },
    {
      name: 'a wrapper source tag replaced by an empty target',
      template: '<VueT is="vue:" />',
    },
    {
      name: 'a wrapper source tag replaced by a builtin target',
      template: '<VueT is="vue:Teleport" />',
    },
    {
      name: 'a dynamic component with a static vue-prefixed value',
      template: '<component is="vue:VueT" />',
    },
    {
      name: 'a slot with a static vue-prefixed value',
      template: '<slot is="vue:VueT" />',
    },
    {
      name: 'a version-ambiguous template element',
      template: '<template is="vue:VueT" />',
    },
    {
      name: 'a compiler-option-ambiguous custom element',
      template: '<x-box is="vue:VueT" />',
    },
  ])('does not attribute $name to a wrapper import', ({ template }) => {
    const root = scopeApp(
      template,
      "import { VueT } from '@fixture/multi/vue';"
    );

    expect(detectVueProject(root)).toBe(false);
  });

  it('lets a core builtin static target outrank a same-named import', () => {
    const root = scopeApp(
      '<main is="vue:Teleport" />',
      "import { VueT as Teleport } from '@fixture/multi/vue';"
    );

    expect(detectVueProject(root)).toBe(false);
  });

  it.each([
    '<div v-is="VueT" />',
    '<VueT v-is="\'div\'" />',
    '<VueT v-is="Mixed.Other" />',
  ])('does not promote version-ambiguous valued v-is source %s', (template) => {
    const root = scopeApp(template);

    expect(detectVueProject(root)).toBe(false);
  });

  it('retains a wrapper source tag for no-value v-is', () => {
    const root = scopeApp(
      '<VueT v-is />',
      "import { VueT } from '@fixture/multi/vue';"
    );

    expect(detectVueProject(root)).toBe(true);
  });

  it('does not execute the dynamic argument of no-value v-is', () => {
    const root = scopeApp(
      '<div v-is:[VueT] />',
      "import { VueT } from '@fixture/multi/vue';"
    );

    expect(detectVueProject(root)).toBe(false);
  });

  it.each([
    {
      imports: "import { VueT } from '@fixture/multi/vue';",
      template: '<VueT v-is="VueT" />',
    },
    {
      imports: "import * as Mixed from '@fixture/multi/vue';",
      template: '<Mixed.VueT v-is="Mixed.VueT" />',
    },
    {
      imports: "import { VueT } from '@fixture/multi/vue';",
      template: '<div is="vue:VueT" v-is="VueT" />',
    },
  ])(
    'retains a wrapper used by both interpretations of valued v-is',
    ({ imports, template }) => {
      const root = scopeApp(template, imports);

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it.each([
    {
      name: 'an explicit template slot scope',
      template:
        '<Child><template #default="{ Mixed }"><Mixed.VueT /></template></Child>',
    },
    {
      name: 'a three-parameter parenthesized v-for scope',
      template:
        '<main v-for="(Mixed, index, key) of rows"><Mixed.VueT /></main>',
    },
    {
      name: 'an exact Pascal binding rendered through kebab casing',
      imports: "import { VueT } from '@fixture/multi/vue';",
      template: '<main v-for="VueT in rows"><vue-t /></main>',
    },
    {
      name: 'an exact camel binding rendered through kebab casing',
      imports: "import { VueT as vueT } from '@fixture/multi/vue';",
      template: '<main v-for="vueT in rows"><vue-t /></main>',
    },
    {
      name: 'a self-referential slot binding default',
      imports: "import { VueT } from '@fixture/multi/vue';",
      template: '<Child v-slot="{ VueT = VueT }"><VueT /></Child>',
    },
    {
      name: 'a Pascal import when a camel setup binding has precedence',
      imports:
        "import { VueT } from '@fixture/multi/vue'; const vueT = 'section';",
      template: '<vue-t />',
    },
    {
      name: 'a Pascal namespace when a camel setup binding has precedence',
      imports:
        "import * as Mixed from '@fixture/multi/vue'; const mixed = { VueT: 'section' };",
      template: '<mixed.VueT />',
    },
    {
      name: 'an exact camel import when a Pascal literal has type precedence',
      imports:
        "import { VueT as vueT } from '@fixture/multi/vue'; const VueT = 'section';",
      template: '<vue-t />',
    },
    {
      name: 'an exact camel import when a static template has type precedence',
      imports:
        "import { VueT as vueT } from '@fixture/multi/vue'; const VueT = `section${1}`;",
      template: '<vue-t />',
    },
    {
      name: 'an exact camel import when an object rest binding has type precedence',
      imports:
        "import { VueT as vueT } from '@fixture/multi/vue'; const { ...VueT } = source;",
      template: '<vue-t />',
    },
    {
      name: 'an exact camel import when a RegExp binding has type precedence',
      imports:
        "import { VueT as vueT } from '@fixture/multi/vue'; const VueT = /section/;",
      template: '<vue-t />',
    },
  ])(
    'does not attribute $name to the wrapper import',
    ({ imports, template }) => {
      const root = scopeApp(template, imports);

      expect(detectVueProject(root)).toBe(false);
    }
  );

  it.each([
    {
      name: 'the component owning a same-named slot binding',
      template: '<VueT v-slot="{ VueT }"><span /></VueT>',
    },
    {
      name: 'a same-named component in the v-for source',
      template: '<VueT v-for="VueT in [VueT]" />',
    },
    {
      name: 'a same-named component in a higher-precedence v-if',
      template: '<VueT v-for="VueT in rows" v-if="VueT" />',
    },
    {
      name: 'a namespace not bound by an aliased object pattern',
      imports: "import * as Mixed from '@fixture/multi/vue';",
      template:
        '<main v-for="({ Mixed: local }, index) in rows"><Mixed.VueT /></main>',
    },
    {
      name: 'a Pascal import when only its camel variant is scoped',
      template: '<main v-for="vueT in rows"><vue-t /></main>',
    },
    {
      name: 'a Pascal namespace rendered through lowercase casing',
      imports: "import * as Mixed from '@fixture/multi/vue';",
      template: '<mixed.VueT />',
    },
    {
      name: 'a Pascal namespace rendered through kebab casing',
      imports: "import * as MyComponents from '@fixture/multi/vue';",
      template: '<my-components.VueT />',
    },
    {
      name: 'a camel namespace rendered through kebab casing',
      imports: "import * as myComponents from '@fixture/multi/vue';",
      template: '<my-components.VueT />',
    },
    {
      name: 'a Pascal namespace with type precedence over a camel binding',
      imports:
        "import * as MyComponents from '@fixture/multi/vue'; const myComponents = getComponents();",
      template: '<my-components.VueT />',
    },
    {
      name: 'a camel import ahead of a Pascal member-call binding',
      imports:
        "import { VueT as vueT } from '@fixture/multi/vue'; const VueT = factory.make();",
      template: '<vue-t />',
    },
  ])('retains $name as a wrapper import use', ({ imports, template }) => {
    const root = scopeApp(template, imports);

    expect(detectVueProject(root)).toBe(true);
  });

  it('does not attribute a normalized namespace tag to its shadowed Pascal binding', () => {
    const root = scopeApp(
      '<Child v-slot="{ Mixed }"><mixed.VueT /></Child>',
      "import * as Mixed from '@fixture/multi/vue';"
    );

    expect(detectVueProject(root)).toBe(false);
  });

  it.each([
    {
      imports: "import { VueT as component } from '@fixture/multi/vue';",
      name: 'the Vue 3.3 static component interpretation',
    },
    {
      imports: "import { VueT as is } from '@fixture/multi/vue';",
      name: 'the Vue 3.5 same-name binding interpretation',
    },
  ])(
    'conservatively retains $name of no-value :is shorthand',
    ({ imports }) => {
      const root = scopeApp('<component :is />', imports);

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it('matches Vue 3.5 lexical resolution for slot and v-for component tags', () => {
    const slot = compileInlineTemplate(
      '<Child v-slot="{ Mixed }"><Mixed.VueT /></Child>'
    );
    const loop = compileInlineTemplate(
      '<main v-for="(Mixed, index) in rows"><Mixed.VueT /></main>'
    );

    expect(slot).toContain('default: _withCtx(({ Mixed }) => [');
    expect(slot).toContain('_createVNode(Mixed.VueT)');
    expect(loop).toContain('_renderList(rows, (Mixed, index) => {');
    expect(loop).toContain('_createVNode(Mixed.VueT)');
  });

  it('matches Vue 3.5 resolution of the lowercase component builtin', () => {
    const output = compileInlineTemplate('<component :is="\'div\'" />');

    expect(output).toContain("_resolveDynamicComponent('div')");
    expect(output).not.toContain('_unref(component)');
  });

  it('matches Vue 3.5 static vue:is component resolution', () => {
    const named = compileInlineTemplate(
      '<div is="vue:VueT" />',
      "import { VueT } from '@fixture/multi/vue';"
    );
    const native = compileInlineTemplate(
      '<VueT is="vue:div" />',
      "import { VueT } from '@fixture/multi/vue';"
    );
    const namespace = compileInlineTemplate(
      '<div is="vue:Mixed.VueT" />',
      "import * as Mixed from '@fixture/multi/vue';"
    );

    expect(named).toContain('_createBlock(_unref(VueT))');
    expect(native).toContain('_resolveComponent("div")');
    expect(native).not.toContain('_unref(VueT)');
    expect(namespace).toContain('_createBlock(Mixed.VueT)');
  });

  it('documents installed Vue semantics for valued v-is', () => {
    const output = compileInlineTemplate(
      '<div v-is="VueT" />',
      "import { VueT } from '@fixture/multi/vue';"
    );

    if (vueCompilerVersion.startsWith('3.3.')) {
      expect(output).toContain('_resolveDynamicComponent(_unref(VueT))');
    } else {
      expect(output).toContain('_createElementBlock("div")');
      expect(output).not.toContain('_unref(VueT)');
    }
  });

  it('matches Vue component lookup precedence for camel setup bindings', () => {
    const output = compileInlineTemplate(
      '<vue-t />',
      "import { VueT } from '@fixture/multi/vue'; const vueT = 'section';"
    );

    expect(output).toContain('_createBlock(vueT)');
    expect(output).not.toContain('_unref(VueT)');
  });

  it('matches Vue binding-type precedence ahead of normalized spelling', () => {
    const literalOutput = compileInlineTemplate(
      '<vue-t />',
      "import { VueT as vueT } from '@fixture/multi/vue'; const VueT = 'section';"
    );
    const namespaceOutput = compileInlineTemplate(
      '<my-components.VueT />',
      "import * as MyComponents from '@fixture/multi/vue'; const myComponents = getComponents();"
    );
    const restOutput = compileInlineTemplate(
      '<vue-t />',
      "import { VueT as vueT } from '@fixture/multi/vue'; const { ...VueT } = source;"
    );
    const memberCallOutput = compileInlineTemplate(
      '<vue-t />',
      "import { VueT as vueT } from '@fixture/multi/vue'; const VueT = factory.make();"
    );

    expect(literalOutput).toContain('_createBlock(VueT)');
    expect(literalOutput).not.toContain('_unref(vueT)');
    expect(namespaceOutput).toContain('MyComponents.VueT');
    expect(namespaceOutput).not.toContain('myComponents.VueT');
    expect(restOutput).toContain('_createBlock(VueT)');
    expect(restOutput).not.toContain('_unref(vueT)');
    expect(memberCallOutput).toContain('_createBlock(_unref(vueT))');
    expect(memberCallOutput).not.toContain('_unref(VueT)');
  });

  it('selects a setup binding before applying lexical shadowing', () => {
    const output = compileInlineTemplate(
      '<main v-for="vueT in rows"><vue-t /></main>',
      "import { VueT } from '@fixture/multi/vue';"
    );

    expect(output).toContain('_unref(VueT)');
    expect(output).not.toContain('_createVNode(vueT)');
  });
});

describe('Vue wrapper use beneath v-pre', () => {
  it.each([
    {
      name: 'a namespace component tag',
      template: '<section v-pre><Mixed.VueT /></section>',
    },
    {
      name: 'a named component tag',
      template: '<section v-pre><VueT /></section>',
    },
    {
      name: 'a directive expression',
      template: '<section v-pre :title="Mixed.VueT" />',
    },
    {
      name: 'a directive before v-pre',
      template: '<section :title="Mixed.VueT" v-pre />',
    },
    {
      name: 'an interpolation',
      template: '<section v-pre>{{ Mixed.VueT }}</section>',
    },
    {
      name: 'nested elements',
      template: `
        <section v-pre>
          <div><Mixed.VueT />{{ Mixed.VueT }}</div>
        </section>
      `,
    },
    {
      name: 'v-pre on the namespace component itself',
      template: '<Mixed.VueT v-pre />',
    },
    {
      name: 'v-pre on the named component itself',
      template: '<VueT v-pre />',
    },
    {
      name: 'a v-pre modifier accepted by the Vue compiler',
      template: '<section v-pre.foo><Mixed.VueT /></section>',
    },
    {
      name: 'a v-pre argument accepted by the Vue compiler',
      template: '<section v-pre:ignored><Mixed.VueT /></section>',
    },
    {
      name: 'a void element inside v-pre',
      template: `
        <section v-pre>
          <img :src="Mixed.VueT">
          <Mixed.VueT />
        </section>
      `,
    },
    {
      name: 'a raw-text element inside v-pre',
      template: `
        <section v-pre>
          <textarea>{{ Mixed.VueT }}<Mixed.VueT /></textarea>
          <Mixed.VueT />
        </section>
      `,
    },
    {
      name: 'closing-tag-shaped content in a comment',
      template: `
        <section v-pre>
          <!-- </section><Mixed.VueT /> -->
          <Mixed.VueT />
        </section>
      `,
    },
    {
      name: 'an uppercase void-name component used as a v-pre owner',
      template: `
        <INPUT v-pre :value="Mixed.VueT">
          <Mixed.VueT />
        </INPUT>
      `,
    },
  ])('ignores $name', ({ template }) => {
    const root = vPreApp(template);

    expect(detectVueProject(root)).toBe(false);
  });

  it('resumes executable component detection after the v-pre element closes', () => {
    const root = vPreApp(`
      <section>
        <section v-pre>
          <section><Mixed.VueT /></section>
        </section>
        <Mixed.VueT />
      </section>
    `);

    expect(detectVueProject(root)).toBe(true);
  });

  it.each([
    {
      name: 'a case-insensitive HTML closing tag',
      template: `
        <SECTION v-pre><Mixed.VueT /></section>
        <Mixed.VueT />
      `,
    },
    {
      name: 'a void v-pre owner',
      template: `
        <input v-pre :value="Mixed.VueT">
        <Mixed.VueT />
      `,
    },
    {
      name: 'a raw-text v-pre owner',
      template: `
        <textarea v-pre>{{ Mixed.VueT }}<Mixed.VueT /></textarea>
        <Mixed.VueT />
      `,
    },
    {
      name: 'an uppercase raw-text v-pre owner',
      template: `
        <TEXTAREA v-pre>{{ Mixed.VueT }}<Mixed.VueT /></textarea>
        <Mixed.VueT />
      `,
    },
  ])('resumes component detection after $name', ({ template }) => {
    const root = vPreApp(template);

    expect(detectVueProject(root)).toBe(true);
  });

  it.each(['textarea', 'title'])(
    'recognizes executable interpolation in <%s> without v-pre',
    (tag) => {
      const root = vPreApp(`<${tag}>{{ Mixed.VueT }}</${tag}>`);

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it.each(['INPUT', 'TEXTAREA', 'SCRIPT'])(
    'treats case-sensitive <%s> as a component container without v-pre',
    (tag) => {
      const root = vPreApp(`<${tag}><Mixed.VueT /></${tag}>`);

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it('matches the Vue 3.5 compiler treatment of v-pre content', () => {
    const { code } = compile(
      `
        <section v-pre>
          <Mixed.VueT />
          <VueT />
          <main :title="Mixed.VueT">{{ Mixed.VueT }}</main>
        </section>
        <Mixed.VueT />
      `,
      { mode: 'module', prefixIdentifiers: true }
    );

    expect(code).toContain('_createElementVNode("Mixed.VueT")');
    expect(code).toContain('_createElementVNode("VueT")');
    expect(code).toContain('{ ":title": "Mixed.VueT" }');
    expect(code).toContain('"{{ Mixed.VueT }}"');
    expect(code).toContain('_resolveComponent("Mixed.VueT")');
    expect(code).not.toContain('_ctx.Mixed');
  });
});

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

/**
 * Files for a React app that depends on a local package whose root entry is
 * React-only and whose `./vue` entry re-exports gt-vue's `T`.
 */
function multiFrameworkFiles(
  manifest: Record<string, unknown> = {}
): Record<string, string> {
  return {
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
  };
}

/** Creates a private multi-framework app that is removed after the test. */
function createMultiFrameworkFixture(
  sourceFiles: Record<string, string>,
  manifest?: Record<string, unknown>
): string {
  const root = createTestProject({
    ...multiFrameworkFiles(manifest),
    ...sourceFiles,
  });
  linkPackage(root, '', '@fixture/multi', 'vendor/multi');
  return root;
}

/**
 * Returns a multi-framework app containing exactly `sourceFiles`.
 *
 * Detection keeps no state between calls, so cases that only vary files below
 * `src/` rewrite one shared app instead of scaffolding a project per case.
 */
function multiFrameworkApp(
  sourceFiles: Record<string, string>,
  manifest?: Record<string, unknown>
): string {
  const sourceOnly = Object.keys(sourceFiles).every((file) =>
    file.startsWith('src/')
  );
  if (manifest || !sourceOnly) {
    return createMultiFrameworkFixture(sourceFiles, manifest);
  }
  if (!sharedApp) {
    sharedApp = createProjectFixture(multiFrameworkFiles());
    linkPackage(sharedApp, '', '@fixture/multi', 'vendor/multi');
  }
  fs.rmSync(path.join(sharedApp, 'src'), { force: true, recursive: true });
  writeProjectFiles(sharedApp, sourceFiles);
  return sharedApp;
}

/** Returns the shared app with `source` as its only SFC. */
function sfcApp(source: string): string {
  return multiFrameworkApp({ 'src/App.vue': source });
}

/** Creates a React app whose local dependency mixes GT and ordinary exports. */
function createRootEntryFixture(sourceFiles: Record<string, string>): string {
  const root = createTestProject({
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
    ...sourceFiles,
  });
  linkPackage(root, '', '@fixture/mixed-root', 'vendor/mixed-root');
  return root;
}

function scopeApp(template: string, imports = defaultImports): string {
  return sfcApp(scopeSfc(template, imports));
}

function vPreApp(template: string): string {
  return sfcApp(`
      <script setup>
      import * as Mixed from '@fixture/multi/vue';
      import { VueT } from '@fixture/multi/vue';
      </script>
      <template>${template}</template>
    `);
}

function compileInlineTemplate(
  template: string,
  imports = defaultImports
): string {
  const { descriptor, errors } = parse(scopeSfc(template, imports), {
    filename: 'Scope.vue',
  });
  expect(errors).toEqual([]);
  return compileScript(descriptor, {
    id: 'consumer-template-scope-regression',
    inlineTemplate: true,
  }).content;
}

function scopeSfc(template: string, imports = defaultImports): string {
  return `<script setup>
${imports}
const rows = [];
</script>
<template>${template}</template>`;
}

const defaultImports = `import * as Mixed from '@fixture/multi/vue';
import {
  VueT,
  VueT as component,
  VueT as Component,
  VueT as COMPONENT,
  VueT as cOmPoNeNt,
} from '@fixture/multi/vue';`;
