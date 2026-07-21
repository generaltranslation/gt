/*
 * Number and date skeleton compatibility is adapted from
 * @formatjs/icu-skeleton-parser (MIT). See THIRD_PARTY_NOTICES.md.
 */

import type { ExtendedNumberFormatOptions, NumberSkeletonToken } from './types';

const FRACTION_PRECISION = /^\.(?:(0+)(\*)?|(#+)|(0+)(#+))$/;
const SIGNIFICANT_PRECISION = /^(@+)?(\+|#+)?[rs]?$/;
const INTEGER_WIDTH = /^(?:(\*)(0+)|(#+)(0+)|(0+))$/;
const DATE_TIME_FIELD =
  /(?:[Eec]{1,6}|G{1,5}|[Qq]{1,5}|(?:[yYur]+|U{1,5})|[ML]{1,5}|d{1,2}|D{1,3}|F|[abB]{1,5}|[hHkKjJC]{1,2}|w{1,2}|W|m{1,2}|s{1,2}|[SA]+|[zZOvVxX]{1,4})(?=([^']*'[^']*')*[^']*$)/g;

type ModernNumberFormatOptions = ExtendedNumberFormatOptions & {
  roundingMode?:
    | 'ceil'
    | 'floor'
    | 'expand'
    | 'trunc'
    | 'halfCeil'
    | 'halfFloor'
    | 'halfExpand'
    | 'halfTrunc'
    | 'halfEven';
  roundingPriority?: 'auto' | 'morePrecision' | 'lessPrecision';
  trailingZeroDisplay?: 'auto' | 'stripIfInteger';
};

const ROUNDING_MODES: Record<
  string,
  NonNullable<ModernNumberFormatOptions['roundingMode']>
> = {
  'rounding-mode-floor': 'floor',
  'rounding-mode-ceiling': 'ceil',
  'rounding-mode-down': 'trunc',
  'rounding-mode-up': 'expand',
  'rounding-mode-half-even': 'halfEven',
  'rounding-mode-half-down': 'halfTrunc',
  'rounding-mode-half-up': 'halfExpand',
};

export function parseNumberSkeletonTokens(
  skeleton: string
): NumberSkeletonToken[] {
  const stringTokens = skeleton.trim().split(/\s+/u).filter(Boolean);
  if (stringTokens.length === 0) {
    throw new SyntaxError('Number skeleton cannot be empty.');
  }

  return stringTokens.map((token) => {
    const [stem, ...options] = token.split('/');
    if (options.some((option) => option.length === 0)) {
      throw new SyntaxError(`Invalid number skeleton token: ${token}.`);
    }
    return { stem, options };
  });
}

export function parseNumberSkeletonOptions(
  tokens: NumberSkeletonToken[]
): ExtendedNumberFormatOptions {
  const result: ModernNumberFormatOptions = {};

  for (const token of tokens) {
    if (!token.stem) {
      throw new SyntaxError('Number skeleton token stem cannot be empty.');
    }
    const option = token.options[0];

    switch (token.stem) {
      case 'percent':
      case '%':
        result.style = 'percent';
        continue;
      case '%x100':
        result.style = 'percent';
        result.scale = 100;
        continue;
      case 'currency':
        requireOption(token);
        result.style = 'currency';
        result.currency = option;
        continue;
      case 'group-off':
      case ',_':
        result.useGrouping = false;
        continue;
      case 'group-auto':
      case 'group-min2':
      case 'group-on-aligned':
      case ',!':
        // FormatJS 2.11.x recognizes these stems but leaves the native
        // default in place. This matters for four-digit values: modern Intl
        // runtimes interpret `min2` differently from FormatJS.
        continue;
      case 'precision-integer':
      case '.':
        result.maximumFractionDigits = 0;
        continue;
      case 'measure-unit':
      case 'unit':
        requireOption(token);
        result.style = 'unit';
        result.unit = option!.replace(/^(.*?)-/, '');
        continue;
      case 'compact-short':
      case 'K':
        result.notation = 'compact';
        result.compactDisplay = 'short';
        continue;
      case 'compact-long':
      case 'KK':
        result.notation = 'compact';
        result.compactDisplay = 'long';
        continue;
      case 'scientific':
      case 'engineering':
        result.notation = token.stem;
        for (const notationOption of token.options) {
          applySign(result, notationOption);
        }
        continue;
      case 'notation-simple':
        result.notation = 'standard';
        continue;
      case 'unit-width-narrow':
        result.currencyDisplay = 'narrowSymbol';
        result.unitDisplay = 'narrow';
        continue;
      case 'unit-width-short':
        result.currencyDisplay = 'code';
        result.unitDisplay = 'short';
        continue;
      case 'unit-width-full-name':
        result.currencyDisplay = 'name';
        result.unitDisplay = 'long';
        continue;
      case 'unit-width-iso-code':
        result.currencyDisplay = 'symbol';
        continue;
      case 'scale':
        requireOption(token);
        result.scale = Number(option);
        if (!Number.isFinite(result.scale)) {
          throw new SyntaxError(`Invalid scale value: ${option}.`);
        }
        continue;
      case 'integer-width':
        requireOption(token);
        applyIntegerWidth(result, option!);
        continue;
    }

    const roundingMode = ROUNDING_MODES[token.stem];
    if (roundingMode) {
      result.roundingMode = roundingMode;
      continue;
    }

    if (/^0+$/u.test(token.stem)) {
      result.minimumIntegerDigits = token.stem.length;
      continue;
    }

    if (FRACTION_PRECISION.test(token.stem)) {
      applyFractionPrecision(result, token);
      continue;
    }

    if (SIGNIFICANT_PRECISION.test(token.stem)) {
      Object.assign(result, parseSignificantPrecision(token.stem));
      continue;
    }

    if (applySign(result, token.stem)) continue;
    if (applyConciseScientific(result, token.stem)) continue;
  }

  return result;
}

function requireOption(token: NumberSkeletonToken): void {
  if (!token.options[0]) {
    throw new SyntaxError(`${token.stem} requires an option.`);
  }
}

function applySign(result: ModernNumberFormatOptions, stem: string): boolean {
  switch (stem) {
    case 'sign-auto':
      result.signDisplay = 'auto';
      return true;
    case 'sign-accounting':
    case '()':
      result.currencySign = 'accounting';
      return true;
    case 'sign-always':
    case '+!':
      result.signDisplay = 'always';
      return true;
    case 'sign-accounting-always':
    case '()!':
      result.signDisplay = 'always';
      result.currencySign = 'accounting';
      return true;
    case 'sign-except-zero':
    case '+?':
      result.signDisplay = 'exceptZero';
      return true;
    case 'sign-accounting-except-zero':
    case '()?':
      result.signDisplay = 'exceptZero';
      result.currencySign = 'accounting';
      return true;
    case 'sign-never':
    case '+_':
      result.signDisplay = 'never';
      return true;
    default:
      return false;
  }
}

function applyConciseScientific(
  result: ModernNumberFormatOptions,
  source: string
): boolean {
  const match = /^(E{1,2})(\+!|\+\?)?(0+)$/u.exec(source);
  if (!match) return false;

  result.notation = match[1] === 'EE' ? 'engineering' : 'scientific';
  if (match[2]) applySign(result, match[2]);
  result.minimumIntegerDigits = match[3].length;
  return true;
}

function applyIntegerWidth(
  result: ModernNumberFormatOptions,
  width: string
): void {
  const match = INTEGER_WIDTH.exec(width);
  if (!match) {
    throw new SyntaxError(`Unsupported integer width: ${width}.`);
  }
  if (match[1]) {
    result.minimumIntegerDigits = match[2].length;
  } else if (match[3]) {
    throw new Error('We currently do not support maximum integer digits');
  } else {
    throw new Error('We currently do not support exact integer digits');
  }
}

function applyFractionPrecision(
  result: ModernNumberFormatOptions,
  token: NumberSkeletonToken
): void {
  if (token.options.length > 1) {
    throw new SyntaxError('Fraction precision accepts at most one option.');
  }

  const match = FRACTION_PRECISION.exec(token.stem);
  if (!match) return;
  const [, zeros, unlimited, hashes, required, optional] = match;

  if (unlimited === '*') {
    result.minimumFractionDigits = zeros.length;
  } else if (hashes) {
    result.maximumFractionDigits = hashes.length;
  } else if (required && optional) {
    result.minimumFractionDigits = required.length;
    result.maximumFractionDigits = required.length + optional.length;
  } else {
    result.minimumFractionDigits = zeros.length;
    result.maximumFractionDigits = zeros.length;
  }

  if (token.options[0] === 'w') {
    result.trailingZeroDisplay = 'stripIfInteger';
  } else if (token.options[0]) {
    Object.assign(result, parseSignificantPrecision(token.options[0]));
  }
}

function parseSignificantPrecision(
  precision: string
): ModernNumberFormatOptions {
  const result: ModernNumberFormatOptions = {};
  if (!SIGNIFICANT_PRECISION.test(precision)) return result;
  if (precision.endsWith('r')) result.roundingPriority = 'morePrecision';
  if (precision.endsWith('s')) result.roundingPriority = 'lessPrecision';

  const significant = precision.replace(/[rs]$/u, '');
  const required = significant.match(/^@+/u)?.[0] ?? '';
  const optional = significant.slice(required.length);

  if (required) result.minimumSignificantDigits = required.length;
  if (optional === '+') return result;
  if (optional.startsWith('#')) {
    result.maximumSignificantDigits = required.length + optional.length;
  } else if (required) {
    result.maximumSignificantDigits = required.length;
  }
  return result;
}

export function parseDateTimeSkeletonOptions(
  skeleton: string,
  locale?: Intl.Locale
): Intl.DateTimeFormatOptions {
  const pattern = resolveLocaleHourSkeleton(skeleton, locale);
  const result: Intl.DateTimeFormatOptions = {};

  for (const [field] of pattern.matchAll(DATE_TIME_FIELD)) {
    const length = field.length;
    switch (field[0]) {
      case 'G':
        result.era = length === 4 ? 'long' : length === 5 ? 'narrow' : 'short';
        break;
      case 'y':
        result.year = length === 2 ? '2-digit' : 'numeric';
        break;
      case 'M':
      case 'L':
        result.month = ['numeric', '2-digit', 'short', 'long', 'narrow'][
          length - 1
        ] as Intl.DateTimeFormatOptions['month'];
        break;
      case 'd':
        result.day = length === 2 ? '2-digit' : 'numeric';
        break;
      case 'E':
        result.weekday =
          length === 4 ? 'long' : length === 5 ? 'narrow' : 'short';
        break;
      case 'e':
      case 'c':
        if (length < 4) throw unsupported(field, 'weekday');
        result.weekday = ['short', 'long', 'narrow', 'short'][
          length - 4
        ] as Intl.DateTimeFormatOptions['weekday'];
        break;
      case 'a':
        result.hour12 = true;
        break;
      case 'h':
        result.hourCycle = 'h12';
        result.hour = length === 2 ? '2-digit' : 'numeric';
        break;
      case 'H':
        result.hourCycle = 'h23';
        result.hour = length === 2 ? '2-digit' : 'numeric';
        break;
      case 'K':
        result.hourCycle = 'h11';
        result.hour = length === 2 ? '2-digit' : 'numeric';
        break;
      case 'k':
        result.hourCycle = 'h24';
        result.hour = length === 2 ? '2-digit' : 'numeric';
        break;
      case 'm':
        result.minute = length === 2 ? '2-digit' : 'numeric';
        break;
      case 's':
        result.second = length === 2 ? '2-digit' : 'numeric';
        break;
      case 'z':
        result.timeZoneName = length < 4 ? 'short' : 'long';
        break;
      case 'Y':
      case 'u':
      case 'U':
      case 'r':
      case 'Q':
      case 'q':
      case 'w':
      case 'W':
      case 'D':
      case 'F':
      case 'b':
      case 'B':
      case 'Z':
      case 'O':
      case 'v':
      case 'V':
      case 'X':
      case 'x':
        throw unsupported(field, 'date/time');
      case 'C':
      case 'S':
      case 'A':
        // @formatjs/icu-messageformat-parser accepted these fields but omitted
        // them from parsedOptions, causing Intl.DateTimeFormat to use its
        // default date output when no other supported fields were present.
        break;
    }
  }

  return result;
}

export function resolveLocaleHourSkeleton(
  skeleton: string,
  locale?: Intl.Locale
): string {
  if (!locale || !/[jJ]/u.test(skeleton)) return skeleton;

  const resolved = new Intl.DateTimeFormat(locale.toString(), {
    hour: 'numeric',
  }).resolvedOptions();
  const localeHourSymbol =
    resolved.hourCycle === 'h11'
      ? 'K'
      : resolved.hourCycle === 'h12'
        ? 'h'
        : resolved.hourCycle === 'h24'
          ? 'k'
          : 'H';
  return skeleton.replace(/[jJ]+/gu, (field) => {
    const hourLength = field.length % 2 === 0 ? 2 : 1;
    if (field[0] === 'J') return 'H'.repeat(hourLength);

    const hour = localeHourSymbol.repeat(hourLength);
    if (localeHourSymbol !== 'h' && localeHourSymbol !== 'K') {
      return hour;
    }
    const dayPeriod =
      field.length <= 2 ? 'a' : field.length <= 4 ? 'aaaa' : 'aaaaa';
    return `${hour}${dayPeriod}`;
  });
}

function unsupported(field: string, kind: string): RangeError {
  return new RangeError(`Unsupported ${kind} skeleton field: ${field}.`);
}
