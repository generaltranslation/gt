import fs from 'node:fs';
import path from 'node:path';
import { compileScript, parse } from '@vue/compiler-sfc';
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
    const root = createConsumerFixture(template);

    expect(detectVueProject(root)).toBe(false);
  });

  it.each(['component', 'Component'])(
    'does not treat dynamic <%s> as an import use',
    (component) => {
      const root = createConsumerFixture(`<${component} :is="'div'" />`);

      expect(detectVueProject(root)).toBe(false);
    }
  );

  it.each(['component', 'Component'])(
    'retains imported static <%s> as a runtime use',
    (component) => {
      const root = createConsumerFixture(`<${component} />`);

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it.each(['COMPONENT', 'cOmPoNeNt'])(
    'retains imported non-builtin casing <%s> with an is binding',
    (component) => {
      const root = createConsumerFixture(`<${component} :is="'div'" />`);

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it.each(['component', 'Component'])(
    'retains imported static <%s> when boolean is has no value',
    (component) => {
      const root = createConsumerFixture(`<${component} is />`);

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it('does not attribute a dot-shorthand dynamic component to a static component import', () => {
    const root = createConsumerFixture(
      `<component .is="'div'" />`,
      "import { VueT as component } from '@fixture/multi/vue';"
    );

    expect(detectVueProject(root)).toBe(false);
  });

  it('tracks a wrapper passed through the dot-shorthand dynamic component expression', () => {
    const root = createConsumerFixture(
      '<component .is="VueT" />',
      "import { VueT } from '@fixture/multi/vue';"
    );

    expect(detectVueProject(root)).toBe(true);
  });

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
      const root = createConsumerFixture(template, imports);

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
    const root = createConsumerFixture(template, imports);

    expect(detectVueProject(root)).toBe(true);
  });

  it('does not attribute a normalized namespace tag to its shadowed Pascal binding', () => {
    const root = createConsumerFixture(
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
      const root = createConsumerFixture('<component :is />', imports);

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

function createConsumerFixture(
  template: string,
  imports = defaultImports
): string {
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
    'src/App.vue': createSfc(template, imports),
  });
  temporaryDirectories.push(root);

  const destination = path.join(root, 'node_modules', '@fixture', 'multi');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.symlinkSync(path.join(root, 'vendor/multi'), destination, 'dir');
  return root;
}

function compileInlineTemplate(
  template: string,
  imports = defaultImports
): string {
  const { descriptor, errors } = parse(createSfc(template, imports), {
    filename: 'Scope.vue',
  });
  expect(errors).toEqual([]);
  return compileScript(descriptor, {
    id: 'consumer-template-scope-regression',
    inlineTemplate: true,
  }).content;
}

function createSfc(template: string, imports = defaultImports): string {
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
