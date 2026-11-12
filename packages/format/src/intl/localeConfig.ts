import type { LocaleProperties } from '../locales/getLocaleProperties';
import { defaultLocaleMatcher } from '../settings/settings';

/** The ECMA-402 locale matching algorithms `determineLocale` supports. */
export const localeMatchers = ['lookup', defaultLocaleMatcher] as const;
export type LocaleMatcher = (typeof localeMatchers)[number];

/** The locales an app supports; plain data shared by GTIntl, GTRuntime and GT. */
export type LocaleConfig = {
  defaultLocale?: string;
  locales?: readonly string[];
  customMapping?: {
    readonly [locale: string]: string | Readonly<Partial<LocaleProperties>>;
  };
  /** The IANA time zone of the dates and times formatted without one. */
  timeZone?: string;
  localeMatcher?: LocaleMatcher;
};

/**
 * A locale configuration with its settings resolved, which `GTIntl` takes:
 * this package applies no defaults of its own. `locales` stays optional,
 * because leaving it out means no approved-locales restriction.
 */
export type ResolvedLocaleConfig = LocaleConfig &
  Required<Pick<LocaleConfig, 'defaultLocale' | 'timeZone' | 'localeMatcher'>>;

/**
 * Copies and freezes a locale configuration, so later changes to the caller's
 * objects never reach an instance. Exported from the internal entry only.
 */
export function snapshotLocaleConfig({
  defaultLocale,
  locales,
  customMapping,
  timeZone,
  localeMatcher,
}: LocaleConfig): Readonly<LocaleConfig> {
  return Object.freeze({
    defaultLocale,
    timeZone,
    localeMatcher,
    locales: locales && Object.freeze([...locales]),
    customMapping:
      customMapping &&
      Object.freeze(
        Object.fromEntries(
          Object.entries(customMapping).map(([alias, value]) => [
            alias,
            typeof value === 'object' ? Object.freeze({ ...value }) : value,
          ])
        )
      ),
  });
}
