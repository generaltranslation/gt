/**
 * Regression cases are adapted from the FormatJS printer suite:
 * https://github.com/formatjs/formatjs/blob/75edf1cd6a7045475bb134daf62c686602c92547/packages/icu-messageformat-parser/tests/printer.test.ts
 * The upstream printer is MIT licensed. See ../../THIRD_PARTY_NOTICES.md.
 */

import { describe, expect, it } from 'vitest';
import { parse, printAST } from '../index';

const GENERATED_ROUND_TRIP_MESSAGES = [
  ...Array.from(
    { length: 64 },
    (_, index) =>
      `{choice, select, case${index} {Result ${index}: {name}} other {Fallback ${index}}}`
  ),
  ...Array.from(
    { length: 32 },
    (_, index) =>
      `{count, plural, offset:${index} =${index} {Exact ${index}} one {# item for {name}} other {# items for {name}}}`
  ),
  ...Array.from(
    { length: 32 },
    (_, index) =>
      `{place, selectordinal, =${index} {Exact ${index}} one {#st} two {#nd} few {#rd} other {#th}}`
  ),
  ...Array.from({ length: 24 }, (_, depth) => {
    let message = 'Hello {name}';
    for (let index = 0; index <= depth; index += 1) {
      message = `<tag${index}>${message}</tag${index}>`;
    }
    return message;
  }),
  ...[
    'percent',
    '%',
    '%x100',
    'currency/USD',
    'currency/EUR unit-width-narrow',
    'group-off',
    'group-auto',
    'group-min2',
    'group-on-aligned',
    'precision-integer',
    'measure-unit/length-meter unit-width-full-name',
    'compact-short',
    'compact-long',
    'scientific',
    'engineering',
    'notation-simple',
    'scale/0.01',
    'integer-width/*000',
    'rounding-mode-floor',
    '.',
    '.0',
    '.00',
    '.##',
    '.00##',
    '.000*',
    '@@',
    '@@#',
    'sign-auto',
    'sign-always',
    'sign-except-zero',
    'sign-never',
    'sign-accounting currency/USD',
    'E0',
    'EE+!00',
  ].map((skeleton) => `{value, number, ::${skeleton}}`),
  ...Array.from(
    { length: 32 },
    (_, index) => `Literal ${index} '{value${index}}' and {argument${index}}`
  ),
];

const ESCAPED_PLURAL_SYNTAX_FRAGMENTS = [
  '#',
  '##',
  '{',
  '}',
  '{}',
  '{#}',
  '<b>',
  '</b>',
];

// Exercise every three-fragment combination because the old printer failed
// when plural hashes were adjacent to one another or to other quoted syntax.
const GENERATED_ESCAPED_PLURAL_ROUND_TRIP_MESSAGES =
  ESCAPED_PLURAL_SYNTAX_FRAGMENTS.flatMap((first) =>
    ESCAPED_PLURAL_SYNTAX_FRAGMENTS.flatMap((second) =>
      ESCAPED_PLURAL_SYNTAX_FRAGMENTS.map(
        (third) => `{count, plural, other {'${first}${second}${third}'}}`
      )
    )
  );

describe('printAST', () => {
  it.each([
    ['', ''],
    ['Hello {name}', 'Hello {name}'],
    ['{n, number}', '{n, number}'],
    ['{n, number, percent}', '{n, number, percent}'],
    [
      '{n, number, ::compact-short currency/GBP}',
      '{n, number, ::compact-short currency/GBP}',
    ],
    ['{d, date, ::yyyyMMdd}', '{d, date, ::yyyyMMdd}'],
    [
      '{gender, select, male {He} female {She} other {They}}',
      '{gender,select,male{He} female{She} other{They}}',
    ],
    [
      '{count, plural, offset:2 =0 {none} one {# item} other {# items}}',
      '{count,plural,offset:2 =0{none} one{# item} other{# items}}',
    ],
    [
      '{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
      '{place,selectordinal,one{#st} two{#nd} few{#rd} other{#th}}',
    ],
    ['<b>Bold <i>{name}</i></b>', '<b>Bold <i>{name}</i></b>'],
    ["Cost: '{'price'}'", "Cost: '{price}'"],
    ["'{isn''t}'", "'{isn''t}'"],
    ["It''s {name} o''clock", "It's {name} o'clock"],
    ["{name}'s book", "{name}''s book"],
    ["{count, plural, other {'#' #}}", "{count,plural,other{'#' #}}"],
    ["{count, plural, other {'##'}}", "{count,plural,other{'##'}}"],
    ["{count, plural, other {'{#}'}}", "{count,plural,other{'{#}'}}"],
    [
      "{count, plural, other {<b>'##'</b>}}",
      "{count,plural,other{<b>'##'</b>}}",
    ],
  ])('prints %j with stable canonical bytes', (message, expected) => {
    expect(printAST(parse(message))).toBe(expected);
  });

  it.each([
    'plain text',
    'Héllo 🎉 {name}',
    '{a}{b}{c}',
    '{status, select, yes {{name} accepted} other {none}}',
    '{count, plural, one {<b># item</b>} other {<b># items</b>}}',
    "{count, plural, other {'##' and '{#}'}}",
    "{count, plural, other {<b>'##'</b>}}",
    '{count, plural, one {{status, select, yes {{name}} other {none}}} other {No}}',
    "'{isn''t}'",
  ])('preserves the AST through print and reparse for %j', (message) => {
    const original = parse(message);
    expect(parse(printAST(original))).toEqual(original);
  });

  it.each(GENERATED_ROUND_TRIP_MESSAGES)(
    'preserves the AST through print and reparse for %j',
    (message) => {
      const original = parse(message);
      const reparsed = parse(printAST(original));

      expect(reparsed).toEqual(original);
    }
  );

  it.each(GENERATED_ESCAPED_PLURAL_ROUND_TRIP_MESSAGES)(
    'preserves escaped plural syntax through print and reparse for %j',
    (message) => {
      const original = parse(message);
      const reparsed = parse(printAST(original));

      expect(reparsed).toEqual(original);
    }
  );
});
