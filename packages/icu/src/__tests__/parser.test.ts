/**
 * Compatibility cases are adapted from the FormatJS parser integration corpus:
 * https://github.com/formatjs/formatjs/tree/75edf1cd6a7045475bb134daf62c686602c92547/packages/icu-messageformat-parser/integration-tests/test_cases
 * FormatJS parser fixtures are MIT licensed. See ../../THIRD_PARTY_NOTICES.md.
 */

import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { parse, SKELETON_TYPE, TYPE } from '../index';

describe('parse', () => {
  it('parses literals, arguments, and exact source locations', () => {
    expect(parse('My name is {0}', { captureLocation: true })).toEqual([
      {
        type: TYPE.literal,
        value: 'My name is ',
        location: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 11, line: 1, column: 12 },
        },
      },
      {
        type: TYPE.argument,
        value: '0',
        location: {
          start: { offset: 11, line: 1, column: 12 },
          end: { offset: 14, line: 1, column: 15 },
        },
      },
    ]);
  });

  it('counts columns by code point and offsets by UTF-16 code unit', () => {
    expect(parse('😀 {name}', { captureLocation: true })).toMatchObject([
      {
        value: '😀 ',
        location: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 3, line: 1, column: 3 },
        },
      },
      {
        value: 'name',
        location: {
          start: { offset: 3, line: 1, column: 3 },
          end: { offset: 9, line: 1, column: 9 },
        },
      },
    ]);
  });

  it('tracks multiline option fragments', () => {
    const ast = parse('{choice, select,\n one {First}\n other {Second}\n}', {
      captureLocation: true,
    });
    expect(ast[0]).toMatchObject({
      type: TYPE.select,
      options: {
        one: {
          value: [{ type: TYPE.literal, value: 'First' }],
          location: {
            start: { offset: 22, line: 2, column: 6 },
            end: { offset: 29, line: 2, column: 13 },
          },
        },
      },
    });
  });

  it('captures locations in linear time for large messages', () => {
    const count = 10_000;
    const message = Array.from(
      { length: count },
      (_, index) => `{v${index}}`
    ).join('');
    const start = performance.now();
    const ast = parse(message, { captureLocation: true });
    const duration = performance.now() - start;

    expect(ast).toHaveLength(count);
    expect(ast.at(-1)?.location?.end.offset).toBe(message.length);
    // The former per-node prefix rescans took multiple seconds here. Keep a
    // deliberately generous ceiling for slower CI machines.
    expect(duration).toBeLessThan(1_000);
  });

  it('parses selects, nested arguments, and null-prototype-like keys safely', () => {
    const ast = parse(
      '{kind, select, constructor {ctor} __proto__ {{name}} toString {text} other {fallback}}'
    );
    expect(ast[0]).toMatchObject({
      type: TYPE.select,
      value: 'kind',
      options: {
        constructor: { value: [{ type: TYPE.literal, value: 'ctor' }] },
        __proto__: { value: [{ type: TYPE.argument, value: 'name' }] },
        toString: { value: [{ type: TYPE.literal, value: 'text' }] },
        other: { value: [{ type: TYPE.literal, value: 'fallback' }] },
      },
    });
    expect(
      Object.hasOwn((ast[0] as { options: object }).options, '__proto__')
    ).toBe(true);
  });

  it('parses cardinal plurals, exact matches, offsets, and pound signs', () => {
    expect(
      parse(
        '{count, plural, offset:2 =-1 {none} one {# item} other {# items}}'
      )[0]
    ).toMatchObject({
      type: TYPE.plural,
      value: 'count',
      offset: 2,
      pluralType: 'cardinal',
      options: {
        '=-1': { value: [{ type: TYPE.literal, value: 'none' }] },
        one: {
          value: [{ type: TYPE.pound }, { type: TYPE.literal, value: ' item' }],
        },
      },
    });
  });

  it('parses ordinal plurals', () => {
    expect(
      parse(
        '{floor, selectordinal, =0 {ground} one {#st} two {#nd} few {#rd} other {#th}}'
      )[0]
    ).toMatchObject({
      type: TYPE.plural,
      pluralType: 'ordinal',
      offset: 0,
      options: { '=0': {}, one: {}, two: {}, few: {}, other: {} },
    });
  });

  it('parses number and date/time skeletons into native Intl options', () => {
    expect(
      parse('{amount, number, ::compact-short currency/GBP .00##}')[0]
    ).toMatchObject({
      type: TYPE.number,
      style: {
        type: SKELETON_TYPE.number,
        tokens: [
          { stem: 'compact-short', options: [] },
          { stem: 'currency', options: ['GBP'] },
          { stem: '.00##', options: [] },
        ],
        parsedOptions: {
          notation: 'compact',
          compactDisplay: 'short',
          style: 'currency',
          currency: 'GBP',
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        },
      },
    });
    expect(parse('{date, date, ::yyyyMMMdd}')[0]).toMatchObject({
      type: TYPE.date,
      style: {
        type: SKELETON_TYPE.dateTime,
        pattern: 'yyyyMMMdd',
        parsedOptions: { year: 'numeric', month: 'short', day: '2-digit' },
      },
    });
  });

  it.each(['C', 'S', 'A'])(
    'preserves FormatJS parsing of the %s date/time skeleton field',
    (field) => {
      expect(
        parse(`{date, time, ::${field}}`, {
          locale: new Intl.Locale('en-US'),
        })[0]
      ).toMatchObject({
        type: TYPE.time,
        style: {
          type: SKELETON_TYPE.dateTime,
          pattern: field,
          parsedOptions: {},
        },
      });
    }
  );

  it('can skip skeleton option parsing while preserving tokens', () => {
    expect(
      parse('{amount, number, ::currency/USD}', {
        shouldParseSkeletons: false,
      })[0]
    ).toMatchObject({
      style: {
        tokens: [{ stem: 'currency', options: ['USD'] }],
        parsedOptions: {},
      },
    });
  });

  it('rejects an empty number skeleton stem only when parsing options', () => {
    expect(() => parse('{amount, number, ::/USD}')).toThrow(
      'Number skeleton token stem cannot be empty'
    );
    expect(
      parse('{amount, number, ::/USD}', { shouldParseSkeletons: false })[0]
    ).toMatchObject({
      style: { tokens: [{ stem: '', options: ['USD'] }], parsedOptions: {} },
    });
  });

  it('parses nested tags and normalizes self-closing tags as literals', () => {
    expect(parse('this is <a>nested <b>{name}</b></a>')).toMatchObject([
      { type: TYPE.literal, value: 'this is ' },
      {
        type: TYPE.tag,
        value: 'a',
        children: [
          { type: TYPE.literal, value: 'nested ' },
          {
            type: TYPE.tag,
            value: 'b',
            children: [{ type: TYPE.argument, value: 'name' }],
          },
        ],
      },
    ]);
    expect(parse('<test-tag />')).toEqual([
      { type: TYPE.literal, value: '<test-tag/>' },
    ]);
  });

  it.each(['<a\u0301>x</a\u0301>', '<a\u203f>x</a\u203f>'])(
    'parses FormatJS-compatible Unicode tag names in %j',
    (message) => {
      expect(parse(message)).toEqual([
        {
          type: TYPE.tag,
          value: message.slice(1, message.indexOf('>')),
          children: [{ type: TYPE.literal, value: 'x' }],
        },
      ]);
    }
  );

  it('can treat tags as plain text', () => {
    expect(parse('<b>{name}</b>', { ignoreTag: true })).toEqual([
      { type: TYPE.literal, value: '<b>' },
      { type: TYPE.argument, value: 'name' },
      { type: TYPE.literal, value: '</b>' },
    ]);
  });

  it.each([
    ["'{a''b}'", "{a'b}"],
    ["This '{isn''t}' obvious", "This {isn't} obvious"],
    ["It''s {name}", "It's "],
    ['A } is literal at the top level', 'A } is literal at the top level'],
    ["{count, plural, other {'#' #}}", undefined],
  ])('implements ICU apostrophe rules for %j', (message, leadingLiteral) => {
    const ast = parse(message);
    if (leadingLiteral !== undefined) {
      expect(ast[0]).toMatchObject({
        type: TYPE.literal,
        value: leadingLiteral,
      });
    }
    expect(ast).toBeDefined();
  });

  it('allows missing other only when explicitly configured', () => {
    expect(() => parse('{x, select, one {One}}')).toThrow(
      'MISSING_OTHER_CLAUSE'
    );
    expect(() =>
      parse('{x, select, one {One}}', { requiresOtherClause: false })
    ).not.toThrow();
  });

  it.each([
    ['Hello {name', 'EXPECT_ARGUMENT_CLOSING_BRACE'],
    ['Hello {}', 'EMPTY_ARGUMENT'],
    ['{name, unknown}', 'INVALID_ARGUMENT_TYPE'],
    ['{name, select, }', 'EXPECT_ARGUMENT_SELECTOR'],
    ['{count, plural, }', 'EXPECT_ARGUMENT_SELECTOR'],
    [
      '{x, select, a {A} a {B} other {C}}',
      'DUPLICATE_SELECT_ARGUMENT_SELECTOR',
    ],
    ['<b>text</i>', 'UNMATCHED_CLOSING_TAG'],
    ['<b>text', 'UNCLOSED_TAG'],
    ['{n, number, ::}', 'Number skeleton cannot be empty'],
    ['{n, number, ::currency/}', 'Invalid number skeleton token'],
    ['{n, number, ::integer-width/*}', 'Unsupported integer width'],
    ["{n, number, 'unclosed}", 'UNCLOSED_QUOTE_IN_ARGUMENT_STYLE'],
  ])('rejects malformed ICU %j', (message, error) => {
    expect(() => parse(message)).toThrow(error);
  });
});
