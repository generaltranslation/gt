/**
 * ICU4C is the reference for what a message means. Every row of
 * fixtures/icu4c/icu4c-78.3.tsv is a message, a value and what ICU4C 78.3
 * prints for them in en_US and UTC. Each must be one of:
 *
 * - the same text as ICU4C's;
 * - the same text once ICU's defaults are spelled out, where Intl's differ:
 *   ICU rounds a tie to the even digit and keeps six fraction digits in a
 *   skeleton, and V8 writes a plain space before AM and PM;
 * - an error, for what ICU4C formats and Intl cannot (UNSUPPORTED below) and
 *   for what ICU4C rejects too;
 * - one of DIFFERENCES below, each with its reason.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { icuToMessage } from '../convert';
import { formatMessageTree } from '../index';
import { formatMessage } from '../parser';

type Row = { message: string; value: string; icu: string };

const DATE = new Date('2020-05-06T23:30:05.123Z');

const ROWS: Row[] = readFileSync(
  new URL('./fixtures/icu4c/icu4c-78.3.tsv', import.meta.url),
  'utf8'
)
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [message, value, icu] = line.split('\t');
    return { message, value, icu };
  });

const number = (skeleton: string) => `{n, number, ::${skeleton}}`;
const date = (skeleton: string) => `{d, date, ::${skeleton}}`;

/**
 * What ICU4C formats and Intl cannot. Reading one throws a RangeError that
 * names the token or field, rather than formatting something else.
 */
const UNSUPPORTED = new Set([
  ...[
    // A sign or a number of digits for the exponent.
    'scientific/sign-always',
    'scientific/sign-never',
    'scientific/sign-except-zero',
    'scientific/*ee',
    'scientific/+ee',
    'scientific/*ee/sign-always',
    'scientific/sign-always/*ee',
    'E00',
    'EE00',
    'E+!0',
    'EE+!0',
    'E+?00',
    // Units Intl does not have, and a unit given in two tokens.
    'permille',
    'permille scale/1000',
    'unit/permille',
    'unit/furlong-per-second',
    'measure-unit/length-meter per-measure-unit/duration-second',
    'measure-unit/length-meter per-measure-unit/duration-hour',
    // A hidden, formal or variant currency symbol.
    'currency/CAD unit-width-hidden',
    'unit/meter unit-width-hidden',
    'currency/CAD unit-width-formal',
    'currency/CAD unit-width-variant',
    // Cash rounding, half-odd rounding, no rounding, and other increments.
    'currency/CAD precision-currency-cash',
    'precision-currency-cash/w',
    'rounding-mode-half-odd',
    '.0 rounding-mode-half-odd',
    '.0 rounding-mode-unnecessary',
    'precision-increment/0.3',
    // A maximum of integer digits, or none.
    'integer-width/##0',
    'integer-width/00',
    'integer-width/*',
    'integer-width-trunc',
    // Grouping by thousands in every locale, and `5.` for 5.
    'group-thousands',
    'decimal-always',
  ].map(number),
  ...[
    // Week-based and related years, quarters, weeks, and days of the year.
    'Y u U r Q QQQ QQQQ q Qy yQQQ yQQQQ w ww W yw MMMMW D F g A',
    // A numeric or two-letter weekday, and a zero-padded year.
    'e c EEEEEE eeeeee cccccc yyyyy',
    // AM or PM alone or narrow, noon and midnight, and the hours `J` and `C`.
    'a aaaa hmaaaaa jjjjj jjjjjj b bh jmb J JJ Jm C CC Cm jmC',
    // More than three fractional digits.
    'SSSS SSSSSS',
    // ISO and location time zones, and widths ICU4C prints as nothing.
    'Z ZZZZ ZZZZZ V VV VVV VVVV X XXX x xxx vv OO',
  ]
    .flatMap((fields) => fields.split(' '))
    .map(date),
  // ICU4C reads any other style as a pattern.
  '{n, number, #,##0.00}',
  '{n, number, foo}',
  '{d, date, yyyy-MM-dd}',
]);

type Difference = {
  why: string;
  messages: string[];
  check: (row: Row) => void;
};

