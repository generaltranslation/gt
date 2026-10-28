import { readFileSync } from 'node:fs';
import type { JsxChildren } from '@generaltranslation/format/types';
import { hashContent } from 'gt-i18n/internal';
import {
  Branch as ReactBranch,
  Currency as ReactCurrency,
  DateTime as ReactDateTime,
  Num as ReactNum,
  Plural as ReactPlural,
  Var as ReactVar,
} from '@generaltranslation/react-core/components';
import { prepareT } from '@generaltranslation/react-core/components-rsc';
import { initializeI18nConfig as initializeReactI18nConfig } from '@generaltranslation/react-core/pure';
import * as React from 'react';
import { createElement, type ReactNode } from 'react';
import {
  Fragment,
  createSSRApp,
  createTextVNode,
  createVNode,
  defineComponent,
  h,
  type Component,
  type VNode,
  type VNodeChild,
} from 'vue';
import { renderToString } from 'vue/server-renderer';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  Branch,
  Currency,
  DateTime,
  Num,
  Plural,
  T,
  Var,
  createGT,
} from '../index';
import { serializeVueChildren } from '../rendering/translateVueChildren';
import { jsxHash, renderWithPlugin, stripFragmentMarkers } from './testUtils';
import { compileSfcTemplate } from './compileSfcTemplate';

// Each suite configures React in its own beforeAll: the suites below need
// different React tagging options and the React config is a singleton.

type ContractFixture = {
  context?: string;
  name: string;
  react: () => ReactNode;
  vue: {
    components?: Record<string, Component>;
    setup?: () => Record<string, unknown>;
    template: string;
  };
};

function DocsLink({ children }: { children?: ReactNode }): ReactNode {
  return createElement('a', null, children);
}

function Callout({ children }: { children?: ReactNode }): ReactNode {
  return createElement('aside', null, children);
}

const VueDocsLink = defineComponent({
  name: 'DocsLink',
  props: {
    to: { required: true, type: String },
  },
  setup(props, { slots }) {
    return () => h('a', { href: props.to }, slots.default?.());
  },
});

const VueCallout = defineComponent({
  name: 'Callout',
  setup(_props, { slots }) {
    return () => h('aside', slots.default?.());
  },
});

const fixtures: ContractFixture[] = [
  {
    name: 'plain text',
    react: () => createElement('p', null, 'Hello, world!'),
    vue: { template: '<T><p>Hello, world!</p></T>' },
  },
  {
    name: 'nested intrinsic elements and exact text boundaries',
    react: () =>
      createElement(
        'p',
        null,
        'Read ',
        createElement('strong', null, 'the docs'),
        ' today.'
      ),
    vue: {
      template: '<T><p>Read <strong>the docs</strong> today.</p></T>',
    },
  },
  {
    name: 'static custom-component children',
    react: () => createElement(DocsLink, { to: '/docs' }, 'Cannot access?'),
    vue: {
      components: { DocsLink: VueDocsLink },
      template: '<T><DocsLink to="/docs">Cannot access?</DocsLink></T>',
    },
  },
  {
    name: 'nested static custom-component content with a dynamic Var',
    react: () =>
      createElement(
        DocsLink,
        { to: '/docs' },
        createElement(
          'span',
          null,
          'Hello, ',
          createElement(ReactVar, null, 'Ada'),
          '!'
        )
      ),
    vue: {
      components: { DocsLink: VueDocsLink },
      setup: () => ({ name: 'Ada' }),
      template:
        '<T><DocsLink to="/docs"><span>Hello, <Var>{{ name }}</Var>!</span></DocsLink></T>',
    },
  },
  {
    name: 'nested custom components',
    react: () =>
      createElement(
        Callout,
        null,
        createElement(
          DocsLink,
          { to: '/docs' },
          'Read ',
          createElement('em', null, 'the guide')
        )
      ),
    vue: {
      components: { Callout: VueCallout, DocsLink: VueDocsLink },
      template:
        '<T><Callout><DocsLink to="/docs">Read <em>the guide</em></DocsLink></Callout></T>',
    },
  },
  {
    name: 'typed and untyped variables',
    react: () => [
      createElement(ReactVar, { key: 'var' }, 'Ada'),
      createElement(ReactNum, { key: 'num' }, 1234),
      createElement(ReactCurrency, { currency: 'USD', key: 'currency' }, 25),
      createElement(
        ReactDateTime,
        { key: 'date' },
        new Date('2025-01-01T00:00:00Z')
      ),
    ],
    vue: {
      setup: () => ({ date: new Date('2025-01-01T00:00:00Z'), name: 'Ada' }),
      template:
        '<T><Var>{{ name }}</Var><Num :value="1234"/><Currency currency="USD" :value="25"/><DateTime :value="date"/></T>',
    },
  },
  {
    name: 'Branch alternatives and fallback content',
    react: () =>
      createElement(
        ReactBranch,
        {
          branch: 'online',
          online: createElement('strong', null, 'Online'),
        },
        createElement('span', null, 'Unknown')
      ),
    vue: {
      template:
        '<T><Branch branch="online"><template #online><strong>Online</strong></template><span>Unknown</span></Branch></T>',
    },
  },
  {
    name: 'Plural alternatives and fallback content',
    react: () =>
      createElement(
        ReactPlural,
        {
          n: 2,
          one: createElement('span', null, 'One item'),
          other: createElement('span', null, 'Many items'),
        },
        createElement('span', null, 'Items')
      ),
    vue: {
      template:
        '<T><Plural :n="2"><template #one><span>One item</span></template><template #other><span>Many items</span></template><span>Items</span></Plural></T>',
    },
  },
  {
    name: 'custom components inside Branch alternatives',
    react: () =>
      createElement(
        ReactBranch,
        {
          branch: 'docs',
          docs: createElement(DocsLink, { to: '/docs' }, 'Read the docs'),
        },
        createElement('span', null, 'No destination')
      ),
    vue: {
      components: { DocsLink: VueDocsLink },
      template:
        '<T><Branch branch="docs"><template #docs><DocsLink to="/docs">Read the docs</DocsLink></template><span>No destination</span></Branch></T>',
    },
  },
  {
    name: 'Branch and Var inside a custom component',
    react: () =>
      createElement(
        Callout,
        null,
        createElement(
          ReactBranch,
          {
            branch: 'welcome',
            welcome: [
              'Welcome, ',
              createElement(ReactVar, { key: 'name' }, 'Ada'),
              '!',
            ],
          },
          'Welcome!'
        )
      ),
    vue: {
      components: { Callout: VueCallout },
      setup: () => ({ name: 'Ada' }),
      template:
        '<T><Callout><Branch branch="welcome"><template #welcome>Welcome, <Var>{{ name }}</Var>!</template>Welcome!</Branch></Callout></T>',
    },
  },
  {
    context: 'account navigation',
    name: 'static context',
    react: () => createElement('nav', null, 'Account'),
    vue: {
      template: '<T context="account navigation"><nav>Account</nav></T>',
    },
  },
];

