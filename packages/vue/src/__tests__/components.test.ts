import {
  Branch as ReactBranch,
  Plural as ReactPlural,
  Var as ReactVar,
  prepareT as prepareReactT,
  renderTranslatedChildren as renderReactTranslatedChildren,
} from '@generaltranslation/react-core/components-rsc';
import { initializeI18nConfig as initializeReactI18nConfig } from '@generaltranslation/react-core/pure';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { JsxChildren } from 'generaltranslation/types';
import * as React from 'react';
import {
  compile,
  createSSRApp,
  defineComponent,
  h,
  type Component,
  type VNode,
  type VNodeChild,
} from 'vue';
import { renderToString } from 'vue/server-renderer';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { getFormatLocales, isBranchAttribute } from '../components/utils';
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

type BranchTransformation = 'branch' | 'plural';
type BranchSourceValue =
  | 'rich'
  | 'rich siblings'
  | boolean
  | null
  | number
  | string;
type BranchTargetValue = JsxChildren;

const BRANCH_SOURCE_CASES = [
  { label: 'rich node', value: 'rich' },
  { label: 'two rich siblings', value: 'rich siblings' },
  { label: 'true', value: true },
  { label: 'positive number', value: 1 },
  { label: 'nonempty string', value: 'SOURCE TEXT' },
  { label: 'false', value: false },
  { label: 'null', value: null },
  { label: 'zero', value: 0 },
  { label: 'negative zero', value: -0 },
  { label: 'empty string', value: '' },
  { label: 'NaN', value: Number.NaN },
] as const satisfies ReadonlyArray<{
  label: string;
  value: BranchSourceValue;
}>;

const BRANCH_TARGET_CASES = [
  { label: 'true', value: true },
  { label: 'false', value: false },
  { label: 'null', value: null },
  { label: 'string', value: 'TARGET STRING' },
  { label: 'string array', value: ['TARGET A', 'TARGET B'] },
  {
    label: 'single element',
    value: { t: 'span', i: 2, c: 'TARGET ELEMENT' },
  },
  {
    label: 'single variable',
    value: { i: 3, k: '_gt_value_3', v: 'v' },
  },
] as const satisfies ReadonlyArray<{
  label: string;
  value: BranchTargetValue;
}>;

const BRANCH_RENDER_MATRIX = BRANCH_SOURCE_CASES.flatMap((source) =>
  BRANCH_TARGET_CASES.map((target) => ({ source, target }))
);

