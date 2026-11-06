/**
 * Number and date skeletons with the exact native Intl options the pinned
 * FormatJS parser produces for each, adapted from intl-messageformat 10.7.16
 * and @formatjs/icu-messageformat-parser 2.11.4 (see
 * formatter-compatibility.test.ts and ../../THIRD_PARTY_NOTICES.md).
 */

export type NumberCase = {
  skeleton: string;
  options: Intl.NumberFormatOptions;
  scale?: number;
};

export const NUMBER_SKELETONS: NumberCase[] = [
  { skeleton: 'percent', options: { style: 'percent' } },
  { skeleton: '%', options: { style: 'percent' } },
  { skeleton: '%x100', options: { style: 'percent' }, scale: 100 },
  {
    skeleton: 'currency/USD',
    options: { style: 'currency', currency: 'USD' },
  },
  {
    skeleton: 'currency/EUR unit-width-narrow',
    options: {
      style: 'currency',
      currency: 'EUR',
      currencyDisplay: 'narrowSymbol',
    },
  },
  {
    skeleton: 'currency/USD unit-width-short',
    options: { style: 'currency', currency: 'USD', currencyDisplay: 'code' },
  },
  {
    skeleton: 'currency/USD unit-width-full-name',
    options: { style: 'currency', currency: 'USD', currencyDisplay: 'name' },
  },
  {
    skeleton: 'currency/USD unit-width-iso-code',
    options: { style: 'currency', currency: 'USD', currencyDisplay: 'symbol' },
  },
  { skeleton: 'group-off', options: { useGrouping: false } },
  { skeleton: 'group-auto', options: {} },
  { skeleton: 'group-min2', options: {} },
  { skeleton: 'group-on-aligned', options: {} },
  { skeleton: ',!', options: {} },
  { skeleton: 'precision-integer', options: { maximumFractionDigits: 0 } },
  {
    skeleton: 'measure-unit/length-meter unit-width-full-name',
    options: { style: 'unit', unit: 'meter', unitDisplay: 'long' },
  },
  {
    skeleton: 'unit/duration-second unit-width-narrow',
    options: { style: 'unit', unit: 'second', unitDisplay: 'narrow' },
  },
  {
    skeleton: 'compact-short',
    options: { notation: 'compact', compactDisplay: 'short' },
  },
  {
    skeleton: 'compact-long',
    options: { notation: 'compact', compactDisplay: 'long' },
  },
  { skeleton: 'scientific', options: { notation: 'scientific' } },
  { skeleton: 'engineering', options: { notation: 'engineering' } },
  { skeleton: 'notation-simple', options: { notation: 'standard' } },
  // intl-messageformat treats a zero scale as absent.
  { skeleton: 'scale/0', options: {}, scale: 1 },
  { skeleton: 'scale/0.01', options: {}, scale: 0.01 },
  { skeleton: 'scale/100', options: {}, scale: 100 },
  { skeleton: 'integer-width/*000', options: { minimumIntegerDigits: 3 } },
  {
    skeleton: 'rounding-mode-floor',
    options: { roundingMode: 'floor' },
  },
  { skeleton: '.', options: { maximumFractionDigits: 0 } },
  {
    skeleton: '.0',
    options: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
  },
  {
    skeleton: '.00',
    options: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  },
  { skeleton: '.##', options: { maximumFractionDigits: 2 } },
  {
    skeleton: '.00##',
    options: { minimumFractionDigits: 2, maximumFractionDigits: 4 },
  },
  { skeleton: '.000*', options: { minimumFractionDigits: 3 } },
  {
    skeleton: '@@',
    options: { minimumSignificantDigits: 2, maximumSignificantDigits: 2 },
  },
  {
    skeleton: '@@#',
    options: { minimumSignificantDigits: 2, maximumSignificantDigits: 3 },
  },
  { skeleton: 'sign-auto', options: { signDisplay: 'auto' } },
  { skeleton: 'sign-always', options: { signDisplay: 'always' } },
  {
    skeleton: 'sign-except-zero',
    options: { signDisplay: 'exceptZero' },
  },
  { skeleton: 'sign-never', options: { signDisplay: 'never' } },
  {
    skeleton: 'sign-accounting currency/USD',
    options: {
      style: 'currency',
      currency: 'USD',
      currencySign: 'accounting',
    },
  },
  {
    skeleton: 'sign-accounting-always currency/USD',
    options: {
      style: 'currency',
      currency: 'USD',
      currencySign: 'accounting',
      signDisplay: 'always',
    },
  },
  {
    skeleton: 'sign-accounting-except-zero currency/USD',
    options: {
      style: 'currency',
      currency: 'USD',
      currencySign: 'accounting',
      signDisplay: 'exceptZero',
    },
  },
  {
    skeleton: 'E0',
    options: { notation: 'scientific', minimumIntegerDigits: 1 },
  },
  {
    skeleton: 'EE+!00',
    options: {
      notation: 'engineering',
      signDisplay: 'always',
      minimumIntegerDigits: 2,
    },
  },
];

