import { describe, expect, it } from 'vitest';
import { parse as parseIcu } from '@formatjs/icu-messageformat-parser';
import { formatMessage } from '@generaltranslation/format';
import {
  CatalogConversionError,
  convertCatalogs,
  DEFAULT_SEPARATORS,
  escapeIcuText,
  type ConvertInput,
} from '../catalogConvert.js';

/** Builds a single-locale, single-namespace input with sane defaults. */
function input(
  raw: Record<string, unknown>,
  overrides: Partial<ConvertInput> = {}
): ConvertInput {
  return {
    defaultLocale: 'en',
    locales: ['en'],
    defaultNS: 'translation',
    raw: { en: { translation: raw } },
    ...overrides,
  };
}

function convert(
  raw: Record<string, unknown>,
  overrides: Partial<ConvertInput> = {}
) {
  const result = convertCatalogs(input(raw, overrides));
  return { dict: result.byLocale.en, reports: result.reports };
}

/** Renders an ICU string through gt's own formatter (the gt-next runtime path). */
function render(
  icu: string,
  locale: string,
  vars: Record<string, unknown>
): string {
  return formatMessage(icu, { locales: [locale], variables: vars });
}

/** Walks a '.'-separated path through the nested dictionary exactly as gt-next's
 *  runtime resolver does, so a test can assert an emitted key is resolvable. */
