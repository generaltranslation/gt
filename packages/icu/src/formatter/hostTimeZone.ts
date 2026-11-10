let timeZone: string | undefined;

/**
 * The host's time zone, for a date or time formatted without one. It is read
 * once: reading it costs as much as building a formatter, and with the zone
 * always passed to a formatter, formatters can be shared. A host whose zone
 * changes while the process runs keeps the first; pass a `timeZone` to choose.
 */
export function hostTimeZone(): string {
  return (timeZone ??= new Intl.DateTimeFormat().resolvedOptions().timeZone);
}
