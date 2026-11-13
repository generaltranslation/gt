/*
 * Date skeleton compatibility is adapted from @formatjs/icu-skeleton-parser
 * (MIT). See THIRD_PARTY_NOTICES.md.
 *
 * A field has ICU's meaning or it throws a RangeError: Intl has no quarter,
 * week or numeric weekday, among others. icu4c-conformance.test.ts lists
 * what differs.
 */

import {
  createDayPeriodWithoutHourError,
  createInvalidDateTimeFieldError,
  createUnsupportedDateTimeFieldError,
} from '../errors/skeletonErrors';
import { DATE_TIME_FIELD_SYMBOLS } from '../settings/formatOptions';
import type { DateTimeNode } from '../tree/messageTree';

// The last alternative is any other letter, so that none is skipped.
const DATE_TIME_FIELD =
  /(?:[Eec]{1,6}|G{1,5}|[Qq]{1,5}|(?:[yYur]+|U{1,5})|[ML]{1,5}|d{1,2}|D{1,3}|F|[ab]{1,5}|B{1,5}|[hHkK]{1,2}|j{1,6}|J{1,2}|w{1,2}|W|m{1,2}|s{1,2}|S+|[zZOvVxX]{1,4}|[A-Za-z])(?=([^']*'[^']*')*[^']*$)/g;

/**
 * What each hour symbol asks of Intl. In a skeleton `h` and `K` are the
 * 12-hour clock the locale prefers, which starts at 0 in Japanese, and `H`
 * and `k` the 24-hour clock (UTS #35). `hour12` leaves the hour cycle to the
 * locale; `H` names its cycle, which engines before 2023 got wrong for
 * `hour12: false`.
 */
export const HOUR_CLOCKS = {
  h: { hour12: true },
  K: { hour12: true },
  H: { hourCycle: 'h23' },
  k: { hour12: false },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

const WIDTHS = ['short', 'long', 'narrow'] as const;

/** The fields of UTS #35 that Intl has no option for at any length. */
const ICU_ONLY_FIELDS = 'YuUrQqlwWDFgbJCAZVXx';

/** The fields of a date skeleton as written; quoted text is not a field. */
export function dateTimeSkeletonFields(skeleton: string): string[] {
  return Array.from(skeleton.matchAll(DATE_TIME_FIELD), ([field]) => field);
}

/**
 * The Intl options of a date skeleton. `localeHour` says how to read `j`,
 * which remains only when the skeleton was parsed without a locale: as the
 * locale's hour, or as nothing, like FormatJS.
 */
export function parseDateTimeSkeletonOptions(
  skeleton: string,
  localeHour: boolean
): Intl.DateTimeFormatOptions {
  const result: Intl.DateTimeFormatOptions = {};
  let hasHour = false;
  let hasAmPm = false;

  for (const field of dateTimeSkeletonFields(skeleton)) {
    const length = field.length;
    switch (field[0]) {
      case 'G':
        result.era = length === 4 ? 'long' : length === 5 ? 'narrow' : 'short';
        break;
      case 'y':
        // Five or more pad the year with zeros, which Intl cannot.
        if (length > 4) throw unsupported(field, 'date/time');
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
        // Six is ICU's two-letter weekday, which Intl does not have.
        if (length > 5) throw unsupported(field, 'weekday');
        result.weekday = WIDTHS[Math.max(length - 3, 0)];
        break;
      case 'e':
      case 'c':
        // One or two is the number of the weekday.
        if (length < 3 || length > 5) throw unsupported(field, 'weekday');
        result.weekday = WIDTHS[length - 3];
        break;
      // AM or PM comes with a 12-hour clock in Intl, so `a` adds nothing to
      // an hour. Five is the narrow form, which Intl does not have.
      case 'a':
        if (length > 4) throw unsupported(field, 'date/time');
        hasAmPm = true;
        break;
      case 'B':
        result.dayPeriod = WIDTHS[Math.max(length - 3, 0)];
        break;
      // `j` is the locale's hour, which Intl spells as an hour with no
      // hourCycle. Three or more widen its AM or PM.
      case 'j':
        if (length > 4) throw unsupported(field, 'date/time');
        hasHour = true;
        if (localeHour) result.hour = length % 2 ? 'numeric' : '2-digit';
        break;
      case 'h':
      case 'H':
      case 'K':
      case 'k':
        hasHour = true;
        // The last hour symbol decides the clock.
        delete result.hour12;
        delete result.hourCycle;
        Object.assign(result, HOUR_CLOCKS[field[0]]);
        result.hour = length === 2 ? '2-digit' : 'numeric';
        break;
      case 'm':
        result.minute = length === 2 ? '2-digit' : 'numeric';
        break;
      case 's':
        result.second = length === 2 ? '2-digit' : 'numeric';
        break;
      case 'S':
        // ICU shows every `S`; Intl shows at most three digits.
        if (length > 3) throw unsupported(field, 'date/time');
        result.fractionalSecondDigits = length as 1 | 2 | 3;
        break;
      case 'z':
        result.timeZoneName = length < 4 ? 'short' : 'long';
        break;
      case 'O':
      case 'v':
        if (length !== 1 && length !== 4) throw unsupported(field, 'date/time');
        result.timeZoneName = `${length === 1 ? 'short' : 'long'}${
          field[0] === 'O' ? 'Offset' : 'Generic'
        }`;
        break;
      // A field ICU has and Intl does not, or a letter that is no field.
      // `J` is the locale's hour without AM or PM, and `C` its hour with the
      // day period it prefers.
      default:
        throw ICU_ONLY_FIELDS.includes(field[0])
          ? unsupported(field, 'date/time')
          : new SyntaxError(createInvalidDateTimeFieldError(field));
    }
  }

  if (hasAmPm && !hasHour) {
    throw new RangeError(createDayPeriodWithoutHourError());
  }
  return result;
}

export function resolveLocaleHourSkeleton(
  skeleton: string,
  locale?: Intl.Locale
): string {
  if (!locale || !skeleton.includes('j')) return skeleton;

  const localeHourSymbol = getLocaleHourSymbol(locale);
  let resolvedSkeleton = '';

  // Ported from FormatJS's getBestPattern scanner. Its ordering is observable
  // in the public AST and, for mixed j/J/hour runs, changes Intl options and
  // rendered output. In particular, only identical j runs are coalesced. A J
  // stays, since Intl cannot hide AM or PM in a locale with a 12-hour clock.
  for (let index = 0; index < skeleton.length; index += 1) {
    const character = skeleton[index];
    if (character === 'j') {
      let extraLength = 0;
      while (skeleton[index + 1] === character) {
        extraLength += 1;
        index += 1;
      }
      const hourLength = 1 + (extraLength & 1);
      const dayPeriodLength =
        localeHourSymbol === 'H' || localeHourSymbol === 'k'
          ? 0
          : extraLength < 2
            ? 1
            : 3 + (extraLength >> 1);
      resolvedSkeleton =
        localeHourSymbol.repeat(hourLength) +
        resolvedSkeleton +
        'a'.repeat(dayPeriodLength);
    } else {
      resolvedSkeleton += character;
    }
  }

  return resolvedSkeleton;
}

// A formatter resolves the same Intl.Locale for every message in a locale.
const localeHourSymbols = new WeakMap<Intl.Locale, 'h' | 'H' | 'K' | 'k'>();

function getLocaleHourSymbol(locale: Intl.Locale): 'h' | 'H' | 'K' | 'k' {
  let symbol = localeHourSymbols.get(locale);
  if (!symbol) {
    symbol = hourSymbol(localeHourCycle(locale));
    localeHourSymbols.set(locale, symbol);
  }
  return symbol;
}

/**
 * The locale's hour cycle, region override included. Engines expose it as
 * `getHourCycles()`, or as the older `hourCycles` getter that V8 has since
 * removed; a DateTimeFormat, the last resort, ignores a `-u-rg-` override.
 */
function localeHourCycle(locale: Intl.Locale): string | undefined {
  const withHourCycles = locale as Intl.Locale & {
    getHourCycles?: () => Intl.LocaleHourCycleKey[];
    hourCycles?: Intl.LocaleHourCycleKey[];
  };
  return (
    locale.hourCycle ??
    withHourCycles.getHourCycles?.()[0] ??
    withHourCycles.hourCycles?.[0] ??
    new Intl.DateTimeFormat(locale.toString(), {
      hour: 'numeric',
    }).resolvedOptions().hourCycle
  );
}

function hourSymbol(hourCycle: string | undefined): 'h' | 'H' | 'K' | 'k' {
  switch (hourCycle) {
    case 'h11':
      return 'K';
    case 'h12':
      return 'h';
    case 'h24':
      return 'k';
    default:
      return 'H';
  }
}

/**
 * Prints date or time fields as an ICU skeleton:
 * `{ year: 'numeric', month: 'short', day: 'numeric' }` becomes `yMMMd`.
 * The fields must be valid, as `validateMessageTree` checks. `hour` is the
 * symbol of the hour: `j`, the locale's, or that of an hour cycle, like `H`.
 */
export function printDateTimeSkeleton(
  fields: Exclude<NonNullable<DateTimeNode[2]>, string>,
  hour = 'j'
): string {
  const values: Partial<Record<string, string | number>> = fields;
  return Object.entries(DATE_TIME_FIELD_SYMBOLS)
    .map(([key, symbols]) => {
      const value = values[key];
      return value === undefined
        ? ''
        : (symbols as Record<string, string>)[value];
    })
    .join('')
    .replace(/j/g, hour);
}

function unsupported(field: string, kind: string): RangeError {
  return new RangeError(createUnsupportedDateTimeFieldError(field, kind));
}
