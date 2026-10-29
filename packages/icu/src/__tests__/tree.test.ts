import { describe, expect, it } from 'vitest';
import {
  buildMessageTree,
  formatAst,
  SKELETON_TYPE,
  TYPE,
  validateMessageTree,
  type MessageFormatElement,
  type MessageTreeHole,
  type PluralElement,
  type SelectElement,
} from '../index';
import { parse, printAST } from '../parser';

function tree(
  strings: readonly string[],
  ...holes: Parameters<typeof buildMessageTree>[1]
): MessageFormatElement[] {
  const result = buildMessageTree(strings, holes).tree;
  // Every built tree must pass the catalog validator.
  expect(validateMessageTree(result)).toBeUndefined();
  return result;
}

// Trees without Intl-option styles survive printing and reparsing.
function expectPrintRoundTrip(result: MessageFormatElement[]): void {
  expect(parse(printAST(result))).toEqual(result);
}

const POUND: MessageTreeHole = { kind: 'pound' };

describe('buildMessageTree', () => {
  it('builds arguments between literals', () => {
    const result = tree(['Hello ', '!'], { kind: 'argument', name: 'name' });
    expect(result).toEqual([
      { type: TYPE.literal, value: 'Hello ' },
      { type: TYPE.argument, value: 'name' },
      { type: TYPE.literal, value: '!' },
    ]);
    expectPrintRoundTrip(result);
  });

  it('merges adjacent literals and drops empty ones', () => {
    expect(
      tree(
        ['', 'a', ''],
        { kind: 'fragment', strings: ['x'], holes: [] },
        { kind: 'fragment', strings: ['b', 'c'], holes: [] }
      )
    ).toEqual([{ type: TYPE.literal, value: 'xabc' }]);
    expect(tree([''])).toEqual([]);
  });

  it('builds the plural count from a pound hole and keeps # literal', () => {
    const result = tree(['# of ', ''], {
      kind: 'plural',
      name: 'count',
      branches: {
        one: { strings: ['', ' item'], holes: [POUND] },
        other: {
          strings: ['', ' items by ', ''],
          holes: [
            POUND,
            {
              kind: 'select',
              name: 'who',
              branches: { me: 'me #', other: 'others' },
            },
          ],
        },
      },
    });
    expect(result).toEqual(
      parse(
        '# of {count, plural, one {# item} other {# items by {who, select, me {me #} other {others}}}}'
      )
    );
    expectPrintRoundTrip(result);
    expect(formatAst(result, 'en', { count: 2, who: 'me' })).toBe(
      '# of 2 items by me #'
    );
  });

  it('builds selectordinal as an ordinal plural', () => {
    const result = tree(['', ''], {
      kind: 'selectordinal',
      name: 'place',
      branches: {
        one: { strings: ['', 'st'], holes: [POUND] },
        other: { strings: ['', 'th'], holes: [POUND] },
      },
    });
    expect(result).toEqual(
      parse('{place, selectordinal, one {#st} other {#th}}')
    );
    expectPrintRoundTrip(result);
  });

  it('adds an empty other branch to selects without one', () => {
    const [select] = tree(['', ''], {
      kind: 'select',
      name: 'size',
      branches: { small: 'S', large: 'L', medium: undefined },
    }) as [SelectElement];
    expect(select.options).toEqual({
      large: { value: [{ type: TYPE.literal, value: 'L' }] },
      other: { value: [] },
      small: { value: [{ type: TYPE.literal, value: 'S' }] },
    });
    expect(formatAst([select], 'en', { size: 'medium' })).toBe('');
    expectPrintRoundTrip([select]);
  });

  it('emits option keys in lexicographic order', () => {
    const [plural] = tree(['', ''], {
      kind: 'plural',
      name: 'n',
      branches: { other: 'o', one: '1', '=2': 'two', '=10': 'ten', few: 'f' },
    }) as [PluralElement];
    expect(Object.keys(plural.options)).toEqual([
      '=10',
      '=2',
      'few',
      'one',
      'other',
    ]);
    expectPrintRoundTrip([plural]);
  });

  it('inlines fragments into the surrounding message', () => {
    const result = tree(['A', 'D'], {
      kind: 'fragment',
      strings: ['B', 'C'],
      holes: [{ kind: 'argument', name: 'x' }],
    });
    expectPrintRoundTrip(result);
    expect(result).toEqual([
      { type: TYPE.literal, value: 'AB' },
      { type: TYPE.argument, value: 'x' },
      { type: TYPE.literal, value: 'CD' },
    ]);
  });

  it('numbers anonymous values in tree order', () => {
    const holes: MessageTreeHole[] = [
      { kind: 'anonymous', value: 0 },
      { kind: 'anonymous', value: 'x' },
      {
        kind: 'plural',
        name: 'n',
        branches: {
          other: {
            strings: ['', ''],
            holes: [{ kind: 'anonymous', value: 'z' }],
          },
          one: {
            strings: ['', ''],
            holes: [{ kind: 'anonymous', value: 'y' }],
          },
        },
      },
    ];
    const { tree: result, values } = buildMessageTree(
      ['', ' ', ' / ', ''],
      holes
    );
    expect(result).toEqual([
      { type: TYPE.argument, value: '_gt_1' },
      { type: TYPE.literal, value: ' ' },
      { type: TYPE.argument, value: '_gt_2' },
      { type: TYPE.literal, value: ' / ' },
      {
        type: TYPE.plural,
        value: 'n',
        offset: 0,
        pluralType: 'cardinal',
        options: {
          one: { value: [{ type: TYPE.argument, value: '_gt_3' }] },
          other: { value: [{ type: TYPE.argument, value: '_gt_4' }] },
        },
      },
    ]);
    expect(values).toEqual([
      ['_gt_1', 0],
      ['_gt_2', 'x'],
      ['_gt_3', 'y'],
      ['_gt_4', 'z'],
    ]);
  });

  it('names helper values passed without a name as anonymous, before their branches', () => {
    const { tree: result, values } = buildMessageTree(
      ['', ' ', ' ', ''],
      [
        {
          kind: 'plural',
          value: 2,
          branches: {
            other: {
              strings: ['', ' from ', ''],
              holes: [POUND, { kind: 'anonymous', value: 'Ada' }],
            },
          },
        },
        { kind: 'number', value: 9.5, options: { style: 'percent' } },
        { kind: 'date', value: 0 },
      ]
    );
    expect(result).toEqual([
      {
        type: TYPE.plural,
        value: '_gt_1',
        offset: 0,
        pluralType: 'cardinal',
        options: {
          other: {
            value: [
              { type: TYPE.pound },
              { type: TYPE.literal, value: ' from ' },
              { type: TYPE.argument, value: '_gt_2' },
            ],
          },
        },
      },
      { type: TYPE.literal, value: ' ' },
      {
        type: TYPE.number,
        value: '_gt_3',
        style: {
          type: SKELETON_TYPE.number,
          tokens: [],
          parsedOptions: { style: 'percent' },
        },
      },
      { type: TYPE.literal, value: ' ' },
      { type: TYPE.date, value: '_gt_4' },
    ]);
    expect(values).toEqual([
      ['_gt_1', 2],
      ['_gt_2', 'Ada'],
      ['_gt_3', 9.5],
      ['_gt_4', 0],
    ]);
    expect(formatAst(result, 'en', Object.fromEntries(values))).toContain(
      '2 from Ada 950%'
    );
  });

  it.each<[string, MessageTreeHole]>([
    ['with a space', { kind: 'argument', name: 'first name' }],
    ['that is empty', { kind: 'number', name: '' }],
    [
      'starting with a direction mark',
      { kind: 'argument', name: '\u200ename' },
    ],
  ])('rejects a variable name %s', (_case, hole) => {
    expect(() => tree(['', ''], hole)).toThrow(/not a valid ICU argument name/);
  });

  it.each<[string, MessageTreeHole]>([
    [
      'with ICU syntax',
      { kind: 'select', name: 's', branches: { 'non-binary': 'x' } },
    ],
    ['that is empty', { kind: 'select', name: 's', branches: { '': 'x' } }],
    ['=N in a select', { kind: 'select', name: 's', branches: { '=1': 'x' } }],
    [
      '=N with a fraction',
      { kind: 'plural', name: 'n', branches: { '=1.5': 'x' } },
    ],
  ])('rejects a branch key %s', (_case, hole) => {
    expect(() => tree(['', ''], hole)).toThrow(/not a valid ICU selector/);
  });

  it('keeps a direction mark inside a name, which parses back', () => {
    const result = tree(['', ''], { kind: 'argument', name: 'a\u200eb' });
    expect(parse(printAST(result))).toEqual(result);
  });

  it('rejects the plural count outside a plural branch', () => {
    const select: MessageTreeHole = {
      kind: 'select',
      name: 's',
      branches: { other: { strings: ['', ''], holes: [POUND] } },
    };
    expect(() => buildMessageTree(['', ' items'], [POUND])).toThrow(
      /plural count is used outside/
    );
    // Like ICU, a nested select resets the count context.
    expect(() =>
      buildMessageTree(
        ['', ''],
        [
          {
            kind: 'plural',
            name: 'n',
            branches: { other: { strings: ['', ''], holes: [select] } },
          },
        ]
      )
    ).toThrow(/plural count is used outside/);
  });

  it('rejects user variable names that collide with generated names', () => {
    expect(() => tree(['', ''], { kind: 'argument', name: '_gt_1' })).toThrow(
      /reserved/
    );
    expect(() =>
      tree(['', ''], {
        kind: 'plural',
        name: 'n',
        branches: {
          other: {
            strings: ['', ''],
            holes: [{ kind: 'number', name: '_gt_x' }],
          },
        },
      })
    ).toThrow(/reserved/);
  });

  it('builds number and date styles from Intl options', () => {
    const result = tree(
      ['', ' ', ' ', ''],
      { kind: 'number', name: 'n' },
      { kind: 'number', name: 'p', options: { style: 'percent' } },
      { kind: 'date', name: 'd', options: { dateStyle: 'long' } }
    );
    expect(result).toEqual([
      { type: TYPE.number, value: 'n' },
      { type: TYPE.literal, value: ' ' },
      {
        type: TYPE.number,
        value: 'p',
        style: {
          type: SKELETON_TYPE.number,
          tokens: [],
          parsedOptions: { style: 'percent' },
        },
      },
      { type: TYPE.literal, value: ' ' },
      {
        type: TYPE.date,
        value: 'd',
        style: {
          type: SKELETON_TYPE.dateTime,
          pattern: '',
          parsedOptions: { dateStyle: 'long' },
        },
      },
    ]);
    expect(formatAst(result.slice(2, 3), 'en', { p: 0.5 })).toBe('50%');
  });

  it('sorts Intl option keys so equal messages have equal tree JSON', () => {
    const build = (options: Intl.NumberFormatOptions) =>
      JSON.stringify(tree(['', ''], { kind: 'number', name: 'p', options }));
    expect(build({ style: 'currency', currency: 'USD' })).toBe(
      build({ currency: 'USD', style: 'currency' })
    );
  });
});
