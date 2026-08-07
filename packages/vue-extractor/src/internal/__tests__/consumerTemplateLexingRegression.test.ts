import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectVueProject } from '../../detect.js';
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
    const root = createConsumerFixture(source);

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
    const root = createConsumerFixture(`
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
      name: 'a slot binding that shadows the imported name',
      template: `<Child v-slot="{ Mixed }">Ordinary</Child>`,
    },
    {
      name: 'a loop binding that shadows the imported name',
      template: `<main v-for="Mixed in values">Ordinary</main>`,
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
    const root = createConsumerFixture(`
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
    const root = createConsumerFixture(`
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
    const root = createConsumerFixture(`
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
    const root = createConsumerFixture(`
      <script setup>
      import { VueT as ${name} } from '@fixture/multi/vue';
      </script>
      <template><${name}>Platform element</${name}></template>
    `);

    expect(detectVueProject(root)).toBe(false);
  });
});

function createConsumerFixture(source: string): string {
  const root = createProjectFixture({
    'package.json': JSON.stringify({
      name: '@fixture/react-app',
      dependencies: { '@fixture/multi': 'file:./vendor/multi' },
    }),
    'vendor/multi/package.json': JSON.stringify({
      name: '@fixture/multi',
      version: '1.0.0',
      exports: { './vue': './src/vue.ts' },
      dependencies: { 'gt-vue': '*' },
    }),
    'vendor/multi/src/vue.ts': "export { T as VueT } from 'gt-vue';\n",
    'src/App.vue': source,
  });
  temporaryDirectories.push(root);

  const destination = path.join(root, 'node_modules', '@fixture', 'multi');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.symlinkSync(path.join(root, 'vendor/multi'), destination, 'dir');
  return root;
}
