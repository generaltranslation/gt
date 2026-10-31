/**
 * Compatibility expectations are adapted from intl-messageformat 10.7.16 and
 * @formatjs/icu-messageformat-parser 2.11.4:
 * https://github.com/formatjs/formatjs/blob/75edf1cd6a7045475bb134daf62c686602c92547/packages/intl-messageformat/tests/index.test.ts
 * The upstream formatter is BSD-3-Clause licensed and the parser is MIT
 * licensed. See ../../THIRD_PARTY_NOTICES.md.
 */

import { describe, expect, it } from 'vitest';
import { formatMessage } from '../parser';
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

describe('pinned intl-messageformat compatibility matrix', () => {
  it.each(NUMBER_CASES)(
    'formats $skeleton for $value in $locale',
    ({ locale, skeleton, options, scale, value }) => {
      expect(
        formatMessage(`{n, number, ::${skeleton}}`, locale, { value, n: value })
      ).toBe(new Intl.NumberFormat(locale, options).format(value * scale));
    }
  );

  it.each(PLURAL_CASES)(
    'formats cardinal $value in $locale',
    ({ locale, value }) => {
      const message =
        '{n, plural, offset:1 =-1 {exact-negative} =0 {exact-zero} =1 {exact-one} zero {zero:#} one {one:#} two {two:#} few {few:#} many {many:#} other {other:#}}';
      const exact = new Map([
        [-1, 'exact-negative'],
        [0, 'exact-zero'],
        [1, 'exact-one'],
      ]).get(value);
      const adjusted = value - 1;
      const category = new Intl.PluralRules(locale).select(adjusted);
      const expected =
        exact ??
        `${category}:${new Intl.NumberFormat(locale).format(adjusted)}`;

      expect(formatMessage(message, locale, { n: value })).toBe(expected);
    }
  );

  it.each(PLURAL_CASES)(
    'formats ordinal $value in $locale',
    ({ locale, value }) => {
      const message =
        '{n, selectordinal, =0 {exact-zero} zero {zero:#} one {one:#} two {two:#} few {few:#} many {many:#} other {other:#}}';
      const category = new Intl.PluralRules(locale, {
        type: 'ordinal',
      }).select(value);
      const expected =
        value === 0
          ? 'exact-zero'
          : `${category}:${new Intl.NumberFormat(locale).format(value)}`;

      expect(formatMessage(message, locale, { n: value })).toBe(expected);
    }
  );

  it.each(DATE_CASES)(
    'formats $skeleton for $value in $locale',
    ({ locale, skeleton, options, value }) => {
      expect(
        formatMessage(`{value, date, ::${skeleton}}`, locale, { value })
      ).toBe(new Intl.DateTimeFormat(locale, options).format(value));
    }
  );
});
