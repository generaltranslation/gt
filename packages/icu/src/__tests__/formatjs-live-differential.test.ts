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
  '{value, date, ::yyyyMMMdd}',
  '{value, time, ::HHmmss}',
  '{value, time, ::C}',
  '{value, time, ::S}',
  '{value, time, ::A}',
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

const formatJsFormatters = new Map<string, IntlMessageFormat>();

function formatWithFormatJs(
  message: string,
  locale: string,
  values: Record<string, unknown>
): unknown {
  const key = `${locale}\u0000${message}`;
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

  it.each(DATE_RUNTIME_CASES)(
    'matches date/time formatting for $locale and $message',
    ({ locale, message, value }) => {
      const values = { value };
      expect(formatMessage(message, locale, values)).toEqual(
        formatWithFormatJs(message, locale, values)
      );
    }
  );

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

  it.each(INVALID_MESSAGES)(
    'matches rejection of invalid input %j',
    (message) => {
      expect(() => parse(message)).toThrow();
      expect(() => formatJsParse(message)).toThrow();
    }
  );
});

// FormatJS printAST is intentionally not used as an oracle: it is not part of
// the package's public API, and its tag handling historically lost plural
// context. Public AST equivalence plus our own parse/print round trip protects
// the supported contract without reproducing that upstream bug.