describe('Branch and Plural attributes', () => {
  beforeAll(() => {
    initializeReactI18nConfig({ defaultLocale: 'en' });
  });

  it('accepts primitive branch attributes', () => {
    const attributes: [string, unknown][] = [
      ['formal', 'Welcome'],
      ['count', 12],
      ['large', 12n],
      ['flag', false],
      ['enabled', true],
      ['empty', null],
      ['one', 'Singular'],
    ];

    expect(
      attributes.filter(([name, value]) => !isBranchAttribute(name, value))
    ).toEqual([]);
  });

  it('preserves direct boolean and null Branch attributes in the rich wire source', () => {
    const source = serializeVueChildren([
      h(Branch, {
        active: true,
        branch: 'active',
        inactive: false,
        pending: '',
        unknown: null,
      }),
    ]);

    expect(source).toEqual({
      t: 'Branch',
      i: 1,
      d: {
        b: {
          active: true,
          inactive: false,
          pending: '',
          unknown: null,
        },
        t: 'b',
      },
    });
  });

  it('preserves primitive accepted Plural forms and rejects other attributes in the rich wire source', () => {
    const source = serializeVueChildren([
      h(Plural, {
        few: '',
        ignored: true,
        many: 0,
        n: 1,
        one: true,
        other: 'false',
        two: null,
        zero: false,
      }),
    ]);

    expect(source).toEqual({
      t: 'Plural',
      i: 1,
      d: {
        b: {
          few: '',
          many: '0',
          one: true,
          other: 'false',
          two: null,
          zero: false,
        },
        t: 'p',
      },
    });
  });

  it('serializes Branch and Plural named slots before same-name primitive attributes', () => {
    const source = serializeVueChildren([
      h(
        Branch,
        { branch: 'formal', formal: false },
        {
          default: () => 'Fallback',
          formal: () => 'Named slot',
        }
      ),
      h(
        Plural,
        { n: 1, one: null },
        {
          default: () => 'Plural fallback',
          one: () => 'Named plural slot',
        }
      ),
    ]);

    expect(source).toEqual([
      {
        t: 'Branch',
        i: 1,
        d: { b: { formal: 'Named slot' }, t: 'b' },
        c: 'Fallback',
      },
      {
        t: 'Plural',
        i: 2,
        d: { b: { one: 'Named plural slot' }, t: 'p' },
        c: 'Plural fallback',
      },
    ]);
  });

  it('preserves empty and literal named slots independently from default slots', () => {
    const source = serializeVueChildren([
      h(
        Branch,
        { branch: 'empty' },
        {
          empty: () => [],
          false: () => [false],
          null: () => [null],
          true: () => [true],
          undefined: () => [undefined],
        }
      ),
      h(
        Plural,
        { n: 1 },
        {
          few: () => [false],
          many: () => [null],
          one: () => [],
          other: () => [true],
        }
      ),
    ]);

    expect(source).toEqual([
      {
        t: 'Branch',
        i: 1,
        d: {
          b: { empty: [], false: false, null: null, true: true },
          t: 'b',
        },
      },
      {
        t: 'Plural',
        i: 2,
        d: {
          b: { few: false, many: null, one: [], other: true },
          t: 'p',
        },
      },
    ]);
  });

  it('does not invoke unsupported Plural named slots while serializing rich source', () => {
    let acceptedCalls = 0;
    let ignoredCalls = 0;
    const source = serializeVueChildren([
      h(
        Plural,
        { n: 1 },
        {
          ignored: () => {
            ignoredCalls += 1;
            return 'Ignored';
          },
          one: () => {
            acceptedCalls += 1;
            return 'One';
          },
        }
      ),
    ]);

    expect(source).toEqual({
      t: 'Plural',
      i: 1,
      d: { b: { one: 'One' }, t: 'p' },
    });
    expect(acceptedCalls).toBe(1);
    expect(ignoredCalls).toBe(0);
  });

  it('rejects reserved, non-content, and non-primitive attributes', () => {
    const attributes: [string, unknown][] = [
      ['branch', 'formal'],
      ['class', 'secret'],
      ['style', 'color: red'],
      ['style', { color: 'red' }],
      ['n', 2],
      ['locales', 'fr'],
      ['key', 'stable'],
      ['ref', 'component'],
      ['ref-for', true],
      ['ref-key', 'component'],
      ['ref_for', true],
      ['ref_key', 'component'],
      ['onClick', 'not a branch'],
      ['on-click', 'not a branch'],
      ['onVnodeMounted', 'not a branch'],
      ['data-note', 'private'],
      ['aria-label', 'Greeting'],
      ['formal', { label: 'Welcome' }],
      ['formal', ['Welcome']],
      ['formal', () => 'Welcome'],
      ['formal', undefined],
      ['formal', Symbol('Welcome')],
    ];

    expect(
      attributes.filter(([name, value]) => isBranchAttribute(name, value))
    ).toEqual([]);
  });

  it.each([
    [
      'class',
      '<Branch branch="class" class="secret">Class fallback</Branch>',
      'Class fallback',
    ],
    [
      'style',
      '<Branch branch="style" :style="{ color: \'red\' }">Style fallback</Branch>',
      'Style fallback',
    ],
    [
      'listener',
      '<Branch branch="onClick" @click="handler">Listener fallback</Branch>',
      'Listener fallback',
    ],
    [
      'object',
      '<Branch branch="formal" :formal="payload">Object fallback</Branch>',
      'Object fallback',
    ],
    [
      'function',
      '<Branch branch="callback" :callback="handler">Function fallback</Branch>',
      'Function fallback',
    ],
    [
      'data attribute',
      '<Branch branch="data-note" data-note="secret">Data fallback</Branch>',
      'Data fallback',
    ],
    [
      'ARIA attribute',
      '<Branch branch="aria-label" aria-label="secret">ARIA fallback</Branch>',
      'ARIA fallback',
    ],
  ])(
    'does not render a standalone %s value as branch content',
    async (_label, template, fallback) => {
      const html = await renderTemplate(template, () => ({
        handler: () => 'secret listener',
        payload: { label: 'secret object' },
      }));

      expect(html).toContain(fallback);
      expect(html).not.toContain('secret listener');
      expect(html).not.toContain('[object Object]');
    }
  );

  it.each([
    ['string', 'formal', 'formal="Welcome"', 'Welcome'],
    ['number', 'count', ':count="12"', '12'],
    ['bigint', 'large', ':large="12n"', '12'],
  ])(
    'renders a standalone %s branch attribute as text',
    async (_label, branch, attribute, expected) => {
      const html = await renderTemplate(
        `<Branch branch="${branch}" ${attribute}>Fallback</Branch>`
      );

      expect(html).toContain(expected);
      expect(html).not.toContain('Fallback');
    }
  );

  it.each([
    ['false', ':flag="false"'],
    ['true', ':flag="true"'],
    ['null', ':flag="null"'],
  ])(
    'treats a standalone %s attribute as a present empty branch',
    async (label, attribute) => {
      const html = await renderTemplate(
        `<div>before<Branch branch="flag" ${attribute}>Fallback</Branch>after</div>`
      );

      expect(html).toContain('beforeafter');
      expect(html).not.toContain('Fallback');
      expect(html).not.toContain(`>${label}<`);
    }
  );

  it('prefers a named Branch slot over an attribute with the same name', async () => {
    const html = await renderTemplate(
      '<Branch branch="formal" formal="Attribute"><template #formal>Slot</template>Fallback</Branch>'
    );

    expect(html).toContain('Slot');
    expect(html).not.toContain('Attribute');
    expect(html).not.toContain('Fallback');
  });

  it('keeps empty Branch slots selected and lets null Plural slots fall back', async () => {
    const Root = defineComponent({
      setup() {
        return () =>
          h(T, null, {
            default: () => [
              'before',
              h(
                Branch,
                { branch: 'empty' },
                { default: () => ['Branch fallback'], empty: () => [] }
              ),
              'after|',
              h(
                Plural,
                { n: 1 },
                { default: () => ['Plural fallback'], one: () => [null] }
              ),
            ],
          });
      },
    });

    expect(stripFragmentMarkers(await renderWithPlugin(Root, createGT()))).toBe(
      'beforeafter|Plural fallback'
    );
  });

  it('selects a data-* named slot without treating the matching attribute as content', async () => {
    const html = await renderTemplate(
      '<Branch branch="data-note" data-note="Attribute"><template #data-note>Named slot</template>Fallback</Branch>'
    );

    expect(html).toContain('Named slot');
    expect(html).not.toContain('Attribute');
    expect(html).not.toContain('Fallback');
  });

  it('selects a data-* named slot inside default-locale rich content', async () => {
    const html = await renderTemplate(
      '<T><Branch branch="data-note" data-note="Attribute"><template #data-note>Source named slot</template>Source fallback</Branch></T>'
    );

    expect(html).toContain('Source named slot');
    expect(html).not.toContain('Attribute');
    expect(html).not.toContain('Source fallback');
  });

  it('selects a translated data-* named slot inside rich content', async () => {
    const source: JsxChildren = {
      t: 'Branch',
      i: 1,
      d: { b: { 'data-note': 'Source named slot' }, t: 'b' },
      c: 'Source fallback',
    };
    const target: JsxChildren = {
      t: 'Branch',
      i: 1,
      d: { b: { 'data-note': 'Translated named slot' }, t: 'b' },
      c: 'Translated fallback',
    };
    const plugin = createGT({
      loadTranslations: async () => ({ [jsxHash(source)]: target }),
    });
    await plugin.setLocale('fr');

    const html = await renderTemplate(
      '<T><Branch branch="data-note" data-note="Attribute"><template #data-note>Source named slot</template>Source fallback</Branch></T>',
      undefined,
      plugin
    );

    expect(html).toContain('Translated named slot');
    expect(html).not.toContain('Attribute');
    expect(html).not.toContain('Source named slot');
    expect(html).not.toContain('Translated fallback');
  });

  it('uses the same filtered inputs for a rich Branch hash', async () => {
    const source: JsxChildren = {
      t: 'Branch',
      i: 1,
      d: {
        b: {
          formal: 'Slot source',
          count: '12',
          large: '12',
          flag: false,
          empty: null,
        },
        t: 'b',
      },
      c: 'Fallback',
    };
    const target: JsxChildren = {
      t: 'Branch',
      i: 1,
      d: {
        b: {
          formal: 'Slot traduit',
          count: 'douze',
          large: 'grand',
          flag: false,
          empty: null,
        },
        t: 'b',
      },
      c: 'Repli',
    };
    const plugin = createGT({
      loadTranslations: async () => ({ [jsxHash(source)]: target }),
    });
    await plugin.setLocale('fr');

    const html = await renderTemplate(
      '<T><Branch branch="formal" class="secret" :style="{ color: \'red\' }" @click="handler" formal="Attribute" :count="12" :large="12n" :flag="false" :empty="null" :payload="payload" :callback="handler" data-note="private" aria-label="Greeting"><template #formal>Slot source</template>Fallback</Branch></T>',
      () => ({
        handler: () => 'secret listener',
        payload: { label: 'secret object' },
      }),
      plugin
    );

    expect(html).toContain('Slot traduit');
    expect(html).not.toContain('Slot source');
    expect(html).not.toContain('Attribute');
    expect(html).not.toContain('secret');
    expect(html).not.toContain('[object Object]');
  });

  it('filters standalone Plural attributes and keeps primitive forms', async () => {
    const html = await renderTemplate(
      '<div><Plural :n="1" :one="payload">Object fallback</Plural>|<Plural :n="1" one="One">Fallback</Plural>|<Plural :n="1" :one="1">Fallback</Plural></div>',
      () => ({ payload: { label: 'secret object' } })
    );

    expect(html).toContain('Object fallback|One|1');
    expect(html).not.toContain('[object Object]');
  });

  it('treats a standalone Plural false form as present and empty', async () => {
    const html = await renderTemplate(
      '<div>before<Plural :n="1" :one="false">Fallback</Plural>after</div>'
    );

    expect(html).toContain('beforeafter');
    expect(html).not.toContain('Fallback');
    expect(html).not.toContain('>false<');
  });

  it('uses the standalone Plural default for a null form', async () => {
    const html = await renderTemplate(
      '<div>before<Plural :n="1" :one="null">Fallback</Plural>after</div>'
    );

    expect(html).toContain('beforeFallbackafter');
    expect(html).not.toContain('>null<');
  });

  it('prefers a named Plural slot over an attribute with the same name', async () => {
    const html = await renderTemplate(
      '<Plural :n="1" one="Attribute"><template #one>Slot</template>Fallback</Plural>'
    );

    expect(html).toContain('Slot');
    expect(html).not.toContain('Attribute');
    expect(html).not.toContain('Fallback');
  });

  it('uses the default plural rules when the default locale is active', async () => {
    const html = await renderTemplate(
      '<Plural :n="0" :locales="[\'fr\']"><template #one>French one</template><template #other>English other</template></Plural>',
      () => ({}),
      createGT({ defaultLocale: 'en' })
    );

    expect(html).toContain('English other');
    expect(html).not.toContain('French one');
  });

  it('uses the active locale plural rules before the default locale', async () => {
    const plugin = createGT({ defaultLocale: 'en' });
    await plugin.setLocale('fr');
    const html = await renderTemplate(
      '<Plural :n="0"><template #one>French one</template><template #other>English other</template></Plural>',
      () => ({}),
      plugin
    );

    expect(html).toContain('French one');
    expect(html).not.toContain('English other');
  });

  it('uses the same filtered inputs for a rich Plural hash', async () => {
    const source: JsxChildren = {
      t: 'Plural',
      i: 1,
      d: { b: { other: 'Other' }, t: 'p' },
      c: 'Fallback',
    };
    const target: JsxChildren = {
      t: 'Plural',
      i: 1,
      d: { b: { other: 'Autres' }, t: 'p' },
      c: 'Repli',
    };
    const plugin = createGT({
      loadTranslations: async () => ({ [jsxHash(source)]: target }),
    });
    await plugin.setLocale('fr');

    const html = await renderTemplate(
      '<T><Plural :n="2" class="secret" :style="{ color: \'red\' }" @click="handler" :one="payload" other="Other" data-note="private" aria-label="Items">Fallback</Plural></T>',
      () => ({
        handler: () => 'secret listener',
        payload: { label: 'secret object' },
      }),
      plugin
    );

    expect(html).toContain('Autres');
    expect(html).not.toContain('Other');
    expect(html).not.toContain('secret');
    expect(html).not.toContain('[object Object]');
  });

  it('uses a React-canonical boolean/null branch hash and renders both source and target values as empty', async () => {
    // React's persisted wire format keeps boolean and null branch values as
    // primitives even though they render no visible content.
    const source: JsxChildren = [
      'before',
      {
        t: 'Branch',
        i: 1,
        d: { b: { active: true }, t: 'b' },
      },
      {
        t: 'Branch',
        i: 2,
        d: { b: { inactive: false }, t: 'b' },
      },
      {
        t: 'Branch',
        i: 3,
        d: { b: { unknown: null }, t: 'b' },
      },
      'after',
    ];
    const target: JsxChildren = [
      'avant',
      {
        t: 'Branch',
        i: 1,
        d: { b: { active: false }, t: 'b' },
      },
      {
        t: 'Branch',
        i: 2,
        d: { b: { inactive: true }, t: 'b' },
      },
      {
        t: 'Branch',
        i: 3,
        d: { b: { unknown: null }, t: 'b' },
      },
      'après',
    ];
    const Root = defineComponent({
      setup() {
        return () =>
          h(T, null, {
            default: () => [
              'before',
              h(Branch, { active: true, branch: 'active' }),
              h(Branch, { branch: 'inactive', inactive: false }),
              h(Branch, { branch: 'unknown', unknown: null }),
              'after',
            ],
          });
      },
    });

    const defaultHtml = stripFragmentMarkers(
      await renderWithPlugin(Root, createGT())
    );
    expect(defaultHtml).toContain('beforeafter');
    expect(defaultHtml).not.toContain('true');
    expect(defaultHtml).not.toContain('null');

    const translatedPlugin = createGT({
      loadTranslations: async () => ({ [jsxHash(source)]: target }),
    });
    await translatedPlugin.setLocale('fr');
    const translatedHtml = stripFragmentMarkers(
      await renderWithPlugin(Root, translatedPlugin)
    );

    expect(translatedHtml).toContain('avantaprès');
    expect(translatedHtml).not.toContain('before');
    expect(translatedHtml).not.toContain('false');
    expect(translatedHtml).not.toContain('null');
  });

  // One test per transformation walks the whole source/target matrix and
  // reports every combination whose Vue output differs from React's.
  it.each(['branch', 'plural'] as const)(
    'matches React for every %s source and target combination',
    async (transformation) => {
      const mismatches: Record<string, unknown>[] = [];
      for (const { source, target } of BRANCH_RENDER_MATRIX) {
        const labels = { source: source.label, target: target.label };
        try {
          const react = renderReactMatrixCase(
            transformation,
            source.value,
            target.value
          );
          const vue = await renderVueMatrixCase(
            transformation,
            source.value,
            target.value
          );
          if (vue !== react) mismatches.push({ ...labels, react, vue });
        } catch (error) {
          mismatches.push({ ...labels, error: String(error) });
        }
      }

      expect(mismatches).toEqual([]);
    }
  );
});

