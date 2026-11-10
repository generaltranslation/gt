import { describe, expect, it } from 'vitest';
import { icuToMessageTree, messageTreeToIcu } from '../convert';
import {
  validateMessageTree,
  type DateTimeNode,
  type MessageTree,
  type NumberNode,
  type SelectNode,
} from '../index';
import {
  buildMessageTree,
  DATE_FIELD_OPTIONS,
  TIME_FIELD_OPTIONS,
  type MessageTreeHole,
} from '../internal';
import { DATE_TIME_FIELD_SYMBOLS } from '../convert/skeleton';
import { normalizeTree } from '../tree/canonical';
import { formatMessage, formatMessageTree } from './format';

const POUND: MessageTreeHole = { kind: 'pound' };

describe('icuToMessageTree', () => {
  it('converts an ICU string to a message tree', () => {
    expect(
      icuToMessageTree('Hi {name}, {n, plural, one {# file} other {# files}}')
    ).toEqual([
      'Hi ',
      ['name'],
      ', ',
      ['n', 'plural', { one: [0, ' file'], other: [0, ' files'] }],
    ]);
  });

  it('sorts branches and fields like buildMessageTree', () => {
    const tree = icuToMessageTree(
      '{n, plural, other {#} one {one} =2 {two}} {d, date, ::yMMMd}'
    );
    expect(Object.keys((tree[0] as SelectNode)[2])).toEqual([
      '=2',
      'one',
      'other',
    ]);
    expect(JSON.stringify(tree[2])).toBe(
      '["d","date",{"day":"numeric","month":"short","year":"numeric"}]'
    );
  });

  it('matches the tree built from the equivalent template', () => {
    const built = buildMessageTree(
      ['You have ', ''],
      [
        {
          kind: 'plural',
          name: 'count',
          branches: {
            one: { strings: ['', ' message'], holes: [POUND] },
            other: { strings: ['', ' messages'], holes: [POUND] },
          },
        },
      ]
    ).tree;
    expect(
      icuToMessageTree(
        'You have {count, plural, other {# messages} one {# message}}'
      )
    ).toEqual(built);
  });

  it('keeps tags, offsets, named styles, and a __proto__ branch', () => {
    const tree = icuToMessageTree(
      '<b>{n, plural, offset:1 other {#}}</b> {p, number, percent} {k, select, __proto__ {P} other {O}}'
    );
    expect(tree).toEqual([
      ['b', 'tag', [['n', 'plural', { other: [0] }, 1]]],
      ' ',
      ['p', 'number', 'percent'],
      ' ',
      ['k', 'select', JSON.parse('{"__proto__":"P","other":"O"}')],
    ]);
    expect(Object.keys((tree[4] as SelectNode)[2])).toEqual([
      '__proto__',
      'other',
    ]);
  });

  // The hour cycle is formatting context, so every hour symbol is the hour.
  it.each(['j', 'J', 'h', 'H', 'K', 'k', 'ha'])(
    'reads the hour symbol in ::%smm as the hour',
    (hour) => {
      expect(icuToMessageTree(`{d, time, ::${hour}mm}`)).toEqual([
        ['d', 'time', { hour: 'numeric', minute: '2-digit' }],
      ]);
    }
  );

  it('reads a skeleton of only formatting context as no style, never {}', () => {
    expect(icuToMessageTree('{t, time, ::a}{d, date, ::a}')).toEqual([
      ['t', 'time'],
      ['d', 'date'],
    ]);
  });

  it('formats the locale hour like formatMessage', () => {
    const d = new Date(2026, 0, 1, 13, 5);
    for (const icu of ['{d, time, ::j}', '{d, time, ::jjmm}']) {
      for (const locale of ['en-US', 'de']) {
        expect(formatMessageTree(icuToMessageTree(icu), locale, { d })).toBe(
          formatMessage(icu, locale, { d })
        );
      }
    }
  });

  it('reads fractional seconds, day periods and time zone names', () => {
    expect(
      icuToMessageTree(
        '{d, time, ::jmmssSSS} {d, time, ::hB} {d, date, ::vvvv}'
      )
    ).toEqual([
      [
        'd',
        'time',
        {
          fractionalSecondDigits: 3,
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        },
      ],
      ' ',
      ['d', 'time', { dayPeriod: 'short', hour: 'numeric' }],
      ' ',
      ['d', 'date', { timeZoneName: 'longGeneric' }],
    ]);
  });

  it('reads a unit as ICU4C does, the whole identifier', () => {
    expect(icuToMessageTree('{s, number, ::unit/kilometer-per-hour}')).toEqual([
      ['s', 'number', { style: 'unit', unit: 'kilometer-per-hour' }],
    ]);
  });

  it.each([
    '{n, number, ::currency/USD}',
    '{n, number, ::percent}',
    '{n, number, ::unit/meter unit-width-full-name}',
    '{n, number, ::measure-unit/length-meter}',
    '{n, number, integer}',
    '{d, date, ::yMd}{d, date, foo}',
    '{t, time, ::E}',
  ])('rejects %s, which a tree cannot hold', (icu) => {
    expect(() => icuToMessageTree(icu)).toThrow(
      /cannot be part of a message tree: /
    );
  });

  it('names the problem and the placeholder', () => {
    expect(() => icuToMessageTree('{n, number, ::.00}')).toThrow(
      '{n, number, ::.00} cannot be part of a message tree: a number skeleton can only be ::unit/<unit>; other number options are formatting context.'
    );
    expect(() => icuToMessageTree('{t, time, ::yMd}')).toThrow(
      '{t, time, ::yMd} cannot be part of a message tree: a time has no "day" option.'
    );
    expect(() => icuToMessageTree('{t, time, ::ssSSSS}')).toThrow(
      '{t, time, ::ssSSSS} cannot be part of a message tree: fractional seconds have at most three digits, SSS.'
    );
  });

  it('formats more than three fractional digits in an ICU string as three', () => {
    const t = new Date(2020, 4, 6, 23, 30, 5, 123);
    expect(formatMessage('{t, time, ::ssSSSS}', 'en-US', { t })).toBe(
      formatMessage('{t, time, ::ssSSS}', 'en-US', { t })
    );
  });

  it('throws a SyntaxError for an invalid ICU string', () => {
    expect(() => icuToMessageTree('{n, plural, one {x}}')).toThrow(SyntaxError);
  });
});