/** Where a message formats, but not as ICU4C formats it. */
const DIFFERENCES: Difference[] = [
  {
    why: 'Intl adds the date to a skeleton of only an era or a time zone name',
    messages: 'G GGG GGGG GGGGG z zz zzz zzzz O OOOO v vvvv'
      .split(' ')
      .map(date),
    check: (row) => {
      expect(format(row)).toMatch(/^5\/6\/2020,? /);
      expect(format(row).endsWith(row.icu)).toBe(true);
    },
  },
  {
    // `jB` is how a message tree prints `{ hour, dayPeriod }`, so it is read
    // back as that. `hB` is the day period in ICU4C too.
    why: 'ICU4C shows AM or PM for the day period B beside the hour j',
    messages: ['jB', 'jmB'].map(date),
    check: (row) => {
      expect(row.icu).toMatch(/PM$/);
      expect(format(row)).toMatch(/at night$/);
    },
  },
  {
    // `.00/@##s` and `.##/@@@r`, with the priority, format alike in both.
    why: 'ICU4C pads a fraction combined with significant digits to its minimum; Intl does not',
    messages: ['.00/@##', '.00/@', '.0#/@@@*', '.00/@@@*'].map(number),
    check: (row) => {
      const unpadded = row.icu.replace(/\.0+$|(\.\d*?[1-9])0+$/, '$1');
      expect([row.icu, unpadded]).toContain(formatWithIcuDefaults(row));
    },
  },
  {
    // `@@@*` keeps at most 21 significant digits the same way, which only a
    // bigint or a numeric string has: formatter.test.ts checks it.
    why: 'Intl keeps at most 100 fraction digits, where .00* and precision-unlimited keep every one',
    messages: ['.00*', 'precision-unlimited'].map(number),
    check: (row) => {
      if (Math.abs(Number(row.value)) < 1e-100) {
        expect(Number(format(row))).toBe(0);
      } else {
        expect(format(row)).toBe(row.icu);
      }
    },
  },
  {
    why: 'ICU4C rounds to two digits for precision-currency-standard without a currency',
    messages: [number('precision-currency-standard')],
    check: (row) => {
      expect(format(row)).toBe(format({ ...row, message: '{n, number}' }));
    },
  },
  {
    why: 'ICU4C rejects an unknown numbering system; Intl uses the locale’s',
    messages: [number('numbering-system/bogus')],
    check: (row) => {
      expect(row.icu).toMatch(/^PARSE ERROR/);
      expect(format(row)).toBe(format({ ...row, message: '{n, number}' }));
    },
  },
  {
    why: 'ICU4C formats a number or date in {n} for the locale; it is printed as JavaScript prints it, like FormatJS',
    messages: ['{n}', '{d}'],
    check: (row) => {
      const { n, d } = valuesOf(row);
      expect(format(row)).toBe(String(row.message === '{n}' ? n : d));
    },
  },
  {
    why: 'ICU4C takes the currency of {n, number, currency} from the locale; a message says which it is',
    messages: ['{n, number, currency}'],
    check: (row) => {
      expect(() => format(row)).toThrow('no currency was given');
    },
  },
  {
    why: '<b>…</b> is a tag, as in FormatJS; ICU4C reads it as text',
    messages: ['<b>{s}</b>', "a '<b>' b {s}"],
    check: (row) => {
      if (row.message.startsWith('<')) {
        expect(() => format(row)).toThrow('"b" was not provided');
      } else {
        expect(format(row)).toBe('a <b> b x');
      }
    },
  },
  {
    why: 'spellout, ordinal and duration are not Intl formats',
    messages: ['{n, spellout}', '{n, ordinal}', '{n, duration}'],
    check: (row) => {
      expect(() => format(row)).toThrow('INVALID_ARGUMENT_TYPE');
    },
  },
];

const DIFFERENCE_OF = new Map(
  DIFFERENCES.flatMap((difference) =>
    difference.messages.map((message) => [message, difference] as const)
  )
);

function valuesOf({ value }: Row) {
  return { n: Number(value) || 0, s: value, d: DATE };
}

function format(row: Row): string {
  return formatMessage(row.message, 'en-US', valuesOf(row), {
    timeZone: 'UTC',
  });
}

const PRECISION_OPTIONS = [
  'minimumFractionDigits',
  'maximumFractionDigits',
  'minimumSignificantDigits',
  'maximumSignificantDigits',
  'roundingIncrement',
];

/**
 * Formats a lone number with ICU's defaults spelled out as formatting
 * context: a tie rounds to the even digit, and a skeleton without a
 * precision keeps six fraction digits, unless it is compact or a currency.
 */
function formatWithIcuDefaults(row: Row): string {
  if (!/^\{n, number[^{}]*\}$/.test(row.message)) return format(row);
  const { tree, formats } = icuToMessage(row.message);
  const context: Record<string, unknown> = formats.n ?? {};
  const sixFractionDigits =
    row.message.includes('::') &&
    !PRECISION_OPTIONS.some((option) => option in context) &&
    context.notation !== 'compact' &&
    !JSON.stringify(tree).includes('"currency"');
  return formatMessageTree(tree, 'en-US', valuesOf(row), {
    timeZone: 'UTC',
    formats: {
      n: {
        roundingMode: 'halfEven',
        ...(sixFractionDigits && { maximumFractionDigits: 6 }),
        ...context,
      },
    },
  });
}

// V8 writes a plain space where CLDR has a narrow no-break space.
const plainSpaces = (text: string) => text.replace(/\u202f/g, ' ');

const ROWS_BY_MESSAGE = new Map<string, Row[]>();
for (const row of ROWS) {
  ROWS_BY_MESSAGE.set(row.message, [
    ...(ROWS_BY_MESSAGE.get(row.message) ?? []),
    row,
  ]);
}
const MESSAGES = [...ROWS_BY_MESSAGE.keys()];

describe('ICU4C conformance', () => {
  it.each(
    MESSAGES.filter(
      (message) => !DIFFERENCE_OF.has(message) && !UNSUPPORTED.has(message)
    )
  )('formats %s as ICU4C does, or rejects it too', (message) => {
    for (const row of ROWS_BY_MESSAGE.get(message)!) {
      if (/^(PARSE|FORMAT) ERROR/.test(row.icu)) {
        expect(() => format(row)).toThrow();
      } else if (plainSpaces(format(row)) !== plainSpaces(row.icu)) {
        expect(formatWithIcuDefaults(row)).toBe(row.icu);
      }
    }
  });

  it.each([...UNSUPPORTED])(
    'throws for %s, which Intl cannot format',
    (message) => {
      const rows = ROWS_BY_MESSAGE.get(message)!;
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(() => format(row)).toThrow(RangeError);
    }
  );

  describe.each(DIFFERENCES)('$why', ({ messages, check }) => {
    it.each(messages)('%s', (message) => {
      const rows = ROWS_BY_MESSAGE.get(message)!;
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach(check);
    });
  });
});