describe('gt-vue formatting components', () => {
  it('formats typed number, currency, Date, and epoch values', async () => {
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(Num, { locales: ['en-US'], value: 1234.5 }),
            '|',
            h(Currency, {
              currency: 'USD',
              locales: ['en-US'],
              value: 12,
            }),
            '|',
            h(DateTime, {
              locales: ['en-US'],
              options: { timeZone: 'UTC', year: 'numeric' },
              value: new Date('2024-01-01T00:00:00.123Z'),
            }),
            '|',
            h(DateTime, {
              locales: ['en-US'],
              options: { timeZone: 'UTC', year: 'numeric' },
              value: 1704067200000,
            }),
          ]);
      },
    });

    expect(
      stripFragmentMarkers(await renderWithPlugin(Root, createGT()))
    ).toContain('1,234.5|$12.00|2024|2024');
  });

  it('does not treat formatter slot children as values', async () => {
    const slot = vi.fn(() => '999');
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(Num, { locales: ['en-US'], value: 2 }, { default: slot }),
            h(Currency, { locales: ['en-US'], value: 3 }, { default: slot }),
            h(
              DateTime,
              {
                locales: ['en-US'],
                options: { timeZone: 'UTC', year: 'numeric' },
                value: 1704067200000,
              },
              { default: slot }
            ),
          ]);
      },
    });

    expect(
      stripFragmentMarkers(await renderWithPlugin(Root, createGT()))
    ).toContain('2$3.002024');
    expect(slot).not.toHaveBeenCalled();
  });

  it('returns partially parseable value strings unchanged', async () => {
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(Num, { locales: ['en-US'], value: '1,234.5' }),
            '|',
            h(Currency, {
              currency: 'USD',
              locales: ['en-US'],
              value: '12 dollars',
            }),
          ]);
      },
    });

    expect(
      stripFragmentMarkers(await renderWithPlugin(Root, createGT()))
    ).toContain('1,234.5|12 dollars');
  });

  it('returns invalid dates unchanged', async () => {
    const Root = defineComponent({
      setup() {
        return () => h(DateTime, { value: 'definitely-not-a-date' as string });
      },
    });

    expect(await renderWithPlugin(Root, createGT())).toContain(
      'definitely-not-a-date'
    );
  });

  it('renders nullish and whitespace-only values as empty without prop warnings', async () => {
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(Num, { value: '   ' }),
            h(Currency, { value: '\n' }),
            h(DateTime, { value: '\t' }),
            h(Num, { value: null }),
            h(Currency, { value: null }),
            h(DateTime, { value: null }),
          ]);
      },
    });
    const warnings: string[] = [];
    const app = createSSRApp(Root).use(createGT());
    app.config.warnHandler = (message) => warnings.push(message);

    expect(stripFragmentMarkers(await renderToString(app))).toBe('<div></div>');
    expect(warnings).toEqual([]);
  });

  it('uses only the default locale when it is active', () => {
    expect(getFormatLocales(['fr-CA'], 'en', 'en')).toEqual(['en']);
    expect(getFormatLocales(['fr-CA'], libraryDefaultLocale)).toEqual([
      libraryDefaultLocale,
    ]);
  });

  it('ignores explicit formatter locales when the default locale is active', async () => {
    const Root = defineComponent({
      setup() {
        return () => h(Num, { locales: ['de-DE'], value: 1234.5 });
      },
    });

    expect(stripFragmentMarkers(await renderWithPlugin(Root, createGT()))).toBe(
      '1,234.5'
    );
  });

  it('prefers explicit locales for standalone formatters at a non-default locale', async () => {
    const Root = defineComponent({
      setup() {
        return () => h(Num, { locales: ['de'], value: 1234.5 });
      },
    });
    const app = createSSRApp(Root).use(
      createGT({ defaultLocale: 'en', locale: 'fr' })
    );

    expect(stripFragmentMarkers(await renderToString(app))).toBe(
      new Intl.NumberFormat('de').format(1234.5)
    );
  });

  it('formats with Latin digits and the Gregorian calendar, as gt-react does', async () => {
    const date = new Date(Date.UTC(2020, 4, 6, 12));
    const Root = defineComponent({
      setup() {
        return () => [
          h(Num, { value: 1234.5 }),
          ' ',
          h(DateTime, {
            options: { dateStyle: 'short', timeZone: 'UTC' },
            value: date,
          }),
        ];
      },
    });
    // Persian has digits and a calendar of its own, so both defaults show.
    const app = createSSRApp(Root).use(
      createGT({ defaultLocale: 'en', locale: 'fa-IR' })
    );

    expect(stripFragmentMarkers(await renderToString(app))).toBe(
      `${new Intl.NumberFormat('fa-IR', { numberingSystem: 'latn' }).format(1234.5)} ${new Intl.DateTimeFormat('fa-IR', { calendar: 'gregory', dateStyle: 'short', numberingSystem: 'latn', timeZone: 'UTC' }).format(date).replace(/[\u200F\u202B\u202E]/g, '')}`
    );
  });

  it.each([
    [{ currency: 'USD' }],
    [{ currency: undefined }],
    [{ style: 'percent' }],
  ] as const)(
    'keeps the currency prop of <Currency> over options %j',
    async (options) => {
      const Root = defineComponent({
        setup() {
          return () =>
            h(Currency, {
              currency: 'EUR',
              locales: ['en-US'],
              options,
              value: 12,
            });
        },
      });

      expect(
        stripFragmentMarkers(await renderWithPlugin(Root, createGT()))
      ).toBe('€12.00');
    }
  );

  it('tries explicit, active, and default locales once while translating', () => {
    expect(getFormatLocales(['fr-CA', 'fr', 'en'], 'fr', 'en')).toEqual([
      'fr-CA',
      'fr',
      'en',
    ]);
  });

  it('ignores fallthrough attributes without warning for unwrapped values', async () => {
    let listenerCalls = 0;
    const fallthrough = {
      class: 'ignored-class',
      'data-ignored': 'ignored-data',
      onClick: () => {
        listenerCalls += 1;
      },
      title: 'ignored-title',
    };
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(Var, fallthrough, { default: () => 'Ada' }),
            h(Var, fallthrough, {
              default: () => h('span', { id: 'inner' }, 'Grace'),
            }),
            h(Num, { ...fallthrough, locales: ['en-US'], value: 2 }),
            h(Currency, {
              ...fallthrough,
              currency: 'USD',
              locales: ['en-US'],
              value: 3,
            }),
            h(DateTime, {
              ...fallthrough,
              locales: ['en-US'],
              options: { timeZone: 'UTC', year: 'numeric' },
              value: 1704067200000,
            }),
          ]);
      },
    });
    const warnings: string[] = [];
    const app = createSSRApp(Root).use(createGT());
    app.config.warnHandler = (message) => warnings.push(message);

    const html = await renderToString(app);

    expect(html).toContain('Ada');
    expect(html).toContain('<span id="inner">Grace</span>');
    expect(html).toContain('2');
    expect(html).toContain('$3.00');
    expect(html).toContain('2024');
    expect(html).not.toContain('ignored-');
    expect(listenerCalls).toBe(0);
    expect(warnings).toEqual([]);
  });
});