describe('messageTreeToIcu', () => {
  it('prints text, placeholders, and branches as ICU', () => {
    expect(
      messageTreeToIcu([
        "It's ",
        ['n', 'plural', { one: [0, ' {file}'], other: [0, ' files'] }],
        ' for ',
        ['role', 'select', { admin: 'admins', other: 'everyone' }],
      ])
    ).toBe(
      "It's {n,plural,one{# '{file}'} other{# files}} for {role,select,admin{admins} other{everyone}}"
    );
  });

  it.each<[MessageTree, string]>([
    [[['n', 'number']], '{n, number}'],
    [[['p', 'number', 'percent']], '{p, number, percent}'],
    [[['t', 'number', 'currency']], '{t, number, currency}'],
    [
      [['km', 'number', { style: 'unit', unit: 'kilometer' }]],
      '{km, number, ::unit/kilometer}',
    ],
    [[['d', 'date', 'medium']], '{d, date, medium}'],
    [[['t', 'time', 'short']], '{t, time, short}'],
    [[['d', 'date', { day: 'numeric', month: 'short' }]], '{d, date, ::MMMd}'],
    [
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
      '{d, date, ::yMMMdjmm}',
    ],
    [
      [
        [
          't',
          'time',
          {
            dayPeriod: 'long',
            fractionalSecondDigits: 2,
            hour: '2-digit',
            second: 'numeric',
            timeZoneName: 'shortOffset',
          },
        ],
      ],
      '{t, time, ::jjBBBBsSSO}',
    ],
  ])('prints %j as %s', (tree, icu) => {
    expect(messageTreeToIcu(tree)).toBe(icu);
    expect(icuToMessageTree(icu)).toEqual(tree);
  });

  it('prints adjacent text as one literal', () => {
    // Quoting '{' and '}' separately would print '{''}', an escaped quote.
    const tree: MessageTree = ['{', '}', ['b', 'tag', ["'", '{']]];
    expect(icuToMessageTree(messageTreeToIcu(tree))).toEqual([
      '{}',
      ['b', 'tag', ["'{"]],
    ]);
  });

  it.each<[string, unknown]>([
    ['a currency', ['p', 'number', { currency: 'USD', style: 'currency' }]],
    ['a time zone', ['d', 'date', { timeZone: 'UTC', year: 'numeric' }]],
    ['dateStyle as an option', ['d', 'date', { dateStyle: 'medium' }]],
    ['date fields on a time', ['t', 'time', { year: 'numeric' }]],
    ['an unknown style name', ['n', 'number', 'integer']],
  ])('throws for %s, which a tree cannot hold', (_name, node) => {
    expect(() => messageTreeToIcu([node] as MessageTree)).toThrow(
      /cannot be part of a message tree/
    );
  });

  it('prints the same ICU in any host time zone', () => {
    const tree: MessageTree = [
      ['t', 'time', { hour: 'numeric', timeZoneName: 'short' }],
      ['d', 'date', { day: 'numeric', month: 'short', year: 'numeric' }],
    ];
    const original = process.env.TZ;
    try {
      const printed = ['UTC', 'America/New_York', 'Asia/Tokyo'].map((zone) => {
        process.env.TZ = zone;
        return messageTreeToIcu(tree);
      });
      expect(new Set(printed)).toEqual(
        new Set(['{t, time, ::jz}{d, date, ::yMMMd}'])
      );
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it('prints an offset branch where it cannot read as offset:', () => {
    const tree = icuToMessageTree('{n, plural, other {O} offset {X}}');
    expect(icuToMessageTree(messageTreeToIcu(tree))).toEqual(tree);
  });
});

// Every style a tree holds, each field value alone, and fields together.
function formattedNodes(): (NumberNode | DateTimeNode)[] {
  const nodes: (NumberNode | DateTimeNode)[] = [
    ['n', 'number'],
    ['n', 'number', 'percent'],
    ['n', 'number', 'currency'],
    ['n', 'number', { style: 'unit', unit: 'kilometer' }],
    ['n', 'number', { style: 'unit', unit: 'kilometer-per-hour' }],
    ['d', 'date'],
    ['d', 'time'],
  ];
  for (const name of ['full', 'long', 'medium', 'short'] as const) {
    nodes.push(['d', 'date', name], ['d', 'time', name]);
  }
  for (const kind of ['date', 'time'] as const) {
    const fields: readonly string[] =
      kind === 'date' ? DATE_FIELD_OPTIONS : TIME_FIELD_OPTIONS;
    for (const field of fields) {
      const symbols =
        DATE_TIME_FIELD_SYMBOLS[field as keyof typeof DATE_TIME_FIELD_SYMBOLS];
      for (const value of Object.keys(symbols)) {
        const typed =
          field === 'fractionalSecondDigits' ? Number(value) : value;
        nodes.push(['d', kind, { [field]: typed }] as DateTimeNode);
      }
    }
  }
  nodes.push(
    [
      'd',
      'date',
      {
        day: '2-digit',
        era: 'long',
        hour: 'numeric',
        minute: '2-digit',
        month: 'long',
        second: '2-digit',
        weekday: 'short',
        year: 'numeric',
      },
    ],
    [
      'd',
      'time',
      {
        dayPeriod: 'narrow',
        fractionalSecondDigits: 1,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        timeZoneName: 'long',
      },
    ]
  );
  return nodes;
}

const LOSSLESS_TREES: MessageTree[] = [
  [],
  ['Plain text'],
  ["It's {quoted} # and '' and {}"],
  ['Hi ', ['name'], '!'],
  ...formattedNodes().map((node) => ['Value: ', node, '.']),
  [
    [
      'count',
      'plural',
      {
        '=0': 'None',
        '=-1': 'Minus one',
        few: [0, ' few'],
        one: [0, " item's"],
        other: [
          0,
          ' items for ',
          ['role', 'select', { admin: ['admins # ', ['who']], other: '' }],
        ],
      },
      1,
    ],
  ],
  [['place', 'selectordinal', { one: [0, 'st'], other: [0, 'th'] }]],
  [['k', 'select', JSON.parse('{"__proto__":"P","offset":"X","other":"O"}')]],
  [
    'Read ',
    [
      'b',
      'tag',
      ['the ', ['i', 'tag', ['terms']], ' by ', ['d', 'date', 'long']],
    ],
  ],
  [
    [
      'n',
      'plural',
      {
        other: [
          ['b', 'tag', [0, ' at ', ['p', 'number', 'percent']]],
          ['t', 'time', { hour: '2-digit', minute: '2-digit' }],
        ],
      },
    ],
  ],
];

describe('the tree and ICU text', () => {
  // Valid canonical trees print to ICU and read back as the same tree.
  it.each(LOSSLESS_TREES.map((tree) => [JSON.stringify(tree), tree]))(
    'convert without loss: %s',
    (_json, tree) => {
      expect(validateMessageTree(tree)).toBeUndefined();
      expect(normalizeTree(tree)).toEqual(tree);
      expect(icuToMessageTree(messageTreeToIcu(tree))).toEqual(tree);
    }
  );

  // Non-canonical styles that would print and read back as another tree.
  it.each<[string, unknown]>([
    ['an empty time style', [['t', 'time', {}]]],
    ['an empty date style', [['d', 'date', {}]]],
    ['an empty number style', [['n', 'number', {}]]],
  ])('rejects %s, which is not lossless', (_name, tree) => {
    expect(validateMessageTree(tree)).toEqual({
      path: [0, 2],
      message: 'expected options; leave out an empty style',
    });
    expect(() => messageTreeToIcu(tree as MessageTree)).toThrow(
      /cannot be part of a message tree/
    );
  });

  it('formats each node like its printed ICU', () => {
    const d = new Date(2020, 4, 6, 23, 30, 5, 123);
    for (const node of formattedNodes()) {
      // The currency is formatting context, which ICU text cannot carry.
      if (node[2] === 'currency') continue;
      const icu = messageTreeToIcu([node]);
      const values = node[1] === 'number' ? { n: 1234.5 } : { d };
      for (const locale of ['en-US', 'de', 'ja']) {
        expect(formatMessageTree([node], locale, values)).toBe(
          formatMessage(icu, locale, values)
        );
      }
    }
  });
});