describe('React-authoritative rich-content runtime contract', () => {
  beforeAll(() => {
    initializeReactI18nConfig({ defaultLocale: 'en' });
  });

  for (const fixture of fixtures) {
    it(`matches React's semantic wire and hash for ${fixture.name}`, async () => {
      const reactWire = prepareReactWire(fixture);
      const vueWire = await prepareVueWire(fixture);

      expect(normalizeSemanticWire(vueWire)).toEqual(
        normalizeSemanticWire(reactWire)
      );
      expect(jsxHash(vueWire, fixture.context)).toBe(
        jsxHash(reactWire, fixture.context)
      );
    });
  }

  it('keeps Var values out of the wire and hash', async () => {
    const fixture = fixtures.find(
      ({ name }) =>
        name === 'nested static custom-component content with a dynamic Var'
    );
    expect(fixture).toBeDefined();

    const first = await prepareVueWire(fixture!);
    const second = await prepareVueWire({
      ...fixture!,
      react: () =>
        createElement(
          DocsLink,
          { to: '/docs' },
          createElement(
            'span',
            null,
            'Hello, ',
            createElement(ReactVar, null, 'Grace'),
            '!'
          )
        ),
      vue: { ...fixture!.vue, setup: () => ({ name: 'Grace' }) },
    });

    expect(second).toEqual(first);
    expect(jsxHash(second)).toBe(jsxHash(first));
  });

  it('matches React text boundaries for adjacent Vue JSX Text VNodes', () => {
    // Source comments are deliberately outside this portable contract: Vue's
    // production compiler removes both the comment and its text boundary.
    const reactWire = prepareT({
      locale: 'en',
      params: {},
      sourceChildren: createElement('p', null, 'Before', 'After'),
    }).sourceJsxChildren;
    const vueWire = serializeVueChildren([
      h('p', null, [createTextVNode('Before'), createTextVNode('After')]),
    ]);

    expect(normalizeSemanticWire(vueWire)).toEqual(
      normalizeSemanticWire(reactWire)
    );
    expect(jsxHash(vueWire)).toBe(jsxHash(reactWire));
  });

  it('documents HTML source-comment boundaries as non-portable', async () => {
    const fixture: ContractFixture = {
      name: 'source comment boundary',
      react: () => createElement('p', null, 'Before', 'After'),
      vue: {
        template: '<T><p>Before<!-- source boundary -->After</p></T>',
      },
    };
    const reactWire = prepareReactWire(fixture);
    const developmentWire = await prepareVueWire(fixture, true);
    const productionWire = await prepareVueWire(fixture, false);

    expect(normalizeSemanticWire(developmentWire)).toEqual(
      normalizeSemanticWire(reactWire)
    );
    expect(normalizeSemanticWire(productionWire)).toEqual({
      i: 1,
      c: 'BeforeAfter',
    });
    expect(jsxHash(productionWire)).not.toBe(jsxHash(developmentWire));
  });

  it('renders React-keyed translations inside a custom component', async () => {
    const fixture = fixtures.find(
      ({ name }) => name === 'static custom-component children'
    );
    expect(fixture).toBeDefined();
    const reactWire = prepareReactWire(fixture!);
    const reactHash = jsxHash(reactWire);
    const target: JsxChildren = {
      t: 'DocsLink',
      i: 1,
      c: 'Accéder à la documentation',
    };
    const plugin = createGT({
      locale: 'fr',
      loadTranslations: async () => ({ [reactHash]: target }),
    });
    await plugin.loadTranslations('fr');
    const Root = defineComponent({
      components: { DocsLink: VueDocsLink, T },
      render: compileSfcTemplate(
        '<T><DocsLink to="/docs">Cannot access?</DocsLink></T>'
      ),
    });

    const html = await renderWithPlugin(Root, plugin);

    expect(html).toContain('<a href="/docs">Accéder à la documentation</a>');
    expect(html).not.toContain('Cannot access?');
  });
});

