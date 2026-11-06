import { describe, expect, it } from 'vitest';
import { isMessageTree, validateMessageTree } from '../index';
import { icuToMessageTree } from '../convert';

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
    '{amount, number, ::currency/USD .00} {pct, number, percent}',
    '{when, date, short} {when, time, ::Hms} {when, date, ::yyyyMMMdd}',
    'Click <link>here <i>now</i></link> <br/>',
  ])('accepts converted parse() output for %j', (message) => {
    expect(validateMessageTree(icuToMessageTree(message))).toBeUndefined();
  });

  it('accepts pound, absent and null styles, and entries past the known ones', () => {
    expect(
      validateMessageTree([
        0,
        ['n', 'number'],
        ['n', 'number', null],
        ['n', 'number', 'percent'],
        ['n', 'number', { style: 'percent', scale: 100 }],
        ['s', 'select', { other: '' }, 'future'],
      ])
    ).toBeUndefined();
  });

  it.each([undefined, null, 0, 'text', {}, { 0: 'a' }])(
    'rejects the non-array %j',
    (value) => {
      expect(validateMessageTree(value)).toEqual({
        path: [],
        message: 'expected an array of nodes',
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
    [
      'a non-numeric number scale',
      [['n', 'number', { scale: 'not-a-number' }]],
      [0, 2, 'scale'],
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
    const style = Object.create({ scale: 'x' });
    expect(isMessageTree([['n', 'number', style]])).toBe(true);
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
