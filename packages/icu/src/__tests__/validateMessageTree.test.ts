import { describe, expect, it } from 'vitest';
import { isMessageTree, validateMessageTree } from '../index';
import { icuToMessage } from '../convert';

const select = (branches: unknown) => ['x', 'select', branches];

function nestedTags(levels: number): unknown[] {
  let tree: unknown[] = ['leaf'];
  for (let level = 0; level < levels; level++) tree = [['b', 'tag', tree]];
  return tree;
}

describe('validateMessageTree', () => {
  it.each([
    'Hello {name}!',
    "It's {n, plural, offset:1 =0 {none} one {# item} other {# items}}",
    '{rank, selectordinal, one {#st} two {#nd} other {#th}}',
    '{role, select, admin {<b>{name}</b> is an admin} other {Hi}}',
    '{amount, number, currency} {pct, number, percent} {d, number, ::unit/meter}',
    '{when, date, short} {when, time, ::jms} {when, date, ::yyyyMMMdd}',
    '{when, time, full} {when, time, ::jmmssSSSBz}',
    'Click <link>here <i>now</i></link> <br/>',
  ])('accepts converted parse() output for %j', (message) => {
    expect(validateMessageTree(icuToMessage(message).tree)).toBeUndefined();
  });

  it('accepts pound, absent and null styles, and entries past the known ones', () => {
    expect(
      validateMessageTree([
        0,
        ['n', 'number'],
        ['n', 'number', null],
        ['n', 'number', 'percent'],
        ['s', 'select', { other: '' }, 'future'],
      ])
    ).toBeUndefined();
  });

  it.each(['Save', '', "It's {cool}"])('accepts the text %j', (text) => {
    expect(validateMessageTree(text)).toBeUndefined();
    expect(isMessageTree(text)).toBe(true);
  });

  it('accepts text, empty text and an array of only text in a branch or tag', () => {
    expect(
      isMessageTree([
        select({ a: 'Save', b: '', other: ['x', 'y'] }),
        ['b', 'tag', 'bold'],
        ['i', 'tag', ''],
      ])
    ).toBe(true);
  });

  it.each([undefined, null, 0, {}, { 0: 'a' }])(
    'rejects the non-tree %j',
    (value) => {
      expect(validateMessageTree(value)).toEqual({
        path: [],
        message: 'expected text or an array of nodes',
      });
    }
  );

  it.each([
    ['a null node', [null], [0]],
    ['an object node', [{ type: 0, value: 'a' }], [0]],
    ['a number other than 0', [1], [0]],
    ['an empty placeholder', [[]], [0, 0]],
    ['a non-string name', [[1]], [0, 0]],
    ['an unknown kind', [['x', 'plural2', {}]], [0, 1]],
    ['a null kind', [['x', null]], [0, 1]],
    ['a numeric style', [['n', 'number', 1]], [0, 2]],
    ['an array style', [['d', 'date', []]], [0, 2]],
    ['an empty number style', [['n', 'number', {}]], [0, 2]],
    ['an empty date style', [['d', 'date', {}]], [0, 2]],
    ['an empty time style', [['t', 'time', {}]], [0, 2]],
    ['an unknown number style name', [['n', 'number', 'integer']], [0, 2]],
    ['an unknown date style name', [['d', 'date', 'tiny']], [0, 2]],
    [
      'a number option object other than a unit',
      [['n', 'number', { style: 'percent' }]],
      [0, 2, 'style'],
    ],
    [
      'a unit ICU cannot print',
      [['n', 'number', { style: 'unit', unit: 'kilo meter' }]],
      [0, 2, 'unit'],
    ],
    [
      'a number formatting context option',
      [['n', 'number', { currency: 'USD', style: 'currency' }]],
      [0, 2, 'currency'],
    ],
    [
      'a date formatting context option',
      [['d', 'date', { timeZone: 'UTC', year: 'numeric' }]],
      [0, 2, 'timeZone'],
    ],
    [
      'a style as an option',
      [['d', 'date', { style: 'short' }]],
      [0, 2, 'style'],
    ],
    [
      'a date field on a time',
      [['t', 'time', { year: 'numeric' }]],
      [0, 2, 'year'],
    ],
    [
      'a field value Intl does not have',
      [['d', 'date', { month: 'tiny' }]],
      [0, 2, 'month'],
    ],
    [
      'string fractional second digits',
      [['t', 'time', { fractionalSecondDigits: '3' }]],
      [0, 2, 'fractionalSecondDigits'],
    ],
    ['missing branches', [['s', 'select']], [0, 2]],
    ['array branches', [select([])], [0, 2]],
    ['a non-string, non-array branch', [select({ a: 5 })], [0, 2, 'a']],
    ['an invalid branch tree', [select({ a: ['ok', 1] })], [0, 2, 'a', 1]],
    [
      'a non-finite plural offset',
      [['n', 'plural', { other: '' }, Infinity]],
      [0, 3],
    ],
    [
      'a string plural offset',
      [['n', 'selectordinal', { other: '' }, '1']],
      [0, 3],
    ],
    ['missing tag children', [['b', 'tag']], [0, 2]],
    [
      'an invalid nested tag child',
      ['a', ['b', 'tag', [['i', 'tag', [1]]]]],
      [1, 2, 0, 2, 0],
    ],
  ])('rejects %s', (_name, tree, path) => {
    expect(validateMessageTree(tree)?.path).toEqual(path);
  });

  it('ignores inherited branches and options', () => {
    const branches = Object.create({ other: 5 });
    expect(isMessageTree([select(branches)])).toBe(true);
    const style = Object.assign(Object.create({ currency: 'USD' }), {
      style: 'unit',
      unit: 'meter',
    });
    expect(isMessageTree([['n', 'number', style]])).toBe(true);
  });

  it('explains a style a tree cannot hold', () => {
    expect(
      validateMessageTree([['d', 'date', { timeZone: 'UTC' }]])?.message
    ).toBe(
      '"timeZone" is formatting context, which a message tree does not hold'
    );
    expect(
      validateMessageTree([['t', 'time', { style: 'short' }]])?.message
    ).toBe('"style" is written as a style name, like "medium"');
    expect(
      validateMessageTree([['t', 'time', { day: 'numeric' }]])?.message
    ).toBe('a time has no "day" option');
  });

  it('treats __proto__ branch keys as ordinary branches', () => {
    expect(
      isMessageTree(JSON.parse('[["x","select",{"__proto__":"","other":""}]]'))
    ).toBe(true);
    expect(
      validateMessageTree(JSON.parse('[["x","select",{"__proto__":null}]]'))
        ?.path
    ).toEqual([0, 2, '__proto__']);
  });

  it('limits nesting depth', () => {
    expect(isMessageTree(nestedTags(64))).toBe(true);
    expect(validateMessageTree(nestedTags(65))).toEqual({
      path: Array(65).fill([0, 2]).flat(),
      message: 'nesting deeper than 64 levels',
    });
    expect(isMessageTree(nestedTags(2), { maxDepth: 1 })).toBe(false);
    expect(validateMessageTree([select({ a: [] })], { maxDepth: 0 })).toEqual({
      path: [0, 2, 'a'],
      message: 'nesting deeper than 0 levels',
    });
  });

  it('limits the total node count', () => {
    expect(isMessageTree(Array(10_000).fill('a'))).toBe(true);
    expect(validateMessageTree(Array(10_001).fill('a'))).toEqual({
      path: [10_000],
      message: 'more than 10000 nodes and branches',
    });
    expect(validateMessageTree(nestedTags(2), { maxNodes: 2 })).toEqual({
      path: [0, 2, 0, 2, 0],
      message: 'more than 2 nodes and branches',
    });
  });

  it('counts select and plural branches toward the node limit', () => {
    const branches = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [`k${index}`, ''])
    );
    expect(isMessageTree([select(branches)], { maxNodes: 101 })).toBe(true);
    expect(validateMessageTree([select(branches)], { maxNodes: 5 })).toEqual({
      path: [0, 2, 'k4'],
      message: 'more than 5 nodes and branches',
    });
  });
});
