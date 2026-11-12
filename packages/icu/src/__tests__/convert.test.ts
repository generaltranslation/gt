import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkTranslation,
  icuToMessage,
  messageToIcu,
  messageTreeToIcu,
} from '../convert';
import {
  validateMessageTree,
  type DateTimeNode,
  type Message,
  type MessageTree,
  type MessageTreeFormats,
  type NumberNode,
  type SelectNode,
} from '../index';
import { buildMessageTree, type TemplateHole } from '../internal';
import {
  DATE_FIELD_OPTIONS,
  TIME_FIELD_OPTIONS,
} from '../settings/formatOptions';
import { DATE_TIME_FIELD_SYMBOLS } from '../convert/skeleton';
import { normalizeTree } from '../tree/canonical';
import { formatMessage, formatMessageTree } from './format';
import { DATE_SKELETONS, NUMBER_SKELETONS } from './skeletonCases';

const POUND: TemplateHole = { kind: 'pound' };

describe('icuToMessage', () => {
  it('converts an ICU string to a message tree', () => {
    expect(
      icuToMessage('Hi {name}, {n, plural, one {# file} other {# files}}').tree
    ).toEqual([
      'Hi ',
      ['name'],
      ', ',
      ['n', 'plural', { one: [0, ' file'], other: [0, ' files'] }],
    ]);
  });

  it('converts a message without placeholders to one string', () => {
    expect(icuToMessage('Save').tree).toBe('Save');
    expect(icuToMessage('').tree).toBe('');
    expect(icuToMessage("It's '{cool}'").tree).toBe("It's {cool}");
    expect(icuToMessage('<b>bold</b> text').tree).toEqual([
      ['b', 'tag', 'bold'],
      ' text',
    ]);
    expect(icuToMessage('{s, select, a {} other {Hi}}<b></b>').tree).toEqual([
      ['s', 'select', { a: '', other: 'Hi' }],
      ['b', 'tag', ''],
    ]);
  });

  it('sorts branches and fields like buildMessageTree', () => {
    const tree = icuToMessage(
      '{n, plural, other {#} one {one} =2 {two}} {d, date, ::yMMMd}'
    ).tree;
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
      icuToMessage(
        'You have {count, plural, other {# messages} one {# message}}'
      ).tree
    ).toEqual(built);
  });

  it('keeps tags, offsets, named styles, and a __proto__ branch', () => {
    const tree = icuToMessage(
      '<b>{n, plural, offset:1 other {#}}</b> {p, number, percent} {k, select, __proto__ {P} other {O}}'
    ).tree;
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
  it.each(['j', 'h', 'H', 'K', 'k', 'ha'])(
    'reads the hour symbol in ::%smm as the hour',
    (hour) => {
      expect(icuToMessage(`{d, time, ::${hour}mm}`).tree).toEqual([
        ['d', 'time', { hour: 'numeric', minute: '2-digit' }],
      ]);
    }
  );

  it('reads a skeleton without fields as no style, never {}', () => {
    expect(icuToMessage("{t, time, ::'x'}{d, date, ::'x'}").tree).toEqual([
      ['t', 'time'],
      ['d', 'date'],
    ]);
  });

  it('formats the locale hour like formatMessage', () => {
    const d = new Date(2026, 0, 1, 13, 5);
    for (const icu of ['{d, time, ::j}', '{d, time, ::jjmm}']) {
      for (const locale of ['en-US', 'de']) {
        expect(formatMessageTree(icuToMessage(icu).tree, locale, { d })).toBe(
          formatMessage(icu, locale, { d })
        );
      }
    }
  });

  it('reads fractional seconds, day periods and time zone names', () => {
    expect(
      icuToMessage('{d, time, ::jmmssSSS} {p, time, ::hB} {z, date, ::vvvv}')
        .tree
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
      ['p', 'time', { dayPeriod: 'short', hour: 'numeric' }],
      ' ',
      ['z', 'date', { timeZoneName: 'longGeneric' }],
    ]);
  });

  it('reads a unit as ICU4C does, the whole identifier', () => {
    expect(icuToMessage('{s, number, ::unit/kilometer-per-hour}').tree).toEqual(
      [['s', 'number', { style: 'unit', unit: 'kilometer-per-hour' }]]
    );
  });

  // The message options stay in the tree; the rest is the variable's formats.
  it.each<[string, MessageTree, Record<string, object>]>([
    [
      '{n, number, ::currency/EUR .00}',
      [['n', 'number', 'currency']],
      {
        n: {
          currency: 'EUR',
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        },
      },
    ],
    [
      '{n, number, ::compact-short}',
      [['n', 'number']],
      { n: { compactDisplay: 'short', notation: 'compact' } },
    ],
    [
      '{n, number, integer}',
      [['n', 'number']],
      { n: { maximumFractionDigits: 0 } },
    ],
    // ICU's percent does not multiply by 100; `%x100` does, as Intl's style.
    [
      '{n, number, ::percent .0}',
      [['n', 'number', { style: 'unit', unit: 'percent' }]],
      { n: { maximumFractionDigits: 1, minimumFractionDigits: 1 } },
    ],
    [
      '{n, number, ::%x100 .0}',
      [['n', 'number', 'percent']],
      { n: { maximumFractionDigits: 1, minimumFractionDigits: 1 } },
    ],
    [
      '{n, number, ::measure-unit/length-meter unit-width-full-name}',
      [['n', 'number', { style: 'unit', unit: 'meter' }]],
      { n: { unitDisplay: 'long' } },
    ],
    ['{n, number, ::scale/0}', [['n', 'number']], { n: { scale: 0 } }],
    ['{n, number, ::scale/100}', [['n', 'number']], { n: { scale: 100 } }],
    [
      '{t, time, ::Hmm}',
      [['t', 'time', { hour: 'numeric', minute: '2-digit' }]],
      { t: { hourCycle: 'h23' } },
    ],
    [
      '{n, number, percent} {d, date, long}',
      [['n', 'number', 'percent'], ' ', ['d', 'date', 'long']],
      {},
    ],
  ])('splits %s into its tree and formats', (icu, tree, formats) => {
    expect(icuToMessage(icu)).toEqual({ tree, formats });
  });

  it('reads the same sentence in two currencies as one tree', () => {
    const euros = icuToMessage('Total: {total, number, ::currency/EUR}');
    const dollars = icuToMessage('Total: {total, number, ::currency/USD}');
    expect(dollars.tree).toEqual(euros.tree);
    expect([euros.formats, dollars.formats]).toEqual([
      { total: { currency: 'EUR' } },
      { total: { currency: 'USD' } },
    ]);
  });

  // A message formats as its string does: nothing the string says is lost.
  it.each([
    ...NUMBER_SKELETONS.map(({ skeleton }) => `{n, number, ::${skeleton}}`),
    ...DATE_SKELETONS.map(({ skeleton }) => `{d, date, ::${skeleton}}`),
    '{n, number, integer}',
    '{n, number, percent}',
    '{d, date, full} {d, time, short}',
  ])('formats the message of %s like the string', (icu) => {
    const { tree, formats } = icuToMessage(icu);
    const values = { n: 1234.567, d: new Date(2020, 4, 6, 23, 30, 5, 123) };
    for (const locale of ['en-US', 'de', 'ja']) {
      expect(formatMessageTree(tree, locale, values, { formats })).toBe(
        formatMessage(icu, locale, values)
      );
    }
  });

  it('reads a style name of the app from `styles`', () => {
    const styles = {
      number: { EUR: { style: 'currency', currency: 'EUR' } },
      // Intl's name for a date's style is read as the message's `style`.
      date: { day: { dateStyle: 'full', timeZone: 'UTC' } },
      time: { clock: { hour: 'numeric', hour12: false } },
    } as const;
    expect(
      icuToMessage('{n, number, EUR} {d, date, day} {t, time, clock}', {
        styles,
      })
    ).toEqual({
      tree: [
        ['n', 'number', 'currency'],
        ' ',
        ['d', 'date', 'full'],
        ' ',
        ['t', 'time', { hour: 'numeric' }],
      ],
      formats: {
        n: { currency: 'EUR' },
        d: { timeZone: 'UTC' },
        t: { hour12: false },
      },
    });
    // The app's own name wins over ICU's, as in FormatJS.
    expect(
      icuToMessage('{n, number, percent}', {
        styles: { number: { percent: { maximumFractionDigits: 1 } } },
      })
    ).toEqual({
      tree: [['n', 'number']],
      formats: { n: { maximumFractionDigits: 1 } },
    });
  });

  it.each([
    '{n, number, EUR}',
    // An inherited key is not a style name.
    '{n, number, constructor}',
    '{d, date, ::yMd}{d, date, foo}',
    '{t, time, ::E}',
  ])('rejects %s, which no message holds', (icu) => {
    expect(() => icuToMessage(icu)).toThrow(
      /cannot be part of a message tree: /
    );
  });

  it('rejects one variable with two formatting contexts', () => {
    expect(() =>
      icuToMessage('{n, number, ::.00} or about {n, number, ::compact-short}')
    ).toThrow(
      'Message variable "n" is formatted with different formatting context in one message; give each its own variable name.'
    );
    // The same options twice are one context.
    expect(
      icuToMessage('{n, number, ::.00} of {n, number, ::.00}').formats
    ).toEqual({ n: { maximumFractionDigits: 2, minimumFractionDigits: 2 } });
  });

  it('names the problem and the placeholder', () => {
    expect(() => icuToMessage('{n, number, EUR}')).toThrow(
      '{n, number, EUR} cannot be part of a message tree: "EUR" is not a style name; pass the app\'s own style names as `styles`.'
    );
    expect(() => icuToMessage('{t, time, ::yMd}').tree).toThrow(
      '{t, time, ::yMd} cannot be part of a message tree: a time has no "year" option.'
    );
  });

  it('throws a RangeError for a skeleton Intl cannot format', () => {
    expect(() => icuToMessage('{t, time, ::ssSSSS}')).toThrow(
      new RangeError('Unsupported date/time skeleton field: SSSS.')
    );
    expect(() => icuToMessage('{n, number, ::permille}')).toThrow(
      new RangeError(
        'The number skeleton token "permille" cannot be formatted: Intl has no per-mille unit.'
      )
    );
  });

  it('throws a SyntaxError for an invalid ICU string', () => {
    expect(() => icuToMessage('{n, plural, one {x}}').tree).toThrow(
      SyntaxError
    );
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
    expect(icuToMessage(icu).tree).toEqual(tree);
  });

  it('prints a message without placeholders as literal text', () => {
    expect(messageTreeToIcu("It's {cool}")).toBe("It's '{cool}'");
    expect(messageTreeToIcu('')).toBe('');
    expect(messageTreeToIcu([['b', 'tag', 'bold'], ' text'])).toBe(
      '<b>bold</b> text'
    );
    expect(
      messageTreeToIcu([['n', 'plural', { one: '# {n}', other: [0] }]])
    ).toBe("{n,plural,one{'#' '{n}'} other{#}}");
  });

  it.each<[string, unknown]>([
    ['a currency', ['p', 'number', { currency: 'USD', style: 'currency' }]],
    ['a time zone', ['d', 'date', { timeZone: 'UTC', year: 'numeric' }]],
    ['a style as an option', ['d', 'date', { style: 'medium' }]],
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
    const tree = icuToMessage('{n, plural, other {O} offset {X}}').tree;
    expect(icuToMessage(messageTreeToIcu(tree)).tree).toEqual(tree);
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
  '',
  'Plain text',
  "It's {quoted} # and '' and {}",
  "'{'",
  ['Hi ', ['name'], '!'],
  [['b', 'tag', 'bold'], ' text'],
  ['a ', ['i', 'tag', ''], " it's"],
  [
    [
      'n',
      'plural',
      { '=0': '', one: "# isn't '{n}'", other: [0, " it's '#'"] },
    ],
  ],
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
      ['the ', ['i', 'tag', 'terms'], ' by ', ['d', 'date', 'long']],
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

describe('messageToIcu', () => {
  it.each<[string, Message, string, MessageTreeFormats]>([
    [
      'a currency and its digits',
      {
        tree: ['Total: ', ['total', 'number', 'currency']],
        formats: { total: { currency: 'EUR', maximumFractionDigits: 0 } },
      },
      'Total: {total, number, ::currency/EUR precision-integer}',
      {},
    ],
    [
      'an hour cycle, and not a time zone',
      {
        tree: [['due', 'time', { hour: 'numeric', minute: '2-digit' }]],
        formats: { due: { hourCycle: 'h23', timeZone: 'Asia/Tokyo' } },
      },
      '{due, time, ::Hmm}',
      { due: { timeZone: 'Asia/Tokyo' } },
    ],
    [
      'a notation, grouping and a sign',
      {
        tree: [['n', 'number']],
        formats: {
          n: {
            notation: 'compact',
            compactDisplay: 'short',
            useGrouping: false,
            signDisplay: 'always',
          },
        },
      },
      '{n, number, ::compact-short group-off sign-always}',
      {},
    ],
    [
      'the digits of a percent',
      {
        tree: [['n', 'number', 'percent']],
        formats: { n: { maximumFractionDigits: 1 } },
      },
      '{n, number, ::%x100 .#}',
      {},
    ],
    [
      'the width of a unit',
      {
        tree: [['d', 'number', { style: 'unit', unit: 'kilometer' }]],
        formats: { d: { unitDisplay: 'long' } },
      },
      '{d, number, ::unit/kilometer unit-width-full-name}',
      {},
    ],
    [
      'the same context in every branch',
      {
        tree: [
          [
            'n',
            'plural',
            {
              one: [['total', 'number', 'currency'], ' for ', 0, ' item'],
              other: [['total', 'number', 'currency'], ' for ', 0, ' items'],
            },
          ],
        ],
        formats: { total: { currency: 'USD' } },
      },
      '{n,plural,one{{total, number, ::currency/USD} for # item} other{{total, number, ::currency/USD} for # items}}',
      {},
    ],
  ])('writes %s', (_what, message, icu, formats) => {
    expect(messageToIcu(message)).toEqual({ icu, formats });
  });

  // A token is written only when it reads back as exactly its options.
  it.each<[string, Message, string]>([
    [
      'a minimum of fraction digits without a maximum',
      { tree: [['n', 'number']], formats: { n: { minimumFractionDigits: 2 } } },
      '{n, number}',
    ],
    [
      'a compact notation without its display',
      { tree: [['n', 'number']], formats: { n: { notation: 'compact' } } },
      '{n, number}',
    ],
    [
      'the digits of a currency without its code',
      {
        tree: [['n', 'number', 'currency']],
        formats: { n: { maximumFractionDigits: 0 } },
      },
      '{n, number, currency}',
    ],
    [
      'the hour cycle of a named style',
      { tree: [['t', 'time', 'short']], formats: { t: { hourCycle: 'h23' } } },
      '{t, time, short}',
    ],
    [
      'a time zone, a calendar and a numbering system of a date',
      {
        tree: [['d', 'date', 'long']],
        formats: {
          d: { timeZone: 'UTC', calendar: 'gregory', numberingSystem: 'latn' },
        },
      },
      '{d, date, long}',
    ],
    [
      // `formats` is by variable, so reading the string back would give `n`
      // two contexts.
      'context that only one placeholder of a variable can spell',
      {
        tree: [['n', 'number'], ' is ', ['n', 'number', 'currency']],
        formats: { n: { currency: 'EUR' } },
      },
      '{n, number} is {n, number, currency}',
    ],
  ])('leaves %s in formats', (_what, message, icu) => {
    expect(messageToIcu(message)).toEqual({ icu, formats: message.formats });
  });

  const fixture = readFileSync(
    new URL('./fixtures/icu4c/icu4c-78.3.tsv', import.meta.url),
    'utf8'
  );
  const READABLE = [
    ...new Set(fixture.split('\n').map((row) => row.split('\t')[0])),
  ].filter((icu) => {
    try {
      return icuToMessage(icu);
    } catch {
      return false;
    }
  });

  // Nothing is lost or added on the way to an ICU string and back.
  it.each(READABLE)('writes the message of %s back', (icu) => {
    const message = icuToMessage(icu);
    const written = messageToIcu(message);
    const read = icuToMessage(written.icu);
    expect(read.tree).toEqual(message.tree);
    const names = Object.keys(message.formats);
    expect(Object.keys({ ...read.formats, ...written.formats })).toEqual(
      expect.arrayContaining(names)
    );
    for (const name of names) {
      // The string says nothing the message does not.
      expect(message.formats[name]).toMatchObject(read.formats[name] ?? {});
      expect({ ...read.formats[name], ...written.formats[name] }).toEqual(
        message.formats[name]
      );
    }
    // Printing is stable: what was read prints the same again.
    expect(messageToIcu(read).icu).toBe(written.icu);
  });

  it('reads back what it writes for the options of a tagged template', () => {
    const message: Message = {
      tree: [
        ['total', 'number', 'currency'],
        ' at ',
        ['t', 'time', { hour: '2-digit', minute: '2-digit' }],
      ],
      formats: {
        total: {
          currency: 'JPY',
          currencyDisplay: 'code',
          currencySign: 'accounting',
          localeMatcher: 'lookup',
          minimumIntegerDigits: 2,
          roundingMode: 'floor',
        },
        t: { hour12: false, timeZone: 'Asia/Tokyo' },
      },
    };
    const written = messageToIcu(message);
    expect(written).toEqual({
      icu: '{total, number, ::currency/JPY unit-width-iso-code rounding-mode-floor integer-width/*00 sign-accounting} at {t, time, ::jjmm}',
      formats: {
        total: { localeMatcher: 'lookup' },
        t: { hour12: false, timeZone: 'Asia/Tokyo' },
      },
    });
    expect(icuToMessage(written.icu).tree).toEqual(message.tree);
  });
});

describe('the tree and ICU text', () => {
  // Valid canonical trees print to ICU and read back as the same tree.
  it.each(LOSSLESS_TREES.map((tree) => [JSON.stringify(tree), tree]))(
    'convert without loss: %s',
    (_json, tree) => {
      expect(validateMessageTree(tree)).toBeUndefined();
      expect(normalizeTree(tree)).toEqual(tree);
      expect(icuToMessage(messageTreeToIcu(tree)).tree).toEqual(tree);
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

describe('checkTranslation', () => {
  const price: MessageTree = ['Total: ', ['price', 'number', 'currency']];

  it('checks a message without placeholders on either side', () => {
    expect(checkTranslation('Save', icuToMessage('Guardar'))).toBeUndefined();
    expect(
      checkTranslation('Save', icuToMessage(''), { locale: 'ja' })
    ).toBeUndefined();
    expect(
      checkTranslation([['b', 'tag', 'Save']], icuToMessage('<b>Guardar</b>'))
    ).toBeUndefined();
    expect(checkTranslation(price, icuToMessage('Total'))).toBe(
      'The translation does not match its source: "price" is missing from the translation.'
    );
    expect(checkTranslation('Save', icuToMessage('Guardar {name}'))).toBe(
      'The translation does not match its source: "name" does not exist in the source.'
    );
  });

  it('accepts new text, word order and branch content', () => {
    const source: MessageTree = [
      ['n', 'plural', { one: [0, ' file by ', ['who']], other: [0, ' files'] }],
      ' ',
      ['d', 'date', { day: 'numeric', month: 'short' }],
    ];
    expect(
      checkTranslation(
        source,
        icuToMessage(
          '{d, date, ::dMMM} : {n, plural, one {# fichier de {who}} other {# fichiers de {who}}}'
        )
      )
    ).toBeUndefined();
  });

  it.each([
    [
      'a variable the source does not have',
      'Total : {cost, number, currency}',
      '"cost" does not exist in the source; "price" is missing from the translation',
    ],
    [
      'a changed kind',
      'Total : {price}',
      '"price" changed kind or plural offset',
    ],
  ])('rejects %s', (_name, translation, problem) => {
    expect(checkTranslation(price, icuToMessage(translation))).toMatch(
      `The translation does not match its source: ${problem}`
    );
  });

  it('rejects a changed plural offset or plural kind', () => {
    const source: MessageTree = [['n', 'plural', { other: [0] }]];
    expect(
      checkTranslation(source, icuToMessage('{n, plural, offset:1 other {#}}'))
    ).toContain('"n" changed kind or plural offset');
    expect(
      checkTranslation(source, icuToMessage('{n, selectordinal, other {#}}'))
    ).toContain('"n" changed kind or plural offset');
  });

  it('rejects a style the source does not use for the variable', () => {
    expect(
      checkTranslation(price, icuToMessage('Total : {price, number}'))
    ).toBe(
      'The translation does not match its source: "price" uses {price, number}, which the source does not; "price" is missing {price, number, currency}.'
    );
    const source: MessageTree = [['d', 'date', 'short']];
    expect(
      checkTranslation(source, icuToMessage('{d, date, medium}'))
    ).toContain('"d" uses {d, date, medium}, which the source does not');
  });

  it('accepts each style of a variable in any order, and requires all of them', () => {
    const source: MessageTree = [
      ['p', 'number', 'percent'],
      ' (',
      ['p', 'number'],
      ')',
    ];
    expect(
      checkTranslation(
        source,
        icuToMessage('({p, number}) {p, number, percent} {p, number}')
      )
    ).toBeUndefined();
    expect(checkTranslation(source, icuToMessage('{p, number, percent}'))).toBe(
      'The translation does not match its source: "p" is missing {p, number}.'
    );
  });

  // How a value is rendered is the source's, so a translation sets none of it.
  it.each([
    [
      'a currency',
      'Total : {price, number, ::currency/USD}',
      '"price" sets currency, which a translation cannot set',
    ],
    [
      'digits',
      'Total : {price, number, ::currency/EUR .00}',
      '"price" sets currency, maximumFractionDigits, minimumFractionDigits, which a translation cannot set',
    ],
  ])('reports %s set by the translation', (_name, translation, problem) => {
    expect(checkTranslation(price, icuToMessage(translation))).toBe(
      `The translation does not match its source: ${problem}.`
    );
  });

  it('reports an hour cycle set by the translation', () => {
    const source = icuToMessage('At {t, time, ::jmm}').tree;
    expect(checkTranslation(source, icuToMessage('À {t, time, ::jmm}'))).toBe(
      undefined
    );
    expect(checkTranslation(source, icuToMessage('À {t, time, ::Hmm}'))).toBe(
      'The translation does not match its source: "t" sets hourCycle, which a translation cannot set.'
    );
  });

  it('treats fields in any key order as one style', () => {
    const source: MessageTree = [
      ['d', 'date', { day: 'numeric', month: 'short' }],
    ];
    expect(
      checkTranslation(source, {
        tree: [['d', 'date', { month: 'short', day: 'numeric' }]],
        formats: {},
      })
    ).toBeUndefined();
  });

  it('accepts leaving out the plural categories the locale does not have', () => {
    // Japanese has only `other`, so `one`, its `name` and its style go.
    const source: MessageTree = [
      [
        'n',
        'plural',
        {
          one: ['Only ', ['name'], ' on ', ['d', 'date', 'long']],
          other: [0, ' files on ', ['d', 'date', 'short']],
        },
      ],
    ];
    const translation = icuToMessage(
      '{n, plural, other {{d, date, short}に#件}}'
    );
    expect(
      checkTranslation(source, translation, { locale: 'ja' })
    ).toBeUndefined();
    expect(checkTranslation(source, translation)).toBe(
      'The translation does not match its source: "name" is missing from the translation; "d" is missing {d, date, long}.'
    );
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
      checkTranslation(nested, icuToMessage('{n, selectordinal, other {#.}}'), {
        locale: 'ja',
      })
    ).toBeUndefined();
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
      expect(
        checkTranslation(source, icuToMessage(translation), { locale })
      ).toContain('"name" is missing from the translation');
    }
  );

  describe('with a locale, checks the plural branches', () => {
    const files: MessageTree = [
      ['n', 'plural', { one: [0, ' file'], other: [0, ' files'] }],
    ];
    const check = (icu: string, locale?: string, source = files) =>
      checkTranslation(source, icuToMessage(icu), { locale });
    const problem = (text: string) =>
      `The translation does not match its source: ${text}.`;

    it('needs a branch for every category the locale has', () => {
      // 2 and 22 are `few` in Russian, and would read as `other` does.
      expect(check('{n, plural, one {# файл} other {# файлов}}', 'ru')).toBe(
        problem('"n" is missing the plural branches few, many, which ru needs')
      );
      expect(
        check(
          '{n, plural, one {# файл} few {# файла} many {# файлов} other {# файла}}',
          'ru'
        )
      ).toBeUndefined();
      // A million is `many` in French: 1 000 000 de fichiers.
      expect(
        check('{n, plural, one {# fichier} other {# fichiers}}', 'fr')
      ).toBe(problem('"n" is missing the plural branch many, which fr needs'));
    });

    it('asks for no more than `other` where the locale has only that', () => {
      expect(check('{n, plural, other {#件}}', 'ja')).toBeUndefined();
    });

    it('leaves alone a category the locale does not have', () => {
      // Never chosen in Japanese, so it does no harm.
      expect(check('{n, plural, one {#件} other {#件}}', 'ja')).toBeUndefined();
    });

    it('rejects a branch that is no category', () => {
      expect(
        check('{n, plural, one {# file} lots {many} other {# files}}', 'en')
      ).toBe(
        problem(
          '"n" has the plural branch lots, which is not a plural category'
        )
      );
    });

    it('keeps exact branches out of it', () => {
      expect(
        check('{n, plural, =0 {none} one {# file} other {# files}}', 'en')
      ).toBeUndefined();
    });

    it('checks an ordinal by the locale’s ordinal categories', () => {
      const place: MessageTree = [
        ['n', 'selectordinal', { one: [0, 'er'], other: [0, 'e'] }],
      ];
      expect(
        check('{n, selectordinal, one {#st} other {#th}}', 'en', place)
      ).toBe(
        problem('"n" is missing the ordinal branches two, few, which en needs')
      );
      expect(
        check(
          '{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
          'en',
          place
        )
      ).toBeUndefined();
    });

    it('checks a plural inside a branch, and reports each plural once', () => {
      const nested: MessageTree = [
        [
          'g',
          'select',
          {
            a: [['n', 'plural', { one: 'x', other: 'y' }]],
            other: [['n', 'plural', { one: 'x', other: 'y' }]],
          },
        ],
      ];
      expect(
        check(
          '{g, select, a {{n, plural, one {x} other {y}}} other {{n, plural, one {x} other {y}}}}',
          'pl',
          nested
        )
      ).toBe(
        problem('"n" is missing the plural branches few, many, which pl needs')
      );
    });

    it('checks no branches without a locale, or with one Intl has no rules for', () => {
      expect(check('{n, plural, other {# файлов}}')).toBeUndefined();
      // Intl would answer for the host's language.
      expect(check('{n, plural, other {# x}}', 'zz')).toBeUndefined();
    });
  });
});
