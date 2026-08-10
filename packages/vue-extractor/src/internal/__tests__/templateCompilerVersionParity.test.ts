import { describe, expect, it } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import {
  extractFromVueSource,
  testVueCompilerVersion,
} from './testVueCompiler.js';

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
      { t: 'i', i: 5, c: 'First' },
      { t: 'u', i: 6, c: 'Second' },
    ]);
    expect(hashSource({ dataFormat: 'JSX', source: source! })).toBe(
      '01a3131578552150'
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
      { t: 'u', i: 5, c: 'Fragment' },
      { t: 'i', i: 6, c: 'After' },
    ]);
    expect(hashSource({ dataFormat: 'JSX', source: source! })).toBe(
      '45c26775d92815dd'
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
