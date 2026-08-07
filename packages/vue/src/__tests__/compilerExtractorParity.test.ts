import { fileURLToPath } from 'node:url';
import type { JsxChild, JsxChildren } from '@generaltranslation/format/types';
import { extractFromVueSource } from '@generaltranslation/vue-extractor';
import { hashSource } from 'generaltranslation/id';
import {
  compile,
  createSSRApp,
  defineComponent,
  Fragment,
  h,
  version,
  type Component,
  type RenderFunction,
  type VNode,
} from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { Branch, Plural, T, Var, createGT } from '../index';
import { serializeVueChildren } from '../rendering/translateVueChildren';

type ComponentCase = {
  component: 'Branch' | 'Plural';
  selectedSlot: string;
  selection: string;
};

type WhitespaceCase = {
  markup: string;
  name: string;
};

const consumerFile = fileURLToPath(
  new URL('../CompilerParity.vue', import.meta.url)
);
const projectRoot = fileURLToPath(new URL('../../../..', import.meta.url));

const components: ComponentCase[] = [
  {
    component: 'Branch',
    selectedSlot: 'formal',
    selection: 'branch="formal"',
  },
  { component: 'Plural', selectedSlot: 'one', selection: ':n="1"' },
];

const whitespace: WhitespaceCase[] = [
  { name: 'space', markup: ' ' },
  { name: 'tab', markup: '&#9;' },
  { name: 'line-feed', markup: '&#10;' },
  { name: 'form-feed', markup: '&#12;' },
  { name: 'carriage-return', markup: '&#13;' },
  { name: 'named-nbsp', markup: '&nbsp;' },
  { name: 'decimal-nbsp', markup: '&#160;' },
  { name: 'hex-nbsp', markup: '&#xA0;' },
  { name: 'literal-nbsp', markup: '\u00a0' },
  { name: 'ogham-space', markup: '&#x1680;' },
  { name: 'en-quad', markup: '&#x2000;' },
  { name: 'em-quad', markup: '&#x2001;' },
  { name: 'en-space', markup: '&ensp;' },
  { name: 'em-space', markup: '&emsp;' },
  { name: 'three-per-em-space', markup: '&#x2004;' },
  { name: 'four-per-em-space', markup: '&#x2005;' },
  { name: 'six-per-em-space', markup: '&#x2006;' },
  { name: 'figure-space', markup: '&#x2007;' },
  { name: 'punctuation-space', markup: '&#x2008;' },
  { name: 'thin-space', markup: '&thinsp;' },
  { name: 'hair-space', markup: '&#x200A;' },
  { name: 'line-separator', markup: '&#x2028;' },
  { name: 'paragraph-separator', markup: '&#x2029;' },
  { name: 'narrow-nbsp', markup: '&#x202F;' },
  { name: 'medium-mathematical-space', markup: '&#x205F;' },
  { name: 'ideographic-space', markup: '&#x3000;' },
  { name: 'byte-order-mark', markup: '&#xFEFF;' },
  { name: 'zero-width-space', markup: '&#x200B;' },
  { name: 'word-joiner', markup: '&#x2060;' },
];

const positions = [
  { name: 'before', place: (slot: string, value: string) => value + slot },
  { name: 'after', place: (slot: string, value: string) => slot + value },
  {
    name: 'around',
    place: (slot: string, value: string) => value + slot + value,
  },
];

