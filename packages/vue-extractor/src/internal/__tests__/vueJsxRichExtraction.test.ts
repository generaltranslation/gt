import { hashSource } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

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
          'Hello ',
          '1',
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
    ).toBe('4293805c6f6d7cd8');
  });

  it('serializes immutable primitive globals in JSX', async () => {
    const output = await extractFromVueSource(
      `
        import { Branch, T } from 'gt-vue';
        export const View = () => (
          <T>{undefined}{NaN}{Infinity}<Branch branch="few" missing={undefined} few={Infinity} many={NaN}>Fallback</Branch></T>
        );
      `,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map((result) => result.source)).toEqual([
      [
        'NaN',
        'Infinity',
        {
          c: 'Fallback',
          d: { b: { few: 'Infinity', many: 'NaN' }, t: 'b' },
          i: 1,
          t: 'Branch',
        },
      ],
    ]);
  });

  it('gives JSX lexical bindings precedence over primitive globals', async () => {
    const output = await extractFromVueSource(
      `
        import { T } from 'gt-vue';
        const undefined = 'local undefined';
        const NaN = 'local NaN';
        const Infinity = 'local Infinity';
        export const View = () => <T>{undefined}|{NaN}|{Infinity}</T>;
      `,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map((result) => result.source)).toEqual([
      ['local undefined', '|', 'local NaN', '|', 'local Infinity'],
    ]);
  });

  it('does not fall back to JSX globals through dynamic lexical bindings', async () => {
    const output = await extractFromVueSource(
      `
        import { T } from 'gt-vue';
        const NaN = getValue();
        export const View = () => <T>{NaN}</T>;
      `,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain('dynamic JSX content');
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
      {
        c: { c: 'opaque', i: 4, t: 'i' },
        i: 3,
        t: 'CustomFragment',
      },
    ]);
  });

  it('preserves renamed Fragment imports that Vue compiles as component slots', async () => {
    const output = await extractFromVueSource(
      `
        import { Fragment as VueFragment } from 'vue';
        import { T } from 'gt-vue';
        export const View = () => <T>
          <VueFragment><b>Retained</b></VueFragment>
          <VueFragment v-slots={{ default: () => <em>Slotted</em> }} />
        </T>;
      `,
      '/project/src/View.tsx'
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual([
      {
        c: { c: 'Retained', i: 2, t: 'b' },
        i: 1,
        t: 'C1',
      },
      {
        c: { c: 'Slotted', i: 4, t: 'em' },
        i: 3,
        t: 'C3',
      },
    ]);
    expect(
      hashSource({
        dataFormat: 'JSX',
        source: output.results[0]!.source,
      })
    ).toBe('63915234a0275689');
  });

  it('serializes static children inside arbitrary custom components', async () => {
    const output = await extractFromVueSource(
      `
        import { T, Var } from 'gt-vue';
        import Card from './Card.vue';
        const name = getName();
        export const View = () => (
          <T><Card title="Card"><span>Visible</span><Var>{name}</Var></Card></T>
        );
      `,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map((result) => result.source)).toEqual([
      {
        c: [
          { c: 'Visible', i: 2, t: 'span' },
          { i: 3, k: '_gt_value_3', v: 'v' },
        ],
        d: { ti: 'Card' },
        i: 1,
        t: 'Card',
      },
    ]);
  });

  it('preserves React-compatible text boundaries around JSX comments', async () => {
    const output = await extractFromVueSource(
      `
        import { T } from 'gt-vue';
        import Card from './Card.vue';
        export const View = () => (
          <T><Card>Before{/* source boundary */}After</Card></T>
        );
      `,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual({
      c: ['Before', 'After'],
      i: 1,
      t: 'Card',
    });
    expect(
      hashSource({ dataFormat: 'JSX', source: output.results[0]!.source })
    ).toBe('3bcc07b273d94f01');
  });

  it('preserves React-compatible boundaries between adjacent string expressions', async () => {
    const output = await extractFromVueSource(
      `
        import { T } from 'gt-vue';
        import Card from './Card.vue';
        export const View = () => (
          <><T>{'A'}{'B'}</T><T><Card>{'A'}{'B'}</Card></T></>
        );
      `,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      ['A', 'B'],
      { c: ['A', 'B'], i: 1, t: 'Card' },
    ]);
    expect(
      output.results.map(({ source }) =>
        hashSource({ dataFormat: 'JSX', source })
      )
    ).toEqual(['0998d2c300882cb5', '9bbc5cefc482e24c']);
  });

  it('serializes static children of Vue helpers used as JSX component tags', async () => {
    const output = await extractFromVueSource(
      `
        import { h as H } from 'vue';
        import { T } from 'gt-vue';
        export const View = () => (
          <T><H><strong>Opaque helper slot</strong></H><i>After</i></T>
        );
      `,
      '/project/src/View.tsx'
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual([
      {
        c: { c: 'Opaque helper slot', i: 2, t: 'strong' },
        i: 1,
        t: 'H',
      },
      { c: 'After', i: 3, t: 'i' },
    ]);
  });

  it('serializes authored children for every recognized Vue helper tag', async () => {
    const output = await extractFromVueSource(
      `
        import {
          defineComponent as DefineComponent,
          markRaw as MarkRaw,
          reactive as Reactive,
          ref as Ref,
        } from 'vue';
        import { T } from 'gt-vue';
        export const View = () => (
          <T>
            <Ref><b>hidden ref</b></Ref>
            <Reactive><i>hidden reactive</i></Reactive>
            <MarkRaw><em>hidden markRaw</em></MarkRaw>
            <DefineComponent><strong>hidden defineComponent</strong></DefineComponent>
            <u>visible</u>
          </T>
        );
      `,
      '/project/src/View.tsx'
    );

    expect(output.errors).toEqual([]);
    const source = output.results[0]?.source;
    expect(source).toEqual([
      { c: { c: 'hidden ref', i: 2, t: 'b' }, i: 1, t: 'Ref' },
      { c: { c: 'hidden reactive', i: 4, t: 'i' }, i: 3, t: 'Reactive' },
      { c: { c: 'hidden markRaw', i: 6, t: 'em' }, i: 5, t: 'MarkRaw' },
      {
        c: { c: 'hidden defineComponent', i: 8, t: 'strong' },
        i: 7,
        t: 'DefineComponent',
      },
      { c: 'visible', i: 9, t: 'u' },
    ]);
  });

  it('serializes a static explicit default slot and ignores named slots', async () => {
    const output = await extractFromVueSource(
      `
        import { T, Var } from 'gt-vue';
        import Card from './Card.vue';
        const name = getName();
        export const View = () => (
          <T>
            <Card v-slots={{
              default: () => <><strong>Hello</strong> <Var>{name}</Var></>,
              named: async (props) => <i>{props.label}</i>,
            }} />
            <b>After</b>
          </T>
        );
      `,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual([
      {
        c: [
          { c: 'Hello', i: 2, t: 'strong' },
          ' ',
          { i: 3, k: '_gt_value_3', v: 'v' },
        ],
        i: 1,
        t: 'Card',
      },
      { c: 'After', i: 4, t: 'b' },
    ]);
  });

  it.each([
    {
      name: 'literal computed key',
      setup: '',
      slot: `['default']`,
    },
    {
      name: 'immutable computed key',
      setup: `const defaultSlot = 'default';`,
      slot: `[defaultSlot]`,
    },
  ])('serializes a default slot selected by a $name', async (fixture) => {
    const output = await extractFromVueSource(
      `
        import { T } from 'gt-vue';
        import Card from './Card.vue';
        ${fixture.setup}
        export const View = () => (
          <T><Card v-slots={{ ${fixture.slot}: () => <b>Hello</b> }} /></T>
        );
      `,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual({
      c: { c: 'Hello', i: 2, t: 'b' },
      i: 1,
      t: 'Card',
    });
  });

  it('serializes Vue object-child default slots while leaving named slots opaque', async () => {
    const output = await extractFromVueSource(
      `
        import { T } from 'gt-vue';
        import Card from './Card.vue';
        export const View = () => (
          <T><Card>{{
            default: () => <span>Default child</span>,
            named: ({ label }) => <i>{label}</i>,
          }}</Card></T>
        );
      `,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual({
      c: { c: 'Default child', i: 2, t: 'span' },
      i: 1,
      t: 'Card',
    });
  });

  it.each([
    {
      name: 'arrow function',
      child: `{() => <b>Hello</b>}`,
    },
    {
      name: 'function expression',
      child: `{function () { return <b>Hello</b>; }}`,
    },
  ])(
    'serializes the $name child Vue JSX transforms into a direct default slot',
    async ({ child }) => {
      const output = await extractFromVueSource(
        `
          import { T } from 'gt-vue';
          import Card from './Card.vue';
          export const View = () => <T><Card>${child}</Card></T>;
        `,
        '/project/src/View.tsx',
        { projectRoot: '/project' }
      );

      const source = {
        c: { c: 'Hello', i: 2, t: 'b' },
        i: 1,
        t: 'Card',
      };
      expect(output.errors).toEqual([]);
      expect(output.results[0]?.source).toEqual(source);
      expect(hashSource({ dataFormat: 'JSX', source })).toBe(
        '1c3760937a26bcbd'
      );
    }
  );

  it('extracts T inside an ordinary named slot independently', async () => {
    const output = await extractFromVueSource(
      `
        import { T } from 'gt-vue';
        import Card from './Card.vue';
        export const View = () => (
          <T><Card v-slots={{
            default: () => <span>Default child</span>,
            named: () => <T context="named">Independent</T>,
          }} /><b>After</b></T>
        );
      `,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map((result) => result.source)).toEqual([
      [
        {
          c: { c: 'Default child', i: 2, t: 'span' },
          i: 1,
          t: 'Card',
        },
        { c: 'After', i: 3, t: 'b' },
      ],
      'Independent',
    ]);
  });

  it('omits component-owned implementation content from a self-closing component', async () => {
    const output = await extractFromVueSource(
      `
        import { T } from 'gt-vue';
        import Card from './Card.vue';
        export const View = () => <T><Card /></T>;
      `,
      '/project/src/View.tsx',
      { projectRoot: '/project' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual({ i: 1, t: 'Card' });
  });

  it('gives intrinsic HTML and SVG tags precedence over lexical aliases', async () => {
    const output = await extractFromVueSource(
      `
        import { T, T as div, Var as span } from 'gt-vue';
        import { reactive as svg } from 'vue';
        export const View = () => (
          <T>
            <div><b>GT alias</b></div>
            <span><i>Variable alias</i></span>
            <svg><text>Vue helper alias</text></svg>
          </T>
        );
      `,
      '/project/src/View.tsx'
    );

    expect(output.errors).toEqual([]);
    const source = output.results[0]?.source;
    expect(source).toEqual([
      { c: { c: 'GT alias', i: 2, t: 'b' }, i: 1, t: 'div' },
      { c: { c: 'Variable alias', i: 4, t: 'i' }, i: 3, t: 'span' },
      {
        c: { c: 'Vue helper alias', i: 6, t: 'text' },
        i: 5,
        t: 'svg',
      },
    ]);
    expect(hashSource({ dataFormat: 'JSX', source: source! })).toBe(
      'a5b5d264ac1dd95d'
    );
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

  it.each(['/project/src/View.jsx', '/project/src/View.tsx'])(
    'preserves React-compatible primitive branch wire values in %s',
    async (filename) => {
      const output = await extractFromVueSource(
        `
          import { Branch, Plural, T } from 'gt-vue';
          export const View = () => (
            <T>
              <Plural
                n={1}
                zero={0}
                one={1}
                two={-1}
                few={3.14159}
                many={1e6}
                other={0xff}
                ignored={false}
              />
              <Branch
                branch="status"
                active={true}
                inactive={false}
                unknown={null}
                pending=""
              />
              <Plural
                n={1}
                singular="Single 'quotes' inside"
                plural={'Double "quotes" inside'}
                other={\`Template with 'both' "types"\`}
              />
            </T>
          );
        `,
        filename
      );

      expect(output.errors).toEqual([]);
      expect(output.results[0]?.source).toStrictEqual([
        {
          d: {
            b: {
              few: '3.14159',
              many: '1000000',
              one: '1',
              other: '255',
              two: '-1',
              zero: '0',
            },
            t: 'p',
          },
          i: 1,
          t: 'Plural',
        },
        {
          d: {
            b: {
              active: true,
              inactive: false,
              pending: '',
              unknown: null,
            },
            t: 'b',
          },
          i: 2,
          t: 'Branch',
        },
        {
          d: {
            b: {
              other: 'Template with \'both\' "types"',
              plural: 'Double "quotes" inside',
              singular: "Single 'quotes' inside",
            },
            t: 'p',
          },
          i: 3,
          t: 'Plural',
        },
      ]);
      expect(
        hashSource({
          dataFormat: 'JSX',
          source: output.results[0]!.source,
        })
      ).toBe('4d68f22fc6e97b8f');
    }
  );

  it('preserves direct boolean and null props for accepted Plural forms', async () => {
    const output = await extractFromVueSource(
      `
        import { Plural, T } from 'gt-vue';
        export const View = () => (
          <T>
            <Plural
              n={2}
              zero
              one={false}
              two="Two"
              other={null}
              invalid={true}
            />
          </T>
        );
      `,
      '/project/src/View.tsx'
    );

    const source = {
      d: {
        b: { one: false, other: null, two: 'Two', zero: true },
        t: 'p' as const,
      },
      i: 1,
      t: 'Plural',
    };
    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toStrictEqual(source);
    expect(hashSource({ dataFormat: 'JSX', source })).toBe('5057e7a9d4100a95');
  });

  it('keeps named JSX slots ahead of direct boolean and null props', async () => {
    const output = await extractFromVueSource(
      `
        import { Branch, Plural, T } from 'gt-vue';
        export const View = () => (
          <T>
            <Branch
              branch="formal"
              formal={false}
              casual={null}
              v-slots={{
                formal: () => 'Formal slot',
                casual: () => 'Casual slot',
              }}
            />
            <Plural
              n={1}
              one={false}
              other={null}
              v-slots={{
                one: () => 'One slot',
                other: () => 'Other slot',
              }}
            />
          </T>
        );
      `,
      '/project/src/View.jsx'
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toStrictEqual([
      {
        d: {
          b: { casual: 'Casual slot', formal: 'Formal slot' },
          t: 'b',
        },
        i: 1,
        t: 'Branch',
      },
      {
        d: { b: { one: 'One slot', other: 'Other slot' }, t: 'p' },
        i: 2,
        t: 'Plural',
      },
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
      {
        c: { c: 'Opaque transition child', i: 8, t: 'b' },
        i: 7,
        t: 'Transition',
      },
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
      name: 'scoped ordinary default slot',
      source: `<T><Card v-slots={{ default: (props) => <b>{props.label}</b> }} /></T>`,
      setup: `const Card = () => null;`,
      diagnostic: 'dynamic or scoped default slot',
    },
    {
      name: 'async ordinary default slot',
      source: `<T><Card v-slots={{ default: async () => <b>Hello</b> }} /></T>`,
      setup: `const Card = () => null;`,
      diagnostic: 'dynamic or scoped default slot',
    },
    {
      name: 'generator ordinary default slot',
      source: `<T><Card v-slots={{ *default() { return <b>Hello</b>; } }} /></T>`,
      setup: `const Card = () => null;`,
      diagnostic: 'dynamic or scoped default slot',
    },
    {
      name: 'unknown computed ordinary default slot',
      source: `<T><Card v-slots={{ [slotName]: () => <b>Hello</b> }} /></T>`,
      setup: `const Card = () => null; const slotName = getSlotName();`,
      diagnostic: 'dynamic slot name',
    },
    {
      name: 'spread ordinary slots',
      source: `<T><Card v-slots={{ ...slots, default: () => <b>Hello</b> }} /></T>`,
      setup: `const Card = () => null;`,
      diagnostic: 'spread in a component slots object',
    },
    {
      name: 'dynamic ordinary slots object',
      source: `<T><Card v-slots={getSlots()} /></T>`,
      setup: `const Card = () => null;`,
      diagnostic: 'dynamic v-slots',
    },
    {
      name: 'ordinary default slot with a dynamic body',
      source: `<T><Card v-slots={{ default() { prepare(); return <b>Hello</b>; } }} /></T>`,
      setup: `const Card = () => null;`,
      diagnostic: 'dynamic function body',
    },
    {
      name: 'scoped direct ordinary default slot',
      source: `<T><Card>{(props) => <b>{props.label}</b>}</Card></T>`,
      setup: `const Card = () => null;`,
      diagnostic: 'dynamic or scoped direct default slot',
    },
    {
      name: 'async direct ordinary default slot',
      source: `<T><Card>{async () => <b>Hello</b>}</Card></T>`,
      setup: `const Card = () => null;`,
      diagnostic: 'dynamic or scoped direct default slot',
    },
    {
      name: 'generator direct ordinary default slot',
      source: `<T><Card>{function* () { return <b>Hello</b>; }}</Card></T>`,
      setup: `const Card = () => null;`,
      diagnostic: 'dynamic or scoped direct default slot',
    },
    {
      name: 'direct ordinary default slot with a dynamic body',
      source: `<T><Card>{() => { prepare(); return <b>Hello</b>; }}</Card></T>`,
      setup: `const Card = () => null;`,
      diagnostic: 'dynamic function body',
    },
    {
      name: 'nested T in an ordinary component default slot',
      source: `<T><Card><T>Nested</T></Card></T>`,
      setup: `const Card = () => null;`,
      diagnostic: 'nested gt-vue <T>',
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
      name: 'spread branch props',
      source: `<T><Branch {...branches} /></T>`,
      diagnostic: 'spread prop',
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
