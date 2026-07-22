/**
 * Live compatibility oracle for the exact FormatJS versions replaced by this
 * package: intl-messageformat 10.7.16 and
 * @formatjs/icu-messageformat-parser 2.11.4.
 *
 * The upstream implementations and tests are available at:
 * https://github.com/formatjs/formatjs/tree/75edf1cd6a7045475bb134daf62c686602c92547/packages/intl-messageformat
 * https://github.com/formatjs/formatjs/tree/75edf1cd6a7045475bb134daf62c686602c92547/packages/icu-messageformat-parser
 * intl-messageformat is BSD-3-Clause licensed and the parser is MIT licensed.
 * See ../../THIRD_PARTY_NOTICES.md.
 *
 * These dependencies must remain exact-pinned test-only oracles. They must not
 * be moved to runtime dependencies, where they would undo the bundle reduction.
 */

import { parse as formatJsParse } from '@formatjs/icu-messageformat-parser';
import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import { formatMessage, parse, printAST } from '../index';

const PLURAL_LOCALES = [
  'en',
  'fr',
  'ar',
  'ru',
  'pl',
  'cs',
  'sl',
  'cy',
] as const;
const PLURAL_MESSAGES = [
  '{value, plural, zero {zero:#} one {one:#} two {two:#} few {few:#} many {many:#} other {other:#}}',
  '{value, selectordinal, zero {zero:#} one {one:#} two {two:#} few {few:#} many {many:#} other {other:#}}',
  '{value, plural, =1 {canonical} =01 {leading} =+1 {positive} =0 {zero} =-0 {negative-zero} =-01 {negative-leading} other {other:#}}',
  '{value, plural, offset:2 =0 {none} =1 {one} one {category-one:#} other {other:#}}',
] as const;
const PLURAL_VALUES: Array<number | string> = [
  ...Array.from({ length: 70 }, (_, index) => index - 5),
  '-01',
  '-0',
  '0',
  '+1',
  '01',
  '1',
  '2',
  '2.5',
  '10',
  '101',
];

const PLURAL_RUNTIME_CASES = PLURAL_LOCALES.flatMap((locale) =>
  PLURAL_MESSAGES.flatMap((message) =>
    PLURAL_VALUES.map((value) => ({ locale, message, value }))
  )
);

const NUMBER_LOCALES = ['en-US', 'fr-FR', 'de-DE'] as const;
const NUMBER_MESSAGES = [
  '{value, number}',
  '{value, number, integer}',
  '{value, number, percent}',
  '{value, number, ::scale/0}',
  '{value, number, ::scale/0.01}',
  '{value, number, ::currency/USD .00}',
  '{value, number, ::compact-short}',
  '{value, number, ::integer-width/*000}',
  '{value, number, ::integer-width/xx}',
  '{value, number, ::integer-width/*}',
  '{value, number, ::integer-width/x*00}',
  '{value, number, ::integer-width/foo*00bar}',
  '{value, number, ::.00/xyzr}',
  '{value, number, ::.00/xyzs}',
] as const;
const NUMBER_VALUES: Array<number | string> = [
  -1234.567,
  -0,
  0,
  0.125,
  1,
  12.34,
  1234.567,
  '2.5',
  '123456789012345678901234567890',
];

const NUMBER_RUNTIME_CASES = NUMBER_LOCALES.flatMap((locale) =>
  NUMBER_MESSAGES.flatMap((message) =>
    NUMBER_VALUES.map((value) => ({ locale, message, value }))
  )
);

const OBJECT_PROTOTYPE_SKELETON_STEMS = [
  'constructor',
  'toString',
  '__proto__',
  'valueOf',
  'hasOwnProperty',
] as const;

const DATE_VALUE = new Date('2020-05-06T14:03:02Z');
const DATE_RUNTIME_CASES = NUMBER_LOCALES.flatMap((locale) =>
  [
    '{value, date}',
    '{value, date, short}',
    '{value, time, medium}',
    '{value, date, ::yyyyMMMdd}',
    '{value, time, ::HHmmss}',
    '{value, time, ::C}',
    '{value, time, ::S}',
    '{value, time, ::A}',
  ].map((message) => ({ locale, message, value: DATE_VALUE }))
);

