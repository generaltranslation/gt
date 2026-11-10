import { describe, expect, it } from 'vitest';
import {
  validateMessageTree,
  type MessageTree,
  type SelectNode,
} from '../index';
import { formatMessageTree } from './format';
import {
  templateToMessage,
  forEachPlaceholder,
  type TemplateHole,
} from '../internal';
import { icuToMessage, messageTreeToIcu } from '../convert';
import { normalizeMessageTree } from '../tree/canonical';

function tree(
  strings: readonly string[],
  ...holes: Parameters<typeof templateToMessage>[1]
): MessageTree {
  const result = templateToMessage(strings, holes).tree;
  // Every built tree must pass the catalog validator, and is built canonical,
  // so it hashes like the same message converted from ICU.
  expect(validateMessageTree(result)).toBeUndefined();
  expect(normalizeMessageTree(result)).toEqual(result);
  return result;
}

const parseTree = (message: string) => icuToMessage(message).tree;

// Trees without Intl-option styles survive printing and reparsing.
function expectPrintRoundTrip(result: MessageTree): void {
  expect(parseTree(messageTreeToIcu(result))).toEqual(result);
}

const POUND: TemplateHole = { kind: 'pound' };

describe('normalizeMessageTree', () => {
  it('rewrites a tree to the form templateToMessage builds', () => {
    const tree: MessageTree = [
      'a',
      '',
      'b',
      ['n', 'plural', { other: [0, 'x', 'y'], one: ['one'], '=0': [] }, 0],
      ['d', 'date', { year: 'numeric', month: 'short' }],
      ['d', 'date', undefined],
      ['b', 'tag', ['c', 'd']],
    ];
    expect(JSON.stringify(normalizeMessageTree(tree))).toBe(
      JSON.stringify([
        'ab',
        ['n', 'plural', { '=0': '', one: 'one', other: [0, 'xy'] }],
        ['d', 'date', { month: 'short', year: 'numeric' }],
        ['d', 'date'],
        ['b', 'tag', 'cd'],
      ])
    );
    // An empty style is invalid, so it stays for validation and printing to reject.
    expect(normalizeMessageTree([['t', 'time', {}]])).toEqual([
      ['t', 'time', {}],
    ]);
  });

  it('rewrites a message without placeholders to one string', () => {
    expect(normalizeMessageTree(['Sa', '', 've'])).toBe('Save');
    expect(normalizeMessageTree('Save')).toBe('Save');
    expect(normalizeMessageTree([])).toBe('');
    expect(normalizeMessageTree([''])).toBe('');
    expect(normalizeMessageTree([['b', 'tag', []]])).toEqual([
      ['b', 'tag', ''],
    ]);
  });
});

describe('forEachPlaceholder', () => {
  it('visits no text, whether a message, branch or tag is a string', () => {
    const names: string[] = [];
    const visit = ([name]: readonly [string, ...unknown[]]) => names.push(name);
    forEachPlaceholder('Save {x}', visit);
    forEachPlaceholder('', visit);
    forEachPlaceholder(
      [
        ['s', 'select', { a: 'Save', other: ['Hi ', ['x']] }],
        ['b', 'tag', 'y'],
      ],
      visit
    );
    expect(names).toEqual(['s', 'x', 'b']);
  });
});

