// Every Intl option of number(), date() and time() is in exactly one bucket:
// message options are part of the message, so they are stored in its tree,
// printed as ICU and hashed; formatting context is set where the message is
// used and never leaves it.

/** Number options that are part of the message. */
export const NUMBER_MESSAGE_OPTIONS = ['style', 'unit'] as const;

/** Number options set where the message is used. */
export const NUMBER_CONTEXT_OPTIONS = [
  'currency',
  'currencyDisplay',
  'currencySign',
  'unitDisplay',
  'notation',
  'compactDisplay',
  'minimumIntegerDigits',
  'minimumFractionDigits',
  'maximumFractionDigits',
  'minimumSignificantDigits',
  'maximumSignificantDigits',
  'roundingMode',
  'roundingPriority',
  'roundingIncrement',
  'trailingZeroDisplay',
  'signDisplay',
  'useGrouping',
  'numberingSystem',
  'localeMatcher',
] as const;

/** Fields a time spells out; a date may use them too. */
export const TIME_FIELD_OPTIONS = [
  'hour',
  'minute',
  'second',
  'fractionalSecondDigits',
  'dayPeriod',
  'timeZoneName',
] as const;

/** Fields a date spells out. */
export const DATE_FIELD_OPTIONS = [
  'era',
  'year',
  'month',
  'day',
  'weekday',
  ...TIME_FIELD_OPTIONS,
] as const;

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

// A date or a time has one named style, so it is `style`, as for a number.
// Intl has `dateStyle` and `timeStyle` because one of its formatters takes both.
/** Date options that are part of the message: a named `style` or fields. */
export const DATE_MESSAGE_OPTIONS = ['style', ...DATE_FIELD_OPTIONS] as const;

/** Time options that are part of the message: a named `style` or time fields. */
export const TIME_MESSAGE_OPTIONS = ['style', ...TIME_FIELD_OPTIONS] as const;

/** Date and time options set where the message is used. */
export const DATE_TIME_CONTEXT_OPTIONS = [
  'timeZone',
  'calendar',
  'numberingSystem',
  'hour12',
  'hourCycle',
  'formatMatcher',
  'localeMatcher',
] as const;

// A consumer's older `lib` lacks newer Intl options, like `roundingMode`
// (ES2023) or `fractionalSecondDigits` (ES2021); its types leave them out.
type PickAvailable<T, K extends PropertyKey> = Pick<T, Extract<K, keyof T>>;

export type NumberMessageOptions = PickAvailable<
  Intl.NumberFormatOptions,
  (typeof NUMBER_MESSAGE_OPTIONS)[number]
>;
export type NumberFormattingContext = PickAvailable<
  Intl.NumberFormatOptions,
  (typeof NUMBER_CONTEXT_OPTIONS)[number]
>;
export type DateFieldOptions = PickAvailable<
  Intl.DateTimeFormatOptions,
  (typeof DATE_FIELD_OPTIONS)[number]
>;
export type TimeFieldOptions = PickAvailable<
  Intl.DateTimeFormatOptions,
  (typeof TIME_FIELD_OPTIONS)[number]
>;
type NamedStyle = { style?: DateTimeStyleName };
export type DateMessageOptions = NamedStyle & DateFieldOptions;
export type TimeMessageOptions = NamedStyle & TimeFieldOptions;
export type DateTimeFormattingContext = PickAvailable<
  Intl.DateTimeFormatOptions,
  (typeof DATE_TIME_CONTEXT_OPTIONS)[number]
>;

/**
 * A formatted placeholder's formatting context. `scale` multiplies a number
 * before it is formatted, as ICU's `scale/100`. It is no Intl option, and
 * only an ICU string sets it.
 */
export type MessageFormattingContext =
  | (NumberFormattingContext & { scale?: number })
  | DateTimeFormattingContext;

/**
 * Formatting context by variable name: a message's `formats`, as
 * `templateToMessage` and `icuToMessage` return it.
 */
export type MessageFormats = Readonly<Record<string, MessageFormattingContext>>;

/** The named styles of `{d, date, …}` and `{t, time, …}`: Intl `dateStyle` and `timeStyle`. */
export const DATE_TIME_STYLE_NAMES = [
  'full',
  'long',
  'medium',
  'short',
] as const;
export type DateTimeStyleName = (typeof DATE_TIME_STYLE_NAMES)[number];

/** Named number styles a tree holds; a unit is the `::unit/…` skeleton. */
export const NUMBER_STYLE_NAMES = ['currency', 'percent'] as const;
export type NumberStyleName = (typeof NUMBER_STYLE_NAMES)[number];

/**
 * The number style names of an ICU string, as Intl options. `integer` sets
 * digits, which is formatting context, so a tree does not hold it.
 */
export const NAMED_NUMBER_STYLES: Readonly<
  Record<string, Intl.NumberFormatOptions>
> = {
  integer: { maximumFractionDigits: 0 },
  currency: { style: 'currency' },
  percent: { style: 'percent' },
};