/** Renders a compiled Vue template through the server renderer. */
async function renderTemplate(
  template: string,
  setup: () => Record<string, unknown> = () => ({}),
  plugin = createGT()
): Promise<string> {
  const Root = defineComponent({
    components: { Branch, Plural, T } satisfies Record<string, Component>,
    render: compile(template),
    setup,
  });
  const app = createSSRApp(Root);
  app.use(plugin);
  return stripFragmentMarkers(await renderToString(app));
}

/** Renders one matrix case through React's canonical rich-content pipeline. */
function renderReactMatrixCase(
  transformation: BranchTransformation,
  sourceValue: BranchSourceValue,
  targetValue: BranchTargetValue
): string {
  const prepared = prepareReactT({
    locale: 'en',
    params: {},
    sourceChildren: createReactMatrixSource(transformation, sourceValue),
  });
  const target = createMatrixTarget(transformation, targetValue);
  const rendered = renderReactTranslatedChildren({
    enableI18n: true,
    locales: ['fr'],
    source: prepared.taggedSourceChildren,
    target,
  });
  return serializeReactResult(rendered);
}

/** Renders the equivalent matrix case through the gt-vue T component. */
async function renderVueMatrixCase(
  transformation: BranchTransformation,
  sourceValue: BranchSourceValue,
  targetValue: BranchTargetValue
): Promise<string> {
  const source = serializeVueChildren([
    createVueMatrixSource(transformation, sourceValue),
  ]);
  const target = createMatrixTarget(transformation, targetValue);
  const plugin = createGT({
    loadTranslations: async () => ({ [jsxHash(source)]: target }),
  });
  await plugin.setLocale('fr');
  const Root = defineComponent({
    setup() {
      return () =>
        h(T, null, {
          default: () => createVueMatrixSource(transformation, sourceValue),
        });
    },
  });

  return stripFragmentMarkers(await renderWithPlugin(Root, plugin)).replaceAll(
    '<!---->',
    ''
  );
}

