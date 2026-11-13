/*
 * ICU number skeletons, read as ICU4C reads them and spelled as Intl options:
 * https://unicode-org.github.io/icu/userguide/format_parse/numbers/skeletons.html
 *
 * A token has ICU's meaning or it throws: a SyntaxError when it is not a
 * skeleton token, a RangeError when Intl cannot format what it asks for. The
 * precision and rounding a skeleton leaves out are Intl's defaults, not
 * ICU's; icu4c-conformance.test.ts lists the differences.
 *
 * Tokenizing is adapted from @formatjs/icu-skeleton-parser (MIT). See
 * THIRD_PARTY_NOTICES.md.
 */

import {
  createInvalidNumberSkeletonTokenError,
  createUnsupportedNumberSkeletonTokenError,
} from '../errors/skeletonErrors';
import { DECIMAL_NUMBER } from '../settings/syntax';
import {
  SKELETON_TYPE,
  type ExtendedNumberFormatOptions,
  type NumberSkeleton,
  type NumberSkeletonToken,
} from '../types-dir/ast';

type Options = ExtendedNumberFormatOptions;

const NUMBER_SKELETON_WHITE_SPACE = /[\t-\r \x85\u200E\u200F\u2028\u2029]+/u;

/**
 * Stems that take no option: the stem, its concise form, and the Intl
 * options it spells. The table is read both ways: a skeleton into options,
 * and options into a skeleton.
 */
const STEMS: readonly (readonly [
  stem: string,
  concise: string | undefined,
  options: Options,
])[] = [
  // ICU's percent does not multiply by 100; Intl's percent unit does not either.
  ['percent', '%', { style: 'unit', unit: 'percent' }],
  // `percent scale/100`, which is Intl's percent style.
  ['%x100', undefined, { style: 'percent' }],
  ['base-unit', undefined, {}],
  ['compact-short', 'K', { notation: 'compact', compactDisplay: 'short' }],
  ['compact-long', 'KK', { notation: 'compact', compactDisplay: 'long' }],
  ['scientific', 'E0', { notation: 'scientific' }],
  ['engineering', 'EE0', { notation: 'engineering' }],
  ['notation-simple', undefined, { notation: 'standard' }],
  ['group-off', ',_', { useGrouping: false }],
  ['group-min2', ',?', { useGrouping: 'min2' }],
  // The default, which Intl picks by notation, so no option says it.
  ['group-auto', undefined, {}],
  ['group-on-aligned', ',!', { useGrouping: 'always' }],
  ['latin', undefined, { numberingSystem: 'latn' }],
  ['sign-always', '+!', { signDisplay: 'always' }],
  ['sign-never', '+_', { signDisplay: 'never' }],
  ['sign-except-zero', '+?', { signDisplay: 'exceptZero' }],
  ['sign-negative', '+-', { signDisplay: 'negative' }],
  ['sign-accounting', '()', { currencySign: 'accounting' }],
  // The default, so the writer takes any other stem that says as much first.
  ['sign-auto', undefined, { signDisplay: 'auto' }],
  [
    'sign-accounting-always',
    '()!',
    { currencySign: 'accounting', signDisplay: 'always' },
  ],
  [
    'sign-accounting-except-zero',
    '()?',
    { currencySign: 'accounting', signDisplay: 'exceptZero' },
  ],
  [
    'sign-accounting-negative',
    '()-',
    { currencySign: 'accounting', signDisplay: 'negative' },
  ],
  ['rounding-mode-ceiling', undefined, { roundingMode: 'ceil' }],
  ['rounding-mode-floor', undefined, { roundingMode: 'floor' }],
  ['rounding-mode-down', undefined, { roundingMode: 'trunc' }],
  ['rounding-mode-up', undefined, { roundingMode: 'expand' }],
  ['rounding-mode-half-even', undefined, { roundingMode: 'halfEven' }],
  ['rounding-mode-half-down', undefined, { roundingMode: 'halfTrunc' }],
  ['rounding-mode-half-up', undefined, { roundingMode: 'halfExpand' }],
  ['rounding-mode-half-ceiling', undefined, { roundingMode: 'halfCeil' }],
  ['rounding-mode-half-floor', undefined, { roundingMode: 'halfFloor' }],
  ['decimal-auto', undefined, {}],
  // A unit width is Intl's `currencyDisplay` for a currency and its
  // `unitDisplay` for a unit. ICU shows a unit's full name for `iso-code`.
  [
    'unit-width-narrow',
    undefined,
    { currencyDisplay: 'narrowSymbol', unitDisplay: 'narrow' },
  ],
  [
    'unit-width-short',
    undefined,
    { currencyDisplay: 'symbol', unitDisplay: 'short' },
  ],
  [
    'unit-width-full-name',
    undefined,
    { currencyDisplay: 'name', unitDisplay: 'long' },
  ],
  [
    'unit-width-iso-code',
    undefined,
    { currencyDisplay: 'code', unitDisplay: 'long' },
  ],
];

