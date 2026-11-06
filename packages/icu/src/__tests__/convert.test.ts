import { describe, expect, it } from 'vitest';
import { icuToMessageTree, messageTreeToIcu } from '../convert';
import { type MessageTree, type SelectNode } from '../index';
import {
  buildMessageTree,
  findConflictingFormat,
  type MessageTreeHole,
} from '../internal';
import { formatMessage } from '../parser';
import { formatMessageTree } from '../index';
import type { ExtendedNumberFormatOptions } from '../types-dir/ast';
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
        ' ',
        ['h', 'time', { hour: 'numeric', minute: '2-digit' }],
      ])
    ).toBe('{d, date, ::yMMMd} {p, number, percent} {h, time, ::jmm}');
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
    expect(
      messageTreeToIcu([
        ['n', 'number', { scale: 0 }],
        ['p', 'number', { currency: 'USD', scale: 0, style: 'currency' }],
      ])
    ).toBe('{n, number}{p, number, ::currency/USD}');
  });

  it('prints every number format the parser reads, in its spelling', () => {
    expect(
      messageTreeToIcu([
        [
          'a',
          'number',
          { currency: 'USD', currencyDisplay: 'code', style: 'currency' },
        ],
        ' ',
        ['b', 'number', { scale: 100, style: 'percent' }],
        ' ',
        ['c', 'number', { maximumFractionDigits: 2 }],
        ' ',
        ['d', 'number', { minimumFractionDigits: 3 }],
        ' ',
        ['e', 'number', { maximumFractionDigits: 0 }],
        ' ',
        [
          'f',
          'number',
          {
            maximumFractionDigits: 2,
            maximumSignificantDigits: 3,
            minimumFractionDigits: 1,
            minimumSignificantDigits: 2,
            roundingPriority: 'morePrecision',
          } as ExtendedNumberFormatOptions,
        ],
      ])
    ).toBe(
      '{a, number, ::currency/USD unit-width-short} {b, number, ::percent scale/100} {c, number, ::.##} {d, number, ::.000*} {e, number, ::precision-integer} {f, number, ::.0#/@@#r}'
    );
  });

  it('prints the ICU part of a format, leaving tree-only options to source', () => {
    expect(
      messageTreeToIcu([
        ['d', 'date', { dateStyle: 'medium', timeStyle: 'short' }],
        ' ',
        ['t', 'time', { timeZone: 'UTC', year: 'numeric' }],
        ' ',
        ['c', 'date', { calendar: 'gregory', year: 'numeric' }],
        ' ',
        ['n', 'number', { numberingSystem: 'arab', style: 'percent' }],
      ])
    ).toBe('{d, date} {t, time, ::y} {c, date, ::y} {n, number, percent}');
  });

  it('drops a format whose fields ICU cannot spell', () => {
    // Printing only `second` would show a format the tree does not have.
    expect(
      messageTreeToIcu([
        ['s', 'time', { fractionalSecondDigits: 2, second: 'numeric' }],
        // A 12-hour clock left to the locale is h12 or h11; ICU spells one.
        ['h', 'time', { hour: 'numeric', hour12: true }],
      ])
    ).toBe('{s, time}{h, time}');
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
        new Set(['{t, time, ::y}{d, date, ::yMMMd}'])
      );
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  // Skeletons that print as another spelling of the same format: plain percent
  // as the named style, and Intl defaults or a zero scale as nothing.
  const EQUIVALENT_SPELLINGS: Record<string, string> = {
    '{v, number, ::percent}': '{v, number, percent}',
    '{v, number, ::%}': '{v, number, percent}',
    '{v, number, ::currency/USD unit-width-iso-code}':
      '{v, number, ::currency/USD}',
    '{v, number, ::sign-auto}': '{v, number}',
    '{v, number, ::scale/0}': '{v, number}',
    '{v, time, ::S}': '{v, time, ::yMd}',
  };
  const formatted = (icu: string): string[] => {
    const values = icu.startsWith('{v, number')
      ? [1234.5678, -0.5, 0]
      : [new Date(2025, 0, 2, 15, 4, 5)];
    return ['en-US', 'de', 'ja'].flatMap((locale) =>
      values.map((v) => {
        try {
          return formatMessage(icu, locale, { v });
        } catch (error) {
          return `throws ${(error as Error).name}`;
        }
      })
    );
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
    // Significant digits a fraction stem cannot carry as its option.
    '{v, number, ::precision-integer @@r}',
    '{v, number, ::.00/w @@r}',
    '{v, number, ::@@+s}',
    '{v, number, ::rounding-mode-half-even scale/0.5}',
    '{v, number, ::integer-width/*000 measure-unit/length-meter}',
    '{v, time, ::Hmm}',
    '{v, time, ::ha}',
    '{v, time, ::j}',
    '{v, time, ::jjmm}',
    '{v, date, ::yMMMdjmm}',
    '{v, date, ::GGGGyMMMMdEEEEhmsz}',
    '{v, date, ::LLLLcccc}',
    '{v, time, ::S}',
  ])('round-trips %s without a source', (icu) => {
    const tree = icuToMessageTree(icu);
    const printed = messageTreeToIcu(tree);
    if (icu in EQUIVALENT_SPELLINGS) {
      expect(printed).toBe(EQUIVALENT_SPELLINGS[icu]);
    } else {
      expect(icuToMessageTree(printed)).toEqual(tree);
    }
    expect(formatted(printed)).toEqual(formatted(icu));
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

  it('prints an offset branch where it cannot read as offset:', () => {
    const tree = icuToMessageTree('{n, plural, other {O} offset {X}}');
    expect(icuToMessageTree(messageTreeToIcu(tree))).toEqual(tree);
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

  it('accepts leaving out the plural categories the locale does not have', () => {
    // Japanese has only `other`, so `one` and its `name` go.
    const source: MessageTree = [
      [
        'n',
        'plural',
        { one: ['Only ', ['name'], "'s file"], other: [0, ' files'] },
      ],
    ];
    expect(
      icuToMessageTree('{n, plural, other {#件のファイル}}', {
        source,
        locale: 'ja',
      })
    ).toEqual([['n', 'plural', { other: [0, '件のファイル'] }]]);
    // Ordinals use the locale's ordinal categories, and a variable may sit
    // deeper in the left-out branch.
    const nested: MessageTree = [
      [
        'n',
        'selectordinal',
        {
          one: [['role', 'select', { admin: ['by ', ['name']], other: '' }]],
          other: [0, 'th'],
        },
      ],
    ];
    expect(
      icuToMessageTree('{n, selectordinal, other {#.}}', {
        source: nested,
        locale: 'ja',
      })
    ).toEqual([['n', 'selectordinal', { other: [0, '.'] }]]);
  });

  it.each<[string, MessageTree, string, string | undefined]>([
    [
      'is in a category the locale has (French has one)',
      [['n', 'plural', { one: ['by ', ['name']], other: [0] }]],
      '{n, plural, other {#}}',
      'fr',
    ],
    [
      'is in a left-out category, without a locale',
      [['n', 'plural', { one: ['by ', ['name']], other: [0] }]],
      '{n, plural, other {#}}',
      undefined,
    ],
    [
      'is used outside the left-out category',
      [['name'], ': ', ['n', 'plural', { one: ['by ', ['name']], other: [0] }]],
      '{n, plural, other {#}}',
      'ja',
    ],
    [
      'is in an exact branch, which every locale has',
      [['n', 'plural', { '=0': ['None by ', ['name']], other: [0] }]],
      '{n, plural, other {#}}',
      'ja',
    ],
    [
      'is in a select branch, which every locale has',
      [['role', 'select', { admin: ['Admin ', ['name']], other: 'User' }]],
      '{role, select, other {User}}',
      'ja',
    ],
  ])(
    'rejects a missing variable that %s',
    (_name, source, translation, locale) => {
      expect(() => icuToMessageTree(translation, { source, locale })).toThrow(
        '"name" is missing from the translation'
      );
    }
  );

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

  it('restores each format of a variable from its ICU spelling', () => {
    const source: MessageTree = [
      ['p', 'number', { style: 'percent' }],
      ' (',
      [
        'p',
        'number',
        { currency: 'USD', numberingSystem: 'latn', style: 'currency' },
      ],
      ')',
    ];
    // Translators may reorder placeholders; each keeps its own format.
    expect(
      icuToMessageTree('({p, number, ::currency/USD}) {p, number, percent}', {
        source,
      })
    ).toEqual(['(', source[2], ') ', source[0]]);
  });

  it('rejects a format the source does not have when a variable has several', () => {
    const source: MessageTree = [
      ['p', 'number', { style: 'percent' }],
      ['p', 'number'],
    ];
    expect(() =>
      icuToMessageTree('{p, number, ::currency/EUR}{p, number}', { source })
    ).toThrow('"p" uses a format the source does not have');
  });

  it('rejects a source that formats one variable two ways ICU spells alike', () => {
    const source: MessageTree = [
      ['d', 'date', { dateStyle: 'short', timeZone: 'UTC' }],
      ['d', 'date', { dateStyle: 'short', timeZone: 'Asia/Tokyo' }],
    ];
    expect(() => icuToMessageTree('{d, date}{d, date}', { source })).toThrow(
      'Message variable "d" has two formats ICU spells the same way in the source'
    );
  });
});

describe('findConflictingFormat', () => {
  it('names a variable with two formats ICU spells the same way', () => {
    expect(
      findConflictingFormat([
        ['t', 'time', { timeStyle: 'short', timeZone: 'UTC' }],
        ['n', 'plural', { other: [['t', 'time', { timeStyle: 'short' }]] }],
      ])
    ).toBe('t');
  });

  it('accepts formats ICU spells differently, in any key order, and one name used as different kinds', () => {
    expect(
      findConflictingFormat([
        ['p', 'number', { style: 'currency', currency: 'USD' }],
        ['p', 'number', { currency: 'USD', style: 'currency' }],
        ['p', 'number', { style: 'percent' }],
        ['p', 'number'],
        ['d', 'date', 'short'],
        ['d', 'date', { dateStyle: 'short' }],
        ['d', 'time', { timeStyle: 'short' }],
        ['d'],
      ])
    ).toBeUndefined();
  });
});
