/**
 * Every part of ICU MessageFormat against ICU4C, the reference: syntax and
 * quoting, plural and select, numbers, dates and times, in many locales.
 * Each line of fixtures/icu4c/messages-78.3.jsonl is a message, its values
 * and what ICU4C 78.3 prints for them in UTC, or the error it fails with.
 *
 * A case formats to ICU4C's text, or fails where ICU4C fails. Otherwise it
 * names one of REASONS as `differs`, and must then really differ, so a
 * difference that is fixed loses its mark. It prints `ours` instead, or throws
 * when it has none.
 *
 * icu4c-conformance.test.ts goes deeper into skeletons, in en-US only.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { icuToMessage } from '../convert';
import { formatMessageTree } from '../index';
import { formatIcu, parse } from '../parser';
import { MAX_NESTING_DEPTH } from '../settings/syntax';

/** Why a message does not format as it does in ICU4C. */
const REASONS = {
  // ---- ICU keeps these for old messages. They are left out.
  pattern:
    'A pattern as the style, like #,##0.00 or yyyy-MM-dd, is written for one locale, and ICU discourages it. Write a skeleton.',
  choice: 'ICU deprecates choice. Write a plural or a select.',
  'keyword-case':
    'A type or a style name is lower case, as ICU’s grammar spells it. ICU4C’s parser happens to take any case.',
  'duplicate-selector':
    'A branch key written twice is a mistake. ICU4C uses the first and never the second.',
  'missing-value':
    'A value that was not given is an error. ICU4C shows the reader the placeholder, like {name}.',
  'numbered-arguments':
    'A name is a key of the values, digits or not. ICU4C keeps rules for numbered arguments: no {01}, none past 32767.',
  'empty-style':
    'A style or skeleton that is empty is a mistake. ICU4C formats as with no style, and prints nothing for a date.',
  'plural-from-format':
    'A plural category comes from the value. ICU4C takes it from how the first {n, number, …} in the branch prints, for named and pattern styles only.',
  'whole-number':
    'A plural counts whole things: =1.5, a fractional offset and a number past 2^53 are errors. ICU4C takes them.',
  'name-space':
    'A name or a branch key has no white space of any kind. ICU4C takes a no-break space as part of one.',
  'skeleton-letter':
    'A letter that is no field in a date skeleton is an error. ICU4C skips it, so a typo disappears.',
  nesting: `A message nests at most ${MAX_NESTING_DEPTH} levels. ICU4C stops at 1,023.`,

  // ---- Intl formats the values, and cannot do everything ICU does.
  'intl-cannot':
    'Intl has no option for this token or field, so it throws a RangeError that names it.',
  'rule-based':
    'spellout, ordinal and duration need rule-based number formats, which Intl does not have.',
  bigint:
    'Intl picks a plural category for a double, and a scale that is no power of ten multiplies as one. An int64 they would round is an error.',
  'intl-range':
    'A number past the largest double is an error, unless it is a bigint: Intl prints ∞ for it. ICU4C multiplies a scale as a decimal.',
  'intl-lone-field':
    'An era and a time zone name with no other field are an error: Intl adds the date to them. ICU4C prints the two.',
  'invalid-date':
    'Intl throws for an invalid date. ICU4C prints nothing for it.',

  // ---- Intl fills in what a message leaves out, or picks the pattern.
  'intl-rounding':
    'A tie rounds away from zero in Intl, and to the even digit in ICU. Write rounding-mode-half-even.',
  'intl-digits':
    'A skeleton keeps Intl’s fraction digits for its style, mostly three. ICU allows six. Write a precision.',
  'hour-second':
    'An hour and a second with no minute, like ::kkss, join as for ::HHss: 03 (second: 5). ICU4C puts the second first for kk.',
  'intl-year': 'yyyy does not pad a year before 1000 to four digits in Intl.',
  'intl-calendar':
    'Before 15 October 1582 ICU4C counts in the Julian calendar and V8 in the Gregorian.',
  'intl-grouping':
    'Spanish groups a number from five digits. ICU4C’s {n, number} groups from four, and its own skeletons from five.',

  // ---- Read differently on purpose.
  tags: '<b>…</b> is a tag, as in FormatJS, so an apostrophe before < or > quotes. ICU4C reads all of it as text.',
  'plain-value':
    '{name} prints a number as JavaScript does, as in FormatJS: {year} is 2024, not 2,024. ICU4C formats it for the locale. Write {n, number}.',
  'value-type':
    'A numeric string is a number, as Intl reads one exactly. ICU4C fails.',
  'hour-width':
    'hh and HH pad the hour, as Intl’s 2-digit hour does, which is what a message tree holds for them. ICU4C pads as the locale’s own pattern does, however many letters are written.',
  currency:
    '{n, number, currency} takes its currency from the message’s formats: a locale does not say what an amount is in. ICU4C takes the locale’s.',
  'day-period':
    '::jB shows the day period, as a message tree prints an hour with one. ICU4C shows AM or PM.',
} as const;

