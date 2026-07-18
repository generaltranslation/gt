import { describe, expect, it } from 'vitest';
import { parse as parseIcu } from '@formatjs/icu-messageformat-parser';
import { formatMessage } from '@generaltranslation/format';
import {
  CatalogConversionError,
  convertCatalogs,
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

function convert(raw: Record<string, unknown>, overrides: Partial<ConvertInput> = {}) {
  const result = convertCatalogs(input(raw, overrides));
  return { dict: result.byLocale.en, reports: result.reports };
}

/** Renders an ICU string through gt's own formatter (the gt-next runtime path). */
function render(icu: string, locale: string, vars: Record<string, unknown>): string {
  return formatMessage(icu, { locales: [locale], variables: vars });
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
    expect(render(dict.greeting as string, 'en', { name: 'Ada' })).toBe('Hello Ada');
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
    const { dict } = convert({ price: '{{v, number(minimumFractionDigits: 2)}}' });
    expect(dict.price).toBe('{v, number, ::.00}');
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
      input(pl, { locales: ['pl'], defaultLocale: 'pl', raw: { pl: { translation: pl } } })
    );
    expect(byLocale.pl.items).toBe(
      '{count, plural, one {{count} produkt} few {{count} produkty} many {{count} produktów} other {{count} produktu}}'
    );
    // Polish plural boundaries: 1=one, 2=few, 5=many, 22=few.
    expect(render(byLocale.pl.items as string, 'pl', { count: 1 })).toBe('1 produkt');
    expect(render(byLocale.pl.items as string, 'pl', { count: 2 })).toBe('2 produkty');
    expect(render(byLocale.pl.items as string, 'pl', { count: 5 })).toBe('5 produktów');
    expect(render(byLocale.pl.items as string, 'pl', { count: 22 })).toBe('22 produkty');
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
      input(ar, { locales: ['ar'], defaultLocale: 'ar', raw: { ar: { translation: ar } } })
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
    expect(reports.some((r) => /lack the required `other`/.test(r.reason))).toBe(true);
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
    expect(dict.rank).toBe('{count, plural, one {{count} rank} other {{count} ranks}}');
    expect(dict.rank_ordinal_one).toBe('{count}st');
    expect(dict.rank_ordinal_other).toBe('{count}th');
    expect(reports.some((r) => /ordinal.*collides/.test(r.reason))).toBe(true);
  });
});

describe('context selectors (call-site gated)', () => {
  it('converts to {context, select} only when a call site passed context', () => {
    const { dict } = convert(
      { friend: 'a friend', friend_male: 'his friend', friend_female: 'her friend' },
      { contextKeys: new Set(['translation:friend']) }
    );
    expect(dict.friend).toBe(
      '{context, select, female {her friend} male {his friend} other {a friend}}'
    );
    expect(render(dict.friend as string, 'en', { context: 'male' })).toBe('his friend');
    expect(render(dict.friend as string, 'en', { context: 'x' })).toBe('a friend');
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
    expect(reports.some((r) => /combined context\+plural/.test(r.reason))).toBe(true);
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
      { defaults: [{ ns: 'translation', key: 'missing', value: 'Fallback {{x}}' }] }
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
    expect(result.byLocale.en.dashboard).toEqual({ widgets: { count: 'Widgets' } });
  });
});

describe('separators', () => {
  it('refuses keySeparator: false (flat keys with dots)', () => {
    expect(() =>
      convert({ 'a.b': 'x' }, { separators: { ...defaults(), keySeparator: false } })
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

function defaults() {
  return {
    keySeparator: '.' as const,
    nsSeparator: ':' as const,
    contextSeparator: '_',
    pluralSeparator: '_',
  };
}
