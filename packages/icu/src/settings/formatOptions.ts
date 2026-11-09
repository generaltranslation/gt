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

/** Date options that are part of the message: `dateStyle` or fields. */
export const DATE_MESSAGE_OPTIONS = [
  'dateStyle',
  ...DATE_FIELD_OPTIONS,
] as const;

/** Time options that are part of the message: `timeStyle` or time fields. */
export const TIME_MESSAGE_OPTIONS = [
  'timeStyle',
  ...TIME_FIELD_OPTIONS,
] as const;

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

export type NumberMessageOptions = Pick<
  Intl.NumberFormatOptions,
  (typeof NUMBER_MESSAGE_OPTIONS)[number]
>;
export type NumberFormattingContext = Pick<
  Intl.NumberFormatOptions,
  (typeof NUMBER_CONTEXT_OPTIONS)[number]
>;
export type DateFieldOptions = Pick<
  Intl.DateTimeFormatOptions,
  (typeof DATE_FIELD_OPTIONS)[number]
>;
export type TimeFieldOptions = Pick<
  Intl.DateTimeFormatOptions,
  (typeof TIME_FIELD_OPTIONS)[number]
>;
export type DateMessageOptions = Pick<
  Intl.DateTimeFormatOptions,
  (typeof DATE_MESSAGE_OPTIONS)[number]
>;
export type TimeMessageOptions = Pick<
  Intl.DateTimeFormatOptions,
  (typeof TIME_MESSAGE_OPTIONS)[number]
>;
export type DateTimeFormattingContext = Pick<
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
export type DateTimeStyleName = NonNullable<
  Intl.DateTimeFormatOptions['dateStyle']
>;
export const DATE_TIME_STYLE_NAMES: readonly DateTimeStyleName[] = [
  'full',
  'long',
  'medium',
  'short',
];

/** Named number styles a tree holds; a unit is the `::unit/…` skeleton. */
export type NumberStyleName = Extract<
  Intl.NumberFormatOptions['style'],
  'percent' | 'currency'
>;
export const NUMBER_STYLE_NAMES: readonly NumberStyleName[] = [
  'currency',
  'percent',
];
