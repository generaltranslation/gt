import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { JsxChildren } from '@generaltranslation/format/types';
import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from '../../index.js';

describe('Vue template extraction', () => {
  it('ports the React rich-content matrix with Vue slot semantics', async () => {
    const filePath = fixturePath('template-rich-matrix.vue');
    const source = await readFile(filePath, 'utf8');

    const output = await extractFromVueSource(source, filePath);

    expect(output.errors).toEqual([]);
    expect(richSources(output.results)).toEqual([
      {
        t: 'section',
        i: 1,
        d: { ti: 'Heading', arl: 'Greeting' },
        c: [
          ' Hello ',
          {
            t: 'strong',
            i: 2,
            c: { i: 3, k: '_gt_value_3', v: 'v' },
          },
          ' ! ',
          { t: 'input', i: 4, d: { pl: 'Your name' } },
          {
            t: 'img',
            i: 5,
            d: { alt: 'Portrait', ard: 'hint' },
          },
          { i: 6, k: '_gt_n_6', v: 'n' },
          { i: 7, k: '_gt_date_7', v: 'd' },
          { i: 8, k: '_gt_cost_8', v: 'c' },
          { t: 'var', i: 9, c: 'native' },
          {
            t: 'Branch',
            i: 10,
            d: {
              b: {
                formal: [' Formal ', { i: 11, k: '_gt_value_11', v: 'v' }],
                casual: [' Casual ', { i: 11, k: '_gt_value_11', v: 'v' }],
              },
              t: 'b',
            },
            c: [' Fallback ', { i: 11, k: '_gt_value_11', v: 'v' }],
          },
          {
            t: 'Plural',
            i: 12,
            d: {
              b: {
                one: [' One ', { i: 13, k: '_gt_value_13', v: 'v' }],
                other: [' Many ', { i: 13, k: '_gt_value_13', v: 'v' }],
                zero: 'None',
              },
              t: 'p',
            },
            c: [' Fallback ', { i: 13, k: '_gt_value_13', v: 'v' }],
          },
        ],
      },
    ]);
    expect(output.results[0]?.metadata.context).toBe('matrix');
  });

  it('matches Vue scope, directive, slot, and component-name behavior', async () => {
    const filePath = fixturePath('template-adversarial.vue');
    const source = await readFile(filePath, 'utf8');

    const output = await extractFromVueSource(source, filePath);

    expect(output.errors).toEqual([]);
    expect(stringSources(output.results)).toEqual([
      'Outer v-if',
      'VForDefault',
      'VForSource',
      'SlotDefault',
    ]);
    expect(richSources(output.results)).toEqual([
      'Digit-normalized component',
      'Dynamic component',
      'Explicit default',
      {
        t: 'Branch',
        i: 1,
        d: {
          b: { casual: 'Second', formal: 'First' },
          t: 'b',
        },
      },
      {
        t: 'Plural',
        i: 1,
        d: {
          b: { one: 'One', other: 'Other' },
          t: 'p',
        },
      },
    ]);
  });

  it('visits executable directive arguments in their Vue scope', async () => {
    const output = await extractVue(`
      <script setup>
      import { useGT } from 'gt-vue';
      const gt = useGT();
      const rows = [{}];
      const value = 'attribute';
      </script>
      <template>
        <div :[gt('DirectiveArgument')]="value" />
        <div v-for="gt in rows" :[gt('ShadowedDirectiveArgument')]="value" />
      </template>
    `);

    expect(output.errors).toEqual([]);
    expect(stringSources(output.results)).toEqual(['DirectiveArgument']);
  });

  it('ignores comments and whitespace before an explicit default slot', async () => {
    const output = await extractVue(`
      <script setup>import { T } from 'gt-vue';</script>
      <template>
        <T>
          <!-- translator note -->
          <template #default>Explicit default</template>
        </T>
      </template>
    `);

    expect(output.errors).toEqual([]);
    expect(richSources(output.results)).toEqual(['Explicit default']);
  });

  it.each(['condense', 'preserve'] as const)(
    'drops named-slot separator whitespace with compiler whitespace %s',
    async (whitespace) => {
      const source = vueSource({
        imports: 'Branch, Plural, T',
        template:
          '<T><Branch branch="formal"><template #formal>First</template> <template #casual>Second</template></Branch></T><T><Plural :n="1"><template #one>One</template> <template #other>Other</template></Plural></T>',
      });

      const output = await extractFromVueSource(source, '/fixtures/Slots.vue', {
        compilerOptions: { whitespace },
        projectRoot: '/fixtures',
      });

      expect(output.errors).toEqual([]);
      expect(richSources(output.results)).toEqual([
        {
          t: 'Branch',
          i: 1,
          d: { b: { formal: 'First', casual: 'Second' }, t: 'b' },
        },
        {
          t: 'Plural',
          i: 1,
          d: { b: { one: 'One', other: 'Other' }, t: 'p' },
        },
      ]);
    }
  );

  it.each(['condense', 'preserve'] as const)(
    'preserves implicit default-slot separators with compiler whitespace %s',
    async (whitespace) => {
      const source = vueSource({
        imports: 'Branch, T',
        template:
          '<T><span>A</span> <b>B</b></T><T><Branch branch="formal"><span>A</span> <template #formal>Formal</template> <b>B</b></Branch></T>',
      });

      const output = await extractFromVueSource(source, '/fixtures/Slots.vue', {
        compilerOptions: { whitespace },
        projectRoot: '/fixtures',
      });

      expect(output.errors).toEqual([]);
      expect(richSources(output.results)).toEqual([
        [{ t: 'span', i: 1, c: 'A' }, ' ', { t: 'b', i: 2, c: 'B' }],
        {
          t: 'Branch',
          i: 1,
          d: { b: { formal: 'Formal' }, t: 'b' },
          c: [{ t: 'span', i: 2, c: 'A' }, '  ', { t: 'b', i: 3, c: 'B' }],
        },
      ]);
    }
  );

  it('rejects meaningful implicit content beside an explicit default slot', async () => {
    const output = await extractVue(`
      <script setup>import { T } from 'gt-vue';</script>
      <template>
        <T><template #default>Explicit</template>Implicit</T>
      </template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'more than one default slot definition'
    );
  });

  it('evaluates static TypeScript wrappers and BigInt template values', async () => {
    const output = await extractVue(`
      <script setup lang="ts">
      import { Branch, T } from 'gt-vue';
      </script>
      <template>
        <T :context="('catalog' satisfies string)">{{ 'Answer' satisfies string }}|{{ 1n }}|{{ \`X\${2n}\` }}</T>
        <T><Branch branch="formal" :formal="(1n satisfies bigint)" /></T>
      </template>
    `);

    expect(output.errors).toEqual([]);
    expect(richSources(output.results)).toEqual([
      'Answer|1|X2',
      {
        t: 'Branch',
        i: 1,
        d: { b: { formal: '1' }, t: 'b' },
      },
    ]);
    expect(output.results[0]?.metadata.context).toBe('catalog');
  });

  it('does not resolve a dynamic component through a shadowed GT binding', async () => {
    const output = await extractVue(`
      <script setup>
      import { T } from 'gt-vue';
      const components = [String];
      </script>
      <template>
        <div v-for="T in components">
          <component :is="T">Not a GT translation</component>
        </div>
      </template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it.each([
    {
      name: 'coalesces text around whitespace-free comments',
      imports: 'T',
      template: '<T>Hello<!-- translator note -->world</T>',
      expected: ['Helloworld'] satisfies JsxChildren[],
    },
    {
      name: 'evaluates side-effect-free primitive expressions',
      imports: 'T',
      template: "<T>{{ 'A' + 'B' }}|{{ 2 + 3 }}|{{ true }}|{{ null }}</T>",
      expected: ['AB|5|true|'] satisfies JsxChildren[],
    },
    {
      name: 'serializes statically bound HTML content props',
      imports: 'T',
      template:
        '<T><input :placeholder="\'Name\'" /><img :alt="`Portrait`" :aria-label="\'Photo\'" /></T>',
      expected: [
        [
          { t: 'input', i: 1, d: { pl: 'Name' } },
          {
            t: 'img',
            i: 2,
            d: { alt: 'Portrait', arl: 'Photo' },
          },
        ],
      ] satisfies JsxChildren[],
    },
    {
      name: 'ignores Vue-reserved branch props',
      imports: 'Branch, T',
      setup: 'const handler = () => undefined;',
      template:
        '<T><Branch branch="formal" key="stable" ref="branchRef" ref-for ref-key="branch" data-note="ignored" :onVnodeMounted="handler" formal="Hello">Fallback</Branch></T>',
      expected: [
        {
          t: 'Branch',
          i: 1,
          d: { b: { formal: 'Hello' }, t: 'b' },
          c: 'Fallback',
        },
      ] satisfies JsxChildren[],
    },
    {
      name: 'matches Vue falsy branch-child semantics',
      imports: 'Branch, T',
      template:
        '<T><Branch branch="zero" :zero="0" :off="false" :empty="null">Fallback</Branch></T>',
      expected: [
        {
          t: 'Branch',
          i: 1,
          d: { b: { zero: '0', off: [], empty: [] }, t: 'b' },
          c: 'Fallback',
        },
      ] satisfies JsxChildren[],
    },
    {
      name: 'filters non-CLDR plural branch props',
      imports: 'Plural, T',
      template:
        '<T><Plural :n="2" one="One" other="Other" label="ignored">Fallback</Plural></T>',
      expected: [
        {
          t: 'Plural',
          i: 1,
          d: { b: { one: 'One', other: 'Other' }, t: 'p' },
          c: 'Fallback',
        },
      ] satisfies JsxChildren[],
    },
    {
      name: 'extracts a nested translation through an opaque Var',
      imports: 'T, Var',
      template: '<T>Outer <Var><T>Inner</T></Var></T>',
      expected: [
        ['Outer ', { i: 1, k: '_gt_value_1', v: 'v' }],
        'Inner',
      ] satisfies JsxChildren[],
    },
    {
      name: 'ignores setup-only static dynamic-component selectors',
      imports: 'T',
      template:
        '<component is="T">Static attribute</component><component :is="\'T\'">Static binding</component>',
      expected: [] satisfies JsxChildren[],
    },
    {
      name: 'normalizes numeric kebab-case component aliases',
      imports: 'DateTime as D2, T',
      setup: "const date = new Date('2026-01-01');",
      template: '<T><d-2>{{ date }}</d-2><var>native</var></T>',
      expected: [
        [
          { i: 1, k: '_gt_date_1', v: 'd' },
          { t: 'var', i: 2, c: 'native' },
        ],
      ] satisfies JsxChildren[],
    },
  ])('$name', async ({ expected, imports, setup = '', template }) => {
    const output = await extractVue(vueSource({ imports, setup, template }));

    expect(output.errors).toEqual([]);
    expect(richSources(output.results)).toEqual(expected);
  });

  it('supports both context prop spellings with static bindings', async () => {
    const output = await extractVue(
      vueSource({
        imports: 'T',
        template:
          '<T $context="dollar">Dollar</T><T :context="`bound`">Bound</T>',
      })
    );

    expect(output.errors).toEqual([]);
    expect(richSources(output.results)).toEqual(['Dollar', 'Bound']);
    expect(output.results.map((result) => result.metadata.context)).toEqual([
      'dollar',
      'bound',
    ]);
  });

  it.each([
    {
      name: 'dynamic interpolation',
      imports: 'T',
      setup: 'const value = String(Date.now());',
      template: '<T>{{ value }}</T>',
      error: 'dynamic template content',
    },
    {
      name: 'nested T',
      imports: 'T',
      template: '<T>Outer <T>Inner</T></T>',
      error: 'nested gt-vue <T>',
    },
    {
      name: 'source-shaping v-if',
      imports: 'T',
      setup: 'const show = true;',
      template: '<T><span v-if="show">Conditional</span></T>',
      error: 'source-shaping directive v-if',
    },
    {
      name: 'source-shaping v-html',
      imports: 'T',
      setup: "const html = '<b>unsafe</b>';",
      template: '<T><span v-html="html" /></T>',
      error: 'source-shaping directive v-html',
    },
    {
      name: 'unknown dynamic component',
      imports: 'T',
      setup: "const dynamic = 'section';",
      template: '<T><component :is="dynamic">Unknown</component></T>',
      error: 'dynamic <component>',
    },
    {
      name: 'bare template',
      imports: 'T',
      template: '<T><template>Body</template></T>',
      error: 'bare <template>',
    },
    {
      name: 'runtime slot outlet',
      imports: 'T',
      template: '<T><slot /></T>',
      error: 'Found a <slot>',
    },
    {
      name: 'dynamic translatable HTML prop',
      imports: 'T',
      setup: 'const label = String(Date.now());',
      template: '<T><input :placeholder="label" /></T>',
      error: 'dynamic translatable prop "placeholder"',
    },
    {
      name: 'Var value prop',
      imports: 'T, Var',
      template: '<T><Var value="Ada">Ada</Var></T>',
      error: 'unsupported value prop',
    },
    {
      name: 'Var name prop',
      imports: 'T, Var',
      template: '<T><Var name="person">Ada</Var></T>',
      error: 'unsupported name prop',
    },
    {
      name: 'removed T metadata fields',
      imports: 'T',
      template: '<T $maxChars="20">Hello</T>',
      error: 'unsupported prop "$maxChars"',
    },
    {
      name: 'branch model directive',
      imports: 'Branch, T',
      setup: "const value = 'Hello';",
      template:
        '<T><Branch branch="formal" formal="Hello" v-model="value">Fallback</Branch></T>',
      error: 'unsupported directive v-model',
    },
    {
      name: 'scoped branch slot',
      imports: 'Branch, T',
      template:
        '<T><Branch branch="formal"><template #formal="{ value }">{{ value }}</template></Branch></T>',
      error: 'scoped slot',
    },
    {
      name: 'malformed Vue template',
      imports: 'T',
      template: '<T>',
      error: 'Could not parse a gt-vue single-file component',
    },
  ])('diagnoses $name', async ({ error, imports, setup = '', template }) => {
    const output = await extractVue(vueSource({ imports, setup, template }));

    expect(output.errors.join('\n')).toContain(error);
  });
});

type ExtractionOutput = Awaited<ReturnType<typeof extractFromVueSource>>;

async function extractVue(source: string): Promise<ExtractionOutput> {
  return extractFromVueSource(source, '/fixtures/Template.vue', {
    projectRoot: '/fixtures',
  });
}

function stringSources(results: ExtractionOutput['results']): string[] {
  return results
    .filter((result) => result.dataFormat === 'STRING')
    .map((result) => result.source);
}

function richSources(results: ExtractionOutput['results']): JsxChildren[] {
  return results
    .filter((result) => result.dataFormat === 'JSX')
    .map((result) => result.source);
}

function fixturePath(name: string): string {
  return path.join(__dirname, 'fixtures', name);
}

function vueSource({
  imports,
  setup = '',
  template,
}: {
  imports: string;
  setup?: string;
  template: string;
}): string {
  return `<script setup>import { ${imports} } from 'gt-vue';${setup}</script><template>${template}</template>`;
}
