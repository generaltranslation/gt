import { readFileSync } from 'node:fs';
import type { JsxChildren } from '@generaltranslation/format/types';
import { hashSource } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

type WireFormatFixture = {
  description: string;
  hash: string;
  id: keyof typeof sources;
  source: JsxChildren;
};

const sources = {
  'nested-element': `
    <script setup>
    import { T } from 'gt-vue';
    </script>
    <template><T>Hello <strong>wonderful <em>world</em></strong>.</T></template>
  `,
  'typed-variables': `
    <script setup>
    import { Num, T, Var } from 'gt-vue';
    const count = 3;
    const name = 'Ada';
    </script>
    <template><T>Hello <Var>{{ name }}</Var>, you have <Num :value="count" /> messages.</T></template>
  `,
  'independent-branch-numbering': `
    <script setup>
    import { Branch, T, Var } from 'gt-vue';
    const name = 'Ada';
    </script>
    <template><T><Branch branch="formal"><template #formal><strong>Hello</strong> <Var>{{ name }}</Var></template><template #casual><em>Hi</em> <Var>{{ name }}</Var></template><template #default>Fallback</template></Branch><span>After</span></T></template>
  `,
  'independent-plural-numbering': `
    <script setup>
    import { Num, Plural, T } from 'gt-vue';
    const count = 2;
    </script>
    <template><T><Plural :n="count"><template #one>One <Num :value="1" /></template><template #other>Many <Num :value="count" /></template><template #default>Fallback</template></Plural><span>After</span></T></template>
  `,
} satisfies Record<string, string>;

const fixtures = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../test-fixtures/rich-content-wire-format.json',
      import.meta.url
    ),
    'utf8'
  )
) as WireFormatFixture[];

describe('shared rich-content wire format', () => {
  it.each(fixtures)('$id: $description', async (fixture) => {
    const output = await extractFromVueSource(
      sources[fixture.id],
      `${fixture.id}.vue`
    );
    const richResults = output.results.filter(
      (result) => result.dataFormat === 'JSX'
    );

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(richResults).toHaveLength(1);
    expect(richResults[0].source).toEqual(fixture.source);
    expect(
      hashSource({ dataFormat: 'JSX', source: richResults[0].source })
    ).toBe(fixture.hash);
  });
});
