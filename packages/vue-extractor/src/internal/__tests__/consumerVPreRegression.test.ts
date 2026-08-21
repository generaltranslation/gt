import fs from 'node:fs';
import path from 'node:path';
import { compile } from '@vue/compiler-dom';
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
    const root = createConsumerFixture(template);

    expect(detectVueProject(root)).toBe(false);
  });

  it('resumes executable component detection after the v-pre element closes', () => {
    const root = createConsumerFixture(`
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
    const root = createConsumerFixture(template);

    expect(detectVueProject(root)).toBe(true);
  });

  it.each(['textarea', 'title'])(
    'recognizes executable interpolation in <%s> without v-pre',
    (tag) => {
      const root = createConsumerFixture(`<${tag}>{{ Mixed.VueT }}</${tag}>`);

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it.each(['INPUT', 'TEXTAREA', 'SCRIPT'])(
    'treats case-sensitive <%s> as a component container without v-pre',
    (tag) => {
      const root = createConsumerFixture(`<${tag}><Mixed.VueT /></${tag}>`);

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

function createConsumerFixture(template: string): string {
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
    'src/App.vue': `
      <script setup>
      import * as Mixed from '@fixture/multi/vue';
      import { VueT } from '@fixture/multi/vue';
      </script>
      <template>${template}</template>
    `,
  });
  temporaryDirectories.push(root);

  const destination = path.join(root, 'node_modules', '@fixture', 'multi');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.symlinkSync(path.join(root, 'vendor/multi'), destination, 'dir');
  return root;
}
