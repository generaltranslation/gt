import { readFileSync } from 'node:fs';
import { hashSource } from 'generaltranslation/id';
import type { JsxChildren } from 'generaltranslation/types';
import { createSSRApp, h, type VNode, type VNodeChild } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { serializeVueChildren } from '../rendering/translateVueChildren';
import { Branch, Num, Plural, T, Var, createGT } from '../index';

type CatalogInteropCase = {
  alternateExpectedHtml?: string;
  expectedHtml: string;
  source: (alternate?: boolean) => VNodeChild[];
  target: JsxChildren;
};

const cases = {
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

type FixtureId = keyof typeof cases;

type WireFormatFixture = {
  description: string;
  hash: string;
  id: FixtureId;
  source: JsxChildren;
};

const fixtures = JSON.parse(
  readFileSync(
    new URL(
      '../../../../test-fixtures/rich-content-wire-format.json',
      import.meta.url
    ),
    'utf8'
  )
) as WireFormatFixture[];

describe('React-canonical rich catalog interoperability', () => {
  it.each(fixtures)('$id: $description', async (fixture) => {
    const testCase = cases[fixture.id];
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
      expect(hashSource({ dataFormat: 'JSX', source: serialized })).toBe(
        fixture.hash
      );

      const gt = createGT({
        locale: 'fr',
        loadTranslations: async () => ({ [fixture.hash]: testCase.target }),
      });
      await gt.loadTranslations('fr');
      const app = createSSRApp({
        render: () =>
          h('main', null, [
            h(T, null, { default: () => testCase.source(alternate) }),
          ]),
      });
      app.use(gt);

      const html = stripFragmentMarkers(await renderToString(app));
      expect(html).toBe(expectedHtml);
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

function stripFragmentMarkers(html: string): string {
  return html.replaceAll('<!--[-->', '').replaceAll('<!--]-->', '');
}
