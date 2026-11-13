/**
 * Compatibility expectations are adapted from intl-messageformat 10.7.16 and
 * @formatjs/icu-messageformat-parser 2.11.4:
 * https://github.com/formatjs/formatjs/blob/75edf1cd6a7045475bb134daf62c686602c92547/packages/intl-messageformat/tests/index.test.ts
 * The upstream formatter is BSD-3-Clause licensed and the parser is MIT
 * licensed. See ../../THIRD_PARTY_NOTICES.md.
 */

import { describe, expect, it } from 'vitest';
import { expectEachCase } from './expectEachCase';
import { formatIcu } from './format';
import { DATE_SKELETONS, NUMBER_SKELETONS } from './skeletonCases';

const LOCALES = ['en-US', 'fr-FR', 'de-DE'] as const;
const NUMBERS = [
  -1234567.89, -1234.567, -2, -1, -0, 0, 0.125, 0.5, 1, 2, 12.34, 1234.567,
  1234567.89,
] as const;

const NUMBER_CASES = LOCALES.flatMap((locale) =>
  NUMBER_SKELETONS.flatMap(({ skeleton, options, scale = 1 }) =>
    NUMBERS.map((value) => ({ locale, skeleton, options, scale, value }))
  )
);

const PLURAL_LOCALES = [
  'en',
  'fr',
  'ar',
  'ru',
  'pl',
  'cs',
  'sl',
  'cy',
] as const;
const PLURAL_VALUES = Array.from({ length: 128 }, (_, index) => index - 2);
const PLURAL_CASES = PLURAL_LOCALES.flatMap((locale) =>
  PLURAL_VALUES.map((value) => ({ locale, value }))
);

const DATE_CASES = ['en-US', 'de-DE', 'fr-FR', 'ja-JP'].flatMap((locale) =>
  DATE_SKELETONS.flatMap(({ skeleton, options }) =>
    [
      Date.UTC(1970, 0, 1),
      Date.UTC(1999, 11, 31, 23, 59, 59),
      Date.UTC(2020, 4, 6, 14, 3, 2),
    ].map((value) => ({ locale, skeleton, options, value }))
  )
);

const CARDINAL_MESSAGE =
  '{n, plural, offset:1 =-1 {exact-negative} =0 {exact-zero} =1 {exact-one} zero {zero:#} one {one:#} two {two:#} few {few:#} many {many:#} other {other:#}}';
const CARDINAL_EXACT_MATCHES = new Map([
  [-1, 'exact-negative'],
  [0, 'exact-zero'],
  [1, 'exact-one'],
]);
const ORDINAL_MESSAGE =
  '{n, selectordinal, =0 {exact-zero} zero {zero:#} one {one:#} two {two:#} few {few:#} many {many:#} other {other:#}}';

// Each test checks its whole matrix; expectEachCase reports every failing
// input instead of registering thousands of individual tests.
describe('pinned intl-messageformat compatibility matrix', () => {
  it('formats every number skeleton like native Intl', () => {
    expectEachCase(
      NUMBER_CASES,
      ({ locale, skeleton, options, scale, value }) => {
        expect(
          formatIcu(`{n, number, ::${skeleton}}`, locale, {
            value,
            n: value,
          })
        ).toBe(new Intl.NumberFormat(locale, options).format(value * scale));
      }
    );
  });

  it('formats cardinal plurals with offsets and exact matches', () => {
    expectEachCase(PLURAL_CASES, ({ locale, value }) => {
      const adjusted = value - 1;
      const category = new Intl.PluralRules(locale).select(adjusted);
      const expected =
        CARDINAL_EXACT_MATCHES.get(value) ??
        `${category}:${new Intl.NumberFormat(locale).format(adjusted)}`;

      expect(formatIcu(CARDINAL_MESSAGE, locale, { n: value })).toBe(expected);
    });
  });

  it('formats ordinal plurals with exact matches', () => {
    expectEachCase(PLURAL_CASES, ({ locale, value }) => {
      const category = new Intl.PluralRules(locale, {
        type: 'ordinal',
      }).select(value);
      const expected =
        value === 0
          ? 'exact-zero'
          : `${category}:${new Intl.NumberFormat(locale).format(value)}`;

      expect(formatIcu(ORDINAL_MESSAGE, locale, { n: value })).toBe(expected);
    });
  });

  it('formats every date skeleton like native Intl', () => {
    expectEachCase(DATE_CASES, ({ locale, skeleton, options, value }) => {
      expect(formatIcu(`{value, date, ::${skeleton}}`, locale, { value })).toBe(
        new Intl.DateTimeFormat(locale, options).format(value)
      );
    });
  });
});