// Marked pure, so a bundle that reads no number skeleton drops the stems.
const STEM_OPTIONS = /* @__PURE__ */ new Map<string, Options>(
  /* @__PURE__ */ STEMS.flatMap(([stem, concise, options]) =>
    concise
      ? [[stem, options] as const, [concise, options] as const]
      : [[stem, options] as const]
  )
);

const UNIT = ['style', 'unit', 'currency'];
const NOTATION = ['notation', 'compactDisplay'];
const SIGN = ['signDisplay', 'currencySign'];

/**
 * The Intl options of each ICU setting. A skeleton has one token for a
 * setting, so `.00 @@@` and `sign-always sign-accounting` are errors.
 */
const SETTINGS: readonly (readonly string[])[] = [
  UNIT,
  ['currencyDisplay', 'unitDisplay'],
  NOTATION,
  [
    'minimumFractionDigits',
    'maximumFractionDigits',
    'minimumSignificantDigits',
    'maximumSignificantDigits',
    'roundingPriority',
    'roundingIncrement',
    'trailingZeroDisplay',
  ],
  ['roundingMode'],
  ['minimumIntegerDigits'],
  ['scale'],
  ['useGrouping'],
  ['numberingSystem'],
  SIGN,
];

/** Stems ICU defines that Intl cannot format, and why. */
const UNSUPPORTED_STEMS = new Map<string, string>([
  ['permille', 'Intl has no per-mille unit'],
  [
    'per-measure-unit',
    'write the whole unit in one token, like unit/meter-per-second',
  ],
  ['unit-width-formal', 'Intl has no formal currency symbol'],
  ['unit-width-variant', 'Intl has no variant currency symbol'],
  ['unit-width-hidden', 'Intl cannot hide a currency or unit'],
  ['precision-currency-cash', 'Intl has no cash rounding'],
  ['rounding-mode-half-odd', 'Intl has no half-odd rounding'],
  ['rounding-mode-unnecessary', 'Intl always rounds'],
  ['integer-width-trunc', 'Intl shows every integer digit'],
  ['group-thousands', 'Intl groups digits as the locale does'],
  ['decimal-always', 'Intl shows a decimal separator only before a fraction'],
]);

const EXPONENT_DIGITS = 'Intl shows an exponent with as few digits as it has';
const EXPONENT_SIGN = 'Intl shows the sign of an exponent only when negative';

// Intl's limit, which is how it spells ICU's unlimited fraction digits.
const UNLIMITED_FRACTION_DIGITS = 100;

// The increments Intl rounds to, at the last fraction digit.
const ROUNDING_INCREMENTS: NonNullable<Options['roundingIncrement']>[] = [
  1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000,
];