const HOUR_SKELETON_RUNTIME_CASES = [
  ...['Ch', 'hC', 'Cj', 'Jj', 'jJ'].map((skeleton) => ({
    locale: 'en-US',
    skeleton,
  })),
  { locale: 'de-DE', skeleton: 'hj' },
  { locale: 'en-u-rg-gbzzzz', skeleton: 'j' },
  { locale: 'en-GB-u-rg-uszzzz', skeleton: 'j' },
  { locale: 'und-GB', skeleton: 'j' },
] as const;
const HOUR_SKELETON_AST_CASES = [
  ...HOUR_SKELETON_RUNTIME_CASES,
  { locale: 'en-US', skeleton: 'JJJ' },
  { locale: 'en-US', skeleton: 'Mj' },
] as const;
const HOUR_SKELETON_SYMBOLS = ['h', 'H', 'k', 'K', 'j', 'J', 'C'] as const;
const GENERATED_HOUR_SKELETONS = [1, 2, 3].flatMap((length) =>
  Array.from(
    { length: HOUR_SKELETON_SYMBOLS.length ** length },
    (_, combination) => {
      let cursor = combination;
      return Array.from({ length }, () => {
        const symbol =
          HOUR_SKELETON_SYMBOLS[cursor % HOUR_SKELETON_SYMBOLS.length];
        cursor = Math.floor(cursor / HOUR_SKELETON_SYMBOLS.length);
        return symbol;
      }).join('');
    }
  )
);
const GENERATED_HOUR_SKELETON_CASES = [
  'en-US',
  'de-DE',
  'ar-EG',
  'ja-JP',
  'en-u-rg-gbzzzz',
  'en-GB-u-rg-uszzzz',
  'und-GB',
].flatMap((locale) =>
  GENERATED_HOUR_SKELETONS.map((skeleton) => ({ locale, skeleton }))
);

const NON_GRAMMAR_SPACES = [
  '\u00A0',
  '\u1680',
  '\u2000',
  '\u2007',
  '\u202F',
  '\u205F',
  '\u3000',
] as const;

const SIMPLE_RUNTIME_CASES = [
  {
    locale: 'en-US',
    message: 'Hello {name}',
    values: { name: 'Ada' },
  },
  {
    locale: 'en-US',
    message: '{kind, select, yes {Hi {name}} other {No}}',
    values: { kind: 'yes', name: 'Ada' },
  },
  {
    locale: 'en-US',
    message:
      '{kind, select, yes {{count, plural, one {one item} other {# items}}} other {none}}',
    values: { kind: 'yes', count: '2' },
  },
  {
    locale: 'en-US',
    message: "This '{isn''t}' {name}'s first test",
    values: { name: 'Ada' },
  },
  {
    locale: 'en-US',
    message: '{n, number, foo{bar}baz}',
    values: { n: 1234.5 },
  },
  {
    locale: 'en-US',
    message: '{n, number, ::s{al.e/0.5}',
    values: { n: 1234.5 },
  },
  {
    locale: 'en-US',
    message: '{n,number,{}',
    values: { n: 1234.5 },
  },
  {
    locale: 'en-US',
    message: '{x, number,{percent}',
    values: { x: 1234.5 },
  },
] as const;

const PARSER_MESSAGES = [
  'plain text',
  '}',
  'Héllo 🎉 {name}',
  '{first}{second}{third}',
  '{kind, select, yes {Hi {name}} other {No}}',
  '{value, plural, =1 {canonical} =01 {leading} =+1 {positive} =0 {zero} =-0 {negative-zero} =-01 {negative-leading} other {other:#}}',
  '{value, plural, offset:2 =0 {none} one {one:#} other {other:#}}',
  '{value, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
  '<b>Bold <i>{name}</i></b>',
  "This '{isn''t}' obvious",
  "{value, plural, other {'#' #}}",
  '{value, number, ::currency/USD .00##}',
  '{value, number, ::scale/0}',
  '{value, number, ::integer-width/*000}',
  '{value, number, ::integer-width/xx}',
  '{value, number, ::integer-width/*}',
  '{value, number, ::integer-width/x*00}',
  '{value, number, ::integer-width/foo*00bar}',
  '{value, number, ::currency}',
  '{value, number, ::.00/xyzr}',
  '{value, number, ::.00/xyzs}',
  '{value, date, ::yyyyMMMdd}',
  '{value, time, ::HHmmss}',
  '{value, time, ::C}',
  '{value, time, ::S}',
  '{value, time, ::A}',
  '{value, time, ::jh}',
  '{value, time, ::hj}',
  '{n, number, foo{bar}baz}',
  '{n, number, ::s{al.e/0.5}',
  '{n,number,{}',
  '{x, number,{percent}',
  '{n, number, foo{bar} {_gt_, select, other {X}}}',
  ...Array.from(
    { length: 128 },
    (_, index) => `prefix ${index} {value${index}} suffix ${127 - index}`
  ),
  ...Array.from(
    { length: 64 },
    (_, index) =>
      `{value${index}, plural, offset:${index % 5} =0 {zero} =0${index + 1} {leading} one {one:#} other {other:#}}`
  ),
];