describe('templateToMessage', () => {
  it('builds arguments between text', () => {
    const result = tree(['Hello ', '!'], { kind: 'argument', name: 'name' });
    expect(result).toEqual(['Hello ', ['name'], '!']);
    expectPrintRoundTrip(result);
  });

  it('merges adjacent text and drops empty text', () => {
    expect(
      tree(
        ['', 'a', ''],
        { kind: 'fragment', strings: ['x'], holes: [] },
        { kind: 'fragment', strings: ['b', 'c'], holes: [] }
      )
    ).toBe('xabc');
    expect(tree(['Save'])).toBe('Save');
    expect(tree([''])).toBe('');
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
    expect(result).toEqual([
      '# of ',
      [
        'count',
        'plural',
        {
          one: [0, ' item'],
          other: [
            0,
            ' items by ',
            ['who', 'select', { me: 'me #', other: 'others' }],
          ],
        },
      ],
    ]);
    expect(result).toEqual(
      parseTree(
        '# of {count, plural, one {# item} other {# items by {who, select, me {me #} other {others}}}}'
      )
    );
    expectPrintRoundTrip(result);
    expect(formatMessageTree(result, 'en', { count: 2, who: 'me' })).toBe(
      '# of 2 items by me #'
    );
  });

  it('builds selectordinal', () => {
    const result = tree(['', ''], {
      kind: 'selectordinal',
      name: 'place',
      branches: {
        one: { strings: ['', 'st'], holes: [POUND] },
        other: { strings: ['', 'th'], holes: [POUND] },
      },
    });
    expect(result).toEqual([
      ['place', 'selectordinal', { one: [0, 'st'], other: [0, 'th'] }],
    ]);
    expect(result).toEqual(
      parseTree('{place, selectordinal, one {#st} other {#th}}')
    );
    expectPrintRoundTrip(result);
  });

  it('adds an empty other branch to selects without one', () => {
    const [select] = tree(['', ''], {
      kind: 'select',
      name: 'size',
      branches: { small: 'S', large: 'L', medium: undefined },
    }) as [SelectNode];
    expect(select).toEqual([
      'size',
      'select',
      { large: 'L', other: '', small: 'S' },
    ]);
    expect(formatMessageTree([select], 'en', { size: 'medium' })).toBe('');
    expectPrintRoundTrip([select]);
  });

  it('emits branch keys in lexicographic order', () => {
    const [plural] = tree(['', ''], {
      kind: 'plural',
      name: 'n',
      branches: { other: 'o', one: '1', '=2': 'two', '=10': 'ten', few: 'f' },
    }) as [SelectNode];
    expect(Object.keys(plural[2])).toEqual([
      '=10',
      '=2',
      'few',
      'one',
      'other',
    ]);
    expectPrintRoundTrip([plural]);
  });

  it('keeps a __proto__ branch as an own branch', () => {
    const [select] = tree(['', ''], {
      kind: 'select',
      name: 'key',
      branches: JSON.parse('{"__proto__": "P", "other": "O"}'),
    }) as [SelectNode];
    expect(Object.keys(select[2])).toEqual(['__proto__', 'other']);
    expect(formatMessageTree([select], 'en', { key: '__proto__' })).toBe('P');
  });

  it('inlines fragments into the surrounding message', () => {
    const result = tree(['A', 'D'], {
      kind: 'fragment',
      strings: ['B', 'C'],
      holes: [{ kind: 'argument', name: 'x' }],
    });
    expectPrintRoundTrip(result);
    expect(result).toEqual(['AB', ['x'], 'CD']);
  });

  it('numbers anonymous values in tree order', () => {
    const holes: TemplateHole[] = [
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
    const { tree: result, values } = templateToMessage(
      ['', ' ', ' / ', ''],
      holes
    );
    expect(result).toEqual([
      ['_gt_1'],
      ' ',
      ['_gt_2'],
      ' / ',
      ['n', 'plural', { one: [['_gt_3']], other: [['_gt_4']] }],
    ]);
    expect(values).toEqual([
      ['_gt_1', 0],
      ['_gt_2', 'x'],
      ['_gt_3', 'y'],
      ['_gt_4', 'z'],
    ]);
  });

  it('names helper values passed without a name as anonymous, before their branches', () => {
    const {
      tree: result,
      values,
      formats,
    } = templateToMessage(
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
        {
          kind: 'number',
          value: 9.5,
          options: { style: 'percent', maximumFractionDigits: 1 },
        },
        { kind: 'date', value: 0 },
      ]
    );
    expect(result).toEqual([
      ['_gt_1', 'plural', { other: [0, ' from ', ['_gt_2']] }],
      ' ',
      ['_gt_3', 'number', 'percent'],
      ' ',
      ['_gt_4', 'date'],
    ]);
    expect(values).toEqual([
      ['_gt_1', 2],
      ['_gt_2', 'Ada'],
      ['_gt_3', 9.5],
      ['_gt_4', 0],
    ]);
    expect(formats).toEqual({ _gt_3: { maximumFractionDigits: 1 } });
    expect(
      formatMessageTree(result, 'en', Object.fromEntries(values), { formats })
    ).toContain('2 from Ada 950%');
  });

  it.each<[string, TemplateHole]>([
    ['with a space', { kind: 'argument', name: 'first name' }],
    ['that is empty', { kind: 'number', name: '' }],
    [
      'starting with a direction mark',
      { kind: 'argument', name: '\u200ename' },
    ],
  ])('rejects a variable name %s', (_case, hole) => {
    expect(() => tree(['', ''], hole)).toThrow(/not a valid ICU argument name/);
  });

  it.each<[string, TemplateHole]>([
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
    // The parser reads exact keys as safe integers.
    [
      '=N past the safe integers',
      { kind: 'plural', name: 'n', branches: { '=9007199254740992': 'x' } },
    ],
  ])('rejects a branch key %s', (_case, hole) => {
    expect(() => tree(['', ''], hole)).toThrow(/not a valid ICU selector/);
  });

  it('accepts exact keys up to the largest safe integer', () => {
    const result = tree(['', ''], {
      kind: 'plural',
      name: 'n',
      branches: { '=9007199254740991': 'x', '=-9007199254740991': 'y' },
    });
    expectPrintRoundTrip(result);
  });

  it('keeps a direction mark inside a name, which parses back', () => {
    const result = tree(['', ''], { kind: 'argument', name: 'a\u200eb' });
    expectPrintRoundTrip(result);
  });

  it('rejects the plural count outside a plural branch', () => {
    const select: TemplateHole = {
      kind: 'select',
      name: 's',
      branches: { other: { strings: ['', ''], holes: [POUND] } },
    };
    expect(() => templateToMessage(['', ' items'], [POUND])).toThrow(
      /plural count is used outside/
    );
    // Like ICU, a nested select resets the count context.
    expect(() =>
      templateToMessage(
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

  it.each<[string, TemplateHole, MessageTree, Record<string, object>]>([
    ['a plain number', { kind: 'number', name: 'n' }, [['n', 'number']], {}],
    [
      'a decimal number with digits',
      {
        kind: 'number',
        name: 'n',
        options: { style: 'decimal', maximumFractionDigits: 2 },
      },
      [['n', 'number']],
      { n: { maximumFractionDigits: 2 } },
    ],
    [
      'a percent',
      {
        kind: 'number',
        name: 'p',
        options: { style: 'percent', maximumFractionDigits: 1 },
      },
      [['p', 'number', 'percent']],
      { p: { maximumFractionDigits: 1 } },
    ],
    [
      'a currency',
      {
        kind: 'number',
        name: 't',
        options: {
          style: 'currency',
          currency: 'EUR',
          currencyDisplay: 'code',
        },
      },
      [['t', 'number', 'currency']],
      { t: { currency: 'EUR', currencyDisplay: 'code' } },
    ],
    [
      'a unit',
      {
        kind: 'number',
        name: 'km',
        options: { style: 'unit', unit: 'kilometer', unitDisplay: 'long' },
      },
      [['km', 'number', { style: 'unit', unit: 'kilometer' }]],
      { km: { unitDisplay: 'long' } },
    ],
    [
      'a date style',
      {
        kind: 'date',
        name: 'd',
        options: { style: 'medium', timeZone: 'Asia/Tokyo' },
      },
      [['d', 'date', 'medium']],
      { d: { timeZone: 'Asia/Tokyo' } },
    ],
    [
      'a time style',
      { kind: 'time', name: 't', options: { style: 'short' } },
      [['t', 'time', 'short']],
      {},
    ],
    [
      'date fields',
      {
        kind: 'date',
        name: 'd',
        options: {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hourCycle: 'h23',
          calendar: undefined,
        },
      },
      [
        [
          'd',
          'date',
          {
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            month: 'short',
            year: 'numeric',
          },
        ],
      ],
      { d: { hourCycle: 'h23' } },
    ],
    [
      'time fields',
      {
        kind: 'time',
        name: 't',
        options: {
          hour: 'numeric',
          dayPeriod: 'short',
          fractionalSecondDigits: 3,
        },
      },
      [
        [
          't',
          'time',
          { dayPeriod: 'short', fractionalSecondDigits: 3, hour: 'numeric' },
        ],
      ],
      {},
    ],
  ])(
    'keeps the message options of %s in the tree and returns its context',
    (_name, hole, expected, formats) => {
      expect(tree(['', ''], hole)).toEqual(expected);
      expect(templateToMessage(['', ''], [hole]).formats).toEqual(formats);
    }
  );

  it('writes no style, never {}, when only formatting context is set', () => {
    const result = tree(
      ['', ' ', ''],
      { kind: 'time', name: 't', options: { timeZone: 'UTC', hour12: true } },
      { kind: 'number', name: 'n', options: { maximumFractionDigits: 1 } }
    );
    expect(result).toEqual([['t', 'time'], ' ', ['n', 'number']]);
  });

  it('builds the same tree whatever the formatting context', () => {
    const build = (options: Intl.NumberFormatOptions) =>
      JSON.stringify(tree(['', ''], { kind: 'number', name: 'p', options }));
    expect(build({ style: 'currency', currency: 'USD' })).toBe(
      build({ currency: 'JPY', style: 'currency', notation: 'compact' })
    );
  });

  it('sorts fields so equal messages have equal tree JSON', () => {
    const build = (options: Intl.DateTimeFormatOptions) =>
      JSON.stringify(tree(['', ''], { kind: 'date', name: 'd', options }));
    expect(build({ year: 'numeric', month: 'long' })).toBe(
      build({ month: 'long', year: 'numeric' })
    );
  });

  it('binds one formatting context per variable', () => {
    const currency = (currency?: string): TemplateHole => ({
      kind: 'number',
      name: 'p',
      options: { style: 'currency', currency, currencyDisplay: 'code' },
    });
    expect(
      templateToMessage(['', ' ', ''], [currency('USD'), currency('USD')])
        .formats
    ).toEqual({ p: { currency: 'USD', currencyDisplay: 'code' } });
    expect(() =>
      templateToMessage(['', ' ', ''], [currency('USD'), currency('EUR')])
    ).toThrow(
      'Message variable "p" is formatted with different formatting context in one message'
    );
    // No context is a context too.
    expect(() =>
      templateToMessage(
        ['', ' ', ''],
        [currency('USD'), { kind: 'number', name: 'p' }]
      )
    ).toThrow(/different formatting context/);
  });

  it.each<[string, TemplateHole, string]>([
    [
      'a date field on a time',
      { kind: 'time', name: 't', options: { year: 'numeric' } },
      'a time has no "year" option',
    ],
    [
      'a style name with fields',
      {
        kind: 'date',
        name: 'd',
        options: { style: 'short', year: 'numeric' },
      },
      'a style name cannot be combined with fields',
    ],
    [
      'an unknown option',
      {
        kind: 'number',
        name: 'n',
        options: { scale: 2 } as Intl.NumberFormatOptions,
      },
      'a number has no "scale" option',
    ],
    [
      'a unit without the unit style',
      { kind: 'number', name: 'n', options: { unit: 'meter' } },
      `"unit" needs style: 'unit'`,
    ],
    [
      'a unit with another style',
      {
        kind: 'number',
        name: 'n',
        options: { style: 'percent', unit: 'meter' },
      },
      `"unit" needs style: 'unit'`,
    ],
    [
      'a unit style without a unit',
      { kind: 'number', name: 'n', options: { style: 'unit' } },
      'expected a unit such as "kilometer"',
    ],
    [
      'a field value Intl does not have',
      {
        kind: 'date',
        name: 'd',
        options: { month: 'tiny' as 'long' },
      },
      'expected one of: numeric, 2-digit, short, long, narrow',
    ],
  ])('rejects %s', (_name, hole, reason) => {
    expect(() => templateToMessage(['', ''], [hole])).toThrow(reason);
  });
});