/** A time may not hold a date field in a message tree, like `{t, time, ::yMd}`. */
const TREE_REASONS = { 'time-fields': true } as const;

type Value =
  | number
  | string
  | { $date: string }
  | { $int: string }
  | { $number: 'Infinity' | '-Infinity' };

interface Case {
  id: string;
  locale: string;
  message: string;
  values: Record<string, Value>;
  /** What ICU4C prints, or the error it fails with when `rejects`. */
  icu: string;
  rejects?: true;
  differs?: keyof typeof REASONS;
  /** What a case that `differs` prints here instead; without it, it throws. */
  ours?: string;
  treeDiffers?: keyof typeof TREE_REASONS;
}
type Different = Case & Required<Pick<Case, 'differs'>>;

const CASES: Case[] = readFileSync(
  new URL('./fixtures/icu4c/messages-78.3.jsonl', import.meta.url),
  'utf8'
)
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const DIFFERENT = CASES.filter(
  (item): item is Different => item.differs !== undefined
);

const valuesOf = (values: Case['values']) =>
  Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      typeof value !== 'object'
        ? value
        : '$date' in value
          ? new Date(value.$date)
          : '$int' in value
            ? BigInt(value.$int)
            : Number(value.$number),
    ])
  );

// V8 writes a plain space before AM and PM, where ICU4C writes a narrow
// no-break space.
const text = (value: string) => value.replace(/\u202f/g, ' ');

type Outcome = { text: string } | { error: unknown };
const attempt = (format: () => unknown): Outcome => {
  try {
    return { text: text(String(format())) };
  } catch (error) {
    return { error };
  }
};
const asString = ({ locale, message, values }: Case) =>
  attempt(() =>
    formatIcu(message, locale, valuesOf(values), { timeZone: 'UTC' })
  );
const asTree = ({ locale, message, values }: Case) =>
  attempt(() => {
    const { tree, formats } = icuToMessage(message);
    return formatMessageTree(tree, locale, valuesOf(values), {
      formats,
      timeZone: 'UTC',
    });
  });

/** Whether an outcome is ICU4C's: its text, or an error where it fails. */
const matches = (outcome: Outcome, { icu, rejects }: Case) =>
  rejects
    ? 'error' in outcome
    : 'text' in outcome && outcome.text === text(icu);

describe('ICU4C messages', () => {
  it.each(CASES.filter((item) => !item.differs))(
    '$id is as in ICU4C: $message',
    (item) => {
      const expected = item.rejects
        ? { error: expect.anything() }
        : { text: text(item.icu) };
      expect(asString(item)).toEqual(expected);
      if (!item.treeDiffers) expect(asTree(item)).toEqual(expected);
    }
  );

  it.each(DIFFERENT)('$id differs by $differs: $message', (item) => {
    expect(REASONS).toHaveProperty(item.differs);
    const expected =
      item.ours === undefined
        ? { error: expect.anything() }
        : { text: item.ours };
    for (const outcome of [asString(item), asTree(item)]) {
      expect(outcome).toEqual(expected);
      expect(matches(outcome, item)).toBe(false);
    }
  });

  it('rejects a date field in a time as a message tree only', () => {
    const cases = CASES.filter((item) => item.treeDiffers);
    expect(cases.length).toBeGreaterThan(0);
    for (const item of cases) {
      expect(TREE_REASONS).toHaveProperty(String(item.treeDiffers));
      expect(asTree(item)).toEqual({ error: expect.anything() });
    }
  });

  it('has a case for every reason', () => {
    expect(new Set(DIFFERENT.map((item) => item.differs))).toEqual(
      new Set(Object.keys(REASONS).filter((reason) => reason !== 'nesting'))
    );
  });

  it(`nests ${MAX_NESTING_DEPTH} levels and no more`, () => {
    const nested = (levels: number) =>
      '{a, select, other{'.repeat(levels) + 'x' + '}}'.repeat(levels);
    expect(
      formatIcu(
        nested(MAX_NESTING_DEPTH),
        'en',
        { a: 'z' },
        { timeZone: 'UTC' }
      )
    ).toBe('x');
    expect(() => parse(nested(MAX_NESTING_DEPTH + 1))).toThrow(
      `A message nests at most ${MAX_NESTING_DEPTH} levels of branches and tags.`
    );
    // ICU4C's own limit, which overflowed the stack here before.
    expect(() => parse(nested(1023))).toThrow(SyntaxError);
  });
});