const INVALID_MESSAGES = [
  '{',
  '{value',
  '{value,}',
  '{value, unknown}',
  '{value, plural}',
  '{value, plural, one {one}}',
  '{value, plural, one {one} one {duplicate} other {other}}',
  '{value, plural, = {empty} other {other}}',
  '{value, plural, =1.5 {decimal} other {other}}',
  '{value, plural, offset: {other {other}}}',
  '{value, select, other {unterminated}',
  '{value, number, ::}',
  '{value, date, ::}',
  '<b>unterminated',
] as const;

const EXACT_ERROR_MESSAGES = [
  '{',
  '{name',
  '{value,',
  '{value,}',
  '{value, select',
  '{value, select,',
  '{value, select, selected',
  '{value, select, selected {yes} selected {again} other {no}}',
  '{value, plural',
  '{value, plural,',
  '{value, plural, offset: other {no}}',
  '{value, plural, offset:999999999999999999999 other {no}}',
  '{value, plural, =1.5 {decimal} other {no}}',
  '{value, plural, =999999999999999999999 {large} other {no}}',
  '{value, plural, one selected other {no}}',
  '<b>unterminated',
  '<b>text</>',
  '<b>text</b',
  "{value, number, 'unterminated}",
  '{value, number, ::currency/',
  '{value, number, ::currency/}',
  '{value, number, ::}',
] as const;

const INVALID_SIGNIFICANT_PRECISION_SKELETONS = [
  '#',
  '##',
  '+',
  'r',
  's',
  '#r',
  '##s',
  '+r',
  '+s',
  '.00/#',
  '.00/+',
  '.00/r',
] as const;

const formatJsFormatters = new Map<string, IntlMessageFormat>();

function formatWithFormatJs(
  message: string,
  locale: string | string[],
  values: Record<string, unknown>
): unknown {
  const key = `${JSON.stringify(locale)}\u0000${message}`;
  let formatter = formatJsFormatters.get(key);
  if (!formatter) {
    formatter = new IntlMessageFormat(message, locale);
    formatJsFormatters.set(key, formatter);
  }
  return formatter.format(values as never);
}

describe('live FormatJS runtime compatibility', () => {
  it.each(PLURAL_RUNTIME_CASES)(
    'matches plural formatting for $locale, $value, $message',
    ({ locale, message, value }) => {
      const values = { value };
      expect(formatMessage(message, locale, values)).toEqual(
        formatWithFormatJs(message, locale, values)
      );
    }
  );

  it.each(NUMBER_RUNTIME_CASES)(
    'matches number formatting for $locale, $value, $message',
    ({ locale, message, value }) => {
      const values = { value };
      expect(formatMessage(message, locale, values)).toEqual(
        formatWithFormatJs(message, locale, values)
      );
    }
  );

  it.each(OBJECT_PROTOTYPE_SKELETON_STEMS)(
    'ignores inherited rounding-mode map key ::%s like FormatJS',
    (stem) => {
      const message = `{value, number, ::${stem}}`;
      const values = { value: 1234.5 };
      expect(formatMessage(message, 'en-US', values)).toEqual(
        formatWithFormatJs(message, 'en-US', values)
      );
    }
  );

  it.each(DATE_RUNTIME_CASES)(
    'matches date/time formatting for $locale and $message',
    ({ locale, message, value }) => {
      const values = { value };
      expect(formatMessage(message, locale, values)).toEqual(
        formatWithFormatJs(message, locale, values)
      );
    }
  );

  it.each(HOUR_SKELETON_RUNTIME_CASES)(
    'matches locale-aware hour skeleton ::$skeleton for $locale',
    ({ locale, skeleton }) => {
      const message = `{value, time, ::${skeleton}}`;
      const values = { value: new Date(2020, 4, 6, 14, 3, 2) };
      expect(formatMessage(message, locale, values)).toEqual(
        formatWithFormatJs(message, locale, values)
      );
    }
  );

  it.each(GENERATED_HOUR_SKELETON_CASES)(
    'matches generated hour skeleton ::$skeleton for $locale',
    ({ locale, skeleton }) => {
      const message = `{value, time, ::${skeleton}}`;
      const values = { value: new Date(2020, 4, 6, 19, 3, 2) };
      expect(formatMessage(message, locale, values)).toEqual(
        formatWithFormatJs(message, locale, values)
      );

      const localeObject = new Intl.Locale(locale);
      expect(parse(message, { locale: localeObject })).toEqual(
        formatJsParse(message, { locale: localeObject })
      );
    }
  );

  it.each(NON_GRAMMAR_SPACES)(
    'matches named-style behavior after non-grammar space %j',
    (space) => {
      const message = `{value, number, ${space}percent}`;
      const values = { value: 2 };
      expect(formatMessage(message, 'en-US', values)).toEqual(
        formatWithFormatJs(message, 'en-US', values)
      );
    }
  );

  it.each(['scale', 'scale/0x10', 'scale/2foo'])(
    'matches FormatJS parsing of number skeleton ::%s',
    (skeleton) => {
      const message = `{value, number, ::${skeleton}}`;
      const values = { value: 3 };
      expect(formatMessage(message, 'en-US', values)).toEqual(
        formatWithFormatJs(message, 'en-US', values)
      );
    }
  );

  it('matches inherited and proxy-backed variable lookup', () => {
    const inherited = Object.create({ name: 'Ada', count: '2' }) as Record<
      string,
      unknown
    >;
    const message = 'Hello {name}: {count, plural, other {# items}}';
    expect(formatMessage(message, 'en', inherited)).toEqual(
      formatWithFormatJs(message, 'en', inherited)
    );

    const proxy = new Proxy<Record<string, unknown>>(
      {},
      {
        get: (_target, key) => (key === 'name' ? 'Grace' : undefined),
        has: (_target, key) => key === 'name',
      }
    );
    expect(formatMessage('Hello {name}', 'en', proxy)).toEqual(
      formatWithFormatJs('Hello {name}', 'en', proxy)
    );
  });

  it('matches empty and sparse locale-list behavior', () => {
    const message = '{value, time, ::j}';
    const values = { value: new Date(2020, 4, 6, 7, 3, 2) };
    const sparseLocales: string[] = [];
    sparseLocales[1] = 'fr-FR';

    expect(formatMessage(message, sparseLocales, values)).toEqual(
      formatWithFormatJs(message, sparseLocales, values)
    );
    expect(() => formatMessage(message, [], values)).toThrow();
    expect(() => formatWithFormatJs(message, [], values)).toThrow();
  });

  it.each(SIMPLE_RUNTIME_CASES)(
    'matches argument/select behavior for $message',
    ({ locale, message, values }) => {
      expect(formatMessage(message, locale, values)).toEqual(
        formatWithFormatJs(message, locale, values)
      );
    }
  );
});

