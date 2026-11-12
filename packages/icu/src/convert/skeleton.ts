import type { DATE_FIELD_OPTIONS } from '../settings/formatOptions';
import type { DateTimeNode } from '../tree/messageTree';

/**
 * The ICU skeleton symbol of each date and time field value, in printing
 * order. The hour is `j`, the locale's hour, since the hour cycle is
 * formatting context.
 */
export const DATE_TIME_FIELD_SYMBOLS = {
  era: { short: 'G', long: 'GGGG', narrow: 'GGGGG' },
  year: { numeric: 'y', '2-digit': 'yy' },
  month: {
    numeric: 'M',
    '2-digit': 'MM',
    short: 'MMM',
    long: 'MMMM',
    narrow: 'MMMMM',
  },
  day: { numeric: 'd', '2-digit': 'dd' },
  weekday: { short: 'E', long: 'EEEE', narrow: 'EEEEE' },
  hour: { numeric: 'j', '2-digit': 'jj' },
  dayPeriod: { short: 'B', long: 'BBBB', narrow: 'BBBBB' },
  minute: { numeric: 'm', '2-digit': 'mm' },
  second: { numeric: 's', '2-digit': 'ss' },
  fractionalSecondDigits: { 1: 'S', 2: 'SS', 3: 'SSS' },
  timeZoneName: {
    short: 'z',
    long: 'zzzz',
    shortOffset: 'O',
    longOffset: 'OOOO',
    shortGeneric: 'v',
    longGeneric: 'vvvv',
  },
} as const satisfies Record<
  (typeof DATE_FIELD_OPTIONS)[number],
  Record<string, string>
>;

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
