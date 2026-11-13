import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { JsxChildren } from '@generaltranslation/format/types';
import { hashSource } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import type { VueCompilerOptions, VueExtractionOutput } from '../../types.js';
import {
  assertVueCompiles,
  extractFromVueSource,
  testVueCompilerVersion,
} from './testVueCompiler.js';

describe('Vue template extraction', () => {
  // Vue 3.3's HTML parser rejects quotes inside dynamic directive arguments.
  const supportsQuotedDirectiveArguments =
    !testVueCompilerVersion.startsWith('3.3.');

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

  it.skipIf(!supportsQuotedDirectiveArguments)(
    'visits executable directive arguments in their Vue scope',
    async () => {
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
    }
  );

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
          d: { b: { zero: '0', off: false, empty: null }, t: 'b' },
          c: 'Fallback',
        } as unknown as JsxChildren,
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
      template: '<T><d-2 :value="date" /><var>native</var></T>',
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

  it('rejects whitespace-free comments that create build-dependent text boundaries', async () => {
    const output = await extractVue(
      vueSource({
        imports: 'T',
        template: '<T>Hello<!-- translator note -->world</T>',
      })
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'hash changes between development and production'
    );
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
      name: 'string maxChars metadata',
      imports: 'T',
      template: '<T $maxChars="20">Hello</T>',
      error: 'invalid or dynamic maxChars',
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
});

describe('Vue template audit cases', () => {
  type TemplateAuditCase = {
    name: string;
    script: string;
    sources: JsxChildren[];
    template: string;
  };

  const templateExpressionCases: TemplateAuditCase[] = [
    {
      name: 'namespace member call',
      script: `import * as GT from 'gt-vue';`,
      template: `{{ GT.msg('Namespace member') }}`,
      sources: ['Namespace member'],
    },
    {
      name: 'computed namespace member call',
      script: `import * as GT from 'gt-vue';`,
      template: `{{ GT['msg']('Computed namespace member') }}`,
      sources: ['Computed namespace member'],
    },
    {
      name: 'optional namespace member call',
      script: `import * as GT from 'gt-vue';`,
      template: `{{ GT?.msg('Optional namespace member') }}`,
      sources: ['Optional namespace member'],
    },
    {
      name: 'optional computed namespace member call',
      script: `import * as GT from 'gt-vue';`,
      template: `{{ GT?.['msg']('Optional computed member') }}`,
      sources: ['Optional computed member'],
    },
    {
      name: 'optional translator call',
      script: `import { useGT } from 'gt-vue'; const gt = useGT();`,
      template: `{{ gt?.('Optional translator') }}`,
      sources: ['Optional translator'],
    },
    {
      name: 'non-null translator call',
      script: `import { useGT } from 'gt-vue'; const gt = useGT();`,
      template: `{{ gt!('Non-null translator') }}`,
      sources: ['Non-null translator'],
    },
    {
      name: 'type-cast translator call',
      script: `import { useGT } from 'gt-vue'; const gt = useGT();`,
      template: `{{ (gt as typeof gt)('Type-cast translator') }}`,
      sources: ['Type-cast translator'],
    },
    {
      name: 'satisfies-wrapped translator call',
      script: `import { useGT } from 'gt-vue'; const gt = useGT();`,
      template: `{{ (gt satisfies typeof gt)('Satisfies translator') }}`,
      sources: ['Satisfies translator'],
    },
    {
      name: 'script-exposed source identifier',
      script: `import { useGT } from 'gt-vue'; const gt = useGT(); const title = 'Static title';`,
      template: `{{ gt(title) }}`,
      sources: ['Static title'],
    },
    {
      name: 'script-exposed concatenation',
      script: `import { useGT } from 'gt-vue'; const gt = useGT(); const first = 'Static '; const second = 'concat';`,
      template: `{{ gt(first + second) }}`,
      sources: ['Static concat'],
    },
    {
      name: 'script-exposed context identifier',
      script: `import { useGT } from 'gt-vue'; const gt = useGT(); const context = 'audit';`,
      template: `{{ gt('Context source', { $context: context }) }}`,
      sources: ['Context source'],
    },
    {
      name: 'useMessages source identifier',
      script: `import { useMessages } from 'gt-vue'; const m = useMessages(); const title = 'Messages title';`,
      template: `{{ m(title) }}`,
      sources: ['Messages title'],
    },
    {
      name: 'outer translator in a v-for default',
      script: `import { useGT } from 'gt-vue'; const gt = useGT(); const rows = [{}];`,
      template: `<div v-for="{ value = gt('VFor outer') } in rows" />`,
      sources: ['VFor outer'],
    },
    {
      name: 'same-pattern v-for shadow',
      script: `import { useGT } from 'gt-vue'; const gt = useGT(); const rows = [{}];`,
      template: `<div v-for="{ gt, value = gt('VFor shadow') } in rows" />`,
      sources: [],
    },
    {
      name: 'outer translator in a slot default',
      script: `import { useGT } from 'gt-vue'; const gt = useGT();`,
      template: `<Card v-slot="{ value = gt('Slot outer') }" />`,
      sources: ['Slot outer'],
    },
    {
      name: 'same-pattern slot shadow',
      script: `import { useGT } from 'gt-vue'; const gt = useGT();`,
      template: `<Card v-slot="{ gt, value = gt('Slot shadow') }" />`,
      sources: [],
    },
    {
      name: 'nested expression callback shadow',
      script: `import { useGT } from 'gt-vue'; const gt = useGT(); const rows = [String];`,
      template: `{{ rows.map((gt) => gt('Callback shadow')) }}`,
      sources: [],
    },
    {
      name: 'namespace v-for shadow',
      script: `import * as GT from 'gt-vue'; const rows = [{}];`,
      template: `<div v-for="GT in rows" :title="GT.msg('Namespace shadow')" />`,
      sources: [],
    },
    {
      name: 'computed namespace dynamic component',
      script: `import * as GT from 'gt-vue';`,
      template: `<component :is="GT['T']">Computed dynamic T</component>`,
      sources: ['Computed dynamic T'],
    },
    {
      name: 'optional namespace dynamic component',
      script: `import * as GT from 'gt-vue';`,
      template: `<component :is="GT?.T">Optional dynamic T</component>`,
      sources: ['Optional dynamic T'],
    },
    {
      name: 'optional computed namespace dynamic component',
      script: `import * as GT from 'gt-vue';`,
      template: `<component :is="GT?.['T']">Optional computed T</component>`,
      sources: ['Optional computed T'],
    },
    {
      name: 'setup-only static-string dynamic component is not registered',
      script: `import { T } from 'gt-vue';`,
      template: `<component :is="'T'">String dynamic T</component>`,
      sources: [],
    },
    {
      name: 'setup-only static-attribute dynamic component is not registered',
      script: `import { T } from 'gt-vue';`,
      template: `<component is="T">Static dynamic T</component>`,
      sources: [],
    },
    {
      name: 'setup identifier dynamic component',
      script: `import { T } from 'gt-vue';`,
      template: `<component :is="T">Identifier dynamic T</component>`,
      sources: ['Identifier dynamic T'],
    },
    {
      name: 'type-wrapped dynamic component',
      script: `import { T } from 'gt-vue';`,
      template: `<component :is="T as typeof T">Wrapped dynamic T</component>`,
      sources: ['Wrapped dynamic T'],
    },
  ];

  describe('expressions and scopes', () => {
    it.each(templateExpressionCases)('$name', async (testCase) => {
      const source = createSfc(testCase.script, testCase.template);
      assertVueCompiles(source, testCase.name);

      const output = await extractAuditSource(source, testCase.name);

      expect(output.errors).toEqual([]);
      expect(
        output.results.map(({ source: resultSource }) => resultSource)
      ).toEqual(testCase.sources);
    });

    it.each([
      ['static attribute', `is="LocalT"`],
      ['bound static string', `:is="'LocalT'"`],
    ])(
      'resolves an Options API alias through a %s selector',
      async (_name, selector) => {
        const source = `<script lang="ts">import { T } from 'gt-vue'; export default { components: { LocalT: T } };</script><template><component ${selector}>Registered dynamic T</component></template>`;
        assertVueCompiles(source, `options-${_name}`);

        const output = await extractAuditSource(source, `options-${_name}`);

        expect(output.errors).toEqual([]);
        expect(output.results.map((result) => result.source)).toEqual([
          'Registered dynamic T',
        ]);
      }
    );
  });

  type RichAuditCase = {
    name: string;
    script: string;
    source?: JsxChildren;
    template: string;
    context?: string;
  };

  const richCases: RichAuditCase[] = [
    {
      name: 'depth-first native and variable numbering',
      script: `import { Num, T, Var } from 'gt-vue';`,
      template: `<T><b>A</b><i><Var>x</Var><Num :value="1" /></i></T>`,
      source: [
        { t: 'b', i: 1, c: 'A' },
        {
          t: 'i',
          i: 2,
          c: [
            { i: 3, k: '_gt_value_3', v: 'v' },
            { i: 4, k: '_gt_n_4', v: 'n' },
          ],
        },
      ],
    },
    {
      name: 'comments do not consume element ids',
      script: `import { T, Var } from 'gt-vue';`,
      template: `<T>A<!-- note --><Var>x</Var></T>`,
      source: ['A', { i: 1, k: '_gt_value_1', v: 'v' }],
    },
    {
      name: 'branch slots number independently from fallback and siblings',
      script: `import { Branch, T, Var } from 'gt-vue';`,
      template: `<T><Branch branch="formal"><template #formal><b><Var>x</Var></b></template><template #casual><i><Var>y</Var></i></template>Fallback <Var>z</Var></Branch><strong>After</strong></T>`,
      source: [
        {
          t: 'Branch',
          i: 1,
          d: {
            b: {
              formal: {
                t: 'b',
                i: 2,
                c: { i: 3, k: '_gt_value_3', v: 'v' },
              },
              casual: {
                t: 'i',
                i: 2,
                c: { i: 3, k: '_gt_value_3', v: 'v' },
              },
            },
            t: 'b',
          },
          c: ['Fallback ', { i: 2, k: '_gt_value_2', v: 'v' }],
        },
        { t: 'strong', i: 3, c: 'After' },
      ],
    },
    {
      name: 'plural slots number independently',
      script: `import { Plural, T, Var } from 'gt-vue';`,
      template: `<T><Plural :n="2"><template #one>One <Var>x</Var></template><template #other>Other <Var>y</Var></template>Fallback <Var>z</Var></Plural></T>`,
      source: {
        t: 'Plural',
        i: 1,
        d: {
          b: {
            one: ['One ', { i: 2, k: '_gt_value_2', v: 'v' }],
            other: ['Other ', { i: 2, k: '_gt_value_2', v: 'v' }],
          },
          t: 'p',
        },
        c: ['Fallback ', { i: 2, k: '_gt_value_2', v: 'v' }],
      },
    },
    {
      name: 'named branch slot overrides the same prop',
      script: `import { Branch, T } from 'gt-vue';`,
      template: `<T><Branch branch="formal" formal="Prop"><template #formal>Slot</template>Fallback</Branch></T>`,
      source: {
        t: 'Branch',
        i: 1,
        d: { b: { formal: 'Slot' }, t: 'b' },
        c: 'Fallback',
      },
    },
    {
      name: 'script-exposed rich interpolation',
      script: `import { T } from 'gt-vue'; const title = 'Static rich title';`,
      template: `<T>{{ title }}</T>`,
      source: 'Static rich title',
    },
    {
      name: 'script-exposed T context',
      script: `import { T } from 'gt-vue'; const context = 'rich-audit';`,
      template: `<T :context="context">Context body</T>`,
      source: 'Context body',
      context: 'rich-audit',
    },
    {
      name: 'script-exposed translatable HTML prop',
      script: `import { T } from 'gt-vue'; const placeholder = 'Static placeholder';`,
      template: `<T><input :placeholder="placeholder" /></T>`,
      source: { t: 'input', i: 1, d: { pl: 'Static placeholder' } },
    },
    {
      name: 'script-exposed primitive expression',
      script: `import { T } from 'gt-vue'; const first = 'A'; const second = 'B';`,
      template: `<T>{{ first + second }}</T>`,
      source: 'AB',
    },
    {
      name: 'comments and whitespace before explicit default are omitted',
      script: `import { T } from 'gt-vue';`,
      template: `<T><!-- note --> <template #default>Explicit</template></T>`,
      source: 'Explicit',
    },
  ];

  describe('rich tree parity', () => {
    it.each(richCases)('$name', async (testCase) => {
      const source = createSfc(testCase.script, testCase.template);
      assertVueCompiles(source, testCase.name);

      const output = await extractAuditSource(source, testCase.name);

      expect(output.errors).toEqual([]);
      expect(output.results).toHaveLength(1);
      expect(output.results[0]).toMatchObject({
        dataFormat: 'JSX',
        source: testCase.source,
      });
      expect(output.results[0]?.metadata.context).toBe(testCase.context);
    });
  });

  const richDiagnosticCases = [
    {
      name: 'runtime interpolation',
      script: `import { T } from 'gt-vue'; const value = String(Date.now());`,
      template: `<T>{{ value }}</T>`,
      diagnostic: 'dynamic template content',
    },
    {
      name: 'v-for shadow masks a static context',
      script: `import { T } from 'gt-vue'; const context = 'static'; const rows = ['runtime'];`,
      template: `<T v-for="context in rows" :context="context">Body</T>`,
      diagnostic: 'dynamic context',
    },
    {
      name: 'nested T',
      script: `import { T } from 'gt-vue';`,
      template: `<T>Outer <T>Inner</T></T>`,
      diagnostic: 'nested gt-vue <T>',
    },
    {
      name: 'named T slot',
      script: `import { T } from 'gt-vue';`,
      template: `<T><template #other>Named</template></T>`,
      diagnostic: 'named slot on a gt-vue <T>',
    },
    {
      name: 'source-shaping v-if',
      script: `import { T } from 'gt-vue'; const visible = true;`,
      template: `<T><b v-if="visible">Conditional</b></T>`,
      diagnostic: 'source-shaping directive v-if',
    },
    {
      name: 'dynamic content prop',
      script: `import { T } from 'gt-vue'; const label = String(Date.now());`,
      template: `<T><input :placeholder="label" /></T>`,
      diagnostic: 'dynamic translatable prop "placeholder"',
    },
    {
      name: 'Var value prop',
      script: `import { T, Var } from 'gt-vue'; const value = 'runtime';`,
      template: `<T><Var :value="value">Child</Var></T>`,
      diagnostic: 'unsupported value prop',
    },
    {
      name: 'scoped branch slot',
      script: `import { Branch, T } from 'gt-vue';`,
      template: `<T><Branch branch="formal"><template #formal="{ value }">{{ value }}</template></Branch></T>`,
      diagnostic: 'scoped slot',
    },
    {
      name: 'dynamic branch slot name',
      script: `import { Branch, T } from 'gt-vue'; const slotName = 'formal';`,
      template: `<T><Branch branch="formal"><template #[slotName]>Dynamic</template></Branch></T>`,
      diagnostic: 'dynamic slot name',
    },
    {
      name: 'duplicate T context',
      script: `import { T } from 'gt-vue';`,
      template: `<T context="first" $context="second">Body</T>`,
      diagnostic: 'duplicate context props',
    },
  ] as const;

  describe('rich diagnostics', () => {
    it.each(richDiagnosticCases)('$name', async (testCase) => {
      const source = createSfc(testCase.script, testCase.template);
      const output = await extractAuditSource(source, testCase.name);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(testCase.diagnostic);
    });
  });

  describe('source metadata and compiler options', () => {
    it('rebases direct compiler-dom ranges to full-SFC source positions', async () => {
      const source = [
        '<script setup>',
        "import { T } from 'gt-vue';",
        'const dynamicContext = getContext();',
        '</script>',
        '<template>',
        '  <section>',
        '    <T :context="dynamicContext">Invalid</T>',
        '  </section>',
        '</template>',
      ].join('\n');
      const output = await extractFromVueSource(
        source,
        '/project/src/Rebased.vue',
        {
          includeSourceCodeContext: true,
          projectRoot: '/project',
          surroundingLineCount: 0,
        }
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        '/project/src/Rebased.vue (7:8)'
      );
      expect(output.errors.join('\n')).toContain('dynamic context');
    });

    it('captures exact source context for script, rich, and template calls', async () => {
      const source = `<script setup>\nimport { T, useGT } from 'gt-vue';\nconst gt = useGT();\ngt('Script source');\n</script>\n<template>\n  <T>Template source</T>\n  {{ gt('Template call') }}\n</template>`;
      const output = await extractFromVueSource(
        source,
        '/project/src/Context.vue',
        {
          includeSourceCodeContext: true,
          projectRoot: '/project',
          surroundingLineCount: 1,
        }
      );

      expect(output.errors).toEqual([]);
      expect(output.results.map(({ metadata }) => metadata.sourceCode)).toEqual(
        [
          {
            'src/Context.vue': [
              {
                before: 'const gt = useGT();',
                target: `gt('Script source');`,
                after: '</script>',
              },
            ],
          },
          {
            'src/Context.vue': [
              {
                before: '<template>',
                target: '  <T>Template source</T>',
                after: `  {{ gt('Template call') }}`,
              },
            ],
          },
          {
            'src/Context.vue': [
              {
                before: '  <T>Template source</T>',
                target: `  {{ gt('Template call') }}`,
                after: '</template>',
              },
            ],
          },
        ]
      );
    });

    it('supports zero surrounding source lines', async () => {
      const source = createSfc(`import { T } from 'gt-vue';`, `<T>Zero</T>`);
      const output = await extractFromVueSource(source, '/project/Zero.vue', {
        includeSourceCodeContext: true,
        projectRoot: '/project',
        surroundingLineCount: 0,
      });
      const context = output.results[0]?.metadata.sourceCode?.['Zero.vue']?.[0];

      expect(context).toMatchObject({ before: '', after: '' });
    });

    it('omits source context unless explicitly enabled', async () => {
      const output = await extractAuditSource(
        createSfc(`import { T } from 'gt-vue';`, `<T>No context</T>`),
        'no-context'
      );

      expect(output.results[0]?.metadata.sourceCode).toBeUndefined();
      expect(output.results[0]?.metadata.filePaths).toEqual([
        'src/no-context.vue',
      ]);
    });

    it('honors custom interpolation delimiters through the public API', async () => {
      const source = createSfc(
        `import { T, Var } from 'gt-vue'; const name = 'Ada';`,
        `<T>Hello <Var>[[ name ]]</Var></T>`
      );
      const output = await extractAuditSource(source, 'delimiters', {
        delimiters: ['[[', ']]'],
      });

      expect(output.errors).toEqual([]);
      expect(output.results[0]?.source).toEqual([
        'Hello ',
        { i: 1, k: '_gt_value_1', v: 'v' },
      ]);
    });

    it('honors preserve versus condense whitespace through the public API', async () => {
      const source = createSfc(
        `import { T } from 'gt-vue';`,
        `<T>First\n    second</T>`
      );
      const condensed = await extractAuditSource(source, 'condense', {
        whitespace: 'condense',
      });
      const preserved = await extractAuditSource(source, 'preserve', {
        whitespace: 'preserve',
      });

      expect(condensed.errors).toEqual([]);
      expect(preserved.errors).toEqual([]);
      expect(condensed.results[0]?.source).not.toEqual(
        preserved.results[0]?.source
      );
    });
  });

  function createSfc(script: string, template: string): string {
    return `<script setup lang="ts">${script}</script><template>${template}</template>`;
  }

  async function extractAuditSource(
    source: string,
    name: string,
    compilerOptions?: VueCompilerOptions
  ): Promise<VueExtractionOutput> {
    return extractFromVueSource(source, `/project/src/${name}.vue`, {
      compilerOptions,
      projectRoot: '/project',
    });
  }
});

describe('Vue template runtime parity', () => {
  // This fixture includes quoted dynamic directive arguments rejected by 3.3.
  const supportsRuntimeParityFixture =
    !testVueCompilerVersion.startsWith('3.3.');

  it.skipIf(!supportsRuntimeParityFixture)(
    'matches Vue directive scope, slot, and component-name behavior',
    async () => {
      const result = await extractFixture('template-runtime-parity.vue');

      expect(result.errors).toEqual([]);
      expect(
        result.results
          .filter((update) => update.dataFormat === 'STRING')
          .map((update) => update.source)
      ).toEqual(['Outer v-if', 'v-for default', 'Directive', 'slot default']);

      const richSources = result.results
        .filter((update) => update.dataFormat === 'JSX')
        .map((update) => update.source);
      const branch: JsxChildren = {
        t: 'Branch',
        i: 1,
        d: {
          b: { casual: 'Second', formal: 'First' },
          t: 'b',
        },
      };
      const plural: JsxChildren = {
        t: 'Plural',
        i: 1,
        d: {
          b: { one: 'One', other: 'Other' },
          t: 'p',
        },
      };
      expect(richSources).toEqual([
        'Digit-normalized component',
        'Dynamic component',
        'Explicit default',
        branch,
        plural,
      ]);
    }
  );

  it('still rejects meaningful implicit content beside an explicit default slot', async () => {
    const result = await extractFixture('template-duplicate-default.vue');

    expect(result.results).toEqual([]);
    expect(result.errors.join('\n')).toContain(
      'more than one default slot definition'
    );
  });

  function fixturePath(name: string): string {
    return path.join(__dirname, 'fixtures', name);
  }

  async function extractFixture(name: string) {
    const file = fixturePath(name);
    return extractFromVueSource(fs.readFileSync(file, 'utf8'), file, {
      projectRoot: process.cwd(),
    });
  }
});

describe('consumer Vue template compiler parity', () => {
  it('resolves static vue-prefixed native is targets without rewriting dynamic component strings', async () => {
    const output = await extractFromVueSource(
      `
        <script setup>
          import { T, Var } from 'gt-vue';
          const value = 'runtime';
        </script>
        <template>
          <div is="vue:T">Static T</div>
          <T>Before <span is="vue:Var">{{ value }}</span> after</T>
          <component is="vue:T">Opaque dynamic selector</component>
        </template>
      `,
      '/project/src/StaticVueIs.vue',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map((result) => result.source)).toEqual([
      'Static T',
      ['Before ', { i: 1, k: '_gt_value_1', v: 'v' }, ' after'],
    ]);
  });

  it('keeps vue-prefixed dynamic component strings unresolved inside T', async () => {
    const output = await extractFromVueSource(
      `
        <script setup>import { T, Var } from 'gt-vue';</script>
        <template><T><component is="vue:Var">Opaque</component></T></template>
      `,
      '/project/src/DynamicVueIs.vue',
      { projectRoot: '/project' }
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain('dynamic <component>');
  });

  it('uses static vue-prefixed replacements for GT and Vue rich identities', async () => {
    const output = await extractFromVueSource(
      `
        <script setup>
          import { Branch, Plural, T } from 'gt-vue';
          import { Fragment } from 'vue';
        </script>
        <template><T><div is="vue:Branch" formal="Formal" casual="Casual">Default</div><div is="vue:Plural" one="One" other="Other">Many</div><div is="vue:Suspense"><b>Ready</b><template #fallback>Loading</template></div><div is="vue:Fragment"><i>First</i><u>Second</u></div></T></template>
      `,
      '/project/src/StaticRichVueIs.vue',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    const source = output.results[0]?.source;
    expect(source).toEqual([
      {
        t: 'Branch',
        i: 1,
        d: {
          b: { formal: 'Formal', casual: 'Casual' },
          t: 'b',
        },
        c: 'Default',
      },
      {
        t: 'Plural',
        i: 2,
        d: {
          b: { one: 'One', other: 'Other' },
          t: 'p',
        },
        c: 'Many',
      },
      {
        t: 'Suspense',
        i: 3,
        c: { t: 'b', i: 4, c: 'Ready' },
      },
      {
        t: 'C5',
        i: 5,
        c: [
          { t: 'i', i: 6, c: 'First' },
          { t: 'u', i: 7, c: 'Second' },
        ],
      },
    ]);
    expect(hashSource({ dataFormat: 'JSX', source: source! })).toBe(
      '6e3d6f99b81eb251'
    );
  });

  it('rejects native-looking static vue:is targets inside T', async () => {
    const output = await extractFromVueSource(
      `
        <script setup>import { T } from 'gt-vue';</script>
        <template><T><div is="vue:span"><b>HTML child</b></div><svg is="vue:g"><text>SVG child</text></svg><math is="vue:mrow"><mi>MathML child</mi></math></T></template>
      `,
      '/project/src/StaticNativeVueIs.vue',
      { projectRoot: '/project' }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(3);
    for (const target of ['span', 'g', 'mrow']) {
      expect(output.errors.join('\n')).toContain(`is="vue:${target}"`);
      expect(output.errors.join('\n')).toContain(
        'Use a direct literal or component tag'
      );
    }
  });

  it('rejects every unrecognized static vue:is selector inside T', async () => {
    const output = await extractFromVueSource(
      `
        <script>
          import { Var } from 'gt-vue';
          import OptionsCard from './OptionsCard.vue';
          export default { components: { NativeTag: Var, OptionsCard } };
        </script>
        <script setup>
          import { T, Var as CollisionTag } from 'gt-vue';
          import Card from './Card.vue';
          import collisionTag from './Collision.vue';
          const Native = 'div';
          const nativeTag = 'div';
          const Ambiguous = enabled ? 'em' : 'strong';
          const Falsey = false;
        </script>
        <template><T><section is="vue:Native">String</section><section is="vue:Card">Component</section><section is="vue:Ambiguous">Ambiguous</section><section is="vue:Falsey">Falsey</section><section is="vue:OptionsCard">Options</section><section is="vue:">Empty</section><section is="vue:native-tag">Normalized setup</section><native-tag><b>Plain normalized setup</b></native-tag><section is="vue:collision-tag">Direct collision</section><collision-tag><b>Plain direct collision</b></collision-tag></T></template>
      `,
      '/project/src/UnsupportedVueIsBindings.vue',
      { projectRoot: '/project' }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(10);
    for (const target of [
      'Native',
      'Card',
      'Ambiguous',
      'Falsey',
      'OptionsCard',
      '',
      'native-tag',
      'collision-tag',
    ]) {
      expect(output.errors.join('\n')).toContain(`is="vue:${target}"`);
      expect(output.errors.join('\n')).toContain(
        'Use a direct literal or component tag'
      );
    }
    expect(output.errors.join('\n')).toContain(
      'unsupported direct binding for component tag <native-tag>'
    );
    expect(output.errors.join('\n')).toContain(
      'unsupported direct binding for component tag <collision-tag>'
    );
  });

  it('honors Vue first-is precedence before a later vue-prefixed attribute', async () => {
    const output = await extractFromVueSource(
      `
        <script setup>
          import { Branch, T, Var } from 'gt-vue';
          import { Fragment } from 'vue';
        </script>
        <template><T><div :is="Var" is="vue:Branch" formal="Wrong"><b>Hidden</b></div><Suspense :is="Var" is="vue:Branch"><b>Ready</b></Suspense><Fragment :is="Var" is="vue:Branch"><u>Fragment</u></Fragment><i>After</i></T></template>
      `,
      '/project/src/StaticVueIsPrecedence.vue',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    const source = output.results[0]?.source;
    expect(source).toEqual([
      { t: 'div', i: 1, c: { t: 'b', i: 2, c: 'Hidden' } },
      { t: 'Suspense', i: 3, c: { t: 'b', i: 4, c: 'Ready' } },
      { t: 'C5', i: 5, c: { t: 'u', i: 6, c: 'Fragment' } },
      { t: 'i', i: 7, c: 'After' },
    ]);
    expect(hashSource({ dataFormat: 'JSX', source: source! })).toBe(
      '11c8429caf23f3a6'
    );
  });

  it('matches the installed compiler semantics for valued v-is', async () => {
    const output = await extractFromVueSource(
      `
        <script setup>
          import { T, Var, useGT } from 'gt-vue';
          import { Fragment } from 'vue';
          const gt = useGT();
          const selectorArgument = 'ignored selector argument';
        </script>
        <template>
          <div v-is="gt('Vue 3.3 selector')">Ignored selector</div>
          <div v-is:legacy="T">Vue 3.3 argument target</div>
          <div v-is:[gt(selectorArgument)]="T">Vue 3.3 dynamic argument target</div>
          <component v-is="gt('ignored component selector')">Ignored component</component>
          <slot v-is="gt('ignored slot selector')" />
          <template v-is="gt('ignored template selector')">Ignored template</template>
          <Suspense v-is="T">Vue 3.3 Suspense target</Suspense>
          <Fragment v-is="T">Vue 3.3 Fragment target</Fragment>
          <T v-is="Var">Vue 3.4+ source</T>
        </template>
      `,
      '/project/src/ValuedVIs.vue',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    const sources = output.results.map((result) => result.source);
    expect(sources).toEqual(
      testVueCompilerVersion.startsWith('3.3.')
        ? [
            'Vue 3.3 selector',
            'Vue 3.3 argument target',
            'Vue 3.3 dynamic argument target',
            'Vue 3.3 Suspense target',
            'Vue 3.3 Fragment target',
          ]
        : ['Vue 3.4+ source']
    );
    expect(
      output.results.map((result) =>
        hashSource({ dataFormat: result.dataFormat, source: result.source })
      )
    ).toEqual(
      testVueCompilerVersion.startsWith('3.3.')
        ? [
            'a8185ffa69c52a38',
            '8b1bc70354f4f9c8',
            '8470e15e6781ad38',
            '6071dde7f57b0e41',
            '2079b23dabf73021',
          ]
        : ['f73a68d80f5caa68']
    );
  });

  it('preserves an effective but unresolvable empty v-is selector on Vue 3.3', async () => {
    const output = await extractFromVueSource(
      `
        <script setup>import { T } from 'gt-vue';</script>
        <template>
          <T v-is="">empty raw</T>
          <div is="vue:T" v-is="">empty static</div>
        </template>
      `,
      '/project/src/EmptyValuedVIs.vue',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map((result) => result.source)).toEqual(
      testVueCompilerVersion.startsWith('3.3.')
        ? []
        : ['empty raw', 'empty static']
    );
    expect(
      output.results.map((result) =>
        hashSource({ dataFormat: result.dataFormat, source: result.source })
      )
    ).toEqual(
      testVueCompilerVersion.startsWith('3.3.')
        ? []
        : ['a4bdb5962dd37992', 'cdeda1c0b7a4bf7d']
    );
  });

  it('recognizes only Vue exact-case Suspense builtin spellings', async () => {
    const output = await extractFromVueSource(
      `
        <script setup>
          import { T } from 'gt-vue';
          import { defineComponent } from 'vue';
          const SUSPENSE = defineComponent({ name: 'SUSPENSE' });
          const susPense = defineComponent({ name: 'susPense' });
        </script>
        <template><T><Suspense><b>Exact</b></Suspense><suspense><i>Lower</i></suspense><SUSPENSE><u>Upper hidden</u></SUSPENSE><susPense><em>Mixed hidden</em></susPense><div is="vue:Suspense"><strong>Static exact</strong></div><div is="vue:suspense"><small>Static lower</small></div></T></template>
      `,
      '/project/src/SuspenseCasing.vue',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    const source = output.results[0]?.source;
    expect(source).toEqual([
      { t: 'Suspense', i: 1, c: { t: 'b', i: 2, c: 'Exact' } },
      { t: 'Suspense', i: 3, c: { t: 'i', i: 4, c: 'Lower' } },
      { t: 'SUSPENSE', i: 5, c: { t: 'u', i: 6, c: 'Upper hidden' } },
      { t: 'susPense', i: 7, c: { t: 'em', i: 8, c: 'Mixed hidden' } },
      {
        t: 'Suspense',
        i: 9,
        c: { t: 'strong', i: 10, c: 'Static exact' },
      },
      {
        t: 'Suspense',
        i: 11,
        c: { t: 'small', i: 12, c: 'Static lower' },
      },
    ]);
    expect(hashSource({ dataFormat: 'JSX', source: source! })).toBe(
      '1fc85d4b54bced88'
    );
  });
});

describe('Vue variable component interface validation', () => {
  it('accepts explicit dynamic value props outside T in SFC templates', async () => {
    const output = await extractFromVueSource(
      `
        <script setup lang="ts">
          import * as GT from 'gt-vue';
          import { Num as Count } from 'gt-vue';
          const amount = Math.random();
          const date = new Date();
        </script>
        <template>
          <Count :value="amount" />
          <GT.Currency :value="amount" />
          <GT.DateTime :value="date" />
        </template>
      `,
      '/project/src/View.vue'
    );

    expect(output.errors).toEqual([]);
  });

  it('rejects invalid direct, aliased, and namespaced SFC uses outside T', async () => {
    const output = await extractFromVueSource(
      `
        <script setup lang="ts">
          import * as GT from 'gt-vue';
          import { Num as Count, Var as Value } from 'gt-vue';
          const date = new Date();
          const name = 'Ada';
        </script>
        <template>
          <Count />
          <GT.DateTime :value="date">{{ date }}</GT.DateTime>
          <Value :value="name">{{ name }}</Value>
        </template>
      `,
      '/project/src/View.vue'
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(3);
    expect(output.errors.join('\n')).toContain(
      'gt-vue <Num> component without a value prop'
    );
    expect(output.errors.join('\n')).toContain(
      'children on a gt-vue <DateTime> component'
    );
    expect(output.errors.join('\n')).toContain('unsupported value prop');
  });

  it('reports each invalid SFC use inside T only once', async () => {
    const output = await extractFromVueSource(
      `
        <script setup lang="ts">
          import { Num, T } from 'gt-vue';
        </script>
        <template><T><Num /></T></template>
      `,
      '/project/src/View.vue'
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain('without a value prop');
  });

  it('accepts explicit dynamic value props outside T in TSX', async () => {
    const output = await extractFromVueSource(
      `
        import * as GT from 'gt-vue';
        import { Num as Count } from 'gt-vue';
        const amount = Math.random();
        const date = new Date();
        export const View = () => <><Count value={amount} /><GT.Currency value={amount} /><GT.DateTime value={date} /></>;
      `,
      '/project/src/View.tsx'
    );

    expect(output.errors).toEqual([]);
  });

  it('rejects invalid direct, aliased, and namespaced TSX uses outside T', async () => {
    const output = await extractFromVueSource(
      `
        import * as GT from 'gt-vue';
        import { Num as Count, Var as Value } from 'gt-vue';
        const date = new Date();
        const name = 'Ada';
        export const View = () => <><Count /><GT.DateTime value={date}>{date}</GT.DateTime><Value value={name}>{name}</Value></>;
      `,
      '/project/src/View.tsx'
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(3);
    expect(output.errors.join('\n')).toContain(
      'gt-vue <Num> component without a value prop'
    );
    expect(output.errors.join('\n')).toContain(
      'children on a gt-vue <DateTime> component'
    );
    expect(output.errors.join('\n')).toContain('unsupported value prop');
  });

  it('reports each invalid TSX use inside T only once', async () => {
    const output = await extractFromVueSource(
      `
        import { Num, T } from 'gt-vue';
        export const View = () => <T><Num /></T>;
      `,
      '/project/src/View.tsx'
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain('without a value prop');
  });
});
