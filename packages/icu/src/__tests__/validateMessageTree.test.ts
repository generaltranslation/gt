import { describe, expect, it } from 'vitest';
import { isMessageTree, validateMessageTree } from '../index';
import { icuToMessage } from '../convert';

const select = (branches: unknown) => ['x', 'select', branches];

function nestedTags(levels: number): unknown[] {
  let tree: unknown[] = [['leaf']];
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

  it('accepts pound and an absent style', () => {
    expect(
      validateMessageTree([
        [
          'n',
          'plural',
          { other: [0, ['n', 'number'], ['n', 'number', 'percent']] },
        ],
      ])
    ).toBeUndefined();
  });

  // ICU reads `#` as the count only there, so elsewhere it would not print back.
  it.each([
    ['at the top of a message', [0, ' files'], [0]],
    ['in a select', [select({ other: [0, ' files'] })], [0, 2, 'other', 0]],
    [
      'in a select inside a plural',
      [['n', 'plural', { other: [select({ other: [0, ' files'] })] }]],
      [0, 2, 'other', 0, 2, 'other', 0],
    ],
    ['in a tag outside a plural', [['b', 'tag', [0, ' files']]], [0, 2, 0]],
  ])('rejects pound %s', (_name, tree, path) => {
    expect(validateMessageTree(tree)).toEqual({
      path,
      message: 'expected 0, the plural count, only in a plural branch',
    });
  });

  it('accepts pound in a tag inside a plural or selectordinal branch', () => {
    expect(
      isMessageTree([
        ['n', 'selectordinal', { other: [['b', 'tag', [0, 'th']]] }],
      ])
    ).toBe(true);
  });

  // The formatter has no branch for a value that matches none.
  it.each(['select', 'plural', 'selectordinal'])(
    'rejects a %s without an other branch',
    (kind) => {
      expect(validateMessageTree([['x', kind, { one: 'One' }]])).toEqual({
        path: [0, 2],
        message: 'expected an other branch',
      });
      expect(validateMessageTree([['x', kind, {}]])?.path).toEqual([0, 2]);
    }
  );

  // A tree is printed as ICU for translation, so names and keys must parse back.
  it.each([
    ['an empty name', [['']], [0, 0]],
    ['a name with a space', [['first name']], [0, 0]],
    ['a name with ICU syntax', [['a.b', 'number']], [0, 0]],
    ['a tag name that starts with a digit', [['1b', 'tag', 'x']], [0, 0]],
    ['an empty tag name', [['', 'tag', 'x']], [0, 0]],
    [
      'a tag name with ICU syntax after its letter',
      [['b!', 'tag', 'x']],
      [0, 0],
    ],
    [
      'a select key with a space',
      [select({ 'in progress': 'Running', other: 'Done' })],
      [0, 2, 'in progress'],
    ],
    ['an empty select key', [select({ '': 'x', other: 'y' })], [0, 2, '']],
    [
      'an exact key on a select',
      [select({ '=1': 'x', other: 'y' })],
      [0, 2, '=1'],
    ],
    [
      'a plural key with ICU syntax',
      [['n', 'plural', { 'a-b': 'x', other: 'y' }]],
      [0, 2, 'a-b'],
    ],
  ])('rejects %s', (_name, tree, path) => {
    expect(validateMessageTree(tree)?.path).toEqual(path);
  });

  it('accepts a negative plural offset, which the parser reads too', () => {
    expect(
      isMessageTree(icuToMessage('{n, plural, offset:-2 other {#}}').tree)
    ).toBe(true);
  });

  it('accepts a tag name with tag-name characters and an exact plural key', () => {
    expect(
      isMessageTree([
        ['my-tag.v2', 'tag', 'x'],
        ['n', 'plural', { '=0': 'none', '=-1': 'owed', other: 'some' }],
      ])
    ).toBe(true);
  });

  it.each([
    [['n', 'number', 'percent', 'more'], 3],
    [['s', 'select', { other: '' }, 'more'], 3],
    [['n', 'plural', { other: '' }, 1, 'more'], 4],
    [['b', 'tag', 'bold', 'more'], 3],
  ])('rejects the node %j with more entries than its kind has', (node, at) => {
    expect(validateMessageTree([node])).toEqual({
      path: [0, at],
      message: 'expected no more entries',
    });
  });

  it('rejects a null style: no style is left out', () => {
    expect(validateMessageTree([['n', 'number', null]])).toEqual({
      path: [0, 2],
      message: 'expected a style name or Intl options',
    });
  });

  it.each(['Save', '', "It's {cool}"])('accepts the text %j', (text) => {
    expect(validateMessageTree(text)).toBeUndefined();
    expect(isMessageTree(text)).toBe(true);
  });

  it('accepts text and empty text in a branch or tag', () => {
    expect(
      isMessageTree([
        select({ a: 'Save', b: '', other: [['name']] }),
        ['b', 'tag', 'bold'],
        ['i', 'tag', ''],
      ])
    ).toBe(true);
  });

  // A message has one valid tree, so it has one key.
  it.each([
    [['Save'], [], 'expected a string for text without placeholders'],
    [[], [], 'expected a string for text without placeholders'],
    [
      [select({ other: ['All'] })],
      [0, 2, 'other'],
      'expected a string for text without placeholders',
    ],
    [
      [['b', 'tag', ['bold']]],
      [0, 2],
      'expected a string for text without placeholders',
    ],
    [
      ['Hi ', 'there, ', ['name']],
      [1],
      'expected a placeholder; write adjacent text as one string',
    ],
    [[['name'], ''], [1], 'expected text; leave out empty text'],
    [
      [['n', 'plural', { other: [0, ' items'] }, 0]],
      [0, 3],
      'leave out an offset of 0',
    ],
    ...['=01', '=+1', '=-0', '=1.5', '=1e3', '=9007199254740993'].map((key) => [
      [['n', 'plural', { [key]: 'exact', other: 'other' }]],
      [0, 2, key],
      'expected = and a safe integer as JavaScript writes it, like =1',
    ]),
  ])('rejects the other form %j of a message', (tree, path, message) => {
    expect(validateMessageTree(tree)).toEqual({ path, message });
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
    [
      'a fractional plural offset',
      [['n', 'plural', { other: '' }, 0.5]],
      [0, 3],
    ],
    [
      'a plural offset past the safe integers',
      [['n', 'plural', { other: '' }, 2 ** 53]],
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
    // An inherited `other` is not a branch, so it is neither read nor enough.
    const branches = Object.create({ other: 5 });
    expect(validateMessageTree([select(branches)])).toEqual({
      path: [0, 2],
      message: 'expected an other branch',
    });
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
    expect(isMessageTree(Array(10_000).fill(['a']))).toBe(true);
    expect(validateMessageTree(Array(10_001).fill(['a']))).toEqual({
      path: [10_000],
      message: 'more than 10000 nodes and branches',
    });
    expect(validateMessageTree(nestedTags(2), { maxNodes: 2 })).toEqual({
      path: [0, 2, 0, 2, 0],
      message: 'more than 2 nodes and branches',
    });
  });

  it('counts select and plural branches toward the node limit', () => {
    const branches = Object.fromEntries([
      ...Array.from({ length: 99 }, (_, index) => [`k${index}`, '']),
      ['other', ''],
    ]);
    expect(isMessageTree([select(branches)], { maxNodes: 101 })).toBe(true);
    expect(validateMessageTree([select(branches)], { maxNodes: 5 })).toEqual({
      path: [0, 2, 'k4'],
      message: 'more than 5 nodes and branches',
    });
  });
});
