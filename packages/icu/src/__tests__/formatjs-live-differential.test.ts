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
import { expectEachCase } from './expectEachCase';

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
// The skeleton scanner only sees a locale through its resolved hour symbol, so
// every combination runs for one 12-hour and one 24-hour locale. The locales
// that exercise other ways of resolving that symbol (numbering system, region
// overrides, undetermined language) run every combination of up to two symbols.
const GENERATED_HOUR_SKELETON_LOCALES = [
  ...['en-US', 'de-DE'].map((locale) => ({
    locale,
    skeletons: GENERATED_HOUR_SKELETONS,
  })),
  ...['ar-EG', 'ja-JP', 'en-u-rg-gbzzzz', 'en-GB-u-rg-uszzzz', 'und-GB'].map(
    (locale) => ({
      locale,
      skeletons: GENERATED_HOUR_SKELETONS.filter(
        (skeleton) => skeleton.length <= 2
      ),
    })
  ),
];

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
  'prefix 0 {value0} suffix 127',
  'prefix 127 {value127} suffix 0',
  // Offsets 0-4 with one- and two-digit leading-zero exact selectors.
  ...Array.from(
    { length: 10 },
    (_, index) =>
      `{value${index}, plural, offset:${index % 5} =0 {zero} =0${index + 1} {leading} one {one:#} other {other:#}}`
  ),
  ...OBJECT_PROTOTYPE_SKELETON_STEMS.map(
    (stem) => `{value, number, ::${stem}}`
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

function expectSameFormat(
  message: string,
  locale: string | string[],
  values: Record<string, unknown>
): void {
  expect(formatMessage(message, locale, values)).toEqual(
    formatWithFormatJs(message, locale, values)
  );
}

function expectSameAst(message: string, locale?: string): void {
  const options = locale
    ? { locale: new Intl.Locale(locale) }
    : { captureLocation: false };
  expect(parse(message, options)).toEqual(formatJsParse(message, options));
}

function catchError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

// Each test below checks a whole corpus; expectEachCase reports every failing
// input instead of registering thousands of individual tests.
describe('live FormatJS runtime compatibility', () => {
  it('matches plural formatting', () => {
    expectEachCase(PLURAL_RUNTIME_CASES, ({ locale, message, value }) => {
      expectSameFormat(message, locale, { value });
    });
  });

  it('matches number formatting', () => {
    expectEachCase(NUMBER_RUNTIME_CASES, ({ locale, message, value }) => {
      expectSameFormat(message, locale, { value });
    });
  });

  it('ignores inherited rounding-mode map keys like FormatJS', () => {
    expectEachCase(OBJECT_PROTOTYPE_SKELETON_STEMS, (stem) => {
      expectSameFormat(`{value, number, ::${stem}}`, 'en-US', {
        value: 1234.5,
      });
    });
  });

  it('matches date/time formatting', () => {
    expectEachCase(DATE_RUNTIME_CASES, ({ locale, message, value }) => {
      expectSameFormat(message, locale, { value });
    });
  });

  it('matches locale-aware hour skeletons', () => {
    const values = { value: new Date(2020, 4, 6, 14, 3, 2) };
    expectEachCase(HOUR_SKELETON_RUNTIME_CASES, ({ locale, skeleton }) => {
      expectSameFormat(`{value, time, ::${skeleton}}`, locale, values);
    });
  });

  // One test per locale: the whole corpus in one test outran the test timeout
  // on a busy CI runner.
  it.each(GENERATED_HOUR_SKELETON_LOCALES)(
    'matches every generated hour skeleton and its AST for $locale',
    ({ locale, skeletons }) => {
      const values = { value: new Date(2020, 4, 6, 19, 3, 2) };
      expectEachCase(skeletons, (skeleton) => {
        const message = `{value, time, ::${skeleton}}`;
        expectSameFormat(message, locale, values);
        expectSameAst(message, locale);
      });
    }
  );

  it('matches named-style behavior after non-grammar spaces', () => {
    expectEachCase(NON_GRAMMAR_SPACES, (space) => {
      expectSameFormat(`{value, number, ${space}percent}`, 'en-US', {
        value: 2,
      });
    });
  });

  it('matches FormatJS parsing of malformed scale skeletons', () => {
    expectEachCase(['scale', 'scale/0x10', 'scale/2foo'], (skeleton) => {
      expectSameFormat(`{value, number, ::${skeleton}}`, 'en-US', { value: 3 });
    });
  });

  it('matches inherited and proxy-backed variable lookup', () => {
    const inherited = Object.create({ name: 'Ada', count: '2' }) as Record<
      string,
      unknown
    >;
    expectSameFormat(
      'Hello {name}: {count, plural, other {# items}}',
      'en',
      inherited
    );

    const proxy = new Proxy<Record<string, unknown>>(
      {},
      {
        get: (_target, key) => (key === 'name' ? 'Grace' : undefined),
        has: (_target, key) => key === 'name',
      }
    );
    expectSameFormat('Hello {name}', 'en', proxy);
  });

  it('matches empty and sparse locale-list behavior', () => {
    const message = '{value, time, ::j}';
    const values = { value: new Date(2020, 4, 6, 7, 3, 2) };
    const sparseLocales: string[] = [];
    sparseLocales[1] = 'fr-FR';

    expectSameFormat(message, sparseLocales, values);
    expect(() => formatMessage(message, [], values)).toThrow();
    expect(() => formatWithFormatJs(message, [], values)).toThrow();
  });

  it('matches argument/select behavior', () => {
    expectEachCase(SIMPLE_RUNTIME_CASES, ({ locale, message, values }) => {
      expectSameFormat(message, locale, values);
    });
  });
});

describe('live FormatJS parser compatibility', () => {
  it('matches the AST', () => {
    expectEachCase(PARSER_MESSAGES, (message) => expectSameAst(message));
  });

  it('preserves the AST through our public parse/print round trip', () => {
    expectEachCase(PARSER_MESSAGES, (message) => {
      const ast = parse(message, { captureLocation: false });
      expect(parse(printAST(ast), { captureLocation: false })).toEqual(ast);
    });
  });

  it('matches the locale-aware AST for hour skeletons', () => {
    expectEachCase(HOUR_SKELETON_AST_CASES, ({ locale, skeleton }) => {
      expectSameAst(`{value, time, ::${skeleton}}`, locale);
    });
  });

  it('matches rejection of invalid input', () => {
    const messages = [
      ...INVALID_MESSAGES,
      ...INVALID_SIGNIFICANT_PRECISION_SKELETONS.map(
        (skeleton) => `{value, number, ::${skeleton}}`
      ),
    ];
    expectEachCase(messages, (message) => {
      expect(() => parse(message)).toThrow();
      expect(() => formatJsParse(message)).toThrow();
    });
  });

  it('matches SyntaxError metadata', () => {
    expectEachCase(EXACT_ERROR_MESSAGES, (message) => {
      const formatJsError = catchError(() =>
        formatJsParse(message)
      ) as Error & {
        location: unknown;
        originalMessage: string;
      };

      expect(formatJsError).toBeInstanceOf(Error);
      expect(catchError(() => parse(message))).toMatchObject({
        message: formatJsError.message,
        location: formatJsError.location,
        originalMessage: formatJsError.originalMessage,
      });
    });
  });
});

// FormatJS printAST is intentionally not used as an oracle: it is not part of
// the package's public API, and its tag handling historically lost plural
// context. Public AST equivalence plus our own parse/print round trip protects
// the supported contract without reproducing that upstream bug.
