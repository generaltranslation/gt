import {
  _formatCurrency,
  _formatDateTime,
  _formatList,
  _formatListToParts,
  _formatMessageICU,
  _formatNum,
  _formatRelativeTime,
  _selectRelativeTimeUnit,
} from './formatting/format';
import { intlCache } from './cache/IntlCache';
import { libraryDefaultLocale } from './settings/settings';
import type { FormatVariables } from './types';
import type { CutoffFormatOptions } from './formatting/custom-formats/CutoffFormat/types';
import type { StringFormat } from './types-dir/jsx/content';
import {
  LocaleResolver,
  type LocaleResolverConstructorParams,
} from './LocaleResolver';

export type LocaleConfigConstructorParams = LocaleResolverConstructorParams;

type LocalesOption = {
  locales?: string | string[];
};

type WithLocales<T = object> = T & LocalesOption;

/**
 * LocaleConfig contains the locale and formatting primitives exposed through
 * the core entrypoint.
 *
 * It intentionally does not store project IDs, API keys, runtime URLs, or any
 * translation credentials. It only stores locale metadata needed to resolve
 * aliases, choose formatting fallbacks, and format values with Intl.
 */
export class LocaleConfig extends LocaleResolver {
  private getFormattingLocales(
    targetLocale?: string,
    locales?: string | string[]
  ) {
    return (
      locales === undefined
        ? [targetLocale, this.defaultLocale, libraryDefaultLocale]
        : Array.isArray(locales)
          ? locales
          : [locales]
    )
      .filter((locale): locale is string => !!locale)
      .map((locale) => this.resolveCanonicalLocale(locale));
  }

  formatNum(
    value: number,
    targetLocale?: string,
    options: WithLocales<Intl.NumberFormatOptions> = {}
  ) {
    const { locales, ...intlOptions } = options;
    return _formatNum({
      value,
      locales: this.getFormattingLocales(targetLocale, locales),
      options: intlOptions,
    });
  }

  formatDateTime(
    value: Date,
    targetLocale?: string,
    options: WithLocales<Intl.DateTimeFormatOptions> = {}
  ) {
    const { locales, ...intlOptions } = options;
    return _formatDateTime({
      value,
      locales: this.getFormattingLocales(targetLocale, locales),
      options: intlOptions,
    });
  }

  formatCurrency(
    value: number,
    currency: string,
    targetLocale?: string,
    options: WithLocales<Intl.NumberFormatOptions> = {}
  ) {
    const { locales, ...intlOptions } = options;
    return _formatCurrency({
      value,
      currency,
      locales: this.getFormattingLocales(targetLocale, locales),
      options: intlOptions,
    });
  }

  formatRelativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    targetLocale?: string,
    options: WithLocales<Intl.RelativeTimeFormatOptions> = {}
  ) {
    const { locales, ...intlOptions } = options;
    return _formatRelativeTime({
      value,
      unit,
      locales: this.getFormattingLocales(targetLocale, locales),
      options: intlOptions,
    });
  }

  formatRelativeTimeFromDate(
    date: Date,
    targetLocale?: string,
    options: WithLocales<
      Intl.RelativeTimeFormatOptions & { baseDate?: Date }
    > = {}
  ) {
    const { locales, baseDate, ...intlOptions } = options;
    const { value, unit } = _selectRelativeTimeUnit(
      date,
      baseDate ?? new Date()
    );
    return _formatRelativeTime({
      value,
      unit,
      locales: this.getFormattingLocales(targetLocale, locales),
      options: intlOptions,
    });
  }

  formatCutoff(
    value: string,
    targetLocale?: string,
    options: WithLocales<CutoffFormatOptions> = {}
  ) {
    const { locales, ...formatOptions } = options;
    return intlCache
      .get(
        'CutoffFormat',
        this.getFormattingLocales(targetLocale, locales),
        formatOptions
      )
      .format(value);
  }

  formatMessage(
    message: string,
    targetLocale?: string,
    options: WithLocales<{
      variables?: FormatVariables;
      dataFormat?: StringFormat;
    }> = {}
  ) {
    const { locales, variables, dataFormat } = options;
    if (dataFormat === 'STRING') return message;
    return _formatMessageICU(
      message,
      this.getFormattingLocales(targetLocale, locales),
      variables
    );
  }

  formatList(
    array: Array<string | number>,
    targetLocale?: string,
    options: WithLocales<Intl.ListFormatOptions> = {}
  ) {
    const { locales, ...intlOptions } = options;
    return _formatList({
      value: array,
      locales: this.getFormattingLocales(targetLocale, locales),
      options: intlOptions,
    });
  }

  formatListToParts<T>(
    array: Array<T>,
    targetLocale?: string,
    options: WithLocales<Intl.ListFormatOptions> = {}
  ) {
    const { locales, ...intlOptions } = options;
    return _formatListToParts<T>({
      value: array,
      locales: this.getFormattingLocales(targetLocale, locales),
      options: intlOptions,
    });
  }
}
