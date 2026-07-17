/**
 * Regression cases are adapted from the FormatJS printer suite:
 * https://github.com/formatjs/formatjs/blob/75edf1cd6a7045475bb134daf62c686602c92547/packages/icu-messageformat-parser/tests/printer.test.ts
 * The upstream printer is MIT licensed. See ../../THIRD_PARTY_NOTICES.md.
 */

import { describe, expect, it } from 'vitest';
import { parse, printAST } from '../index';

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
    ["'{isn''t}'", "'{isn't}'"],
    ["It''s {name} o''clock", "It's {name} o'clock"],
    ["{name}'s book", "{name}''s book"],
    ["{count, plural, other {'#' #}}", "{count,plural,other{'#' #}}"],
  ])('prints %j with stable historical bytes', (message, expected) => {
    expect(printAST(parse(message))).toBe(expected);
  });

  it.each([
    'plain text',
    'Héllo 🎉 {name}',
    '{a}{b}{c}',
    '{status, select, yes {{name} accepted} other {none}}',
    '{count, plural, one {<b># item</b>} other {<b># items</b>}}',
    '{count, plural, one {{status, select, yes {{name}} other {none}}} other {No}}',
  ])('produces reparseable output for %j', (message) => {
    expect(() => parse(printAST(parse(message)))).not.toThrow();
  });
});