// `.`, `.00`, `.0#`, `.##` and `.00*`; ICU before 67 wrote `*` as `+`.
const FRACTION_PRECISION = /^\.(0*)(#*|[*+])$/;
// `@@@`, `@@#` and `@@*`; as the option of a fraction, also `@##r` and `@##s`.
const SIGNIFICANT_PRECISION = /^(@+)(#*|[*+])([rs]?)$/;
const INTEGER_WIDTH = /^([*+]|#*)(0*)$/;
const CONCISE_EXPONENT = /^EE?(\+[!?])?(0+)$/;

export function parseNumberSkeletonTokens(
  skeleton: string
): NumberSkeletonToken[] {
  const stringTokens = skeleton
    .split(NUMBER_SKELETON_WHITE_SPACE)
    .filter(Boolean);
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
  const result: Options = {};
  const set = new Set<string>();
  for (const token of tokens) {
    const options = readToken(token);
    // `base-unit` says no unit, which sets the unit as much as a unit does.
    const keys = token.stem === 'base-unit' ? [...UNIT] : Object.keys(options);
    // `%x100` is `percent scale/100`, so it sets the scale too.
    if (token.stem === '%x100') keys.push('scale');
    // ICU takes each setting once: `.00 .##` is an error, not the last one.
    if (keys.some((key) => set.has(key))) throw invalid(token);
    for (const setting of SETTINGS) {
      if (keys.some((key) => setting.includes(key))) {
        setting.forEach((option) => set.add(option));
      }
    }
    Object.assign(result, options);
  }
  // Intl's percent style has no width, so `%x100 unit-width-full-name` is
  // the percent unit, which spells out its name, at `scale/100`.
  if (
    result.style === 'percent' &&
    tokens.some(({ stem }) => stem === 'unit-width-full-name')
  ) {
    Object.assign(result, { style: 'unit', unit: 'percent', scale: 100 });
  }
  // A unit width is a currency's or a unit's; ICU ignores it for other numbers.
  if (result.style !== 'currency') delete result.currencyDisplay;
  if (result.style !== 'unit') delete result.unitDisplay;
  return result;
}

function readToken(token: NumberSkeletonToken): Options {
  const { stem, options } = token;
  const fixed = STEM_OPTIONS.get(stem);
  if (fixed) {
    if (fixed.notation === 'scientific' || fixed.notation === 'engineering') {
      options.forEach((option) => checkExponentOption(token, option));
    } else if (options.length) {
      throw invalid(token);
    }
    return fixed;
  }
  const reason = UNSUPPORTED_STEMS.get(stem);
  if (reason) throw unsupported(token, reason);
  const precision = readPrecision(token);
  if (precision) return precision;

  switch (stem) {
    case 'currency': {
      const currency = onlyOption(token);
      if (!/^[A-Za-z]{3}$/.test(currency)) throw invalid(token);
      return { style: 'currency', currency: currency.toUpperCase() };
    }
    case 'measure-unit': {
      // `measure-unit/length-meter`: the type comes before the unit.
      const unit = /^[^-]+-(.+)$/.exec(onlyOption(token));
      if (!unit) throw invalid(token);
      return { style: 'unit', unit: unit[1] };
    }
    case 'unit':
      // `unit/kilometer-per-hour`: the whole core unit.
      return { style: 'unit', unit: onlyOption(token) };
    case 'numbering-system':
      return { numberingSystem: onlyOption(token) };
    case 'scale': {
      const scale = onlyOption(token);
      if (!DECIMAL_NUMBER.test(scale)) throw invalid(token);
      return { scale: Number(scale) };
    }
    case 'integer-width':
      return { minimumIntegerDigits: readIntegerWidth(token) };
  }

  // `000`: at least three integer digits.
  if (/^0+$/.test(stem) && !options.length) {
    return { minimumIntegerDigits: stem.length };
  }
  // `E0` and `EE0` are stems above; other forms ask for exponent digits or a sign.
  const exponent = !options.length && CONCISE_EXPONENT.exec(stem);
  if (exponent) {
    throw unsupported(token, exponent[1] ? EXPONENT_SIGN : EXPONENT_DIGITS);
  }
  throw invalid(token);
}

function tokenText({ stem, options }: NumberSkeletonToken): string {
  return stem + options.map((option) => `/${option}`).join('');
}

function invalid(token: NumberSkeletonToken): SyntaxError {
  return new SyntaxError(
    createInvalidNumberSkeletonTokenError(tokenText(token))
  );
}

function unsupported(token: NumberSkeletonToken, reason: string): RangeError {
  return new RangeError(
    createUnsupportedNumberSkeletonTokenError(tokenText(token), reason)
  );
}

function onlyOption(token: NumberSkeletonToken): string {
  if (token.options.length !== 1) throw invalid(token);
  return token.options[0];
}

// `scientific/*ee/sign-always`: the digits and the sign of the exponent.
function checkExponentOption(token: NumberSkeletonToken, option: string): void {
  if (/^[*+]e+$/.test(option)) {
    if (option.length > 2) throw unsupported(token, EXPONENT_DIGITS);
  } else if (option.startsWith('sign-') && STEM_OPTIONS.has(option)) {
    if (option !== 'sign-auto') throw unsupported(token, EXPONENT_SIGN);
  } else {
    throw invalid(token);
  }
}

/**
 * The options of a precision token, or undefined for another token:
 * `precision-integer`, `precision-unlimited`, `precision-currency-standard`,
 * `precision-increment/0.05`, a fraction like `.00#` or significant digits
 * like `@@#`. Each takes a last option `w`, which hides a fraction of zeros.
 */
function readPrecision(token: NumberSkeletonToken): Options | undefined {
  const options = [...token.options];
  const stripIfInteger = options[options.length - 1] === 'w';
  if (stripIfInteger) options.pop();
  const stem = token.stem === 'precision-integer' ? '.' : token.stem;

  let precision: Options;
  let match: RegExpExecArray | null;
  if (stem === 'precision-unlimited') {
    precision = { maximumFractionDigits: UNLIMITED_FRACTION_DIGITS };
  } else if (stem === 'precision-currency-standard') {
    precision = {};
  } else if (stem === 'precision-increment') {
    precision = readIncrement(token, options.shift());
  } else if ((match = FRACTION_PRECISION.exec(stem))) {
    const [, zeros, rest] = match;
    precision = {
      ...(zeros.length > 0 && { minimumFractionDigits: zeros.length }),
      maximumFractionDigits:
        rest === '*' || rest === '+'
          ? UNLIMITED_FRACTION_DIGITS
          : zeros.length + rest.length,
    };
    const significant = options.shift();
    if (significant !== undefined) {
      Object.assign(precision, readFractionSignificant(token, significant));
    }
  } else if ((match = SIGNIFICANT_PRECISION.exec(stem)) && !match[3]) {
    const [, required, rest] = match;
    precision = {
      minimumSignificantDigits: required.length,
      // No maximum is Intl's 21 digits, more than a number has.
      ...(rest !== '*' &&
        rest !== '+' && {
          maximumSignificantDigits: required.length + rest.length,
        }),
    };
  } else {
    return undefined;
  }

  if (options.length) throw invalid(token);
  if (stripIfInteger) precision.trailingZeroDisplay = 'stripIfInteger';
  return precision;
}

/**
 * The significant digits a fraction is combined with, as ICU's
 * `FractionPrecision` reads them: `@@*` keeps at least that many digits,
 * `@##` at most, and `@##r` or `@##s` gives both with the priority.
 */
function readFractionSignificant(
  token: NumberSkeletonToken,
  option: string
): Options {
  const match = SIGNIFICANT_PRECISION.exec(option);
  if (!match) throw invalid(token);
  const [, required, rest, priority] = match;
  const unlimited = rest === '*' || rest === '+';
  if (priority) {
    if (unlimited) throw invalid(token);
    return {
      minimumSignificantDigits: required.length,
      maximumSignificantDigits: required.length + rest.length,
      roundingPriority: priority === 'r' ? 'morePrecision' : 'lessPrecision',
    };
  }
  if (!unlimited && required.length > 1) throw invalid(token);
  return {
    minimumSignificantDigits: 1,
    maximumSignificantDigits: required.length + (unlimited ? 0 : rest.length),
    roundingPriority: unlimited ? 'morePrecision' : 'lessPrecision',
  };
}

/**
 * `precision-increment/0.05` rounds to 5 at two fraction digits. ICU4C reads
 * the option as a decimal number, like `5e-2` or `+0.05`, and shows as many
 * fraction digits as follow its `.`, exponent included, or else as many as
 * the increment has.
 */
function readIncrement(
  token: NumberSkeletonToken,
  option: string | undefined
): Options {
  if (option === undefined || !DECIMAL_NUMBER.test(option)) {
    throw invalid(token);
  }
  const [mantissa, exponent] = Math.abs(Number(option))
    .toExponential()
    .split('e');
  const [whole, decimals = ''] = mantissa.split('.');
  const ownFractionDigits = decimals.length - Number(exponent);
  const dot = option.indexOf('.');
  const fractionDigits =
    dot === -1 ? Math.max(ownFractionDigits, 0) : option.length - dot - 1;
  const digits =
    Number(whole + decimals) * 10 ** (fractionDigits - ownFractionDigits);
  const roundingIncrement = ROUNDING_INCREMENTS.find(
    (increment) => increment === digits
  );
  if (roundingIncrement === undefined) {
    throw unsupported(
      token,
      `Intl rounds to ${ROUNDING_INCREMENTS.join(', ')} at the last fraction digit`
    );
  }
  return {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    roundingIncrement,
  };
}

// `integer-width/*000`: at least three integer digits, and no maximum.
function readIntegerWidth(token: NumberSkeletonToken): number {
  const match = INTEGER_WIDTH.exec(onlyOption(token));
  if (!match) throw invalid(token);
  const [, maximum, minimum] = match;
  if (maximum !== '*' && maximum !== '+') {
    throw unsupported(token, 'Intl shows every integer digit');
  }
  if (!minimum) {
    throw unsupported(token, 'Intl shows at least one integer digit');
  }
  return minimum.length;
}

/**
 * Writes Intl options as a number skeleton: its tokens, and as
 * `parsedOptions` the options those tokens spell, which is how they read
 * back. An option no token spells exactly is left out, like `compactDisplay`
 * without its notation or a currency code that is not three letters, so the
 * skeleton never says more than the options do. A style without a token
 * writes nothing, since the tokens would be read as a plain number's.
 */
export function toNumberSkeleton(options: Options): NumberSkeleton {
  const tokens: NumberSkeletonToken[] = [];
  const add = (stem: string | undefined, ...tokenOptions: string[]) => {
    if (stem) tokens.push({ stem, options: tokenOptions });
  };
  const values = new Map<string, unknown>(Object.entries(options));
  const { style, unit, currency, numberingSystem, scale } = options;

  const fixedUnit = stemOf(values, UNIT);
  if (fixedUnit) add(fixedUnit);
  else if (style === 'currency' && isCurrencyCode(currency)) {
    add('currency', currency);
  } else if (style === 'unit' && isTokenText(unit)) add('unit', unit);

  if (tokens.length || style === undefined) {
    const width =
      style === 'currency'
        ? 'currencyDisplay'
        : style === 'unit'
          ? 'unitDisplay'
          : undefined;
    add(
      width &&
        STEMS.find(
          ([, , spelled]) =>
            spelled[width] !== undefined && spelled[width] === options[width]
        )?.[0]
    );
    add(stemOf(values, NOTATION));
    add(...precisionToken(options));
    add(stemOf(values, ['roundingMode']));
    if (options.minimumIntegerDigits) {
      add('integer-width', `*${'0'.repeat(options.minimumIntegerDigits)}`);
    }
    // `%x100` is `percent scale/100`, and ICU takes one scale.
    if (Number.isFinite(scale) && fixedUnit !== '%x100') {
      add('scale', String(scale));
    }
    add(stemOf(values, ['useGrouping']));
    const latin = stemOf(values, ['numberingSystem']);
    if (latin) add(latin);
    else if (isTokenText(numberingSystem)) {
      add('numbering-system', numberingSystem);
    }
    add(stemOf(values, SIGN));
  }
  return {
    type: SKELETON_TYPE.number,
    tokens,
    parsedOptions: parseNumberSkeletonOptions(tokens),
  };
}

// The first stem that spells the most of a setting, and nothing the options lack.
function stemOf(
  values: ReadonlyMap<string, unknown>,
  setting: readonly string[]
): string | undefined {
  let best: (typeof STEMS)[number] | undefined;
  for (const stem of STEMS) {
    const spelled = Object.entries(stem[2]);
    if (
      spelled.length > (best ? Object.keys(best[2]).length : 0) &&
      spelled.every(
        ([key, value]) => setting.includes(key) && values.get(key) === value
      )
    ) {
      best = stem;
    }
  }
  return best?.[0];
}

const isCurrencyCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Z]{3}$/.test(value);

// Text a token can hold: no space, which ends a token, and no `/`.
const isTokenText = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9-]+$/.test(value);

/**
 * The one precision token of the options, as `readPrecision` reads it back,
 * or none when no token spells exactly them: a minimum of fraction digits
 * without a maximum, or a maximum of significant digits without a minimum.
 */
function precisionToken(options: Options): [stem?: string, ...string[]] {
  const {
    minimumFractionDigits: minimumFraction,
    maximumFractionDigits: maximumFraction,
    minimumSignificantDigits: minimumSignificant,
    maximumSignificantDigits: maximumSignificant,
    roundingPriority: priority = 'auto',
    roundingIncrement: increment,
    trailingZeroDisplay,
  } = options;
  if (trailingZeroDisplay === 'auto') return [];
  const strip = trailingZeroDisplay ? ['w'] : [];
  const hasSignificant =
    minimumSignificant !== undefined || maximumSignificant !== undefined;

  if (increment !== undefined) {
    if (hasSignificant || priority !== 'auto') return [];
    if (maximumFraction === undefined || minimumFraction !== maximumFraction) {
      return [];
    }
    const value = (increment / 10 ** maximumFraction).toFixed(maximumFraction);
    return ['precision-increment', value, ...strip];
  }

  let significant: string | undefined;
  if (hasSignificant) {
    if (!minimumSignificant) return [];
    if ((maximumSignificant ?? minimumSignificant) < minimumSignificant) {
      return [];
    }
    significant =
      '@'.repeat(minimumSignificant) +
      (maximumSignificant === undefined
        ? '*'
        : '#'.repeat(maximumSignificant - minimumSignificant));
  }

  if (maximumFraction === undefined) {
    if (minimumFraction !== undefined) return [];
    if (significant) {
      return priority === 'auto' ? [significant, ...strip] : [];
    }
    // Alone, hiding a fraction of zeros has a token only for a currency.
    return strip.length && options.style === 'currency' && priority === 'auto'
      ? ['precision-currency-standard', ...strip]
      : [];
  }
  if (minimumFraction === 0 || (minimumFraction ?? 0) > maximumFraction) {
    return [];
  }
  const fraction =
    maximumFraction === UNLIMITED_FRACTION_DIGITS
      ? `.${'0'.repeat(minimumFraction ?? 0)}*`
      : `.${'0'.repeat(minimumFraction ?? 0)}${'#'.repeat(maximumFraction - (minimumFraction ?? 0))}`;
  if (!significant) {
    if (priority !== 'auto') return [];
    return [fraction === '.' ? 'precision-integer' : fraction, ...strip];
  }
  // With a fraction, significant digits have both ends and a priority.
  if (maximumSignificant === undefined || priority === 'auto') return [];
  return [
    fraction,
    significant + (priority === 'morePrecision' ? 'r' : 's'),
    ...strip,
  ];
}