function prepareReactWire(fixture: ContractFixture): JsxChildren {
  return prepareT({
    locale: 'en',
    params: fixture.context ? { context: fixture.context } : {},
    sourceChildren: fixture.react(),
  }).sourceJsxChildren;
}

async function prepareVueWire(
  fixture: ContractFixture,
  comments = true
): Promise<JsxChildren> {
  let sourceChildren: VNode[] | undefined;
  const ProbeT = defineComponent({
    name: 'T',
    setup(_props, { slots }) {
      return () => {
        sourceChildren = slots.default?.() ?? [];
        return null;
      };
    },
  });
  const Root = defineComponent({
    components: {
      Branch,
      Currency,
      DateTime,
      Num,
      Plural,
      T: ProbeT,
      Var,
      ...fixture.vue.components,
    },
    render: compileSfcTemplate(fixture.vue.template, comments),
    setup: fixture.vue.setup,
  });

  await renderToString(createSSRApp(Root));
  expect(sourceChildren).toBeDefined();
  return serializeVueChildren(sourceChildren!);
}

/**
 * Removes only diagnostic element labels before comparing framework wires.
 *
 * React function names can be minified and Vue component names can be inferred,
 * so `t` is deliberately ignored by `hashSource()` and by runtime ID binding.
 * IDs, nesting, translated props, branch data, and variable identities remain
 * exact in this comparison.
 */
function normalizeSemanticWire(source: JsxChildren): unknown {
  if (Array.isArray(source)) return source.map(normalizeSemanticWire);
  if (typeof source === 'string') return source;
  if ('k' in source) {
    return {
      i: source.i,
      k: source.k,
      ...(source.v && { v: source.v }),
    };
  }

  return {
    i: source.i,
    ...(source.d && {
      d: {
        ...source.d,
        ...(source.d.b && {
          b: Object.fromEntries(
            Object.entries(source.d.b).map(([key, branch]) => [
              key,
              normalizeSemanticWire(branch),
            ])
          ),
        }),
      },
    }),
    ...(source.c !== undefined && { c: normalizeSemanticWire(source.c) }),
  };
}

