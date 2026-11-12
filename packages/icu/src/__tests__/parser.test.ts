/**
 * Compatibility cases are adapted from the FormatJS parser integration corpus:
 * https://github.com/formatjs/formatjs/tree/75edf1cd6a7045475bb134daf62c686602c92547/packages/icu-messageformat-parser/integration-tests/test_cases
 * FormatJS parser fixtures are MIT licensed. See ../../THIRD_PARTY_NOTICES.md.
 */

import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { parse, SKELETON_TYPE, TYPE, type Location } from '../parser';

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
    expect(Object.getPrototypeOf((ast[0] as { options: object }).options)).toBe(
      Object.prototype
    );
  });

  it('does not require Object.fromEntries to build selector options', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Object, 'fromEntries');
    Object.defineProperty(Object, 'fromEntries', {
      configurable: true,
      value: undefined,
    });

    try {
      const [element] = parse(
        '{value, select, __proto__ {proto} other {fallback}}'
      );
      expect(element).toMatchObject({ type: TYPE.select });
      if (element.type === TYPE.select) {
        expect(Object.hasOwn(element.options, '__proto__')).toBe(true);
      }
    } finally {
      if (descriptor) Object.defineProperty(Object, 'fromEntries', descriptor);
    }
  });

  it('does not require the parser built-ins ponyfilled by FormatJS', () => {
    const descriptors = {
      codePointAt: Object.getOwnPropertyDescriptor(
        String.prototype,
        'codePointAt'
      ),
      fromCodePoint: Object.getOwnPropertyDescriptor(String, 'fromCodePoint'),
      isSafeInteger: Object.getOwnPropertyDescriptor(Number, 'isSafeInteger'),
      startsWith: Object.getOwnPropertyDescriptor(
        String.prototype,
        'startsWith'
      ),
      trimEnd: Object.getOwnPropertyDescriptor(String.prototype, 'trimEnd'),
      trimStart: Object.getOwnPropertyDescriptor(String.prototype, 'trimStart'),
    };
    let ast: ReturnType<typeof parse> | undefined;

    try {
      for (const [owner, key] of [
        [String.prototype, 'codePointAt'],
        [String, 'fromCodePoint'],
        [Number, 'isSafeInteger'],
        [String.prototype, 'startsWith'],
        [String.prototype, 'trimEnd'],
        [String.prototype, 'trimStart'],
      ] as const) {
        Object.defineProperty(owner, key, {
          configurable: true,
          value: undefined,
        });
      }
      ast = parse(
        '😀 {n, plural, one {one} other {# items}} {d, time, ::j  }',
        { locale: new Intl.Locale('en-US') }
      );
    } finally {
      for (const [owner, key] of [
        [String.prototype, 'codePointAt'],
        [String, 'fromCodePoint'],
        [Number, 'isSafeInteger'],
        [String.prototype, 'startsWith'],
        [String.prototype, 'trimEnd'],
        [String.prototype, 'trimStart'],
      ] as const) {
        const descriptor = descriptors[key];
        if (descriptor) Object.defineProperty(owner, key, descriptor);
      }
    }

    expect(ast).toMatchObject([
      { type: TYPE.literal, value: '😀 ' },
      { type: TYPE.plural, value: 'n' },
      { type: TYPE.literal, value: ' ' },
      { type: TYPE.time, value: 'd' },
    ]);
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

  it('reads an exact plural selector as its number, as ICU4C does', () => {
    const [element] = parse(
      '{count, plural, =01 {one} =-0 {zero} =-01 {minus one} other {other}}'
    );

    expect(element).toMatchObject({
      type: TYPE.plural,
      options: { '=1': {}, '=0': {}, '=-1': {}, other: {} },
    });
    expect(() => parse('{count, plural, =1 {a} =+1 {b} other {c}}')).toThrow(
      'A branch key appears twice'
    );
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

  it.each([
    'constructor',
    'toString',
    '__proto__',
    'valueOf',
    'hasOwnProperty',
  ])('rejects %j, an inherited key that is not a stem', (stem) => {
    expect(() => parse(`{amount, number, ::${stem}}`)).toThrow(
      new SyntaxError(`"${stem}" is not an ICU number skeleton token.`)
    );
  });

  it.each([
    ['0085', '\u0085'],
    ['200E', '\u200E'],
    ['200F', '\u200F'],
  ])(
    'parses FormatJS number-skeleton whitespace U+$codePoint',
    (_codePoint, separator) => {
      expect(
        parse(`{amount, number, ::currency/USD${separator}.00}`)[0]
      ).toMatchObject({
        style: {
          tokens: [
            { stem: 'currency', options: ['USD'] },
            { stem: '.00', options: [] },
          ],
          parsedOptions: {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        },
      });
    }
  );

  // ICU4C formats each of these; FormatJS skips them or reads them as another.
  it.each(['A', 'C', 'J', 'g', 'EEEEEE', 'yyyyy', 'SSSS', 'haaaaa', 'jjjjj'])(
    'rejects the date/time skeleton ::%s, which Intl cannot format',
    (skeleton) => {
      expect(() =>
        parse(`{date, time, ::${skeleton}}`, {
          locale: new Intl.Locale('en-US'),
        })
      ).toThrow(RangeError);
    }
  );

  it('reads a, the AM/PM marker, as nothing more than its hour', () => {
    const options = (skeleton: string) =>
      parse(`{date, time, ::${skeleton}}`)[0];
    expect(options('ha')).toMatchObject({
      style: { parsedOptions: { hour: 'numeric', hour12: true } },
    });
    // ICU4C shows 23 for `Ha`, where FormatJS turns the clock to 12 hours.
    expect(options('Ha')).toMatchObject({
      style: { parsedOptions: { hour: 'numeric', hourCycle: 'h23' } },
    });
    expect(() => options('a')).toThrow(
      new RangeError(
        'The date/time skeleton field a, the AM/PM marker, needs an hour field.'
      )
    );
  });

  it.each([
    ['eee', 'short'],
    ['cccc', 'long'],
    ['eeeee', 'narrow'],
  ])('reads the weekday ::%s as ICU4C does: %s', (skeleton, weekday) => {
    expect(parse(`{date, date, ::${skeleton}}`)[0]).toMatchObject({
      style: { parsedOptions: { weekday } },
    });
  });

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
      '"/USD" is not an ICU number skeleton token.'
    );
    expect(
      parse('{amount, number, ::/USD}', { shouldParseSkeletons: false })[0]
    ).toMatchObject({
      style: { tokens: [{ stem: '', options: ['USD'] }], parsedOptions: {} },
    });
  });

  it('parses nested tags and keeps a self-closing tag as the text it is', () => {
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
      { type: TYPE.literal, value: '<test-tag />' },
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

  it('matches the FormatJS tag-name character boundaries', () => {
    const allowed = [
      0x2d, 0x2e, 0x30, 0x39, 0x5f, 0xb7, 0xc0, 0xd6, 0xd8, 0xf6, 0xf8, 0x37d,
      0x37f, 0x1fff, 0x200c, 0x200d, 0x203f, 0x2040, 0x2070, 0x218f, 0x2c00,
      0x2fef, 0x3001, 0xd7ff, 0xf900, 0xfdcf, 0xfdf0, 0xfffd, 0x10000, 0xeffff,
    ];
    const rejected = [
      0xd7, 0xf7, 0x37e, 0x203e, 0x2041, 0x206f, 0x2ff0, 0xe000, 0xfdd0, 0xfffe,
      0xf0000,
    ];

    for (const codePoint of allowed) {
      const character = String.fromCodePoint(codePoint);
      expect(parse(`<a${character}>x</a${character}>`)[0]).toMatchObject({
        type: TYPE.tag,
        value: `a${character}`,
      });
    }
    for (const codePoint of rejected) {
      const character = String.fromCodePoint(codePoint);
      expect(() => parse(`<a${character}>x</a${character}>`)).toThrow();
    }
  });

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
      'A plural, select or selectordinal needs an other branch.'
    );
    expect(() =>
      parse('{x, select, one {One}}', { requiresOtherClause: false })
    ).not.toThrow();
  });

  it.each([
    ['00A0', '\u00A0'],
    ['1680', '\u1680'],
    ['2000', '\u2000'],
    ['2007', '\u2007'],
    ['202F', '\u202F'],
    ['205F', '\u205F'],
    ['3000', '\u3000'],
  ])(
    'does not consume Unicode space U+%s as ICU grammar whitespace',
    (_codePoint, space) => {
      const [element] = parse(`{n, number, ${space}percent}`);
      expect(element).toMatchObject({
        type: TYPE.number,
        style: `${space}percent`,
      });
    }
  );

  it.each([
    ["custom'{style}'", "custom'{style}'"],
    ["custom'{'nested'}'", "custom'{'nested'}'"],
  ])('preserves quoted ICU argument style text %j', (style, expected) => {
    const [element] = parse(`{n, number, ${style}}`);
    expect(element).toMatchObject({
      type: TYPE.number,
      style: expected,
    });
  });

  it.each([
    ['{n, number, foo{bar}baz}', 'foo{bar', 'baz}'],
    ['{n, number, foo{{bar}}baz}', 'foo{{bar', '}baz}'],
  ])(
    'preserves FormatJS splitting at the first unquoted style brace in %j',
    (message, style, trailingLiteral) => {
      expect(parse(message)).toMatchObject([
        { type: TYPE.number, style },
        { type: TYPE.literal, value: trailingLiteral },
      ]);
    }
  );

  it('preserves FormatJS acceptance of an unmatched opening style brace', () => {
    expect(parse('{n, number, foo{bar}')).toMatchObject([
      { type: TYPE.number, style: 'foo{bar' },
    ]);
  });

  it.each([
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
  ])('rejects malformed significant-precision skeleton ::%s', (skeleton) => {
    expect(() => parse(`{n, number, ::${skeleton}}`)).toThrow(
      new SyntaxError(`"${skeleton}" is not an ICU number skeleton token.`)
    );
  });

  it('preserves FormatJS SyntaxError metadata', () => {
    expect.assertions(4);
    try {
      parse('{name');
    } catch (error) {
      const syntaxError = error as SyntaxError & {
        code?: string;
        location?: Location;
        originalMessage?: string;
      };
      expect(syntaxError).toBeInstanceOf(SyntaxError);
      expect(syntaxError.code).toBe('EXPECT_ARGUMENT_CLOSING_BRACE');
      expect(syntaxError.location).toEqual({
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 5, line: 1, column: 6 },
      });
      expect(syntaxError.originalMessage).toBe('{name');
    }
  });

  it.each([
    ['Hello {name', 'EXPECT_ARGUMENT_CLOSING_BRACE'],
    ['Hello {}', 'EMPTY_ARGUMENT'],
    ['{name, unknown}', 'INVALID_ARGUMENT_TYPE'],
    ['{name, select, }', 'EXPECT_SELECT_ARGUMENT_SELECTOR'],
    ['{count, plural, }', 'EXPECT_PLURAL_ARGUMENT_SELECTOR'],
    [
      '{x, select, a {A} a {B} other {C}}',
      'DUPLICATE_SELECT_ARGUMENT_SELECTOR',
    ],
    ['<b>text</i>', 'UNMATCHED_CLOSING_TAG'],
    ['<b>text', 'UNCLOSED_TAG'],
    ['{n, number, ::}', 'INVALID_NUMBER_SKELETON'],
    ['{n, number, ::currency/}', 'INVALID_NUMBER_SKELETON'],
    ['{n, number, ::unit}', '"unit" is not an ICU number skeleton token.'],
    [
      '{n, number, ::integer-width}',
      '"integer-width" is not an ICU number skeleton token.',
    ],
    [
      '{n, number, ::integer-width/*00/foo}',
      '"integer-width/*00/foo" is not an ICU number skeleton token.',
    ],
    ['{n, number, ::Efoo}', '"Efoo" is not an ICU number skeleton token.'],
    [
      '{n, number, ::currency}',
      '"currency" is not an ICU number skeleton token.',
    ],
    [
      '{n, number, ::scale/2x}',
      '"scale/2x" is not an ICU number skeleton token.',
    ],
    [
      '{n, number, ::.##/@@@}',
      '".##/@@@" is not an ICU number skeleton token.',
    ],
    ['{n, number, ::bogus}', '"bogus" is not an ICU number skeleton token.'],
    // A setting given twice: the second token is the error.
    ['{n, number, ::.00 .##}', '".##" is not an ICU number skeleton token.'],
    ['{n, number, ::.00 @@@}', '"@@@" is not an ICU number skeleton token.'],
    [
      '{n, number, ::sign-accounting sign-always}',
      '"sign-always" is not an ICU number skeleton token.',
    ],
    [
      '{n, number, ::latin numbering-system/arab}',
      '"numbering-system/arab" is not an ICU number skeleton token.',
    ],
    ["{n, number, 'unclosed}", 'UNCLOSED_QUOTE_IN_ARGUMENT_STYLE'],
    // ICU4C skips a letter that is no field, so a typo disappears.
    ['{d, date, ::yMMMdT}', '"T" is not a date or time field.'],
  ])('rejects malformed ICU %j', (message, error) => {
    // An error in capitals is the code; the message is a sentence.
    expect(() => parse(message)).toThrow(
      /^[A-Z_]+$/.test(error) ? expect.objectContaining({ code: error }) : error
    );
  });

  it.each([
    [
      '{d, date, ::vv}',
      RangeError,
      'Unsupported date/time skeleton field: vv.',
    ],
    ['{d, date, ::b}', RangeError, 'Unsupported date/time skeleton field: b.'],
  ])(
    'uses stable diagnostics instead of FormatJS incidental errors for %j',
    (message, ErrorType, error) => {
      expect(() => parse(message)).toThrow(ErrorType);
      expect(() => parse(message)).toThrow(error);
    }
  );
});
