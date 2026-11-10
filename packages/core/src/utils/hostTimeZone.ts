let timeZone: string | undefined;

/**
 * The host's time zone, for a date or time whose caller names none. It is
 * read here and nowhere below: `@generaltranslation/format` and
 * `@generaltranslation/icu` take the zone as an argument, which lets them
 * share formatters. It is read once, since reading it costs as much as
 * building a formatter, so a host whose zone changes while the process runs
 * keeps the first; pass a `timeZone` to choose.
 */
export function hostTimeZone(): string {
  return (timeZone ??= new Intl.DateTimeFormat().resolvedOptions().timeZone);
}