function resolveDotPath(dict: Record<string, unknown>, key: string): unknown {
  let current: unknown = dict;
  for (const segment of key.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

describe('escapeIcuText round-trips through @formatjs', () => {
  const cases = [
    'plain text',
    "it's a test",
    'braces { and }',
    "mix {a} 'b' }c{",
    "quote-heavy: don't {do} 'this'",
    '100% sure',
  ];
  for (const text of cases) {
    it(`round-trips ${JSON.stringify(text)}`, () => {
      const escaped = escapeIcuText(text);
      const ast = parseIcu(escaped);
      // A pure-literal message parses to a single literal element equal to input.
      const literal = ast.map((n) => ('value' in n ? n.value : '')).join('');
      expect(literal).toBe(text);
    });
  }
});

describe('interpolation', () => {
  it('strips {{var}} to {var}', () => {
    const { dict } = convert({ greeting: 'Hello {{name}}' });
    expect(dict.greeting).toBe('Hello {name}');
    expect(render(dict.greeting as string, 'en', { name: 'Ada' })).toBe(
      'Hello Ada'
    );
  });

  it('escapes ICU-hostile literals around a placeholder', () => {
    const { dict } = convert({ hostile: "set {{key}} to '{value}'" });
    // Placeholder untouched; literal { } ' quoted so @formatjs parses and gt
    // renders the original text back.
    const icu = dict.hostile as string;
    expect(() => parseIcu(icu)).not.toThrow();
    expect(render(icu, 'en', { key: 'x' })).toBe("set x to '{value}'");
  });

  it('maps {{n, number}} to an ICU number arg', () => {
    const { dict } = convert({ total: '{{n, number}} items' });
    expect(dict.total).toBe('{n, number} items');
  });

  it('maps number option bags to ICU skeletons', () => {
    const { dict } = convert({
      price: '{{v, number(minimumFractionDigits: 2)}}',
    });
    // min 2, max defaults to Intl's decimal default of 3 (min-only must not
    // cap the max at the min, per the m6 adversary finding).
    expect(dict.price).toBe('{v, number, ::.00#}');
    expect(render(dict.price as string, 'en', { v: 3 })).toBe('3.00');
    expect(render(dict.price as string, 'en', { v: 3.14159 })).toBe('3.142');
  });

  it('maps currency(USD) and currency(currency: USD)', () => {
    const a = convert({ p: '{{price, currency(USD)}}' }).dict.p;
    const b = convert({ p: '{{price, currency(currency: USD)}}' }).dict.p;
    expect(a).toBe('{price, number, ::currency/USD}');
    expect(b).toBe('{price, number, ::currency/USD}');
  });

  it('best-efforts datetime and reports the approximation', () => {
    const { dict, reports } = convert({ when: '{{d, datetime}}' });
    expect(dict.when).toBe('{d, date, medium}');
    expect(reports.some((r) => /datetime/.test(r.reason))).toBe(true);
  });

  it('keeps the variable but reports relativetime / list / custom formatters', () => {
    for (const spec of ['relativetime(quarter)', 'list', 'myCustomFmt']) {
      const { dict, reports } = convert({ k: `{{v, ${spec}}}` });
      expect(dict.k).toBe('{v}');
      expect(reports.length).toBeGreaterThan(0);
    }
  });

  it('reports chained formatters and keeps the variable', () => {
    const { dict, reports } = convert({ k: '{{v, number, uppercase}}' });
    expect(dict.k).toBe('{v}');
    expect(reports.some((r) => /chained/.test(r.reason))).toBe(true);
  });

  it('converts {{- var}} and reports the raw-HTML semantics change', () => {
    const { dict, reports } = convert({ k: 'See {{- link}}' });
    expect(dict.k).toBe('See {link}');
    expect(reports.some((r) => /raw HTML/.test(r.reason))).toBe(true);
  });
});

describe('cardinal plurals per-locale CLDR', () => {
  it('groups the two English categories', () => {
    const { dict } = convert({
      items_one: '{{count}} item',
      items_other: '{{count}} items',
    });
    expect(dict.items).toBe(
      '{count, plural, one {{count} item} other {{count} items}}'
    );
    expect(render(dict.items as string, 'en', { count: 1 })).toBe('1 item');
    expect(render(dict.items as string, 'en', { count: 5 })).toBe('5 items');
  });

  it('groups the four Polish categories in CLDR order', () => {
    const pl = {
      items_one: '{{count}} produkt',
      items_few: '{{count}} produkty',
      items_many: '{{count}} produktów',
      items_other: '{{count}} produktu',
    };
    const { byLocale } = convertCatalogs(
      input(pl, {
        locales: ['pl'],
        defaultLocale: 'pl',
        raw: { pl: { translation: pl } },
      })
    );
    expect(byLocale.pl.items).toBe(
      '{count, plural, one {{count} produkt} few {{count} produkty} many {{count} produktów} other {{count} produktu}}'
    );
    // Polish plural boundaries: 1=one, 2=few, 5=many, 22=few.
    expect(render(byLocale.pl.items as string, 'pl', { count: 1 })).toBe(
      '1 produkt'
    );
    expect(render(byLocale.pl.items as string, 'pl', { count: 2 })).toBe(
      '2 produkty'
    );
    expect(render(byLocale.pl.items as string, 'pl', { count: 5 })).toBe(
      '5 produktów'
    );
    expect(render(byLocale.pl.items as string, 'pl', { count: 22 })).toBe(
      '22 produkty'
    );
  });

  it('groups all six Arabic categories in CLDR order', () => {
    const ar: Record<string, string> = {
      items_zero: 'لا عناصر',
      items_one: 'عنصر واحد',
      items_two: 'عنصران',
      items_few: '{{count}} عناصر',
      items_many: '{{count}} عنصرا',
      items_other: '{{count}} عنصر',
    };
    const { byLocale } = convertCatalogs(
      input(ar, {
        locales: ['ar'],
        defaultLocale: 'ar',
        raw: { ar: { translation: ar } },
      })
    );
    const icu = byLocale.ar.items as string;
    expect(icu.startsWith('{count, plural, zero {')).toBe(true);
    // Arabic boundaries: 0=zero, 1=one, 2=two, 3=few, 11=many, 100=other.
    expect(render(icu, 'ar', { count: 0 })).toBe('لا عناصر');
    expect(render(icu, 'ar', { count: 1 })).toBe('عنصر واحد');
    expect(render(icu, 'ar', { count: 2 })).toBe('عنصران');
  });

  it('gates on {{count}} evidence — coincidental _one/_other named keys are NOT grouped without count', () => {
    // A real key pair that merely ends in category names, with no count usage.
    const { dict, reports } = convert(
      { status_one: 'Primary', status_other: 'Secondary' },
      {}
    );
    expect(dict.status_one).toBe('Primary');
    expect(dict.status_other).toBe('Secondary');
    expect(dict.status).toBeUndefined();
    expect(reports.some((r) => /no `\{\{count\}\}`/.test(r.reason))).toBe(true);
  });

  it('groups when the call site passed count even without {{count}} in the value', () => {
    const { dict } = convert(
      { apples_one: 'an apple', apples_other: 'apples' },
      { countKeys: new Set(['translation:apples']) }
    );
    expect(dict.apples).toBe('{count, plural, one {an apple} other {apples}}');
  });

  it('refuses to group a set missing the required _other', () => {
    const { dict, reports } = convert({ dog_one: '{{count}} dog' });
    expect(dict.dog_one).toBe('{count} dog');
    expect(dict.dog).toBeUndefined();
    expect(
      reports.some((r) => /lack the required `other`/.test(r.reason))
    ).toBe(true);
  });

  it('does not group a suffix outside the locale category set', () => {
    // `two` is not a Polish-invalid category, but `many` is not English's.
    const { dict, reports } = convert({
      box_one: '{{count}} box',
      box_many: '{{count}} boxes',
      box_other: '{{count}} boxes',
    });
    // `many` is outside en's {one, other}; the presence of a non-category
    // sibling forces the whole set literal.
    expect(dict.box).toBeUndefined();
    expect(reports.some((r) => /outside .*CLDR set/.test(r.reason))).toBe(true);
  });
});

describe('ordinal plurals', () => {
  it('converts _ordinal_ suffixes to selectordinal', () => {
    const { dict } = convert({
      place_ordinal_one: '{{count}}st',
      place_ordinal_two: '{{count}}nd',
      place_ordinal_few: '{{count}}rd',
      place_ordinal_other: '{{count}}th',
    });
    expect(dict.place).toBe(
      '{count, selectordinal, one {{count}st} two {{count}nd} few {{count}rd} other {{count}th}}'
    );
    expect(render(dict.place as string, 'en', { count: 1 })).toBe('1st');
    expect(render(dict.place as string, 'en', { count: 2 })).toBe('2nd');
    expect(render(dict.place as string, 'en', { count: 4 })).toBe('4th');
  });

  it('converts the cardinal but skip+reports the ordinal on a collision', () => {
    const { dict, reports } = convert(
      {
        rank_one: '{{count}} rank',
        rank_other: '{{count}} ranks',
        rank_ordinal_one: '{{count}}st',
        rank_ordinal_other: '{{count}}th',
      },
      { countKeys: new Set(['translation:rank']) }
    );
    expect(dict.rank).toBe(
      '{count, plural, one {{count} rank} other {{count} ranks}}'
    );
    expect(dict.rank_ordinal_one).toBe('{count}st');
    expect(dict.rank_ordinal_other).toBe('{count}th');
    expect(reports.some((r) => /ordinal.*collides/.test(r.reason))).toBe(true);
  });
});

describe('context selectors (call-site gated)', () => {
  it('converts to {context, select} only when a call site passed context', () => {
    const { dict } = convert(
      {
        friend: 'a friend',
        friend_male: 'his friend',
        friend_female: 'her friend',
      },
      { contextKeys: new Set(['translation:friend']) }
    );
    expect(dict.friend).toBe(
      '{context, select, female {her friend} male {his friend} other {a friend}}'
    );
    expect(render(dict.friend as string, 'en', { context: 'male' })).toBe(
      'his friend'
    );
    expect(render(dict.friend as string, 'en', { context: 'x' })).toBe(
      'a friend'
    );
  });

  it('leaves context-looking keys literal when no call site gates them', () => {
    const { dict } = convert({
      dish: 'a dish',
      dish_starter: 'a starter',
      dish_main: 'a main',
    });
    // No contextKeys evidence: dish_starter stays a plain key (dish_starter
    // could be a legitimate flat key, not `dish` + context `starter`).
    expect(dict.dish_starter).toBe('a starter');
    expect(dict.dish).toBe('a dish');
  });

  it('skip+reports combined context+plural', () => {
    const { dict, reports } = convert(
      {
        colleague_male_one: '{{count}} male colleague',
        colleague_male_other: '{{count}} male colleagues',
      },
      { contextKeys: new Set(['translation:colleague']) }
    );
    expect(dict.colleague).toBeUndefined();
    expect(dict.colleague_male_one).toBe('{count} male colleague');
    expect(reports.some((r) => /combined context\+plural/.test(r.reason))).toBe(
      true
    );
  });
});

describe('nesting, arrays, defaults', () => {
  it('inlines static $t() references', () => {
    const { dict } = convert({
      appName: 'GT',
      welcome: 'Welcome to $t(appName)',
    });
    expect(dict.welcome).toBe('Welcome to GT');
  });

  it('resolves cross-namespace $t(ns:key)', () => {
    const result = convertCatalogs({
      defaultLocale: 'en',
      locales: ['en'],
      defaultNS: 'translation',
      raw: {
        en: {
          translation: { title: 'Home of $t(common:brand)' },
          common: { brand: 'Acme' },
        },
      },
    });
    expect(result.byLocale.en.title).toBe('Home of Acme');
  });

  it('reports and preserves $t() with options', () => {
    const { dict, reports } = convert({
      key: 'x',
      ref: 'value: $t(key, {"count": 1})',
    });
    expect(reports.some((r) => /passes options/.test(r.reason))).toBe(true);
    expect(typeof dict.ref).toBe('string');
  });

  it('detects and reports a nesting cycle', () => {
    const { reports } = convert({ a: '$t(b)', b: '$t(a)' });
    expect(reports.some((r) => /cycle/.test(r.reason))).toBe(true);
  });

  it('skip+reports array / returnObjects values', () => {
    const { dict, reports } = convert({ list: ['a', 'b'] });
    expect(dict.list).toEqual(['a', 'b']);
    expect(reports.some((r) => /array value/.test(r.reason))).toBe(true);
  });

  it('synthesizes an entry from a call-site defaultValue when the key is absent', () => {
    const { dict, reports } = convert(
      { present: 'here' },
      {
        defaults: [
          { ns: 'translation', key: 'missing', value: 'Fallback {{x}}' },
        ],
      }
    );
    expect(dict.missing).toBe('Fallback {x}');
    expect(reports.some((r) => /synthesized/.test(r.reason))).toBe(true);
  });
});

describe('nested keys and namespaces', () => {
  it('preserves dotted nested keys', () => {
    const { dict } = convert({ nav: { home: 'Home', about: 'About' } });
    expect(dict.nav).toEqual({ home: 'Home', about: 'About' });
  });

  it('merges defaultNS at root and other namespaces under their key', () => {
    const result = convertCatalogs({
      defaultLocale: 'en',
      locales: ['en'],
      defaultNS: 'common',
      raw: {
        en: {
          common: { title: 'Title' },
          dashboard: { widgets: { count: 'Widgets' } },
        },
      },
    });
    expect(result.byLocale.en.title).toBe('Title');
    expect(result.byLocale.en.dashboard).toEqual({
      widgets: { count: 'Widgets' },
    });
  });
});

describe('separators', () => {
  it('refuses keySeparator: false (flat keys with dots)', () => {
    expect(() =>
      convert(
        { 'a.b': 'x' },
        { separators: { ...defaults(), keySeparator: false } }
      )
    ).toThrow(CatalogConversionError);
  });

  it('adapts a non-default nsSeparator in $t resolution', () => {
    const result = convertCatalogs({
      defaultLocale: 'en',
      locales: ['en'],
      defaultNS: 'translation',
      separators: { ...defaults(), nsSeparator: '::' },
      raw: {
        en: {
          translation: { title: 'By $t(common::brand)' },
          common: { brand: 'Acme' },
        },
      },
    });
    expect(result.byLocale.en.title).toBe('By Acme');
  });
});

describe('i18next-icu fast path', () => {
  it('passes ICU through, only merging + inlining $t', () => {
    const { dict } = convert(
      {
        count: '{n, plural, one {# item} other {# items}}',
        ref: '$t(count)',
      },
      { isIcu: true }
    );
    // ICU preserved verbatim (not re-escaped), $t inlined.
    expect(dict.count).toBe('{n, plural, one {# item} other {# items}}');
    expect(dict.ref).toBe('{n, plural, one {# item} other {# items}}');
  });
});

// ---- adversary findings (converter) ----------------------------------------
// Each case is drawn from the preserved attack harness at
// adv-scratch/ri18n-conv-28234 and reproduces a data-corruption/loss path the
// converter must no longer silently take.

describe('adversary B3: literal # inside a plural must not read as the count', () => {
  it('quotes # inside a cardinal plural', () => {
    const { dict } = convert(
      { course_one: '1 C# course', course_other: '{{count}} C# courses' },
      { countKeys: new Set(['translation:course']) }
    );
    expect(render(dict.course as string, 'en', { count: 1 })).toBe(
      '1 C# course'
    );
    expect(render(dict.course as string, 'en', { count: 5 })).toBe(
      '5 C# courses'
    );
  });

  it('quotes # inside a selectordinal', () => {
    const { dict } = convert(
      {
        rank_ordinal_one: '#1 (C# dev)',
        rank_ordinal_other: '#{{count}} (C# dev)',
      },
      { countKeys: new Set(['translation:rank']) }
    );
    expect(render(dict.rank as string, 'en', { count: 1 })).toBe('#1 (C# dev)');
    expect(render(dict.rank as string, 'en', { count: 5 })).toBe('#5 (C# dev)');
  });

  it('still renders # literally in plain (non-plural) text', () => {
    const { dict } = convert({ k: 'C# is great, 100% sure' });
    expect(render(dict.k as string, 'en', {})).toBe('C# is great, 100% sure');
  });
});

describe('I1: # inside a number skeleton within a plural branch', () => {
  it('leaves skeleton # intact (parses via @formatjs and renders through gt)', () => {
    const { dict } = convert(
      {
        cart_one:
          '{{count}} item at {{price, number(minimumFractionDigits: 2, maximumFractionDigits: 4)}}',
        cart_other:
          '{{count}} items at {{price, number(minimumFractionDigits: 2, maximumFractionDigits: 4)}}',
      },
      { countKeys: new Set(['translation:cart']) }
    );
    const icu = dict.cart as string;
    // min 2, max 4 -> `.00##`; the skeleton # must NOT be ICU-quoted.
    expect(icu).toContain('::.00##');
    expect(icu).not.toContain("'#'");
    // (a) valid ICU per @formatjs
    expect(() => parseIcu(icu)).not.toThrow();
    // (b) renders correctly through gt's formatMessage
    expect(render(icu, 'en', { count: 1, price: 3 })).toBe('1 item at 3.00');
    expect(render(icu, 'en', { count: 5, price: 3.14159 })).toBe(
      '5 items at 3.1416'
    );
  });

  it('quotes a literal depth-0 # while leaving the skeleton # in the same branch', () => {
    const { dict } = convert(
      {
        room_one:
          'Room #{{count}} at {{price, number(minimumFractionDigits: 2, maximumFractionDigits: 4)}}',
        room_other:
          'Rooms #{{count}} at {{price, number(minimumFractionDigits: 2, maximumFractionDigits: 4)}}',
      },
      { countKeys: new Set(['translation:room']) }
    );
    const icu = dict.room as string;
    expect(icu).toContain('::.00##');
    expect(() => parseIcu(icu)).not.toThrow();
    // the literal # before {count} renders as a literal '#'
    expect(render(icu, 'en', { count: 1, price: 3 })).toBe('Room #1 at 3.00');
  });
});

describe('I2: custom keySeparator conversion', () => {
  const pipeSep = { ...DEFAULT_SEPARATORS, keySeparator: '|' };

  it('converts a | project into a nested, dot-resolvable dictionary', () => {
    const { dict } = convert(
      { greeting: { hello: 'Hi {{name}}' } },
      { separators: pipeSep }
    );
    // gt-next resolves by '.', and the dictionary nests greeting.hello.
    const hello = (dict.greeting as Record<string, unknown>).hello as string;
    expect(hello).toBe('Hi {name}');
    expect(render(hello, 'en', { name: 'Ada' })).toBe('Hi Ada');
  });

  it('refuses a | project whose key segment contains a literal .', () => {
    expect(() =>
      convert({ greeting: { 'a.b': 'Hi' } }, { separators: pipeSep })
    ).toThrow(CatalogConversionError);
    expect(() =>
      convert({ greeting: { 'a.b': 'Hi' } }, { separators: pipeSep })
    ).toThrow(/mis-nest/);
  });

  it('synthesizes a defaultValue for a non-default namespace at the correct nested path (J1)', () => {
    // '|' keySeparator, and 'dashboard:widgets|count' is absent from every
    // catalog but carries a call-site defaultValue. The synthesized entry must
    // nest under dashboard -> widgets -> count, not a spurious flat key
    // 'dashboard.widgets' joined with a literal '.'.
    const result = convertCatalogs({
      defaultLocale: 'en',
      locales: ['en'],
      defaultNS: 'translation',
      separators: pipeSep,
      raw: {
        en: {
          translation: { title: 'Home' },
          dashboard: { existing: 'X' },
        },
      },
      defaults: [
        { ns: 'dashboard', key: 'widgets|count', value: 'Count {{n}}' },
      ],
    });
    const dict = result.byLocale.en;
    // Correct nested shape, under the existing namespace.
    expect(dict.dashboard).toEqual({
      existing: 'X',
      widgets: { count: 'Count {n}' },
    });
    // No spurious flat key with a literal '.' at the dictionary root.
    expect(dict['dashboard.widgets']).toBeUndefined();
    // And the value is reachable by gt-next's '.'-path resolution.
    expect(resolveDotPath(dict, 'dashboard.widgets.count')).toBe('Count {n}');
    expect(result.reports.some((r) => /synthesized/.test(r.reason))).toBe(true);
  });

  it('leaves default-separator namespace synthesis nesting unchanged', () => {
    const result = convertCatalogs({
      defaultLocale: 'en',
      locales: ['en'],
      defaultNS: 'translation',
      raw: {
        en: {
          translation: { title: 'Home' },
          dashboard: { existing: 'X' },
        },
      },
      defaults: [
        { ns: 'dashboard', key: 'widgets.count', value: 'Count {{n}}' },
      ],
    });
    const dict = result.byLocale.en;
    expect(dict.dashboard).toEqual({
      existing: 'X',
      widgets: { count: 'Count {n}' },
    });
    expect(resolveDotPath(dict, 'dashboard.widgets.count')).toBe('Count {n}');
  });
});

describe('adversary B4: base key survives a plural-looking literal fallback', () => {
  it('keeps the base value when a group lacks count evidence', () => {
    const { dict, reports } = convert({
      medal: 'A medal',
      medal_one: 'Gold',
      medal_other: 'Participation',
    });
    expect(dict.medal).toBe('A medal');
    expect(dict.medal_one).toBe('Gold');
    expect(dict.medal_other).toBe('Participation');
    expect(reports.some((r) => /\bmedal\b/.test(r.key))).toBe(true);
  });

  it('keeps the base with a lone _other and no count', () => {
    const { dict } = convert({ notice: 'A notice', notice_other: 'Notices' });
    expect(dict.notice).toBe('A notice');
    expect(dict.notice_other).toBe('Notices');
  });
});

describe('adversary M3: default-ns / namespace collision is order-independent', () => {
  function run(order: string[]) {
    const trees: Record<string, Record<string, unknown>> = {};
    for (const ns of order) {
      if (ns === 'common')
        trees.common = { dashboard: 'DEFAULT-NS-VALUE', greeting: 'Hi' };
      else trees.dashboard = { title: 'NS-VALUE' };
    }
    return convertCatalogs({
      defaultLocale: 'en',
      locales: ['en'],
      defaultNS: 'common',
      raw: { en: trees },
    });
  }
  for (const order of [
    ['common', 'dashboard'],
    ['dashboard', 'common'],
  ]) {
    it(`drops+reports the default-ns key (order: ${order.join(',')})`, () => {
      const r = run(order);
      expect(r.byLocale.en.dashboard).toEqual({ title: 'NS-VALUE' });
      expect(r.byLocale.en.greeting).toBe('Hi');
      expect(
        r.reports.some((x) => /collides with a namespace/.test(x.reason))
      ).toBe(true);
    });
  }
});

describe('adversary M5: defaultValue synthesis must not clobber a string', () => {
  it('does not overwrite an existing string with a synthesized nested object', () => {
    const { dict, reports } = convert(
      { user: 'A user (existing translation)' },
      { defaults: [{ ns: 'translation', key: 'user.name', value: 'Name' }] }
    );
    expect(dict.user).toBe('A user (existing translation)');
    expect(reports.some((r) => /collid/i.test(r.reason))).toBe(true);
  });
});

describe('adversary m5: context values that equal CLDR categories', () => {
  it('preserves the base and names the context possibility in the report', () => {
    const { dict, reports } = convert(
      {
        step: 'a step',
        step_one: 'the first step',
        step_other: 'another step',
      },
      { contextKeys: new Set(['translation:step']) }
    );
    // Base translation survives (B4); the suffixed variants stay literal.
    expect(dict.step).toBe('a step');
    expect(dict.step_one).toBe('the first step');
    expect(dict.step_other).toBe('another step');
    // The report names the context possibility, not just "looks like a plural".
    expect(reports.some((r) => /context/.test(r.reason))).toBe(true);
  });
});

describe('adversary M6: $-named interpolation is not emitted as invalid ICU', () => {
  it('reports {{$var}} and keeps it literal', () => {
    const { dict, reports } = convert({ k: 'Hi {{$user}}' });
    expect(() => parseIcu(dict.k as string)).not.toThrow();
    expect(
      reports.some((r) => /variable name ICU cannot express/.test(r.reason))
    ).toBe(true);
  });
});

describe('adversary m6: fraction-digit skeletons are min/max independent', () => {
  it('maps maximumFractionDigits to an up-to (#) skeleton', () => {
    const { dict } = convert({ p: '{{v, number(maximumFractionDigits: 2)}}' });
    expect(dict.p).toBe('{v, number, ::.##}');
    expect(render(dict.p as string, 'en', { v: 3 })).toBe('3');
    expect(render(dict.p as string, 'en', { v: 3.5 })).toBe('3.5');
  });
});

describe('adversary m7: underscore locale tags still resolve CLDR plurals', () => {
  it('normalizes pt_BR before Intl.PluralRules', () => {
    const raw = {
      items_one: '{{count}} item',
      items_other: '{{count}} items',
    };
    const { byLocale, reports } = convertCatalogs({
      defaultLocale: 'pt_BR',
      locales: ['pt_BR'],
      defaultNS: 'translation',
      raw: { pt_BR: { translation: raw } },
      countKeys: new Set(['translation:items']),
    });
    expect(byLocale.pt_BR.items).toBe(
      '{count, plural, one {{count} item} other {{count} items}}'
    );
    expect(reports.some((r) => /outside .*CLDR set/.test(r.reason))).toBe(
      false
    );
  });
});

describe('adversary m8: currency fraction options are mapped or reported', () => {
  it('maps currency fraction digits into the skeleton', () => {
    const { dict } = convert({
      p: '{{v, currency(currency: USD, minimumFractionDigits: 4)}}',
    });
    expect(dict.p).toBe('{v, number, ::currency/USD .0000}');
    expect(() => parseIcu(dict.p as string)).not.toThrow();
    expect(render(dict.p as string, 'en', { v: 3 })).toBe('$3.0000');
  });
});

describe('adversary m9: identical $t reports are de-duplicated', () => {
  it('reports an unresolvable nested ref once per key, not once per depth', () => {
    const { reports } = convert({ a: '$t(missing) and $t(missing)' });
    const dupes = reports.filter((r) => /\$t\(missing\)/.test(r.reason));
    expect(dupes.length).toBe(1);
  });
});

function defaults() {
  return {
    keySeparator: '.' as const,
    nsSeparator: ':' as const,
    contextSeparator: '_',
    pluralSeparator: '_',
  };
}