/** Creates a React Branch or Plural with an explicit rich default. */
function createReactMatrixSource(
  transformation: BranchTransformation,
  sourceValue: BranchSourceValue
): React.ReactElement {
  const branchName = transformation === 'branch' ? 'selected' : 'other';
  const props: Record<string, unknown> = {
    children: React.createElement('em', null, 'SOURCE DEFAULT'),
    ...(transformation === 'branch'
      ? { branch: branchName }
      : {
          _enableI18n: true,
          _locale: 'en',
          n: 2,
        }),
    [branchName]:
      sourceValue === 'rich'
        ? React.createElement('strong', null, 'SOURCE BRANCH')
        : sourceValue === 'rich siblings'
          ? [
              React.createElement('strong', { key: 'element' }, 'SOURCE FIRST'),
              React.createElement(
                ReactVar,
                { key: 'variable' },
                'SOURCE VARIABLE'
              ),
            ]
          : sourceValue,
  };
  const component = transformation === 'branch' ? ReactBranch : ReactPlural;
  return React.createElement(
    component as React.ComponentType<Record<string, unknown>>,
    props
  );
}

/** Creates a Vue Branch or Plural with the same explicit rich default. */
function createVueMatrixSource(
  transformation: BranchTransformation,
  sourceValue: BranchSourceValue
): VNode {
  const branchName = transformation === 'branch' ? 'selected' : 'other';
  const props: Record<string, unknown> =
    transformation === 'branch' ? { branch: branchName } : { n: 2 };
  const slots: Record<string, () => VNodeChild> = {
    default: () => h('em', null, 'SOURCE DEFAULT'),
  };
  if (sourceValue === 'rich') {
    slots[branchName] = () => h('strong', null, 'SOURCE BRANCH');
  } else if (sourceValue === 'rich siblings') {
    slots[branchName] = () => [
      h('strong', null, 'SOURCE FIRST'),
      h(Var, { key: 'variable' }, { default: () => 'SOURCE VARIABLE' }),
    ];
  } else {
    props[branchName] = sourceValue;
  }
  return h(transformation === 'branch' ? Branch : Plural, props, slots);
}

/** Builds a translated transform record with an explicit target default. */
function createMatrixTarget(
  transformation: BranchTransformation,
  value: BranchTargetValue
): JsxChildren {
  const branchName = transformation === 'branch' ? 'selected' : 'other';
  return {
    t: transformation === 'branch' ? 'Branch' : 'Plural',
    i: 1,
    d: {
      b: { [branchName]: value },
      t: transformation === 'branch' ? 'b' : 'p',
    },
    c: 'TARGET DEFAULT',
  };
}

/** Serializes the small React result grammar used by the parity matrix. */
function serializeReactResult(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (
    typeof node === 'string' ||
    typeof node === 'number' ||
    typeof node === 'bigint'
  ) {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(serializeReactResult).join('');
  if (!React.isValidElement(node)) return '';

  const children = (node.props as { children?: React.ReactNode }).children;
  const content = serializeReactResult(children);
  return typeof node.type === 'string'
    ? `<${node.type}>${content}</${node.type}>`
    : content;
}
