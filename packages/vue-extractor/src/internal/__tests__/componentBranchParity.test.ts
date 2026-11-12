import type { JsxChildren } from '@generaltranslation/format/types';
import { hashSource } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import { assertVueCompiles, extractFromVueSource } from './testVueCompiler.js';

describe('Branch attribute runtime parity', () => {
  type BranchCase = {
    name: string;
    setup?: string;
    source: JsxChildren;
    template: string;
  };

  type BranchWireValue = JsxChildren | boolean | null;

  const primitiveCases: BranchCase[] = [
    {
      name: 'plain string attribute',
      template:
        '<T><Branch branch="formal" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'bound string literal',
      template:
        '<T><Branch branch="formal" :formal="\'Hello\'">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'script-exposed string',
      setup: "const label = 'Hello';",
      template:
        '<T><Branch branch="formal" :formal="label">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'deterministic string expression',
      template:
        '<T><Branch branch="formal" :formal="\'Hel\' + `lo`">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'number',
      template: '<T><Branch branch="count" :count="12">Fallback</Branch></T>',
      source: branchSource({ count: '12' }),
    },
    {
      name: 'negative number',
      template: '<T><Branch branch="count" :count="-12">Fallback</Branch></T>',
      source: branchSource({ count: '-12' }),
    },
    {
      name: 'global NaN',
      template: '<T><Branch branch="count" :count="NaN">Fallback</Branch></T>',
      source: branchSource({ count: 'NaN' }),
    },
    {
      name: 'global Infinity',
      template:
        '<T><Branch branch="count" :count="Infinity">Fallback</Branch></T>',
      source: branchSource({ count: 'Infinity' }),
    },
    {
      name: 'bigint',
      template: '<T><Branch branch="large" :large="12n">Fallback</Branch></T>',
      source: branchSource({ large: '12' }),
    },
    {
      name: 'true',
      template: '<T><Branch branch="flag" :flag="true">Fallback</Branch></T>',
      source: branchSource({ flag: true }),
    },
    {
      name: 'false',
      template: '<T><Branch branch="flag" :flag="false">Fallback</Branch></T>',
      source: branchSource({ flag: false }),
    },
    {
      name: 'null',
      template: '<T><Branch branch="empty" :empty="null">Fallback</Branch></T>',
      source: branchSource({ empty: null }),
    },
    {
      name: 'empty bare attribute',
      template: '<T><Branch branch="empty" empty>Fallback</Branch></T>',
      source: branchSource({ empty: '' }),
    },
  ];

  const knownNonPrimitiveCases: BranchCase[] = [
    {
      name: 'object literal',
      template:
        '<T><Branch branch="formal" :formal="{ label: \'Hello\' }">Fallback</Branch></T>',
      source: branchSource(),
    },
    {
      name: 'array literal',
      template:
        '<T><Branch branch="formal" :formal="[\'Hello\']">Fallback</Branch></T>',
      source: branchSource(),
    },
    {
      name: 'arrow function',
      template:
        '<T><Branch branch="formal" :formal="() => \'Hello\'">Fallback</Branch></T>',
      source: branchSource(),
    },
    {
      name: 'regular expression',
      template:
        '<T><Branch branch="formal" :formal="/Hello/">Fallback</Branch></T>',
      source: branchSource(),
    },
    {
      name: 'new expression',
      template:
        '<T><Branch branch="formal" :formal="new Date(0)">Fallback</Branch></T>',
      source: branchSource(),
    },
    {
      name: 'global undefined',
      template:
        '<T><Branch branch="formal" :formal="undefined">Fallback</Branch></T>',
      source: branchSource(),
    },
    {
      name: 'void expression',
      template:
        '<T><Branch branch="formal" :formal="void 0">Fallback</Branch></T>',
      source: branchSource(),
    },
  ];

  const ignoredNameCases: BranchCase[] = [
    {
      name: 'static class',
      template:
        '<T><Branch branch="formal" class="secret" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'dynamic class object',
      setup: 'const classes = { secret: true };',
      template:
        '<T><Branch branch="formal" :class="classes" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'static style',
      template:
        '<T><Branch branch="formal" style="color: red" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'dynamic style object',
      setup: "const styles = { color: 'red' };",
      template:
        '<T><Branch branch="formal" :style="styles" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'static ARIA attribute',
      template:
        '<T><Branch branch="formal" aria-label="secret" formal="Hello">Fallback</Branch></T>',
      source: {
        t: 'Branch',
        i: 1,
        d: { arl: 'secret', b: { formal: 'Hello' }, t: 'b' },
        c: 'Fallback',
      },
    },
    {
      name: 'static data attribute',
      template:
        '<T><Branch branch="formal" data-note="secret" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'dynamic data attribute',
      setup: 'const note = String(Date.now());',
      template:
        '<T><Branch branch="formal" :data-note="note" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'event directive',
      setup: 'const handler = () => undefined;',
      template:
        '<T><Branch branch="formal" @click="handler" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'event directive with modifiers',
      setup: 'const handler = () => undefined;',
      template:
        '<T><Branch branch="formal" @click.stop="handler" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'object v-on directive',
      setup: 'const listeners = { click: () => undefined };',
      template:
        '<T><Branch branch="formal" v-on="listeners" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'camel-case listener prop',
      setup: 'const handler = () => undefined;',
      template:
        '<T><Branch branch="formal" :onClick="handler" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'kebab-case listener prop',
      setup: 'const handler = () => undefined;',
      template:
        '<T><Branch branch="formal" :on-click="handler" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'VNode listener prop',
      setup: 'const handler = () => undefined;',
      template:
        '<T><Branch branch="formal" :onVnodeMounted="handler" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
    {
      name: 'GT and VNode control props',
      template:
        '<T><Branch branch="formal" :n="2" :locales="[\'en\']" key="stable" ref="branchRef" ref-for ref-key="branch" ref_for ref_key="branch" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    },
  ];

  it.each(primitiveCases)('serializes $name', async (testCase) => {
    const output = await extractCase(testCase);

    expect(output.errors).toEqual([]);
    expect(richSources(output)).toEqual([testCase.source]);
  });

  it.each(knownNonPrimitiveCases)(
    'ignores statically known non-branch $name values',
    async (testCase) => {
      const output = await extractCase(testCase);

      expect(output.errors).toEqual([]);
      expect(richSources(output)).toEqual([testCase.source]);
    }
  );

  it.each(ignoredNameCases)(
    'does not turn the $name into a branch',
    async (testCase) => {
      const output = await extractCase(testCase);

      expect(output.errors).toEqual([]);
      expect(richSources(output)).toEqual([testCase.source]);
    }
  );

  it('fails closed for dynamic translatable ARIA content', async () => {
    const output = await extractCase({
      name: 'dynamic ARIA content',
      setup: 'const label = String(Date.now());',
      template:
        '<T><Branch branch="formal" :aria-label="label" formal="Hello">Fallback</Branch></T>',
      source: [],
    });

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'dynamic translatable prop "aria-label"'
    );
    expect(output.errors.join('\n')).not.toContain('dynamic branch prop');
  });

  it('matches runtime content-prop and Branch interaction', async () => {
    const output = await extractCase({
      name: 'Branch content props',
      template:
        '<T><Branch branch="title" title="Title" alt="Alt" aria-labelledby="Labelled" aria-describedby="Described">Fallback</Branch></T>',
      source: {
        t: 'Branch',
        i: 1,
        d: {
          ti: 'Title',
          alt: 'Alt',
          arb: 'Labelled',
          ard: 'Described',
          b: { title: 'Title', alt: 'Alt' },
          t: 'b',
        },
        c: 'Fallback',
      },
    });

    expect(output.errors).toEqual([]);
    expect(richSources(output)).toEqual([
      {
        t: 'Branch',
        i: 1,
        d: {
          ti: 'Title',
          alt: 'Alt',
          arb: 'Labelled',
          ard: 'Described',
          b: { title: 'Title', alt: 'Alt' },
          t: 'b',
        },
        c: 'Fallback',
      },
    ]);
  });

  it('keeps Plural content props out of its accepted form map', async () => {
    const output = await extractCase({
      name: 'Plural content props',
      template:
        '<T><Plural :n="2" title="Title" alt="Alt" aria-labelledby="Labelled" aria-describedby="Described" other="Other">Fallback</Plural></T>',
      source: {
        t: 'Plural',
        i: 1,
        d: {
          ti: 'Title',
          alt: 'Alt',
          arb: 'Labelled',
          ard: 'Described',
          b: { other: 'Other' },
          t: 'p',
        },
        c: 'Fallback',
      },
    });

    expect(output.errors).toEqual([]);
    expect(richSources(output)).toEqual([
      {
        t: 'Plural',
        i: 1,
        d: {
          ti: 'Title',
          alt: 'Alt',
          arb: 'Labelled',
          ard: 'Described',
          b: { other: 'Other' },
          t: 'p',
        },
        c: 'Fallback',
      },
    ]);
  });

  it.each([
    {
      name: 'static Branch prop',
      setup: '',
      template:
        '<T><Branch branch="formal" formal="Attribute"><template #formal>Slot</template>Fallback</Branch></T>',
      source: branchSource({ formal: 'Slot' }),
    },
    {
      name: 'dynamic Branch prop',
      setup: 'const value = String(Date.now());',
      template:
        '<T><Branch branch="formal" :formal="value"><template #formal>Slot</template>Fallback</Branch></T>',
      source: branchSource({ formal: 'Slot' }),
    },
    {
      name: 'modified Branch prop',
      setup: 'const value = String(Date.now());',
      template:
        '<T><Branch branch="formal" :formal.camel="value"><template #formal>Slot</template>Fallback</Branch></T>',
      source: branchSource({ formal: 'Slot' }),
    },
    {
      name: 'primitive Branch prop',
      setup: '',
      template:
        '<T><Branch branch="formal" :formal="false"><template #formal>Slot</template>Fallback</Branch></T>',
      source: branchSource({ formal: 'Slot' }),
    },
    {
      name: 'dynamic Plural prop',
      setup: 'const value = String(Date.now());',
      template:
        '<T><Plural :n="1" :one="value"><template #one>Slot</template>Fallback</Plural></T>',
      source: pluralSource({ one: 'Slot' }),
    },
    {
      name: 'primitive Plural prop',
      setup: '',
      template:
        '<T><Plural :n="1" :one="null"><template #one>Slot</template>Fallback</Plural></T>',
      source: pluralSource({ one: 'Slot' }),
    },
  ])('gives a named slot precedence over a $name', async (testCase) => {
    const output = await extractCase(testCase);

    expect(output.errors).toEqual([]);
    expect(richSources(output)).toEqual([testCase.source]);
  });

  it('serializes only accepted primitive Plural forms', async () => {
    const output = await extractCase({
      name: 'plural primitive matrix',
      setup: 'const ignored = String(Date.now());',
      template:
        '<T><Plural :n="2" zero="None" :one="1" :two="2n" :few="false" :many="null" other="Other" :label="ignored" class="secret" @click="ignored">Fallback</Plural></T>',
      source: pluralSource({
        zero: 'None',
        one: '1',
        two: '2',
        few: false,
        many: null,
        other: 'Other',
      }),
    });

    expect(output.errors).toEqual([]);
    expect(richSources(output)).toEqual([
      pluralSource({
        zero: 'None',
        one: '1',
        two: '2',
        few: false,
        many: null,
        other: 'Other',
      }),
    ]);
  });

  it('serializes numeric global Plural forms and omits undefined forms', async () => {
    const output = await extractCase({
      name: 'plural primitive globals',
      template:
        '<T><Plural :n="2" :zero="undefined" :few="Infinity" :many="NaN">Fallback</Plural></T>',
      source: pluralSource({ few: 'Infinity', many: 'NaN' }),
    });

    expect(output.errors).toEqual([]);
    expect(richSources(output)).toEqual([
      pluralSource({ few: 'Infinity', many: 'NaN' }),
    ]);
  });

  it('matches finalized runtime hashes for direct primitive branch values', async () => {
    const branchExpected = branchSource({
      active: true,
      inactive: false,
      unknown: null,
      count: '12',
      label: 'Hello',
    });
    const branchOutput = await extractCase({
      name: 'primitive Branch runtime hash',
      template:
        '<T><Branch branch="active" :active="true" :inactive="false" :unknown="null" :count="12" label="Hello">Fallback</Branch></T>',
      source: branchExpected,
    });
    const pluralExpected = pluralSource({
      zero: false,
      one: true,
      two: null,
      few: '',
      many: '0',
      other: 'Other',
    });
    const pluralOutput = await extractCase({
      name: 'primitive Plural runtime hash',
      template:
        '<T><Plural :n="2" :zero="false" :one="true" :two="null" few="" :many="0" other="Other">Fallback</Plural></T>',
      source: pluralExpected,
    });

    expect(branchOutput.errors).toEqual([]);
    expect(pluralOutput.errors).toEqual([]);
    expect(richSources(branchOutput)).toEqual([branchExpected]);
    expect(richSources(pluralOutput)).toEqual([pluralExpected]);
    expect(
      hashSource({
        dataFormat: 'JSX',
        source: richSources(branchOutput)[0],
      })
    ).toBe('be0765c641c3c17a');
    expect(
      hashSource({
        dataFormat: 'JSX',
        source: richSources(pluralOutput)[0],
      })
    ).toBe('69b0a0d0f137587f');
  });

  it.each([
    {
      name: 'dynamic identifier',
      setup: 'const value = String(Date.now());',
      attribute: ':formal="value"',
      key: 'formal',
      component: 'Branch',
    },
    {
      name: 'function call',
      setup: "const getValue = () => 'Hello';",
      attribute: ':formal="getValue()"',
      key: 'formal',
      component: 'Branch',
    },
    {
      name: 'member expression',
      setup: "const state = { value: 'Hello' };",
      attribute: ':formal="state.value"',
      key: 'formal',
      component: 'Branch',
    },
    {
      name: 'dynamic Plural form',
      setup: 'const value = String(Date.now());',
      attribute: ':one="value"',
      key: 'one',
      component: 'Plural',
    },
  ])('fails closed for a $name', async (testCase) => {
    const template = `<T><${testCase.component} ${testCase.component === 'Plural' ? ':n="1"' : 'branch="formal"'} ${testCase.attribute}>Fallback</${testCase.component}></T>`;
    const output = await extractCase({
      name: testCase.name,
      setup: testCase.setup,
      source: [],
      template,
    });

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      `dynamic branch prop "${testCase.key}"`
    );
  });

  it('matches the exact hash captured from the finalized gt-vue runtime', async () => {
    const testCase: BranchCase = {
      name: 'exact runtime hash',
      setup: 'const handler = () => undefined;',
      template:
        '<T><Branch branch="formal" class="secret" :style="{ color: \'red\' }" @click="handler" formal="Hello">Fallback</Branch></T>',
      source: branchSource({ formal: 'Hello' }),
    };
    const output = await extractCase(testCase);
    const source = richSources(output)[0];

    expect(output.errors).toEqual([]);
    expect(source).toEqual(testCase.source);
    expect(hashSource({ dataFormat: 'JSX', source })).toBe('dab20b4518607f20');
  });

  function branchSource(
    branches?: Record<string, BranchWireValue>
  ): JsxChildren {
    return {
      t: 'Branch',
      i: 1,
      ...(branches && Object.keys(branches).length > 0
        ? { d: { b: branches, t: 'b' as const } }
        : {}),
      c: 'Fallback',
    } as unknown as JsxChildren;
  }

  function pluralSource(
    branches: Record<string, BranchWireValue>
  ): JsxChildren {
    return {
      t: 'Plural',
      i: 1,
      d: { b: branches, t: 'p' },
      c: 'Fallback',
    } as unknown as JsxChildren;
  }

  async function extractCase(testCase: BranchCase) {
    const source = createSfc(testCase.setup ?? '', testCase.template);
    assertVueCompiles(source, testCase.name);
    return extractFromVueSource(source, `/fixtures/${testCase.name}.vue`, {
      projectRoot: '/fixtures',
    });
  }

  function createSfc(setup: string, template: string): string {
    return `<script setup lang="ts">import { Branch, Plural, T } from 'gt-vue';${setup}</script><template>${template}</template>`;
  }

  function richSources(
    output: Awaited<ReturnType<typeof extractFromVueSource>>
  ): JsxChildren[] {
    return output.results
      .filter((result) => result.dataFormat === 'JSX')
      .map((result) => result.source);
  }
});

