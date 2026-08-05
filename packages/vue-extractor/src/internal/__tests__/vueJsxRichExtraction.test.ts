import { hashSource } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from '../../index.js';

describe('Vue JSX rich extraction', () => {
  it('extracts a direct T import into the runtime wire format', async () => {
    const output = await extractFromVueSource(
      `
        import { T } from 'gt-vue';
        export const View = () => (
          <T context="card">Hello <strong>world</strong>!</T>
        );
      `,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([
      {
        dataFormat: 'JSX',
        source: ['Hello ', { c: 'world', i: 1, t: 'strong' }, '!'],
        metadata: {
          context: 'card',
          filePaths: ['src/View.tsx'],
        },
      },
    ]);
    expect(
      hashSource({
        context: 'card',
        dataFormat: 'JSX',
        source: output.results[0]!.source,
      })
    ).toBe('fcd7d4e98f673df0');
  });

  it.each([
    {
      name: 'default functional component',
      component: `export default () => <T>Functional</T>;`,
      source: 'Functional',
    },
    {
      name: 'defineComponent setup renderer',
      component: `
        import { defineComponent } from 'vue';
        export default defineComponent({
          setup() {
            return () => <T>Setup renderer</T>;
          },
        });
      `,
      source: 'Setup renderer',
    },
  ])('extracts T from a $name', async ({ component, source }) => {
    const output = await extractFromVueSource(
      `import { T } from 'gt-vue'; ${component}`,
      '/project/src/View.tsx'
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map((result) => result.source)).toEqual([source]);
  });

  it.each([
    {
      filename: '/project/src/View.jsx',
      name: 'standalone JSX',
      source: `
        import { T } from 'gt-vue';
        export const View = () => <T>JavaScript JSX</T>;
      `,
      translation: 'JavaScript JSX',
    },
    {
      filename: '/project/src/View.vue',
      name: 'SFC script setup TSX',
      source: `
        <script setup lang="tsx">
          import { T } from 'gt-vue';
          const View = () => <T>Script setup TSX</T>;
        </script>
        <template><View /></template>
      `,
      translation: 'Script setup TSX',
    },
    {
      filename: '/project/src/View.vue',
      name: 'SFC normal TSX render function',
      source: `
        <script lang="tsx">
          import { defineComponent } from 'vue';
          import { T } from 'gt-vue';
          export default defineComponent({
            setup() {
              return () => <T>Normal script TSX</T>;
            },
          });
        </script>
      `,
      translation: 'Normal script TSX',
    },
  ])('extracts rich translations from $name', async (fixture) => {
    const output = await extractFromVueSource(
      fixture.source,
      fixture.filename,
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map((result) => result.source)).toEqual([
      fixture.translation,
    ]);
  });

  it('tracks aliases, namespaces, fragments, static values, and typed variables', async () => {
    const output = await extractFromVueSource(
      `
        import * as GT from 'gt-vue';
        import {
          Currency,
          DateTime,
          Num,
          T as Translate,
          Var as Value,
        } from 'gt-vue';
        const Alias = Translate;
        const context = 'hero';
        const label = 'Greeting';
        const name = getName();
        const count = getCount();
        const cost = getCost();
        const date = getDate();
        export const View = () => (
          <>
            <Alias $context={context}><>Hello {1}{false}{null}<strong title={label}>world</strong></><Value>{name}</Value><Num value={count}/><Currency value={cost}/><DateTime value={date}/></Alias>
            <GT.T>Namespace</GT.T>
          </>
        );
      `,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([
      {
        dataFormat: 'JSX',
        source: [
          'Hello 1',
          { c: 'world', d: { ti: 'Greeting' }, i: 1, t: 'strong' },
          { i: 2, k: '_gt_value_2', v: 'v' },
          { i: 3, k: '_gt_n_3', v: 'n' },
          { i: 4, k: '_gt_cost_4', v: 'c' },
          { i: 5, k: '_gt_date_5', v: 'd' },
        ],
        metadata: {
          context: 'hero',
          filePaths: ['src/View.tsx'],
        },
      },
      {
        dataFormat: 'JSX',
        source: 'Namespace',
        metadata: { filePaths: ['src/View.tsx'] },
      },
    ]);
    expect(
      hashSource({
        context: 'hero',
        dataFormat: 'JSX',
        source: output.results[0]!.source,
      })
    ).toBe('3a680d85faf2fc41');
  });

  it('matches the Fragment spellings Vue JSX keeps transparent', async () => {
    const output = await extractFromVueSource(
      `
        import * as Vue from 'vue';
        import { T } from 'gt-vue';
        const CustomFragment = () => null;
        const Fragment = CustomFragment;
        export const View = () => (
          <T><>short</><Fragment><span>one</span></Fragment><Vue.Fragment><b>three</b></Vue.Fragment><CustomFragment><i>opaque</i></CustomFragment></T>
        );
      `,
      '/project/src/View.tsx'
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual([
      'short',
      { c: 'one', i: 1, t: 'span' },
      { c: 'three', i: 2, t: 'b' },
      { i: 3, t: 'CustomFragment' },
    ]);
  });

  it('rejects renamed Fragment imports that Vue JSX compiles as component slots', async () => {
    const output = await extractFromVueSource(
      `
        import { Fragment as VueFragment } from 'vue';
        import { T } from 'gt-vue';
        export const View = () => <T><VueFragment><b>Lost</b></VueFragment></T>;
      `,
      '/project/src/View.tsx'
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain('renamed Vue Fragment binding');
  });

  it('keeps arbitrary component slots opaque and extracts their nested T independently', async () => {
    const output = await extractFromVueSource(
      `
        import { T } from 'gt-vue';
        import Card from './Card.vue';
        export const View = () => (
          <T><Card title="Card"><span>Opaque</span><T>Independent</T></Card></T>
        );
      `,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map((result) => result.source)).toEqual([
      { d: { ti: 'Card' }, i: 1, t: 'Card' },
      'Independent',
    ]);
  });

  it('traverses bound tags only when every possible value is a string element', async () => {
    const output = await extractFromVueSource(
      `
        import { T } from 'gt-vue';
        const StaticTag = 'strong';
        const DynamicTag = enabled ? 'em' : 'i';
        export const View = () => (
          <T><StaticTag>Static</StaticTag><DynamicTag>Dynamic</DynamicTag></T>
        );
      `,
      '/project/src/View.tsx'
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual([
      { c: 'Static', i: 1, t: 'strong' },
      { c: 'Dynamic', i: 2, t: 'DynamicTag' },
    ]);
  });

  it('serializes Branch v-slots with independent IDs and slot precedence', async () => {
    const output = await extractFromVueSource(
      `
        import * as GT from 'gt-vue';
        const name = getName();
        const tone = getTone();
        export const View = () => (
          <GT.T><GT.Branch branch={tone} formal="ignored attribute" v-slots={{
            formal: () => <><strong>Hello</strong> <GT.Var>{name}</GT.Var></>,
            casual: () => <><em>Hi</em> <GT.Var>{name}</GT.Var></>,
            default: () => 'Fallback',
          }} /><span>After</span></GT.T>
        );
      `,
      '/project/src/View.tsx'
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual([
      {
        c: 'Fallback',
        d: {
          b: {
            casual: [
              { c: 'Hi', i: 2, t: 'em' },
              ' ',
              { i: 3, k: '_gt_value_3', v: 'v' },
            ],
            formal: [
              { c: 'Hello', i: 2, t: 'strong' },
              ' ',
              { i: 3, k: '_gt_value_3', v: 'v' },
            ],
          },
          t: 'b',
        },
        i: 1,
        t: 'Branch',
      },
      { c: 'After', i: 2, t: 'span' },
    ]);
  });

  it('serializes Plural v-slots and primitive attribute branches', async () => {
    const output = await extractFromVueSource(
      `
        import { Num, Plural, T } from 'gt-vue';
        const count = getCount();
        export const View = () => (
          <T><Plural n={count} zero="None" title="Tip" v-slots={{
            one: () => <>One <Num value={1} /></>,
            other: () => <>Many <Num value={count} /></>,
            invalid: () => 'ignored',
            default: () => 'Fallback',
          }} /><span>After</span></T>
        );
      `,
      '/project/src/View.tsx'
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual([
      {
        c: 'Fallback',
        d: {
          b: {
            one: ['One ', { i: 2, k: '_gt_n_2', v: 'n' }],
            other: ['Many ', { i: 2, k: '_gt_n_2', v: 'n' }],
            zero: 'None',
          },
          t: 'p',
          ti: 'Tip',
        },
        i: 1,
        t: 'Plural',
      },
      { c: 'After', i: 2, t: 'span' },
    ]);
  });

  it('serializes only the normalized default roots of imported Vue Suspense forms', async () => {
    const output = await extractFromVueSource(
      `
        import * as Vue from 'vue';
        import { Suspense, Suspense as Wait, Transition } from 'vue';
        import { T } from 'gt-vue';
        export const View = () => (
          <T>
            <Suspense title="Boundary" v-slots={{ fallback: () => <i>Loading direct</i> }}><section>Direct</section></Suspense>
            <Wait v-slots={{ default: () => <article>Alias</article>, fallback: () => <i>Loading alias</i> }} />
            <Vue.Suspense>{() => <div>Namespace</div>}</Vue.Suspense>
            <Transition><b>Opaque transition child</b></Transition>
          </T>
        );
      `,
      '/project/src/View.tsx'
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual([
      {
        c: { c: 'Direct', i: 2, t: 'section' },
        d: { ti: 'Boundary' },
        i: 1,
        t: 'Suspense',
      },
      { c: { c: 'Alias', i: 4, t: 'article' }, i: 3, t: 'Suspense' },
      { c: { c: 'Namespace', i: 6, t: 'div' }, i: 5, t: 'Suspense' },
      { i: 7, t: 'Transition' },
    ]);
  });

  it('rejects nested T in normalized Suspense content without extracting it twice', async () => {
    const output = await extractFromVueSource(
      `
        import { Suspense } from 'vue';
        import { T } from 'gt-vue';
        export const View = () => <T><Suspense><T>Nested</T></Suspense></T>;
      `,
      '/project/src/View.tsx'
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain('nested gt-vue <T>');
  });

  it('rejects nested T in a traversed native subtree without duplicating extraction', async () => {
    const output = await extractFromVueSource(
      `
        import { T } from 'gt-vue';
        export const View = () => <T><div><T>Nested</T></div></T>;
      `,
      '/project/src/View.tsx'
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain('nested gt-vue <T>');
  });

  it('extracts T returned by an element callback independently from outer children', async () => {
    const output = await extractFromVueSource(
      `
        import { T } from 'gt-vue';
        export const View = () => (
          <T><button onClick={() => <T>Deferred</T>}>Outer</button></T>
        );
      `,
      '/project/src/View.tsx'
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map((result) => result.source)).toEqual([
      { c: 'Outer', i: 1, t: 'button' },
      'Deferred',
    ]);
  });

  it('rejects nested T inside a traversed Branch slot without extracting it twice', async () => {
    const output = await extractFromVueSource(
      `
        import { Branch, T } from 'gt-vue';
        export const View = () => (
          <T><Branch v-slots={{ formal: () => <T>Nested</T> }} /></T>
        );
      `,
      '/project/src/View.tsx'
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain('nested gt-vue <T>');
  });

  it.each([
    {
      name: 'dynamic context',
      source: `<T context={route.name}>Hello</T>`,
      diagnostic: 'dynamic context',
    },
    {
      name: 'conditional context',
      source: `<T context={true ? 'one' : 'two'}>Hello</T>`,
      diagnostic: 'conditional context',
    },
    {
      name: 'spread T props',
      source: `<T {...props}>Hello</T>`,
      diagnostic: 'spread prop',
    },
    {
      name: 'internal hash override',
      source: `<T _hash="wrong">Hello</T>`,
      diagnostic: 'unsupported prop "_hash"',
    },
    {
      name: 'dynamic child',
      source: `<T>Hello {name}</T>`,
      diagnostic: 'dynamic JSX content',
    },
    {
      name: 'conditional child',
      source: `<T>{enabled && <strong>Hello</strong>}</T>`,
      diagnostic: 'conditional JSX content',
    },
    {
      name: 'custom JSX pragma',
      source: `<T>{/* @jsx customVNode */}Hello</T>`,
      diagnostic: 'custom @jsx pragma',
    },
    {
      name: 'duplicate content prop',
      source: `<T><span title="first" title="second">Hello</span></T>`,
      diagnostic: 'duplicate translatable prop "title"',
    },
    {
      name: 'missing formatter value',
      source: `<T><Num /></T>`,
      diagnostic: 'without a value prop',
    },
    {
      name: 'formatter children',
      source: `<T><DateTime value={date}>{date}</DateTime></T>`,
      diagnostic: 'children on a gt-vue <DateTime>',
    },
    {
      name: 'Var value prop',
      source: `<T><Var value={name} /></T>`,
      diagnostic: 'unsupported value prop',
    },
    {
      name: 'unbound custom element',
      source: `<T><custom-element>Unknown mode</custom-element></T>`,
      diagnostic: 'component or custom element',
    },
    {
      name: 'mixed element and component tag',
      source: `<T><MixedTag>Unknown shape</MixedTag></T>`,
      setup: `const Card = () => null; const MixedTag = enabled ? 'div' : Card;`,
      diagnostic: 'renders an element or component',
    },
    {
      name: 'unknown dynamic tag factory',
      source: `<T><DynamicTag>Unknown shape</DynamicTag></T>`,
      setup: `const DynamicTag = getTag();`,
      diagnostic: 'renders an element or component',
    },
    {
      name: 'scoped branch slot',
      source: `<T><Branch v-slots={{ formal: (props) => <b>{props.label}</b> }} /></T>`,
      diagnostic: 'dynamic or scoped JSX slot',
    },
    {
      name: 'dynamic slots object',
      source: `<T><Branch v-slots={getSlots()} /></T>`,
      diagnostic: 'dynamic v-slots',
    },
    {
      name: 'duplicate branch prop',
      source: `<T><Branch formal="First" formal="Second" /></T>`,
      diagnostic: 'duplicate branch prop "formal"',
    },
    {
      name: 'missing plural selector',
      source: `<T><Plural v-slots={{ other: () => 'Many' }} /></T>`,
      diagnostic: 'without an n prop',
    },
    {
      name: 'compiler-dependent object slots',
      source: `<T><Branch>{{ formal: () => 'Formal' }}</Branch></T>`,
      diagnostic: 'object-slot child syntax',
    },
    {
      name: 'source-shaping Vue JSX directive',
      source: `<T><div v-html={html} /></T>`,
      diagnostic: 'Vue JSX directive "v-html"',
    },
    {
      name: 'multi-root Suspense children',
      source: `<T><Suspense><span>One</span><span>Two</span></Suspense></T>`,
      diagnostic: 'invalid default root inside Vue <Suspense>',
    },
    {
      name: 'scoped Suspense default slot',
      source: `<T><Suspense>{(props) => <span>{props.label}</span>}</Suspense></T>`,
      diagnostic: 'dynamic or scoped default slot on Vue <Suspense>',
    },
    {
      name: 'dynamic Suspense slots',
      source: `<T><Suspense v-slots={getSlots()} /></T>`,
      diagnostic: 'dynamic v-slots',
    },
    {
      name: 'unsupported Suspense named slot',
      source: `<T><Suspense v-slots={{ pending: () => <span>Pending</span> }} /></T>`,
      diagnostic: 'unsupported named slot "pending"',
    },
    {
      name: 'ambiguous Suspense child',
      source: `<T><Suspense>{child}</Suspense></T>`,
      diagnostic: 'Could not statically prove the default root',
    },
    {
      name: 'invalid Suspense slot array',
      source: `<T><Suspense v-slots={{ default: () => [<span>One</span>, 'Two'] }} /></T>`,
      diagnostic: 'invalid default root inside Vue <Suspense>',
    },
  ])('fails closed for $name', async ({ source, setup = '', diagnostic }) => {
    const output = await extractFromVueSource(
      `
        import { Suspense } from 'vue';
        import { Branch, DateTime, Num, Plural, T, Var } from 'gt-vue';
        ${setup}
        export const View = () => (${source});
      `,
      '/project/src/View.tsx'
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(diagnostic);
  });
});
