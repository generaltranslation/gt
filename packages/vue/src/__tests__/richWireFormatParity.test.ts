import { readFileSync } from 'node:fs';
import type { JsxChildren } from 'generaltranslation/types';
import { createSSRApp, h, type VNodeChild } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { Branch, Num, Plural, T, Var, createGT } from '../index';

type WireFormatFixture = {
  description: string;
  hash: string;
  id: keyof typeof sources;
  source: JsxChildren;
};

const sources = {
  'nested-element': () => [
    'Hello ',
    h('strong', null, ['wonderful ', h('em', null, 'world')]),
    '.',
  ],
  'typed-variables': () => [
    'Hello ',
    h(Var, null, { default: () => 'Ada' }),
    ', you have ',
    h(Num, { value: 3 }),
    ' messages.',
  ],
  'independent-branch-numbering': () => [
    h(
      Branch,
      { branch: 'formal' },
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
  'independent-plural-numbering': () => [
    h(
      Plural,
      { n: 2 },
      {
        default: () => 'Fallback',
        one: () => ['One ', h(Num, { value: 1 })],
        other: () => ['Many ', h(Num, { value: 2 })],
      }
    ),
    h('span', null, 'After'),
  ],
} satisfies Record<string, () => VNodeChild[]>;

const fixtures = JSON.parse(
  readFileSync(
    new URL(
      '../../../../test-fixtures/rich-content-wire-format.json',
      import.meta.url
    ),
    'utf8'
  )
) as WireFormatFixture[];

describe('shared rich-content wire format', () => {
  it.each(fixtures)('$id: $description', async (fixture) => {
    const translated = `translated-${fixture.id}`;
    const gt = createGT({
      locale: 'fr',
      loadTranslations: async () => ({ [fixture.hash]: translated }),
    });
    await gt.loadTranslations('fr');
    const app = createSSRApp({
      render: () =>
        h('div', null, [h(T, null, { default: sources[fixture.id] })]),
    });
    app.use(gt);

    expect(await renderToString(app)).toContain(translated);
  });
});