describe('component slot runtime parity', () => {
  it('rejects comment boundaries in a serialized component default slot', async () => {
    const output = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      </script>
      <template>
        <!-- outside translated content -->
        <T><Card>Before<!-- source boundary -->After</Card><b>End</b></T>
      </template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'hash changes between development and production'
    );
  });

  it('does not inspect comment whitespace in an opaque named slot', async () => {
    const output = await extract(`
      <script setup>import { T } from 'gt-vue';</script>
      <template><T><Card>Body<template #details>Hidden <!-- named boundary --> content</template></Card></T></template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual({
      t: 'Card',
      i: 1,
      c: 'Body',
    });
  });

  it('serializes a static default slot and extracts named slots independently', async () => {
    const output = await extract(`
      <script setup lang="ts">
      import { T, Var } from 'gt-vue';
      </script>
      <template>
        <T context="outer"><Card title="Heading">Body<template #details="{ label }"><T context="inner">Inner<Var>{{ label }}</Var></T></template><template #unused>Ignored</template></Card><span>After</span></T>
      </template>
    `);

    expect(output.errors).toEqual([]);
    expect(
      output.results
        .filter((result) => result.dataFormat === 'JSX')
        .map((result) => ({
          context: result.metadata.context,
          source: result.source,
        }))
    ).toEqual([
      {
        context: 'outer',
        source: [
          { t: 'Card', i: 1, d: { ti: 'Heading' }, c: 'Body' },
          { t: 'span', i: 2, c: 'After' },
        ],
      },
      {
        context: 'inner',
        source: ['Inner', { i: 1, k: '_gt_value_1', v: 'v' }],
      },
    ]);
  });

  it('rejects scoped default slots and dynamic names that may select default', async () => {
    const scoped = await extract(`
      <script setup>import { T } from 'gt-vue';</script>
      <template><T><Card><template #default="{ label }">{{ label }}</template></Card></T></template>
    `);
    const dynamic = await extract(`
      <script setup>import { T } from 'gt-vue'; const name = 'details';</script>
      <template><T><Card><template #[name]>Details</template></Card></T></template>
    `);

    expect(scoped.results).toEqual([]);
    expect(scoped.errors.join('\n')).toContain('scoped slot');
    expect(dynamic.results).toEqual([]);
    expect(dynamic.errors.join('\n')).toContain('dynamic slot name');
  });

  it('uses an explicit static default slot without inspecting component implementation content', async () => {
    const output = await extract(`
      <script setup>import { T } from 'gt-vue';</script>
      <template><T><Card><template #default>Static body</template><template #toolbar>Ignored toolbar</template></Card><ImplementationOnly /></T></template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual([
      { t: 'Card', i: 1, c: 'Static body' },
      { t: 'ImplementationOnly', i: 2 },
    ]);
  });

  it('keeps Fragment named slots outside the outer translation', async () => {
    const output = await extract(`
      <script setup>
      import { T } from 'gt-vue';
      import { Fragment } from 'vue';
      </script>
      <template><T context="outer"><Fragment><b>Default</b><template #aside><T context="inner">Aside</T></template></Fragment><i>After</i></T></template>
    `);

    expect(output.errors).toEqual([]);
    expect(
      output.results.map((result) => ({
        context: result.metadata.context,
        source: result.source,
      }))
    ).toEqual([
      {
        context: 'outer',
        source: [
          {
            t: 'C1',
            i: 1,
            c: { t: 'b', i: 2, c: 'Default' },
          },
          { t: 'i', i: 3, c: 'After' },
        ],
      },
      { context: 'inner', source: 'Aside' },
    ]);
  });

  it('serializes only Suspense default content and extracts fallback T independently', async () => {
    const output = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      </script>
      <template>
        <T><Suspense><main>Source</main><template #fallback><T context="loading">Loading</T></template></Suspense><Transition><p>Motion</p></Transition><b>After</b></T>
      </template>
    `);

    expect(output.errors).toEqual([]);
    expect(
      output.results
        .filter((result) => result.dataFormat === 'JSX')
        .map((result) => ({
          context: result.metadata.context,
          source: result.source,
        }))
    ).toEqual([
      {
        context: undefined,
        source: [
          {
            t: 'Suspense',
            i: 1,
            c: { t: 'main', i: 2, c: 'Source' },
          },
          {
            t: 'Transition',
            i: 3,
            c: { t: 'p', i: 4, c: 'Motion' },
          },
          { t: 'b', i: 5, c: 'After' },
        ],
      },
      { context: 'loading', source: 'Loading' },
    ]);
  });

  it.each(['#fallback', 'v-slot:fallback'])(
    'extracts a component-level Suspense fallback independently with %s',
    async (directive) => {
      const output = await extract(`
        <script setup lang="ts">
        import { T } from 'gt-vue';
        </script>
        <template><T><Suspense ${directive}><T context="loading">Loading</T></Suspense><b>After</b></T></template>
      `);

      expect(output.errors).toEqual([]);
      expect(
        output.results.map((result) => ({
          context: result.metadata.context,
          source: result.source,
        }))
      ).toEqual([
        {
          context: undefined,
          source: [
            { t: 'Suspense', i: 1 },
            { t: 'b', i: 2, c: 'After' },
          ],
        },
        { context: 'loading', source: 'Loading' },
      ]);
    }
  );

  it('rejects multiple Suspense default roots that Vue normalizes to a comment', async () => {
    const output = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      </script>
      <template><T><Suspense><!-- ignored --><p>First</p><p>Second</p><template #fallback>Loading</template></Suspense></T></template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'more than one default root inside Vue <Suspense>'
    );
  });

  it.each(["Hello {{ 'world' }}", "{{ 'Hello' }}{{ ' world' }}"])(
    'accepts adjacent text as one Suspense root: %s',
    async (content) => {
      const output = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      </script>
      <template><T><Suspense>${content}</Suspense></T></template>
    `);

      expect(output.errors).toEqual([]);
      expect(output.results[0]?.source).toEqual({
        t: 'Suspense',
        i: 1,
        c: 'Hello world',
      });
    }
  );

  it.each([
    'Hello<!-- compiler barrier -->world',
    'Hello<template #fallback>Loading</template>world',
    "{{ 'Hello' }}<!-- compiler barrier -->{{ ' world' }}",
  ])(
    'rejects text roots separated by a Vue compiler barrier: %s',
    async (content) => {
      const output = await extract(`
        <script setup lang="ts">
        import { T } from 'gt-vue';
        </script>
        <template><T><Suspense>${content}</Suspense></T></template>
      `);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'more than one default root inside Vue <Suspense>'
      );
    }
  );

  it('ignores a trailing comment when Suspense has one meaningful root', async () => {
    const output = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      </script>
      <template><T><Suspense><main>Source</main><!-- ignored --></Suspense></T></template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual({
      t: 'Suspense',
      i: 1,
      c: { t: 'main', i: 2, c: 'Source' },
    });
  });

  it.each([
    {
      name: 'literal builtin',
      script: '',
      tag: 'Suspense',
    },
    {
      name: 'named import alias',
      script: "import { Suspense as AsyncBoundary } from 'vue';",
      tag: 'AsyncBoundary',
    },
    {
      name: 'transitive alias',
      script:
        "import { Suspense } from 'vue'; const First = Suspense; const AsyncBoundary = First;",
      tag: 'AsyncBoundary',
    },
    {
      name: 'namespace tag',
      script: "import * as Vue from 'vue';",
      tag: 'Vue.Suspense',
    },
    {
      name: 'namespace-derived alias',
      script: "import * as Vue from 'vue'; const AsyncBoundary = Vue.Suspense;",
      tag: 'AsyncBoundary',
    },
    {
      name: 'nullish alias',
      script:
        "import * as Vue from 'vue'; const AsyncBoundary = Vue.Suspense ?? String;",
      tag: 'AsyncBoundary',
    },
    {
      name: 'logical alias',
      script:
        "import * as Vue from 'vue'; const AsyncBoundary = Vue.Suspense || String;",
      tag: 'AsyncBoundary',
    },
    {
      name: 'logical-and alias',
      script:
        "import * as Vue from 'vue'; const AsyncBoundary = Vue.Suspense && Vue.Suspense;",
      tag: 'AsyncBoundary',
    },
    {
      name: 'static conditional alias',
      script:
        "import * as Vue from 'vue'; const AsyncBoundary = true ? Vue.Suspense : String;",
      tag: 'AsyncBoundary',
    },
    {
      name: 'identical conditional alias',
      script:
        "import * as Vue from 'vue'; const runtimeFlag = Boolean(Date.now()); const AsyncBoundary = runtimeFlag ? Vue.Suspense : Vue.Suspense;",
      tag: 'AsyncBoundary',
    },
    {
      name: 'sequence alias',
      script:
        "import * as Vue from 'vue'; const AsyncBoundary = (0, Vue.Suspense);",
      tag: 'AsyncBoundary',
    },
    {
      name: 'markRaw identity wrapper',
      script:
        "import { markRaw, Suspense } from 'vue'; const AsyncBoundary = markRaw(Suspense);",
      tag: 'AsyncBoundary',
    },
    {
      name: 'kebab-case alias',
      script: "import { Suspense as AsyncBoundary } from 'vue';",
      tag: 'async-boundary',
    },
    {
      name: 'dynamic direct binding',
      script: "import { Suspense } from 'vue';",
      tag: 'component :is="Suspense"',
    },
    {
      name: 'dynamic namespace binding',
      script: "import * as Vue from 'vue';",
      tag: 'component :is="Vue.Suspense"',
    },
  ])('matches literal Suspense for a $name', async ({ script, tag }) => {
    const output = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      ${script}
      </script>
      <template><T><${tag}><main>Source</main><template #fallback>Loading</template></${tag.split(' ')[0]}></T></template>
    `);

    expect(output.errors).toEqual([]);
    const source = output.results.find(
      (result) => result.dataFormat === 'JSX'
    )?.source;
    expect(source).toEqual({
      t: 'Suspense',
      i: 1,
      c: { t: 'main', i: 2, c: 'Source' },
    });
    expect(hashSource({ dataFormat: 'JSX', source })).toBe('bb63de9e2be66ffe');
  });

  it('resolves Options API Suspense registration through object spreads and static selectors', async () => {
    const output = await extract(`
      <script lang="ts">
      import { defineComponent, Suspense } from 'vue';
      import { T } from 'gt-vue';
      const shared = { AsyncBoundary: Suspense };
      export default defineComponent({
        components: { T, ...shared },
      });
      </script>
      <template><T><component :is="'AsyncBoundary'"><main>Source</main><template #fallback>Loading</template></component></T></template>
    `);

    expect(output.errors).toEqual([]);
    const source = output.results.find(
      (result) => result.dataFormat === 'JSX'
    )?.source;
    expect(source).toEqual({
      t: 'Suspense',
      i: 1,
      c: { t: 'main', i: 2, c: 'Source' },
    });
    expect(hashSource({ dataFormat: 'JSX', source })).toBe('bb63de9e2be66ffe');
  });

  it.each([
    {
      name: 'direct overrides',
      declaration: `{
        ...getOptions(),
        components: { T, AsyncBoundary: Suspense },
        setup() { return {}; },
      }`,
    },
    {
      name: 'nested overrides',
      declaration: `{
        ...{
          ...getOptions(),
          components: { T, AsyncBoundary: Suspense },
          setup() { return {}; },
        },
      }`,
    },
    {
      name: 'explicit absent setup override',
      declaration: `{
        ...getOptions(),
        components: { T, AsyncBoundary: Suspense },
        setup: undefined,
      }`,
    },
  ])(
    'accepts relevant Options API properties after unknown top-level spreads: $name',
    async ({ declaration }) => {
      const output = await extract(`
        <script>
        import { Suspense } from 'vue';
        import { T } from 'gt-vue';
        const getOptions = () => ({ components: { Card: Suspense } });
        export default ${declaration};
        </script>
        <template><T><AsyncBoundary><main>Source</main></AsyncBoundary></T></template>
      `);

      expect(output.errors).toEqual([]);
      expect(output.results[0]?.source).toEqual({
        t: 'Suspense',
        i: 1,
        c: { t: 'main', i: 2, c: 'Source' },
      });
    }
  );

  it.each([
    {
      name: 'missing explicit setup',
      declaration:
        '{ ...getOptions(), components: { T, AsyncBoundary: Suspense } }',
    },
    {
      name: 'missing explicit components',
      declaration: '{ ...getOptions(), setup() { return {}; } }',
    },
    {
      name: 'trailing spread',
      declaration:
        '{ components: { T, AsyncBoundary: Suspense }, setup() { return {}; }, ...getOptions() }',
    },
    {
      name: 'trailing computed key',
      declaration:
        '{ components: { T, AsyncBoundary: Suspense }, setup() { return {}; }, [getKey()]: true }',
    },
  ])(
    'rejects unknown top-level Options API properties after $name',
    async ({ declaration }) => {
      const output = await extract(`
        <script>
        import { Suspense } from 'vue';
        import { T } from 'gt-vue';
        const getOptions = () => ({});
        const getKey = () => 'components';
        export default ${declaration};
        </script>
        <template><T><AsyncBoundary><main>Hidden</main></AsyncBoundary></T></template>
      `);

      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve the Vue Options API components or setup'
      );
    }
  );

  it('keeps unknown component-registry keys blocking after explicit overrides', async () => {
    const output = await extract(`
      <script>
      import { Suspense } from 'vue';
      import { T } from 'gt-vue';
      const getComponents = () => ({ Card: Suspense });
      export default {
        components: { ...getComponents(), T, AsyncBoundary: Suspense },
        setup() { return {}; },
      };
      </script>
      <template><T><Card><main>Hidden</main></Card></T></template>
    `);

    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve the Vue Options API components registry'
    );
  });

  it('serializes unproven Suspense-like component children and rejects unregistered string selectors', async () => {
    const opaque = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      import { Suspense as AsyncBoundary } from './ui';
      </script>
      <template><T><AsyncBoundary><main>Hidden</main></AsyncBoundary></T></template>
    `);
    const mutable = await extract(`
      <script setup lang="ts">
      import { Suspense } from 'vue';
      import { T } from 'gt-vue';
      let AsyncBoundary = Suspense;
      AsyncBoundary = String;
      </script>
      <template><T><AsyncBoundary><main>Hidden</main></AsyncBoundary></T></template>
    `);
    const stringSelector = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      </script>
      <template><T><component :is="'Suspense'"><main>Hidden</main></component></T></template>
    `);

    expect(opaque.errors).toEqual([]);
    expect(opaque.results[0]?.source).toEqual({
      t: 'AsyncBoundary',
      i: 1,
      c: { t: 'main', i: 2, c: 'Hidden' },
    });
    expect(mutable.results).toEqual([]);
    expect(mutable.errors.join('\n')).toContain(
      'Could not statically resolve component alias "AsyncBoundary"'
    );
    expect(stringSelector.results).toEqual([]);
    expect(stringSelector.errors.join('\n')).toContain('dynamic <component>');
  });

  it.each([
    {
      name: 'member assignment',
      setup:
        'const registry = { AsyncBoundary: Suspense }; registry.AsyncBoundary = String;',
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'computed member assignment',
      setup:
        "const registry = { AsyncBoundary: Suspense }; registry['AsyncBoundary'] = String;",
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'Object.assign mutation',
      setup:
        'const registry = { AsyncBoundary: Suspense }; Object.assign(registry, { AsyncBoundary: String });',
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'escaped container',
      setup:
        'const registry = { AsyncBoundary: Suspense }; console.log(registry);',
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'deleted member',
      setup:
        'const registry: { AsyncBoundary?: unknown } = { AsyncBoundary: Suspense }; delete registry.AsyncBoundary;',
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'object-pattern member assignment',
      setup:
        'const registry = { AsyncBoundary: Suspense }; ({ AsyncBoundary: registry.AsyncBoundary } = { AsyncBoundary: String });',
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'array-pattern member assignment',
      setup:
        'const registry = { AsyncBoundary: Suspense }; [registry.AsyncBoundary] = [String];',
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'for-of member assignment',
      setup:
        'const registry = { AsyncBoundary: Suspense }; for (registry.AsyncBoundary of [String]) {}',
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'hoisted closure member assignment',
      setup: 'const registry = { AsyncBoundary: Suspense }; mutateRegistry();',
      registration:
        'const { AsyncBoundary } = registry; function mutateRegistry() { registry.AsyncBoundary = String; }',
    },
    {
      name: 'unknown trailing spread',
      setup: 'const getRegistry = () => ({ AsyncBoundary: String });',
      registration:
        'const { AsyncBoundary } = { AsyncBoundary: Suspense, ...getRegistry() };',
    },
    {
      name: 'mutated Options API registry',
      setup:
        'const registry = { AsyncBoundary: Suspense }; registry.AsyncBoundary = String;',
      registration: 'const components = registry;',
      options: true,
    },
    {
      name: 'unknown trailing Options API spread',
      setup: 'const getRegistry = () => ({ AsyncBoundary: String });',
      registration:
        'const components = { AsyncBoundary: Suspense, ...getRegistry() };',
      options: true,
    },
  ])(
    'does not follow a Suspense alias through $name',
    async ({ setup, registration, options }) => {
      const output = await extract(`
        <script${options ? '' : ' setup'} lang="ts">
        import { Suspense } from 'vue';
        import { T } from 'gt-vue';
        ${setup}
        ${registration}
        ${options ? 'export default { components: { ...components, T } };' : ''}
        </script>
        <template><T><AsyncBoundary><main>Hidden</main></AsyncBoundary></T></template>
      `);

      expect(output.errors.join('\n')).toContain(
        options
          ? 'Could not statically resolve the Vue Options API components registry'
          : 'Could not statically resolve component alias "AsyncBoundary"'
      );
      if (options) {
        expect(output.results[0]?.source).toEqual({
          t: 'AsyncBoundary',
          i: 1,
          c: { t: 'main', i: 2, c: 'Hidden' },
        });
      } else {
        expect(output.results).toEqual([]);
      }
    }
  );

  it.each([
    'registry.AsyncBoundary = String;',
    'Object.assign(registry, { AsyncBoundary: String });',
  ])(
    'keeps a component captured before later mutation: %s',
    async (mutation) => {
      const output = await extract(`
      <script setup lang="ts">
      import { Suspense } from 'vue';
      import { T } from 'gt-vue';
      const registry = { AsyncBoundary: Suspense };
      const { AsyncBoundary } = registry;
      ${mutation}
      </script>
      <template><T><AsyncBoundary><main>Source</main></AsyncBoundary></T></template>
    `);

      expect(output.errors).toEqual([]);
      expect(output.results[0]?.source).toEqual({
        t: 'Suspense',
        i: 1,
        c: { t: 'main', i: 2, c: 'Source' },
      });
    }
  );

  it.each([
    {
      name: 'reassigned destructured require binding',
      script: "let { Suspense: Boundary } = require('vue'); Boundary = String;",
      tag: 'Boundary',
    },
    {
      name: 'mutated require namespace member',
      script:
        "const Vue = require('vue'); Vue.Suspense = String; const Boundary = Vue.Suspense;",
      tag: 'Boundary',
    },
    {
      name: 'reassigned require namespace',
      script:
        "let Vue = require('vue'); Vue = { Suspense: String }; const Boundary = Vue.Suspense;",
      tag: 'Boundary',
    },
  ])('fails closed for a $name', async ({ script, tag }) => {
    const output = await extract(`
      <script setup>
      import { T } from 'gt-vue';
      ${script}
      </script>
      <template><T><${tag}><main>Hidden</main></${tag}></T></template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      `Could not statically resolve component alias "${tag}"`
    );
  });

  it('does not trust a mutable CommonJS namespace across SFC script blocks', async () => {
    const output = await extract(`
      <script>
      const Vue = require('vue');
      Vue.Suspense = String;
      export default {};
      </script>
      <script setup>
      import { T } from 'gt-vue';
      </script>
      <template><T><Vue.Suspense><main>Hidden</main></Vue.Suspense></T></template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve component alias "Vue.Suspense"'
    );
  });

  it.each([
    'const Boundary = shallowRef(Suspense);',
    'const Boundary = computed(() => Suspense);',
    'const Boundary = computed({ get: () => Suspense, set() {} });',
    'const Boundary = (() => Suspense)();',
    'function makeBoundary() { return Suspense; } const Boundary = makeBoundary();',
    'const holder = { get Boundary() { return Suspense; } }; const { Boundary } = holder;',
  ])(
    'fails closed when a wrapper can return Vue Suspense: %s',
    async (script) => {
      const output = await extract(`
        <script setup>
        import { computed, shallowRef, Suspense } from 'vue';
        import { T } from 'gt-vue';
        ${script}
        </script>
        <template><T><Boundary><main>Hidden</main></Boundary></T></template>
      `);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve component alias "Boundary"'
      );
    }
  );

  it('still rejects source-shaping directives and dynamic content props on components', async () => {
    const output = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      const heading = String(Date.now());
      const visible = true;
      </script>
      <template><T><Card v-if="visible" :title="heading">Hidden</Card></T></template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain('source-shaping directive v-if');
    expect(output.errors.join('\n')).toContain(
      'dynamic translatable prop "title"'
    );
  });

  async function extract(source: string) {
    return extractFromVueSource(source, '/fixtures/OpaqueComponents.vue', {
      projectRoot: process.cwd(),
    });
  }
});
