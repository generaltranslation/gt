import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import type { JsxChildren } from '@generaltranslation/format/types';
import { hashSource } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

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
    template: '<T><Branch branch="formal" formal="Hello">Fallback</Branch></T>',
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

describe('Branch attribute runtime parity', () => {
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
});

function branchSource(branches?: Record<string, BranchWireValue>): JsxChildren {
  return {
    t: 'Branch',
    i: 1,
    ...(branches && Object.keys(branches).length > 0
      ? { d: { b: branches, t: 'b' as const } }
      : {}),
    c: 'Fallback',
  } as unknown as JsxChildren;
}

function pluralSource(branches: Record<string, BranchWireValue>): JsxChildren {
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

function assertVueCompiles(source: string, name: string): void {
  const filename = `/fixtures/${name}.vue`;
  const parsed = parse(source, { filename });
  expect(parsed.errors, name).toEqual([]);
  const script = compileScript(parsed.descriptor, {
    babelParserPlugins: ['typescript'],
    id: `branch-parity-${name}`,
  });
  const template = parsed.descriptor.template;
  expect(template, name).not.toBeNull();
  if (!template) return;

  const compiled = compileTemplate({
    compilerOptions: {
      bindingMetadata: script.bindings,
      expressionPlugins: ['typescript'],
    },
    filename,
    id: `branch-parity-${name}`,
    source: template.content,
  });
  expect(compiled.errors, name).toEqual([]);
}

function richSources(
  output: Awaited<ReturnType<typeof extractFromVueSource>>
): JsxChildren[] {
  return output.results
    .filter((result) => result.dataFormat === 'JSX')
    .map((result) => result.source);
}