describe('React-authoritative rich runtime shape', () => {
  beforeAll(() => {
    initializeReactI18nConfig({ _tagIds: false, defaultLocale: 'en' });
  });

  it('preserves an authored JSX Fragment as a semantic element', () => {
    expectParity(
      React.createElement(
        React.Fragment,
        null,
        React.createElement('span', null, 'Fragment child')
      ),
      [h(Fragment, null, [h('span', null, 'Fragment child')])],
      '602b5785aa5dc023'
    );
  });

  it('preserves every child of an authored multi-child JSX Fragment', () => {
    expectParity(
      React.createElement(
        React.Fragment,
        null,
        React.createElement('b', null, 'Hello'),
        React.createElement('em', null, 'World')
      ),
      [
        h(Fragment, null, [
          h('b', null, [createTextVNode('Hello')]),
          h('em', null, [createTextVNode('World')]),
        ]),
      ],
      '575ba7a0e3903be4'
    );
  });

  it('preserves an explicit empty array inside an authored JSX Fragment', () => {
    expectParity(
      React.createElement(React.Fragment, null, []),
      [h(Fragment, null, [[]])],
      '9ff224ca1118e4df'
    );
  });

  it('preserves compiler structural Fragments as transparent arrays', () => {
    expectParity([], [createVNode(Fragment, null, [], 64)], 'bdb7cc7686d0e468');
    expectParity(
      [React.createElement('span', { key: 'one' }, 'One')],
      [createVNode(Fragment, null, [h('span', { key: 'one' }, 'One')], 64)],
      'db8f4cf2c0cbdeea'
    );
    expectParity(
      [
        React.createElement('span', { key: 'one' }, 'One'),
        React.createElement('span', { key: 'two' }, 'Two'),
      ],
      [
        createVNode(
          Fragment,
          null,
          [h('span', { key: 'one' }, 'One'), h('span', { key: 'two' }, 'Two')],
          64
        ),
      ],
      'da0189970ce80427'
    );
  });

  it('renders structural Fragment arrays in source and translated locales', async () => {
    const Root = defineComponent({
      setup() {
        return () => [
          h(T, null, {
            default: () => [createVNode(Fragment, null, [], 64)],
          }),
          h(T, null, {
            default: () => [
              createVNode(
                Fragment,
                null,
                [h('span', { key: 'one' }, 'One')],
                64
              ),
            ],
          }),
          h(T, null, {
            default: () => [
              createVNode(
                Fragment,
                null,
                [
                  h('span', { key: 'one' }, 'One'),
                  h('span', { key: 'two' }, 'Two'),
                ],
                64
              ),
            ],
          }),
        ];
      },
    });

    expect(stripFragmentMarkers(await renderWithPlugin(Root, createGT()))).toBe(
      '<span>One</span><span>One</span><span>Two</span>'
    );

    const translated = createGT({
      loadTranslations: async () => ({
        bdb7cc7686d0e468: ['Translated empty'],
        db8f4cf2c0cbdeea: [{ t: 'span', i: 1, c: 'Un' }],
        da0189970ce80427: [
          { t: 'span', i: 2, c: 'Deux' },
          { t: 'span', i: 1, c: 'Un' },
        ],
      }),
    });
    await translated.setLocale('fr');

    expect(stripFragmentMarkers(await renderWithPlugin(Root, translated))).toBe(
      'Translated empty<span>Un</span><span>Deux</span><span>Un</span>'
    );
  });

  it('distinguishes a nested numeric zero from the string zero', () => {
    expectParity(
      React.createElement(React.Fragment, null, 0),
      [h(Fragment, null, [0])],
      'a013c005483cdd19'
    );
    expectParity(
      React.createElement(React.Fragment, null, '0'),
      [h(Fragment, null, ['0'])],
      '246d388a23db9248'
    );
    // The same scalars authored through a Fragment default slot.
    expectParity(
      React.createElement(React.Fragment, null, 0),
      [h(Fragment, null, { default: () => 0 })],
      'a013c005483cdd19'
    );
    expectParity(
      React.createElement(React.Fragment, null, '0'),
      [h(Fragment, null, { default: () => '0' })],
      '246d388a23db9248'
    );
  });

  it('distinguishes a missing slot from an explicit empty root array', () => {
    expectParity(undefined, undefined, '309dc626c8db3d4c');
    expectParity(undefined, [], '309dc626c8db3d4c');
    expectParity([], [[]], 'bdb7cc7686d0e468');
  });

  it('preserves scalar boolean and null wire values but drops array members', () => {
    expectParity(true, [true]);
    expectParity(false, [false]);
    expectParity(null, [null]);
    expectParity([true], [[true]]);
    expectParity([false], [[false]]);
    expectParity([null], [[null]]);
  });

  it('looks up scalar boolean and null T slots by their React hashes', async () => {
    const sources = [true, false, null] as const;
    const plugin = createGT({
      loadTranslations: async () =>
        Object.fromEntries(
          sources.map((source, index) => [
            jsxHash(getReactWire(source)),
            `Translated ${index}`,
          ])
        ),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () =>
          sources.map((source) => h(T, null, { default: () => [source] }));
      },
    });

    expect(stripFragmentMarkers(await renderWithPlugin(Root, plugin))).toBe(
      'Translated 0Translated 1Translated 2'
    );
  });

  it('looks up missing and explicit-empty T slots with distinct hashes', async () => {
    const plugin = createGT({
      loadTranslations: async () => ({
        '309dc626c8db3d4c': 'Missing slot',
        bdb7cc7686d0e468: 'Empty array',
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () => [
          h(T),
          h(T, null, { default: () => [] }),
          h(T, null, { default: () => [[]] }),
        ];
      },
    });

    expect(stripFragmentMarkers(await renderWithPlugin(Root, plugin))).toBe(
      'Missing slotMissing slotEmpty array'
    );
  });

  it('documents Vue normalization of outer arrays and Fragments', async () => {
    expect(await normalizeSlot([['x']])).toStrictEqual(
      await normalizeSlot([h(Fragment, null, ['x'])])
    );
    expect(await normalizeSlot([[]])).not.toStrictEqual(
      await normalizeSlot([h(Fragment)])
    );
  });

  it('reads the raw T slot before Vue erases root JSX shape', async () => {
    expectParity('x', ['x'], '05fe82bcca221d7f');
    expectParity(['x'], [['x']], '18d8d88a83f23215');
    expectParity(
      React.createElement(React.Fragment, null, 'x'),
      [h(Fragment, null, ['x'])],
      '0fe162f7e63e2abe'
    );

    const plugin = createGT({
      loadTranslations: async () => ({
        '05fe82bcca221d7f': 'Scalar',
        '18d8d88a83f23215': 'Array',
        '0fe162f7e63e2abe': 'Fragment',
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () => [
          // Exact default-slot return shapes emitted by @vue/babel-plugin-jsx
          // for `{'x'}`, `{['x']}`, and `<>x</>`, respectively.
          h(T, null, { default: () => ['x'] }),
          h(T, null, { default: () => [['x']] }),
          h(T, null, { default: () => [h(Fragment, null, ['x'])] }),
        ];
      },
    });

    expect(stripFragmentMarkers(await renderWithPlugin(Root, plugin))).toBe(
      'ScalarArrayFragment'
    );
  });

  it('preserves programmatic non-slot array cardinality', async () => {
    const plugin = createGT({
      loadTranslations: async () => ({
        '05fe82bcca221d7f': 'Scalar',
        '18d8d88a83f23215': 'Array',
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () => [h(T, null, 'x'), h(T, null, ['x'])];
      },
    });

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(stripFragmentMarkers(await renderWithPlugin(Root, plugin))).toBe(
        'ScalarArray'
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('preserves explicit arrays after Vue JSX wraps the expression', () => {
    // These are the exact createVNode child arguments emitted by the official
    // @vue/babel-plugin-jsx transform: scalar {'x'} becomes ['x'], while an
    // authored array expression {['x']} remains nested as [['x']].
    expectParity(
      React.createElement('div', null, []),
      [h('div', null, [[]])],
      '9ff224ca1118e4df'
    );
    expectParity(
      React.createElement('div', null, ['x']),
      [h('div', null, [['x']])],
      '101bcee0069a7b83'
    );
    expectParity(
      React.createElement('div', null, [0]),
      [h('div', null, [[0]])],
      'c9c9cd7f3378429f'
    );
  });

  it('distinguishes an explicit empty custom-component array from no slot', () => {
    function Card(): React.ReactNode {
      return null;
    }
    const VueCard = defineComponent({ name: 'Card', render: () => null });

    expectParity(React.createElement(Card, null, []), [
      h(VueCard, null, { default: () => [[]] }),
    ]);
    expectParity(React.createElement(Card), [h(VueCard)]);
  });

  it('flattens the normalized slot wrapper for a Vue JSX function child', () => {
    function Card(): React.ReactNode {
      return null;
    }
    const VueCard = defineComponent({ name: 'Card', render: () => null });

    // @vue/babel-plugin-jsx compiles `{() => <b>Hello</b>}` as Card's direct
    // default slot. That wrapper is not a semantic Fragment in the catalog.
    expectParity(
      React.createElement(Card, null, React.createElement('b', null, 'Hello')),
      [
        h(VueCard, null, {
          default: () => h('b', null, [createTextVNode('Hello')]),
        }),
      ],
      '1c3760937a26bcbd'
    );
    // A default slot returning an array collapses the same way.
    expectParity(
      React.createElement(Card, null, React.createElement('b', null, 'Hello')),
      [h(VueCard, null, { default: () => [h('b', null, 'Hello')] })],
      '1c3760937a26bcbd'
    );
  });

  it('uses React truthiness gates for translated children and content props', async () => {
    expect(await renderOrdinaryTarget({ c: '', d: { ti: 'Target' } })).toBe(
      '<span title="Source">Source child</span>'
    );
    expect(
      await renderOrdinaryTarget({ c: 'Target child', d: { ti: '' } })
    ).toBe('<span title="Source">Target child</span>');
    expect(
      await renderOrdinaryTarget({
        c: 'Target child',
        d: { ti: 'Target' },
      })
    ).toBe('<span title="Target">Target child</span>');
    expect(
      await renderOrdinaryTarget({ c: 'Target child', d: { ti: 'Target' } }, '')
    ).toBe('<span title="Source"></span>');
  });

  it('uses React lookup identity for documented T metadata and aliases', async () => {
    const documentedSource = 'Documented runtime metadata';
    const documentedParams = {
      context: 'documented context',
      id: 'documented-id',
      maxChars: 32,
      requiresReview: true,
    };
    const aliasSource = 'Alias runtime metadata';
    const aliasParams = {
      $context: 'alias context',
      $id: 'alias-id',
      $maxChars: -18,
      $requiresReview: true,
    };
    const zeroSource = 'Zero max chars metadata';
    const falseReviewSource = 'False review metadata';
    const duplicateAliasSource = 'Duplicate alias metadata';
    const duplicateAliasParams = {
      $maxChars: 7,
      $requiresReview: false,
      maxChars: 12,
      requiresReview: true,
    };
    const documentedHash = getReactLookupHash(
      documentedSource,
      documentedParams
    );
    const aliasHash = getReactLookupHash(aliasSource, aliasParams);

    expect(getReactLookupHash(documentedSource, { id: 'ignored-id' })).toBe(
      getReactLookupHash(documentedSource)
    );
    expect(getReactLookupHash(documentedSource, { $id: 'ignored-alias' })).toBe(
      getReactLookupHash(documentedSource)
    );
    expect(getReactLookupHash(documentedSource, { maxChars: 0 })).not.toBe(
      getReactLookupHash(documentedSource)
    );
    expect(getReactLookupHash(documentedSource, { maxChars: -18 })).toBe(
      getReactLookupHash(documentedSource, { maxChars: 18 })
    );
    expect(getReactLookupHash(documentedSource, { maxChars: 32 })).not.toBe(
      getReactLookupHash(documentedSource)
    );
    expect(
      getReactLookupHash(documentedSource, { requiresReview: true })
    ).not.toBe(getReactLookupHash(documentedSource));
    expect(
      getReactLookupHash(documentedSource, { requiresReview: false })
    ).toBe(getReactLookupHash(documentedSource));

    const plugin = createGT({
      loadTranslations: async () => ({
        [aliasHash]: 'Alias runtime target',
        [documentedHash]: 'Documented runtime target',
        [getReactLookupHash(duplicateAliasSource, duplicateAliasParams)]:
          'Dollar aliases take precedence',
        [getReactLookupHash(falseReviewSource, {
          requiresReview: false,
        })]: 'False review target',
        [getReactLookupHash(zeroSource, { maxChars: 0 })]:
          'Zero max chars target',
        explicitMetadataHash: 'Explicit hash target',
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () => [
          h(T, documentedParams, { default: () => documentedSource }),
          h(T, aliasParams, { default: () => aliasSource }),
          h(T, { maxChars: 0 }, { default: () => zeroSource }),
          h(T, { requiresReview: false }, { default: () => falseReviewSource }),
          h(T, duplicateAliasParams, {
            default: () => duplicateAliasSource,
          }),
          h(
            T,
            {
              _hash: 'explicitMetadataHash',
              context: 'ignored by the explicit hash',
              maxChars: 1,
              requiresReview: true,
            },
            { default: () => 'Explicit hash source' }
          ),
        ];
      },
    });

    expect(stripFragmentMarkers(await renderWithPlugin(Root, plugin))).toBe(
      'Documented runtime targetAlias runtime targetZero max chars targetFalse review targetDollar aliases take precedenceExplicit hash target'
    );
  });

  it('passes documented T metadata and dollar aliases through SFC templates', async () => {
    const documentedSource = 'Documented SFC metadata';
    const aliasSource = 'Alias SFC metadata';
    const bareCamelReviewSource = 'Bare camel review metadata';
    const bareKebabReviewSource = 'Bare kebab review metadata';
    const falseReviewSource = 'Explicit false review metadata';
    const documentedParams = {
      context: 'documented SFC context',
      id: 'documented-sfc-id',
      maxChars: 24,
      requiresReview: true,
    };
    const aliasParams = {
      $context: 'alias SFC context',
      $id: 'alias-sfc-id',
      $maxChars: 16,
      $requiresReview: true,
    };
    const plugin = createGT({
      loadTranslations: async () => ({
        [getReactLookupHash(aliasSource, aliasParams)]: 'Alias SFC target',
        [getReactLookupHash(bareCamelReviewSource, {
          $requiresReview: true,
        })]: 'Bare camel review target',
        [getReactLookupHash(bareKebabReviewSource, {
          $requiresReview: true,
        })]: 'Bare kebab review target',
        [getReactLookupHash(documentedSource, documentedParams)]:
          'Documented SFC target',
        [getReactLookupHash(falseReviewSource, {
          $requiresReview: false,
          requiresReview: true,
        })]: 'Explicit false review target',
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      components: { T },
      render: compileSfcTemplate(
        '<main><T context="documented SFC context" id="documented-sfc-id" :max-chars="24" requires-review>Documented SFC metadata</T><T $context="alias SFC context" $id="alias-sfc-id" :$max-chars="16" :$requires-review="true">Alias SFC metadata</T><T $requiresReview>Bare camel review metadata</T><T $requires-review>Bare kebab review metadata</T><T requires-review :$requires-review="false">Explicit false review metadata</T></main>'
      ),
    });

    expect(stripFragmentMarkers(await renderWithPlugin(Root, plugin))).toBe(
      '<main>Documented SFC targetAlias SFC targetBare camel review targetBare kebab review targetExplicit false review target</main>'
    );
  });
});

type ReactTParams = Parameters<typeof prepareT>[0]['params'];

function getReactLookupHash(
  sourceChildren: React.ReactNode,
  params: Record<string, unknown> = {}
): string {
  // gt-vue's `$` aliases take precedence and map to React's unprefixed T props.
  const reactParams = Object.fromEntries(
    Object.entries(params)
      .sort(([a], [b]) => Number(a.startsWith('$')) - Number(b.startsWith('$')))
      .map(([key, value]) => [key.replace(/^\$/, ''), value])
  ) as ReactTParams;
  const prepared = prepareT({
    locale: 'fr',
    params: reactParams,
    sourceChildren,
  });
  return hashContent(prepared.sourceJsxChildren, prepared.targetOptions);
}

function getReactWire(sourceChildren: React.ReactNode): JsxChildren {
  return prepareT({
    locale: 'en',
    params: {},
    sourceChildren,
  }).sourceJsxChildren;
}

function expectParity(
  reactChildren: React.ReactNode,
  vueChildren: unknown,
  expectedHash?: string
): void {
  const reactWire = getReactWire(reactChildren);
  const vueWire = serializeVueChildren(vueChildren);

  // React leaves optional `d: undefined` properties on its in-memory objects;
  // persisted catalogs and Vue omit them. Compare the JSON wire that is
  // actually hashed, uploaded, and loaded at runtime.
  expect(toJsonWire(vueWire)).toStrictEqual(toJsonWire(reactWire));
  expect(jsxHash(vueWire)).toBe(jsxHash(reactWire));
  if (expectedHash) expect(jsxHash(vueWire)).toBe(expectedHash);
}

function toJsonWire(source: JsxChildren): unknown {
  if (source === undefined) return undefined;
  return JSON.parse(JSON.stringify(source)) as unknown;
}

async function renderOrdinaryTarget(
  target: JsxChildren,
  sourceChild = 'Source child'
): Promise<string> {
  const plugin = createGT({
    loadTranslations: async () => ({ truthiness: target }),
  });
  await plugin.setLocale('fr');
  const Root = defineComponent({
    setup() {
      return () =>
        h(
          T,
          { _hash: 'truthiness' },
          {
            default: () => h('span', { title: 'Source' }, sourceChild),
          }
        );
    },
  });

  return stripFragmentMarkers(await renderWithPlugin(Root, plugin));
}

async function normalizeSlot(rawChildren: unknown[]): Promise<unknown> {
  let normalized: unknown;
  const Probe = defineComponent({
    setup(_props, { slots }) {
      return () => {
        normalized = slots.default?.().map((child) => ({
          children: child.children,
          patchFlag: child.patchFlag,
          shapeFlag: child.shapeFlag,
          type: child.type === Fragment ? 'Fragment' : String(child.type),
        }));
        return null;
      };
    },
  });
  const Root = defineComponent({
    setup() {
      return () => h(Probe, null, { default: () => rawChildren });
    },
  });

  await renderToString(createSSRApp(Root));
  return normalized;
}

type CatalogInteropCase = {
  alternateExpectedHtml?: string;
  expectedHtml: string;
  source: (alternate?: boolean) => VNodeChild[];
  target: JsxChildren;
};

const catalogCases = {
  'nested-element': {
    source: () => [
      'Hello ',
      h('strong', null, ['wonderful ', h('em', null, 'world')]),
      '.',
    ],
    target: [
      'Deux fois: ',
      {
        t: 'x',
        i: 1,
        c: [
          { t: 'x', i: 2, c: 'monde' },
          ' puis ',
          { t: 'x', i: 2, c: 'encore' },
        ],
      },
      ' / ',
      { t: 'x', i: 1, c: 'fin' },
      '.',
    ],
    expectedHtml:
      '<main>Deux fois: <strong><em>monde</em> puis <em>encore</em></strong> / <strong>fin</strong>.</main>',
  },
  'typed-variables': {
    source: () => [
      'Hello ',
      h(Var, null, { default: () => 'Ada' }),
      ', you have ',
      h(Num, { value: 3 }),
      ' messages.',
    ],
    target: [
      { k: '_gt_n_2', v: 'n' },
      ' messages pour ',
      { k: '_gt_value_1', v: 'v' },
      '; encore ',
      { k: '_gt_n_2', v: 'n' },
      ' pour ',
      { k: '_gt_value_1', v: 'v' },
      '.',
    ],
    expectedHtml: '<main>3 messages pour Ada; encore 3 pour Ada.</main>',
  },
  'independent-branch-numbering': {
    source: (alternate = false) => [
      h(
        Branch,
        { branch: alternate ? 'casual' : 'formal' },
        {
          casual: () => [
            h('em', null, 'Hi'),
            ' ',
            h(Var, null, { default: () => 'Ada' }),
          ],
          default: () => 'Fallback',
          formal: () => [
            h('strong', null, 'Hello'),
            ' ',
            h(Var, null, { default: () => 'Ada' }),
          ],
        }
      ),
      h('span', null, 'After'),
    ],
    target: [
      { t: 'x', i: 2, c: 'Avant' },
      ' | ',
      {
        t: 'x',
        i: 1,
        d: {
          t: 'b',
          b: {
            casual: [
              { k: '_gt_value_3', v: 'v' },
              ' dit ',
              { t: 'x', i: 2, c: 'Salut' },
            ],
            formal: [
              { k: '_gt_value_3', v: 'v' },
              ' dit ',
              { t: 'x', i: 2, c: 'Bonjour' },
              ' et ',
              { t: 'x', i: 2, c: 'salut' },
            ],
          },
        },
        c: 'Secours',
      },
      ' | ',
      { t: 'x', i: 2, c: 'Après' },
    ],
    expectedHtml:
      '<main><span>Avant</span> | Ada dit <strong>Bonjour</strong> et <strong>salut</strong> | <span>Après</span></main>',
    alternateExpectedHtml:
      '<main><span>Avant</span> | Ada dit <em>Salut</em> | <span>Après</span></main>',
  },
  'independent-plural-numbering': {
    source: (alternate = false) => [
      h(
        Plural,
        { n: alternate ? 1 : 2 },
        {
          default: () => 'Fallback',
          one: () => ['One ', h(Num, { value: 1 })],
          other: () => ['Many ', h(Num, { value: 2 })],
        }
      ),
      h('span', null, 'After'),
    ],
    target: [
      { t: 'x', i: 2, c: 'Début' },
      ' | ',
      {
        t: 'x',
        i: 1,
        d: {
          t: 'p',
          b: {
            one: ['Un: ', { k: '_gt_n_2', v: 'n' }],
            other: [
              { k: '_gt_n_2', v: 'n' },
              ' éléments + ',
              { k: '_gt_n_2', v: 'n' },
            ],
          },
        },
        c: 'Secours',
      },
      ' | ',
      { t: 'x', i: 2, c: 'Fin' },
    ],
    expectedHtml:
      '<main><span>Début</span> | 2 éléments + 2 | <span>Fin</span></main>',
    alternateExpectedHtml:
      '<main><span>Début</span> | Un: 1 | <span>Fin</span></main>',
  },
} satisfies Record<string, CatalogInteropCase>;

type FixtureId = keyof typeof catalogCases;

type WireFormatFixture = {
  description: string;
  hash: string;
  id: FixtureId;
  source: JsxChildren;
};

const wireFormatFixtures = JSON.parse(
  readFileSync(
    new URL(
      '../../../../test-fixtures/rich-content-wire-format.json',
      import.meta.url
    ),
    'utf8'
  )
) as WireFormatFixture[];

describe('React-canonical rich catalog interoperability', () => {
  it.each(wireFormatFixtures)('$id: $description', async (fixture) => {
    const testCase = catalogCases[fixture.id];
    const expectedRenders = [
      testCase.expectedHtml,
      ...(testCase.alternateExpectedHtml
        ? [testCase.alternateExpectedHtml]
        : []),
    ];

    for (const [index, expectedHtml] of expectedRenders.entries()) {
      const alternate = index > 0;
      const sourceChildren = testCase.source(alternate);
      const serialized = serializeVueChildren(sourceChildren as VNode[]);

      // Component labels can be minified independently in React and Vue. IDs,
      // variable records, and d.t branch metadata remain part of the contract.
      expect(removeElementLabels(serialized)).toStrictEqual(
        removeElementLabels(fixture.source)
      );
      expect(jsxHash(serialized)).toBe(fixture.hash);

      const gt = createGT({
        locale: 'fr',
        loadTranslations: async () => ({ [fixture.hash]: testCase.target }),
      });
      await gt.loadTranslations('fr');
      const Root = defineComponent({
        render: () =>
          h('main', null, [
            h(T, null, { default: () => testCase.source(alternate) }),
          ]),
      });

      expect(stripFragmentMarkers(await renderWithPlugin(Root, gt))).toBe(
        expectedHtml
      );
    }
  });
});

function removeElementLabels(children: JsxChildren): JsxChildren {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(removeElementLabels);
  if ('k' in children) return children;

  const { t: _elementLabel, ...element } = children;
  return {
    ...element,
    ...(element.c !== undefined && { c: removeElementLabels(element.c) }),
    ...(element.d?.b !== undefined && {
      d: {
        ...element.d,
        b: Object.fromEntries(
          Object.entries(element.d.b).map(([key, branch]) => [
            key,
            removeElementLabels(branch),
          ])
        ),
      },
    }),
  };
}
