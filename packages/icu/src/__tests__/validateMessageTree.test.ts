import { describe, expect, it } from 'vitest';
import {
  isMessageTree,
  SKELETON_TYPE,
  TYPE,
  validateMessageTree,
} from '../index';
import { parse } from '../parser';

const literal = (value: string) => ({ type: TYPE.literal, value });
const select = (options: Record<string, unknown>) => ({
  type: TYPE.select,
  value: 'x',
  options,
});
const numberSkeleton = (tokens: unknown[]) => ({
  type: TYPE.number,
  value: 'n',
  style: { type: SKELETON_TYPE.number, tokens, parsedOptions: {} },
});
const tag = (children: unknown) => ({ type: TYPE.tag, value: 'b', children });

function nestedTags(levels: number): unknown[] {
  let tree: unknown[] = [literal('leaf')];
  for (let level = 0; level < levels; level++) tree = [tag(tree)];
  return tree;
}

describe('validateMessageTree', () => {
  it.each([
    'Hello {name}!',
    "It's {n, plural, offset:1 =0 {none} one {# item} other {# items}}",
    '{rank, selectordinal, one {#st} two {#nd} other {#th}}',
    '{role, select, admin {<b>{name}</b> is an admin} other {Hi}}',
    '{amount, number, ::currency/USD .00} {pct, number, percent}',
    '{when, date, short} {when, time, ::Hms} {when, date, ::yyyyMMMdd}',
    'Click <link>here <i>now</i></link> <br/>',
  ])('accepts parse() output for %j', (message) => {
    expect(validateMessageTree(parse(message))).toBeUndefined();
    expect(
      validateMessageTree(parse(message, { captureLocation: true }))
    ).toBeUndefined();
  });

  it('accepts pound, null styles, and unknown keys', () => {
    expect(
      validateMessageTree([
        { type: TYPE.pound },
        { type: TYPE.number, value: 'n', style: null },
        {
          type: TYPE.number,
          value: 'n',
          style: {
            type: SKELETON_TYPE.number,
            tokens: [{ stem: 'currency', options: ['USD'], future: 1 }],
            parsedOptions: {},
          },
        },
        { type: TYPE.literal, value: 'a', futureField: 1 },
      ])
    ).toBeUndefined();
  });

  it.each([undefined, null, 0, 'text', {}, { 0: literal('a') }])(
    'rejects the non-array %j',
    (value) => {
      expect(validateMessageTree(value)).toEqual({
        path: [],
        message: 'expected an array of elements',
      });
    }
  );

  it.each([
    ['a non-object element', [null], [0]],
    ['an array element', [[]], [0]],
    ['a missing type', [{ value: 'a' }], [0, 'type']],
    ['an unknown type', [{ type: 9, value: 'a' }], [0, 'type']],
    ['a string type', [{ type: '0', value: 'a' }], [0, 'type']],
    ['a missing value', [{ type: TYPE.literal }], [0, 'value']],
    [
      'a number style of the wrong skeleton type',
      [
        {
          type: TYPE.number,
          value: 'n',
          style: { type: SKELETON_TYPE.dateTime, pattern: 'y' },
        },
      ],
      [0, 'style'],
    ],
    [
      'number skeleton tokens that are not an array',
      [
        {
          type: TYPE.number,
          value: 'n',
          style: { type: SKELETON_TYPE.number, tokens: {} },
        },
      ],
      [0, 'style', 'tokens'],
    ],
    [
      'a number skeleton without parsed options',
      [
        {
          type: TYPE.number,
          value: 'n',
          style: { type: SKELETON_TYPE.number, tokens: [] },
        },
      ],
      [0, 'style', 'parsedOptions'],
    ],
    [
      'a date skeleton without parsed options',
      [
        {
          type: TYPE.date,
          value: 'd',
          style: { type: SKELETON_TYPE.dateTime, pattern: 'y' },
        },
      ],
      [0, 'style', 'parsedOptions'],
    ],
    [
      'a non-object number skeleton token',
      [numberSkeleton(['percent'])],
      [0, 'style', 'tokens', 0],
    ],
    [
      'a number skeleton token without a stem',
      [numberSkeleton([{ options: [] }])],
      [0, 'style', 'tokens', 0, 'stem'],
    ],
    [
      'a number skeleton token without options',
      [numberSkeleton([{ stem: 'percent' }])],
      [0, 'style', 'tokens', 0, 'options'],
    ],
    [
      'a non-string number skeleton token option',
      [
        numberSkeleton([
          { stem: 'percent', options: [] },
          { stem: 'scale', options: ['1', 100] },
        ]),
      ],
      [0, 'style', 'tokens', 1, 'options', 1],
    ],
    [
      'a date skeleton without a pattern',
      [
        {
          type: TYPE.date,
          value: 'd',
          style: { type: SKELETON_TYPE.dateTime },
        },
      ],
      [0, 'style', 'pattern'],
    ],
    [
      'non-object parsed options',
      [
        {
          type: TYPE.time,
          value: 't',
          style: {
            type: SKELETON_TYPE.dateTime,
            pattern: 'Hms',
            parsedOptions: 'x',
          },
        },
      ],
      [0, 'style', 'parsedOptions'],
    ],
    [
      'a non-numeric number scale',
      [
        {
          type: TYPE.number,
          value: 'n',
          style: {
            type: SKELETON_TYPE.number,
            tokens: [],
            parsedOptions: { scale: 'not-a-number' },
          },
        },
      ],
      [0, 'style', 'parsedOptions', 'scale'],
    ],
    [
      'a numeric style',
      [{ type: TYPE.date, value: 'd', style: 1 }],
      [0, 'style'],
    ],
    ['missing options', [{ type: TYPE.select, value: 'x' }], [0, 'options']],
    ['a non-object option', [select({ a: [] })], [0, 'options', 'a']],
    [
      'an invalid option tree',
      [select({ a: { value: [literal('ok'), { type: TYPE.literal }] } })],
      [0, 'options', 'a', 'value', 1, 'value'],
    ],
    [
      'a non-finite plural offset',
      [
        {
          type: TYPE.plural,
          value: 'n',
          offset: Infinity,
          pluralType: 'cardinal',
          options: {},
        },
      ],
      [0, 'offset'],
    ],
    [
      'an unknown plural type',
      [
        {
          type: TYPE.plural,
          value: 'n',
          offset: 0,
          pluralType: 'many',
          options: {},
        },
      ],
      [0, 'pluralType'],
    ],
    ['missing tag children', [tag(undefined)], [0, 'children']],
    [
      'an invalid nested tag child',
      [literal('a'), tag([tag([1])])],
      [1, 'children', 0, 'children', 0],
    ],
  ])('rejects %s', (_name, tree, path) => {
    expect(validateMessageTree(tree)?.path).toEqual(path);
  });

  it('ignores inherited fields', () => {
    const element = Object.create({ type: TYPE.literal, value: 'a' });
    expect(validateMessageTree([element])?.path).toEqual([0, 'type']);
  });

  it('treats __proto__ option keys as ordinary options', () => {
    const valid = JSON.parse(
      `[{"type":5,"value":"x","options":{"__proto__":{"value":[]},"other":{"value":[]}}}]`
    );
    expect(isMessageTree(valid)).toBe(true);
    const invalid = JSON.parse(
      `[{"type":5,"value":"x","options":{"__proto__":{"value":null}}}]`
    );
    expect(validateMessageTree(invalid)?.path).toEqual([
      0,
      'options',
      '__proto__',
      'value',
    ]);
  });

  it('limits nesting depth', () => {
    expect(isMessageTree(nestedTags(64))).toBe(true);
    expect(validateMessageTree(nestedTags(65))).toEqual({
      path: Array(65).fill([0, 'children']).flat(),
      message: 'nesting deeper than 64 levels',
    });
    expect(isMessageTree(nestedTags(2), { maxDepth: 1 })).toBe(false);
    expect(
      validateMessageTree([select({ a: { value: [] } })], { maxDepth: 0 })
    ).toEqual({
      path: [0, 'options', 'a', 'value'],
      message: 'nesting deeper than 0 levels',
    });
  });

  it('limits the total element count', () => {
    expect(isMessageTree(Array(10_000).fill(literal('a')))).toBe(true);
    expect(validateMessageTree(Array(10_001).fill(literal('a')))).toEqual({
      path: [10_000],
      message: 'more than 10000 elements and options',
    });
    expect(validateMessageTree(nestedTags(2), { maxElements: 2 })).toEqual({
      path: [0, 'children', 0, 'children', 0],
      message: 'more than 2 elements and options',
    });
  });

  it('counts select and plural options toward the element limit', () => {
    const options = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [`k${index}`, { value: [] }])
    );
    expect(isMessageTree([select(options)], { maxElements: 101 })).toBe(true);
    expect(validateMessageTree([select(options)], { maxElements: 5 })).toEqual({
      path: [0, 'options', 'k4'],
      message: 'more than 5 elements and options',
    });
  });
});
