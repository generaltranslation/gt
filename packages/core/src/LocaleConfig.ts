import {
  LocaleConfig as ResolvedLocaleConfig,
  type LocaleConfigConstructorParams as ResolvedLocaleConfigParams,
} from '@generaltranslation/format';
import type { WithOptional } from './formatting/formatting';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from './logging/diagnostics';
import { libraryDefaultLocale } from './settings/settings';
import { hostTimeZone } from './utils/hostTimeZone';

export type LocaleConfigConstructorParams = Partial<ResolvedLocaleConfigParams>;

type RelativeTimeFromDateOptions = Parameters<
  ResolvedLocaleConfig['formatRelativeTimeFromDate']
>[2];

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
 * The locale and formatting primitives of `@generaltranslation/format`, with
 * what a caller leaves out resolved: that package takes every argument.
 */
export class LocaleConfig extends ResolvedLocaleConfig {
  constructor(params: LocaleConfigConstructorParams = {}) {
    super({
      ...params,
      defaultLocale: params.defaultLocale ?? libraryDefaultLocale,
      locales: params.locales ?? [],
      timeZone:
        params.timeZone === undefined
          ? hostTimeZone()
          : checkTimeZone(params.timeZone),
    });
  }

  /** Compares the date with now when no `baseDate` is given. */
  override formatRelativeTimeFromDate(
    date: Date,
    targetLocale?: string,
    options?: WithOptional<RelativeTimeFromDateOptions, 'baseDate'>
  ): string {
    return super.formatRelativeTimeFromDate(date, targetLocale, {
      ...options,
      baseDate: options?.baseDate ?? new Date(),
    });
  }
}