describe('Vue compiler and extractor canonical-source parity', () => {
  for (const componentCase of components) {
    for (const compilerWhitespace of ['condense', 'preserve'] as const) {
      for (const position of positions) {
        it.each(whitespace)(
          `${componentCase.component} ${compilerWhitespace} ${position.name} $name`,
          async (whitespaceCase) => {
            const namedSlot = `<template #${componentCase.selectedSlot}><strong title="Named">Named <Var>{{ label }}</Var></strong></template>`;
            const implicit = position.place(namedSlot, whitespaceCase.markup);
            const translated = await assertParity(
              componentCase,
              implicit,
              compilerWhitespace
            );

            expect(translated).toContain('TRANSLATED(Named ');
            expect(translated).toContain('Ada');
          }
        );
      }
    }
  }

  it('pins the known Vue 3.3/3.4 versus 3.5 NBSP slot boundary', async () => {
    const componentCase = components[0]!;
    const namedSlot =
      '<template #formal><strong>Named</strong></template>&nbsp;';
    const { extracted, runtime } = await canonicalSources(
      componentCase,
      namedSlot,
      'condense'
    );

    expect(extracted).toEqual(runtime);
    expect(
      typeof extracted === 'object' &&
        extracted !== null &&
        !Array.isArray(extracted) &&
        'c' in extracted
    ).toBe(minorVersion(version) >= 5);
  });

  it.each(components)(
    '$component preserves rich implicit fallback IDs and variable names',
    async (componentCase) => {
      const namedSlot = `<template #${componentCase.selectedSlot}><strong>Named <Var>{{ label }}</Var></strong></template>`;
      const richDefault = `<em title="Fallback">Fallback <Var>{{ fallback }}</Var></em>&nbsp;`;

      for (const compilerWhitespace of ['condense', 'preserve'] as const) {
        for (const implicit of [
          namedSlot + richDefault,
          richDefault + namedSlot,
        ]) {
          const { extracted, runtime } = await canonicalSources(
            componentCase,
            implicit,
            compilerWhitespace
          );
          expect(extracted).toEqual(runtime);
          expect(
            JSON.stringify(extracted).match(/"_gt_value_3"/g)
          ).toHaveLength(2);
        }
      }
    }
  );

  it.each([
    {
      name: 'direct import',
      script: "import { Fragment } from 'vue';",
      setup: { Fragment },
      setupBinding: 'Fragment',
      tag: 'Fragment',
    },
    {
      name: 'aliased import',
      script: "import { Fragment as F } from 'vue';",
      setup: { F: Fragment },
      setupBinding: 'F',
      tag: 'F',
    },
    {
      name: 'namespace import',
      script: "import * as Vue from 'vue';",
      setup: { Vue: { Fragment } },
      setupBinding: 'Vue',
      tag: 'Vue.Fragment',
    },
  ])(
    'flattens a Vue Fragment $name without consuming an ID',
    async ({ script, setup, setupBinding, tag }) => {
      const template = `<${tag}><span title="Fragment title">Fragment child</span></${tag}>`;
      const source = `<script setup>${script} import { T } from 'gt-vue';</script><template><T>${template}</T></template>`;
      const output = await extractFromVueSource(source, consumerFile, {
        projectRoot,
      });
      expect(output.errors).toEqual([]);
      expect(output.results).toHaveLength(1);

      const render = compile(template, {
        bindingMetadata: { [setupBinding]: 'setup-const' },
      }) as RenderFunction & {
        (
          context: Record<string, never>,
          cache: unknown[],
          props: Record<string, never>,
          setup: Record<string, unknown>,
          data: Record<string, never>,
          options: Record<string, never>
        ): VNode;
      };
      const fragment = render({}, [], {}, setup, {}, {});
      const runtime = serializeVueChildren([fragment]);

      expect(output.results[0]!.source).toEqual(runtime);
      expect(runtime).toEqual({
        t: 'span',
        i: 1,
        d: { ti: 'Fragment title' },
        c: 'Fragment child',
      });
    }
  );

  it('retains a static Fragment tag across an expression-local binding', async () => {
    const source = `<script setup>import { Fragment as F } from 'vue'; import { T } from 'gt-vue'; const choices = [String];</script><template><div v-for="F in choices"><T><F><span>Opaque child</span></F><b>After</b></T></div></template>`;
    const output = await extractFromVueSource(source, consumerFile, {
      projectRoot,
    });

    expect(output.errors).toEqual([]);
    expect(output.results).toHaveLength(1);
    expect(output.results[0]!.source).toEqual([
      { t: 'span', i: 1, c: 'Opaque child' },
      { t: 'b', i: 2, c: 'After' },
    ]);
  });

  it('does not flatten a Fragment dynamic selector shadowed by a local binding', async () => {
    const source = `<script setup>import { Fragment as F } from 'vue'; import { T } from 'gt-vue'; const choices = [String];</script><template><div v-for="F in choices"><T><component :is="F"><span>Opaque child</span></component><b>After</b></T></div></template>`;
    const output = await extractFromVueSource(source, consumerFile, {
      projectRoot,
    });

    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain(
      'Found a dynamic <component> inside a gt-vue <T> component'
    );
    expect(output.results).toEqual([]);
  });
});

