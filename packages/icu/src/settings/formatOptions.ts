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

/** A formatted placeholder's formatting context. */
export type MessageFormattingContext =
  | NumberFormattingContext
  | DateTimeFormattingContext;

/** Formatting context by variable name, as `buildMessageTree` returns it. */
export type MessageTreeFormats = Readonly<
  Record<string, MessageFormattingContext>
>;

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