export const DATE_SKELETONS: Array<{
  skeleton: string;
  options: Intl.DateTimeFormatOptions;
}> = [
  { skeleton: 'y', options: { year: 'numeric' } },
  { skeleton: 'yy', options: { year: '2-digit' } },
  { skeleton: 'yyyy', options: { year: 'numeric' } },
  { skeleton: 'M', options: { month: 'numeric' } },
  { skeleton: 'MM', options: { month: '2-digit' } },
  { skeleton: 'MMM', options: { month: 'short' } },
  { skeleton: 'MMMM', options: { month: 'long' } },
  { skeleton: 'MMMMM', options: { month: 'narrow' } },
  { skeleton: 'd', options: { day: 'numeric' } },
  { skeleton: 'dd', options: { day: '2-digit' } },
  { skeleton: 'E', options: { weekday: 'short' } },
  { skeleton: 'EEEE', options: { weekday: 'long' } },
  { skeleton: 'EEEEE', options: { weekday: 'narrow' } },
  { skeleton: 'G', options: { era: 'short' } },
  { skeleton: 'GGGG', options: { era: 'long' } },
  { skeleton: 'GGGGG', options: { era: 'narrow' } },
  { skeleton: 'h', options: { hourCycle: 'h12', hour: 'numeric' } },
  { skeleton: 'hh', options: { hourCycle: 'h12', hour: '2-digit' } },
  { skeleton: 'H', options: { hourCycle: 'h23', hour: 'numeric' } },
  { skeleton: 'HH', options: { hourCycle: 'h23', hour: '2-digit' } },
  { skeleton: 'K', options: { hourCycle: 'h11', hour: 'numeric' } },
  { skeleton: 'KK', options: { hourCycle: 'h11', hour: '2-digit' } },
  { skeleton: 'k', options: { hourCycle: 'h24', hour: 'numeric' } },
  { skeleton: 'kk', options: { hourCycle: 'h24', hour: '2-digit' } },
  { skeleton: 'm', options: { minute: 'numeric' } },
  { skeleton: 'mm', options: { minute: '2-digit' } },
  { skeleton: 's', options: { second: 'numeric' } },
  { skeleton: 'ss', options: { second: '2-digit' } },
  { skeleton: 'z', options: { timeZoneName: 'short' } },
  { skeleton: 'zzzz', options: { timeZoneName: 'long' } },
  // The pinned FormatJS parser accepts these fields but omits them from the
  // native options object.
  { skeleton: 'C', options: {} },
  { skeleton: 'S', options: {} },
  { skeleton: 'A', options: {} },
  {
    skeleton: 'yyyyMMdd',
    options: { year: 'numeric', month: '2-digit', day: '2-digit' },
  },
  {
    skeleton: 'yyyyMMMdd',
    options: { year: 'numeric', month: 'short', day: '2-digit' },
  },
  {
    skeleton: 'EEEE MMMM d yyyy',
    options: {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    },
  },
  {
    skeleton: 'hhmmss',
    options: {
      hourCycle: 'h12',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    },
  },
  {
    skeleton: 'HHmmssz',
    options: {
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    },
  },
];
