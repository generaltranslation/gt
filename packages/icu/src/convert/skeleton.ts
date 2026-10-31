import {
  HOUR_CYCLES,
  ROUNDING_MODES,
  parseDateTimeSkeletonOptions,
  parseNumberSkeletonOptions,
  parseNumberSkeletonTokens,
  type ModernNumberFormatOptions,
} from '../parser/skeleton';
import { sortRecord } from '../tree/canonical';
import type {
  ExtendedNumberFormatOptions,
  NumberSkeletonToken,
} from '../types-dir/ast';

// Only characters the long-form tokens below use, so a printed skeleton can
// never close the placeholder or start a quote.
const SKELETON_TOKEN = /^[\w.*@#+/-]+$/u;

const DIGIT_OPTIONS = [
  'minimumIntegerDigits',
  'minimumFractionDigits',
  'maximumFractionDigits',
  'minimumSignificantDigits',
  'maximumSignificantDigits',
] as const;

/**
 * Prints Intl number options as ICU: the named style `percent` for plain
 * `{ style: 'percent' }`, otherwise standard skeleton tokens in long form like
 * ICU's `toSkeleton()`, such as `currency/USD`. Returns undefined unless the
 * result parses back to options that format the same in every locale and time
 * zone; printing part of them would show a format the message does not have.
 *
 * It only writes tokens that standard ICU and the formatjs-compatible parser
 * read alike. That rules out the `percent` skeleton (ICU does not multiply by
 * 100; the named style does), `unit-width-short` and `unit-width-iso-code`
 * (formatjs reads them reversed), open-ended or one-sided fraction digits,
 * and fraction and significant digits combined.
 */
export function printNumberStyle(
  options: ExtendedNumberFormatOptions
): 'percent' | NumberSkeletonToken[] | undefined {
  const o = specNormalized(options as ModernNumberFormatOptions);
  // Digit counts become repeated characters; Intl itself allows at most 100.
  const invalidDigits = DIGIT_OPTIONS.some((key) => {
    const digits = o[key];
    return (
      digits !== undefined &&
      !(Number.isInteger(digits) && digits >= 0 && digits <= 100)
    );
  });
  // The formatter reads a zero scale as no scale; ICU multiplies by zero.
  if (invalidDigits || o.scale === 0) return undefined;
  if (Object.keys(o).length === 1 && o.style === 'percent') return 'percent';

  const tokens: string[] = [];
  if (o.style === 'currency') tokens.push(`currency/${o.currency}`);
  if (o.style === 'unit') tokens.push(`unit/${o.unit}`);
  if (o.currencyDisplay === 'narrowSymbol' || o.unitDisplay === 'narrow') {
    tokens.push('unit-width-narrow');
  } else if (o.currencyDisplay === 'name' || o.unitDisplay === 'long') {
    tokens.push('unit-width-full-name');
  }
  if (o.useGrouping === false) tokens.push('group-off');
  if (o.notation === 'compact') {
    tokens.push(o.compactDisplay === 'long' ? 'compact-long' : 'compact-short');
  } else if (o.notation === 'standard') {
    tokens.push('notation-simple');
  } else if (o.notation) {
    tokens.push(o.notation);
  }
  const sign = signStem(o.signDisplay, o.currencySign === 'accounting');
  if (sign) tokens.push(sign);
  if (o.scale !== undefined) tokens.push(`scale/${o.scale}`);
  if (o.minimumIntegerDigits !== undefined) {
    tokens.push(`integer-width/*${'0'.repeat(o.minimumIntegerDigits)}`);
  }
  const fraction = fractionStem(o);
  const significant = significantStem(o);
  // ICU takes one precision token; the fraction-plus-significant forms also
  // carry formatjs-specific rounding priorities.
  if (fraction && significant) return undefined;
  if (fraction) tokens.push(fraction);
  if (significant) tokens.push(significant);
  const roundingMode = Object.keys(ROUNDING_MODES).find(
    (key) => ROUNDING_MODES[key] === o.roundingMode
  );
  if (roundingMode) tokens.push(`rounding-mode-${roundingMode}`);

  if (!tokens.length || !tokens.every((token) => SKELETON_TOKEN.test(token))) {
    return undefined;
  }
  try {
    const parsed = parseNumberSkeletonTokens(tokens.join(' '));
    const reparsed = specNormalized(parseNumberSkeletonOptions(parsed));
    return sameOptions(reparsed, o) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Prints Intl date options as a standard ICU date skeleton:
 * `{ year: 'numeric', month: 'short', day: 'numeric' }` becomes `yMMMd`.
 * Returns undefined unless the skeleton parses back to exactly these options,
 * as for options ICU cannot spell, such as `timeZone`, `calendar` or
 * `dateStyle`, and an hour whose cycle is left to the locale.
 */
export function printDateTimeSkeleton(
  options: Intl.DateTimeFormatOptions
): string | undefined {
  const o = options;
  const hourCycle = Object.keys(HOUR_CYCLES).find(
    (symbol) => HOUR_CYCLES[symbol] === o.hourCycle
  );
  // A day period with a 24-hour cycle, as in `Ha`, is a 12-hour clock to
  // Intl but stays 24-hour in ICU.
  if (o.hour12 === true && hourCycle !== 'h' && hourCycle !== 'K') {
    return undefined;
  }
  const skeleton = [
    field(o.era, { short: 'G', long: 'GGGG', narrow: 'GGGGG' }),
    field(o.year, { numeric: 'y', '2-digit': 'yy' }),
    field(o.month, {
      numeric: 'M',
      '2-digit': 'MM',
      short: 'MMM',
      long: 'MMMM',
      narrow: 'MMMMM',
    }),
    field(o.day, { numeric: 'd', '2-digit': 'dd' }),
    field(o.weekday, { short: 'E', long: 'EEEE', narrow: 'EEEEE' }),
    // ICU spells the hour with its cycle, so an hour needs one.
    hourCycle &&
      field(o.hour, { numeric: hourCycle, '2-digit': hourCycle + hourCycle }),
    o.hour12 === true ? 'a' : '',
    field(o.minute, { numeric: 'm', '2-digit': 'mm' }),
    field(o.second, { numeric: 's', '2-digit': 'ss' }),
    field(o.timeZoneName, { short: 'z', long: 'zzzz' }),
  ].join('');
  if (!skeleton) return undefined;
  try {
    return sameOptions(parseDateTimeSkeletonOptions(skeleton), options)
      ? skeleton
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Drops options the Intl spec makes irrelevant or default in every locale,
 * so `{ notation: 'compact' }` and the `compact-short` skeleton's
 * `{ notation: 'compact', compactDisplay: 'short' }` compare equal. Unlike
 * resolved options, nothing here depends on the host's locale data or time
 * zone.
 */
function specNormalized(
  options: ModernNumberFormatOptions
): ModernNumberFormatOptions {
  const o: ModernNumberFormatOptions = { ...options };
  const drop = (key: keyof ModernNumberFormatOptions, unless: boolean) => {
    if (!unless) delete o[key];
  };
  drop(
    'compactDisplay',
    o.notation === 'compact' && o.compactDisplay !== 'short'
  );
  drop(
    'currencyDisplay',
    o.style === 'currency' && o.currencyDisplay !== 'symbol'
  );
  drop('currencySign', o.style === 'currency' && o.currencySign !== 'standard');
  drop('unitDisplay', o.style === 'unit' && o.unitDisplay !== 'short');
  drop('signDisplay', o.signDisplay !== 'auto');
  for (const key of Object.keys(o) as (keyof ModernNumberFormatOptions)[]) {
    if (o[key] === undefined) delete o[key];
  }
  return o;
}

function field(value: string | undefined, symbols: Record<string, string>) {
  return value === undefined ? '' : (symbols[value] ?? '');
}

function signStem(
  display: Intl.NumberFormatOptions['signDisplay'],
  accounting: boolean
): string | undefined {
  if (accounting) {
    if (display === 'always') return 'sign-accounting-always';
    if (display === 'exceptZero') return 'sign-accounting-except-zero';
    return display === undefined ? 'sign-accounting' : undefined;
  }
  switch (display) {
    case 'always':
      return 'sign-always';
    case 'exceptZero':
      return 'sign-except-zero';
    case 'never':
      return 'sign-never';
  }
}

// Both bounds, as in `.00` or `.00##`: with one bound, Intl fills the other
// from the style while ICU leaves it open.
function fractionStem(o: ModernNumberFormatOptions): string | undefined {
  const min = o.minimumFractionDigits;
  const max = o.maximumFractionDigits;
  if (min === undefined || max === undefined || min < 1 || max < min) {
    return undefined;
  }
  const stem = `.${'0'.repeat(min)}${'#'.repeat(max - min)}`;
  return o.trailingZeroDisplay === 'stripIfInteger' ? `${stem}/w` : stem;
}

function significantStem(o: ModernNumberFormatOptions): string | undefined {
  const min = o.minimumSignificantDigits;
  const max = o.maximumSignificantDigits;
  if (min === undefined || min < 1 || (max !== undefined && max < min)) {
    return undefined;
  }
  return '@'.repeat(min) + (max === undefined ? '+' : '#'.repeat(max - min));
}

function sameOptions(a: object, b: object): boolean {
  return JSON.stringify(sortRecord(a)) === JSON.stringify(sortRecord(b));
}
