export const createInvalidNumberSkeletonTokenError = (token: string) =>
  `"${token}" is not an ICU number skeleton token.`;

export const createUnsupportedNumberSkeletonTokenError = (
  token: string,
  reason: string
) => `The number skeleton token "${token}" cannot be formatted: ${reason}.`;

export const createUnsupportedDateTimeFieldError = (
  field: string,
  kind: string
) => `Unsupported ${kind} skeleton field: ${field}.`;

export const createInvalidDateTimeFieldError = (letter: string) =>
  `"${letter}" is not a date or time field.`;

export const createDayPeriodWithoutHourError = () =>
  'The date/time skeleton field a, the AM/PM marker, needs an hour field.';
