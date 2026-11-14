import {
  GTIntl as ResolvedGTIntl,
  type LocaleConfig,
} from '@generaltranslation/format';
import { defaultLocaleMatcher } from '@generaltranslation/format/internal';
import type { WithOptional } from '../formatting/formatting';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from '../logging/diagnostics';
import { defaultDefaultLocale } from '../settings/settings';
import { hostTimeZone } from '../utils/hostTimeZone';

type LocaleOption = ConstructorParameters<typeof ResolvedGTIntl>[1];

type RelativeTimeFromDateOptions = Parameters<
  ResolvedGTIntl['formatRelativeTimeFromDate']
>[1];

// A config is built far more often than it names a new zone.
const knownTimeZones = new Set<string>();

/**
 * A configured zone is kept for later formats, so a wrong name is reported
 * here, where it was set, and not at the first date that uses it.
 */
export function checkTimeZone(timeZone: string): string {
  if (knownTimeZones.has(timeZone)) return timeZone;
  try {
    // Intl is the authority on which time zones the host supports.
    new Intl.DateTimeFormat(undefined, { timeZone });
  } catch (error) {
    throw new Error(
      createDiagnosticMessage({
        source: 'generaltranslation',
        severity: 'Error',
        whatHappened: `Invalid time zone ${JSON.stringify(timeZone)}`,
        fix: "Use an IANA time zone, like 'America/New_York' or 'UTC'",
        details: formatDiagnosticErrorDetails(error),
      })
    );
  }
  knownTimeZones.add(timeZone);
  return timeZone;
}

/**
 * The locale and formatting helpers of `@generaltranslation/format`, with
 * what a caller leaves out resolved: that package takes every argument.
 */
export class GTIntl extends ResolvedGTIntl {
  constructor(localeConfig: LocaleConfig = {}, options?: LocaleOption) {
    super(
      {
        ...localeConfig,
        defaultLocale: localeConfig.defaultLocale ?? defaultDefaultLocale,
        localeMatcher: localeConfig.localeMatcher ?? defaultLocaleMatcher,
        timeZone:
          localeConfig.timeZone === undefined
            ? hostTimeZone()
            : checkTimeZone(localeConfig.timeZone),
      },
      options
    );
  }

  /** Compares the date with now when no `baseDate` is given. */
  override formatRelativeTimeFromDate(
    date: Date,
    options?: WithOptional<RelativeTimeFromDateOptions, 'baseDate'>
  ): string {
    return super.formatRelativeTimeFromDate(date, {
      ...options,
      baseDate: options?.baseDate ?? new Date(),
    });
  }
}
