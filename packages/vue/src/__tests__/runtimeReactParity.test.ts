import { prepareT } from '@generaltranslation/react-core/components-rsc';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { hashSource } from 'generaltranslation/id';
import type { JsxChildren } from 'generaltranslation/types';
import * as React from 'react';
import {
  Fragment,
  createSSRApp,
  createTextVNode,
  createVNode,
  defineComponent,
  h,
  type Component,
} from 'vue';
import { renderToString } from 'vue/server-renderer';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { T, createGT } from '../index';
import { serializeVueChildren } from '../rendering/translateVueChildren';

beforeAll(() => {
  initializeI18nConfig({ _tagIds: false, defaultLocale: 'en' });
});

describe('React-authoritative rich runtime shape', () => {
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
            richHash(getReactWire(source)),
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

    expect(
      (await renderToString(createSSRApp(Root).use(plugin)))
        .replaceAll('<!--[-->', '')
        .replaceAll('<!--]-->', '')
    ).toBe('Translated 0Translated 1Translated 2');
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

    expect(
      (await renderToString(createSSRApp(Root).use(plugin)))
        .replaceAll('<!--[-->', '')
        .replaceAll('<!--]-->', '')
    ).toBe('Missing slotMissing slotEmpty array');
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

    expect(
      (await renderToString(createSSRApp(Root).use(plugin)))
        .replaceAll('<!--[-->', '')
        .replaceAll('<!--]-->', '')
    ).toBe('ScalarArrayFragment');
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
      expect(
        (await renderToString(createSSRApp(Root).use(plugin)))
          .replaceAll('<!--[-->', '')
          .replaceAll('<!--]-->', '')
      ).toBe('ScalarArray');
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
});

function getReactWire(sourceChildren: React.ReactNode): JsxChildren {
  return prepareT({
    locale: 'en',
    params: {},
    sourceChildren,
  }).sourceJsxChildren;
}

function richHash(source: JsxChildren): string {
  return hashSource({ dataFormat: 'JSX', source });
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
  expect(richHash(vueWire)).toBe(richHash(reactWire));
  if (expectedHash) expect(richHash(vueWire)).toBe(expectedHash);
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

  return (await renderToString(createSSRApp(Root).use(plugin)))
    .replaceAll('<!--[-->', '')
    .replaceAll('<!--]-->', '');
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

async function renderWithPlugin(
  root: Component,
  plugin: ReturnType<typeof createGT>
): Promise<string> {
  return renderToString(createSSRApp(root).use(plugin));
}

function stripFragmentMarkers(html: string): string {
  return html.replaceAll('<!--[-->', '').replaceAll('<!--]-->', '');
}
