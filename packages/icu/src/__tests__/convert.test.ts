import { describe, expect, it } from 'vitest';
import { icuToMessageTree, messageTreeToIcu } from '../convert';
import {
  buildMessageTree,
  findConflictingFormat,
  type MessageTree,
  type MessageTreeHole,
  type SelectNode,
} from '../index';
import { formatMessage } from '../parser';
import { formatMessageTree } from '../index';
import { DATE_SKELETONS, NUMBER_SKELETONS } from './skeletonCases';

const POUND: MessageTreeHole = { kind: 'pound' };

const price: MessageTree = [
  'Total: ',
  ['price', 'number', { currency: 'USD', style: 'currency' }],
];

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

  it('sorts branches and Intl options like buildMessageTree', () => {
    const tree = icuToMessageTree(
      '{n, plural, other {#} one {one} =2 {two}} {p, number, ::currency/EUR}'
    );
    expect(Object.keys((tree[0] as SelectNode)[2])).toEqual([
      '=2',
      'one',
      'other',
    ]);
    expect(JSON.stringify(tree[2])).toBe(
      '["p","number",{"currency":"EUR","style":"currency"}]'
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

  // Without a locale, j and J stay the locale's hour, like Intl's `hour`
  // without an `hourCycle`, instead of being dropped.
  it.each([
    ['{d, time, ::j}', { hour: 'numeric' }],
    ['{d, time, ::jjmm}', { hour: '2-digit', minute: '2-digit' }],
    [
      '{d, time, ::Jmm}',
      { hour: 'numeric', hourCycle: 'h23', minute: '2-digit' },
    ],
  ])('keeps the locale hour in %s', (icu, options) => {
    expect(icuToMessageTree(icu)).toEqual([['d', 'time', options]]);
    const d = new Date(2026, 0, 1, 13, 5);
    for (const locale of ['en-US', 'de']) {
      expect(formatMessageTree(icuToMessageTree(icu), locale, { d })).toBe(
        formatMessage(icu, locale, { d })
      );
    }
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

  it('prints Intl options ICU can spell as skeletons', () => {
    expect(messageTreeToIcu(price)).toBe(
      'Total: {price, number, ::currency/USD}'
    );
    expect(
      messageTreeToIcu([
        ['d', 'date', { day: 'numeric', month: 'short', year: 'numeric' }],
        ' ',
        ['p', 'number', 'percent'],
      ])
    ).toBe('{d, date, ::yMMMd} {p, number, percent}');
  });

  it('prints options a skeleton formats alike by the Intl spec', () => {
    // compactDisplay defaults to short, and a currency ignores unitDisplay,
    // in every locale and time zone.
    expect(
      messageTreeToIcu([
        ['n', 'number', { notation: 'compact' }],
        ' ',
        [
          'p',
          'number',
          {
            currency: 'EUR',
            currencyDisplay: 'narrowSymbol',
            style: 'currency',
          },
        ],
      ])
    ).toBe(
      '{n, number, ::compact-short} {p, number, ::currency/EUR unit-width-narrow}'
    );
  });

  it('prints plain percent as the named style, which scales like Intl', () => {
    // An ICU `percent` skeleton does not multiply by 100; the named style does.
    expect(messageTreeToIcu([['p', 'number', { style: 'percent' }]])).toBe(
      '{p, number, percent}'
    );
  });

  it('prints adjacent text as one literal', () => {
    // Quoting '{' and '}' separately would print '{''}', an escaped quote.
    const tree: MessageTree = ['{', '}', ['b', 'tag', ["'", '{']]];
    expect(icuToMessageTree(messageTreeToIcu(tree))).toEqual([
      '{}',
      ['b', 'tag', ["'{"]],
    ]);
  });

  it('drops a zero scale, which formats as no scale, unlike in ICU', () => {
    expect(messageTreeToIcu([['n', 'number', { scale: 0 }]])).toBe(
      '{n, number}'
    );
  });

  it('drops Intl options ICU cannot spell exactly', () => {
    // Printing only `year` would show a format the tree does not have.
    expect(
      messageTreeToIcu([
        ['d', 'date', { dateStyle: 'medium', timeStyle: 'short' }],
        ' ',
        ['t', 'time', { timeZone: 'UTC', year: 'numeric' }],
        // ICU spells an hour with its cycle; without one it depends on the locale.
        ['h', 'time', { hour: 'numeric', minute: '2-digit' }],
        ['c', 'date', { calendar: 'gregory', year: 'numeric' }],
        // formatjs and standard ICU read the code and symbol widths reversed.
        [
          'p',
          'number',
          { currency: 'USD', currencyDisplay: 'code', style: 'currency' },
        ],
      ])
    ).toBe('{d, date} {t, time}{h, time}{c, date}{p, number}');
  });

  it('prints the same ICU in any host time zone', () => {
    const tree: MessageTree = [
      ['t', 'time', { timeZone: 'UTC', year: 'numeric' }],
      ['d', 'date', { day: 'numeric', month: 'short', year: 'numeric' }],
    ];
    const original = process.env.TZ;
    try {
      const printed = ['UTC', 'America/New_York', 'Asia/Tokyo'].map((zone) => {
        process.env.TZ = zone;
        return messageTreeToIcu(tree);
      });
      expect(new Set(printed)).toEqual(
        new Set(['{t, time}{d, date, ::yMMMd}'])
      );
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  // Skeletons whose tree does not print back as the same skeleton: formatjs
  // reads them differently from standard ICU, they give one fraction bound
  // (Intl fills the other from the style, ICU leaves it open), or they spell
  // only Intl defaults. Plain percent prints as the named style, which both
  // read as Intl does; the rest drop their format, which `source` restores.
  const NOT_PRINTED_AS_SKELETONS: Record<string, string> = {
    '{v, number, ::percent}': '{v, number, percent}',
    '{v, number, ::%}': '{v, number, percent}',
    '{v, number, ::%x100}': '{v, number}',
    '{v, number, ::currency/USD unit-width-short}': '{v, number}',
    // An explicit symbol width is Intl's default.
    '{v, number, ::currency/USD unit-width-iso-code}':
      '{v, number, ::currency/USD}',
    '{v, number, ::precision-integer}': '{v, number}',
    '{v, number, ::.}': '{v, number}',
    '{v, number, ::.##}': '{v, number}',
    '{v, number, ::.000*}': '{v, number}',
    '{v, number, ::sign-auto}': '{v, number}',
    '{v, number, ::.0#/@@#r}': '{v, number}',
    '{v, number, ::@@+s}': '{v, number}',
    '{v, number, ::scale/0}': '{v, number}',
  };

  it.each([
    ...NUMBER_SKELETONS.map(({ skeleton }) => `{v, number, ::${skeleton}}`),
    ...DATE_SKELETONS.map(({ skeleton }) => `{v, date, ::${skeleton}}`),
    // Concise and combined forms.
    '{v, number, ::K}',
    '{v, number, ::+! currency/EUR unit-width-narrow}',
    '{v, number, ::() currency/JPY}',
    '{v, number, ::sign-never group-off}',
    '{v, number, ::.00/w}',
    '{v, number, ::.0#/@@#r}',
    '{v, number, ::@@+s}',
    '{v, number, ::rounding-mode-half-even scale/0.5}',
    '{v, number, ::integer-width/*000 measure-unit/length-meter}',
    '{v, time, ::Hmm}',
    '{v, time, ::ha}',
    '{v, date, ::GGGGyMMMMdEEEEhmsz}',
    '{v, date, ::LLLLcccc}',
  ])('round-trips %s without a source', (icu) => {
    const tree = icuToMessageTree(icu);
    const printed = messageTreeToIcu(tree);
    if (icu in NOT_PRINTED_AS_SKELETONS) {
      expect(printed).toBe(NOT_PRINTED_AS_SKELETONS[icu]);
    } else {
      expect(icuToMessageTree(printed)).toEqual(tree);
    }
  });

  it('treats empty Intl options as no options, except on a time', () => {
    const none: MessageTree = [['p', 'number']];
    expect(icuToMessageTree('{p, number, ::group-min2}')).toEqual(none);
    expect(
      buildMessageTree(['', ''], [{ kind: 'number', name: 'p', options: {} }])
        .tree
    ).toEqual(none);
    expect(icuToMessageTree('{d, date, ::S}')).toEqual([['d', 'date']]);
    // A time without a style formats as a medium time; with `{}`, as Intl's
    // default date.
    expect(icuToMessageTree('{t, time, ::S}')).toEqual([['t', 'time', {}]]);
  });
});

describe('icuToMessageTree with a source', () => {
  const sources: [string, MessageTree][] = [
    [
      'formats',
      [
        'Due ',
        ['due', 'date', { dateStyle: 'medium', timeStyle: 'short' }],
        ', total: ',
        price[1],
      ],
    ],
    [
      'nested branches',
      [
        [
          'count',
          'plural',
          {
            '=0': 'No messages',
            one: [
              0,
              ' message for ',
              ['role', 'select', { admin: 'admins', other: 'everyone' }],
            ],
            other: [
              0,
              ' messages from ',
              ['who'],
              ' at ',
              ['p', 'number', { style: 'percent' }],
            ],
          },
        ],
      ],
    ],
    [
      'an offset and a tag',
      [
        [
          'b',
          'tag',
          [['n', 'selectordinal', { one: [0, 'st'], other: [0, 'th'] }, 1]],
        ],
      ],
    ],
  ];

  it.each(sources)('round-trips %s through printing', (_name, source) => {
    expect(icuToMessageTree(messageTreeToIcu(source), { source })).toEqual(
      source
    );
  });

  it("restores the source's formats in a translation", () => {
    expect(
      icuToMessageTree('Total : {price, number}', { source: price })
    ).toEqual([
      'Total : ',
      ['price', 'number', { currency: 'USD', style: 'currency' }],
    ]);
    // The source decides formats, so a translated style is replaced.
    expect(
      icuToMessageTree('Total : {price, number, percent}', { source: price })
    ).toEqual(icuToMessageTree('Total : {price, number}', { source: price }));
  });

  it.each([
    [
      'a variable the source does not have',
      'Total : {cost, number}',
      '"cost" does not exist in the source; "price" is missing from the translation',
    ],
    ['a missing variable', 'Total', '"price" is missing from the translation'],
    [
      'a changed kind',
      'Total : {price}',
      '"price" changed kind or plural offset',
    ],
  ])('rejects %s', (_name, translation, problem) => {
    expect(() => icuToMessageTree(translation, { source: price })).toThrow(
      `The translation does not use the same variables as its source: ${problem}`
    );
  });

  it('rejects a changed plural offset or plural kind', () => {
    const source: MessageTree = [['n', 'plural', { other: [0] }]];
    expect(() =>
      icuToMessageTree('{n, plural, offset:1 other {#}}', { source })
    ).toThrow('"n" changed kind or plural offset');
    expect(() =>
      icuToMessageTree('{n, selectordinal, other {#}}', { source })
    ).toThrow('"n" changed kind or plural offset');
  });

  it('treats Intl options in any key order as one format', () => {
    const source: MessageTree = [
      ['p', 'number', { style: 'currency', currency: 'USD' }],
      ' / ',
      ['p', 'number', { currency: 'USD', style: 'currency' }],
      ' ',
      ['d', 'date', { dateStyle: 'short', timeZone: 'UTC' }],
      ['d', 'date', { timeZone: 'UTC', dateStyle: 'short' }],
    ];
    const icu = messageTreeToIcu(source);
    expect(icuToMessageTree(icu, { source })).toEqual(
      icuToMessageTree(icu, { source: JSON.parse(JSON.stringify(source)) })
    );
    expect(icuToMessageTree(icu, { source })[0]).toEqual([
      'p',
      'number',
      { currency: 'USD', style: 'currency' },
    ]);
  });

  it('rejects a source that formats one variable two ways', () => {
    const source: MessageTree = [
      ['p', 'number', { style: 'percent' }],
      ['p', 'number', { style: 'currency', currency: 'USD' }],
    ];
    expect(() =>
      icuToMessageTree('{p, number}{p, number}', { source })
    ).toThrow(
      'Message variable "p" is formatted two different ways in the source'
    );
  });
});

describe('findConflictingFormat', () => {
  it('names a variable formatted two different ways', () => {
    expect(
      findConflictingFormat([
        ['p', 'number', { style: 'percent' }],
        ['n', 'plural', { other: [['p', 'number']] }],
      ])
    ).toBe('p');
    expect(
      findConflictingFormat([
        ['d', 'date', 'short'],
        ['d', 'date', { dateStyle: 'short' }],
      ])
    ).toBe('d');
  });

  it('accepts one format in any key order, and one name used as different kinds', () => {
    expect(
      findConflictingFormat([
        ['p', 'number', { style: 'currency', currency: 'USD' }],
        ['p', 'number', { currency: 'USD', style: 'currency' }],
        ['d', 'date', { dateStyle: 'short' }],
        ['d', 'time', { timeStyle: 'short' }],
        ['d'],
      ])
    ).toBeUndefined();
  });
});
