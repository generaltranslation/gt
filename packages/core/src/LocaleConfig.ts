import {
  LocaleConfig as ResolvedLocaleConfig,
  type LocaleConfigConstructorParams as ResolvedLocaleConfigParams,
} from '@generaltranslation/format';
import type { WithOptional } from './formatting';
import { libraryDefaultLocale } from './settings/settings';
import { hostTimeZone } from './utils/hostTimeZone';

export type LocaleConfigConstructorParams = Partial<ResolvedLocaleConfigParams>;

type RelativeTimeFromDateOptions = Parameters<
  ResolvedLocaleConfig['formatRelativeTimeFromDate']
>[2];

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
      timeZone: params.timeZone ?? hostTimeZone(),
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