describe('live FormatJS parser compatibility', () => {
  it.each(PARSER_MESSAGES)('matches the AST for %j', (message) => {
    expect(parse(message, { captureLocation: false })).toEqual(
      formatJsParse(message, { captureLocation: false })
    );
  });

  it.each(PARSER_MESSAGES)(
    'preserves the AST through our public parse/print round trip for %j',
    (message) => {
      const ast = parse(message, { captureLocation: false });
      expect(parse(printAST(ast), { captureLocation: false })).toEqual(ast);
    }
  );

  it.each(OBJECT_PROTOTYPE_SKELETON_STEMS)(
    'ignores inherited rounding-mode map key ::%s in the AST',
    (stem) => {
      const message = `{value, number, ::${stem}}`;
      expect(parse(message, { captureLocation: false })).toEqual(
        formatJsParse(message, { captureLocation: false })
      );
    }
  );

  it.each(INVALID_MESSAGES)(
    'matches rejection of invalid input %j',
    (message) => {
      expect(() => parse(message)).toThrow();
      expect(() => formatJsParse(message)).toThrow();
    }
  );

  it.each(HOUR_SKELETON_AST_CASES)(
    'matches the locale-aware AST for ::$skeleton in $locale',
    ({ locale, skeleton }) => {
      const message = `{value, time, ::${skeleton}}`;
      const localeObject = new Intl.Locale(locale);
      expect(parse(message, { locale: localeObject })).toEqual(
        formatJsParse(message, { locale: localeObject })
      );
    }
  );

  it.each(EXACT_ERROR_MESSAGES)(
    'matches SyntaxError metadata for %j',
    (message) => {
      let formatJsError: unknown;
      let replacementError: unknown;
      try {
        formatJsParse(message);
      } catch (error) {
        formatJsError = error;
      }
      try {
        parse(message);
      } catch (error) {
        replacementError = error;
      }

      expect(replacementError).toMatchObject({
        message: (formatJsError as Error).message,
        location: (formatJsError as Error & { location: unknown }).location,
        originalMessage: (formatJsError as Error & { originalMessage: string })
          .originalMessage,
      });
    }
  );

  it.each(INVALID_SIGNIFICANT_PRECISION_SKELETONS)(
    'matches FormatJS rejection of malformed significant precision ::%s',
    (skeleton) => {
      const message = `{value, number, ::${skeleton}}`;
      expect(() => parse(message)).toThrow();
      expect(() => formatJsParse(message)).toThrow();
    }
  );
});

// FormatJS printAST is intentionally not used as an oracle: it is not part of
// the package's public API, and its tag handling historically lost plural
// context. Public AST equivalence plus our own parse/print round trip protects
// the supported contract without reproducing that upstream bug.