async function assertParity(
  componentCase: ComponentCase,
  implicit: string,
  whitespaceOption: 'condense' | 'preserve'
): Promise<string> {
  const { extracted, render, runtime } = await canonicalSources(
    componentCase,
    implicit,
    whitespaceOption
  );
  expect(extracted).toEqual(runtime);

  const extractedHash = hashSource({ dataFormat: 'JSX', source: extracted });
  const runtimeHash = hashSource({ dataFormat: 'JSX', source: runtime });
  expect(extractedHash).toBe(runtimeHash);

  const plugin = createGT({
    defaultLocale: 'en',
    loadTranslations: async () => ({
      [extractedHash]: translateSource(extracted),
    }),
    locale: 'fr',
  });
  await plugin.loadTranslations('fr');
  const app = createSSRApp(
    createCompiledRoot(render, {
      Branch,
      Plural,
      T,
      Var,
    })
  );
  app.use(plugin);
  return renderToString(app);
}

async function canonicalSources(
  componentCase: ComponentCase,
  implicit: string,
  whitespaceOption: 'condense' | 'preserve'
): Promise<{
  extracted: JsxChildren;
  render: RenderFunction;
  runtime: JsxChildren;
}> {
  const template = `<T><${componentCase.component} ${componentCase.selection}>${implicit}</${componentCase.component}></T>`;
  const source = `<script setup>import { Branch, Plural, T, Var } from 'gt-vue'; const label = 'Ada'; const fallback = 'Grace';</script><template>${template}</template>`;
  const output = await extractFromVueSource(source, consumerFile, {
    compilerOptions: { whitespace: whitespaceOption },
    projectRoot,
  });
  expect(output.errors).toEqual([]);
  expect(output.results).toHaveLength(1);
  const extracted = output.results[0]!.source;
  expect(output.results[0]!.dataFormat).toBe('JSX');

  const render = compile(template, { whitespace: whitespaceOption });
  const captured: JsxChildren[] = [];
  const CaptureT = defineComponent({
    name: 'CaptureT',
    setup(_props, { slots }) {
      return () => {
        captured.push(serializeVueChildren(slots.default?.() ?? []));
        return h('div');
      };
    },
  });
  const app = createSSRApp(
    createCompiledRoot(render, {
      Branch,
      Plural,
      T: CaptureT,
      Var,
    })
  );
  await renderToString(app);
  expect(captured).toHaveLength(1);

  return { extracted, render, runtime: captured[0]! };
}

function createCompiledRoot(
  render: RenderFunction,
  registered: Record<string, Component>
) {
  return defineComponent({
    components: registered,
    setup() {
      return { fallback: 'Grace', label: 'Ada' };
    },
    render,
  });
}

function translateSource(source: JsxChildren): JsxChildren {
  if (typeof source === 'string') return `TRANSLATED(${source})`;
  if (Array.isArray(source)) return source.map(translateSource);
  if (isVariable(source)) return source;

  return {
    ...source,
    ...(source.c !== undefined && { c: translateSource(source.c) }),
    ...(source.d?.b && {
      d: {
        ...source.d,
        b: Object.fromEntries(
          Object.entries(source.d.b).map(([name, branch]) => [
            name,
            translateSource(branch),
          ])
        ),
      },
    }),
  };
}

function isVariable(
  source: JsxChild
): source is Extract<JsxChild, { v: unknown }> {
  return typeof source === 'object' && source !== null && 'v' in source;
}

function minorVersion(value: string): number {
  return Number(value.split('.')[1]);
}
