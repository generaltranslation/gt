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
import { _requiresTranslation } from './locales/requiresTranslation';
import { _determineLocale } from './locales/determineLocale';
import { _isSameLanguage } from './locales/isSameLanguage';
import { _getLocaleProperties } from './locales/getLocaleProperties';
import { _getLocaleEmoji } from './locales/getLocaleEmoji';
import { _isValidLocale, _standardizeLocale } from './locales/isValidLocale';
import { _getLocaleName } from './locales/getLocaleName';
import { _getLocaleDirection } from './locales/getLocaleDirection';
import { libraryDefaultLocale } from './settings/settings';
import { _isSameDialect } from './locales/isSameDialect';
import { _isSupersetLocale } from './locales/isSupersetLocale';
import type { CustomMapping, FormatVariables } from './types';
import { _resolveAliasLocale } from './locales/resolveAliasLocale';
import { _resolveCanonicalLocale } from './locales/resolveCanonicalLocale';
import type { CutoffFormatOptions } from './formatting/custom-formats/CutoffFormat/types';
import { cutoffFormatCache } from './formatting/custom-formats/CutoffFormat/CutoffFormatCache';
import type { StringFormat } from './types-dir/jsx/content';

export type LocaleConfigConstructorParams = {
  defaultLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
};

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
export class LocaleConfig {
  readonly defaultLocale: string;
  readonly locales: string[];
  readonly customMapping?: CustomMapping;

  constructor({
    defaultLocale = libraryDefaultLocale,
    locales = [],
    customMapping,
  }: LocaleConfigConstructorParams = {}) {
    this.defaultLocale = defaultLocale;
    this.locales = locales;
    this.customMapping = customMapping;
  }

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
    return cutoffFormatCache
      .get(this.getFormattingLocales(targetLocale, locales), formatOptions)
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

  getLocaleName(locale: string) {
    return _getLocaleName(locale, this.defaultLocale, this.customMapping);
  }

  getLocaleEmoji(locale: string) {
    return _getLocaleEmoji(locale, this.customMapping);
  }

  getLocaleProperties(locale: string) {
    return _getLocaleProperties(locale, this.defaultLocale, this.customMapping);
  }

  requiresTranslation(
    targetLocale: string,
    sourceLocale: string = this.defaultLocale,
    approvedLocales: string[] | undefined = this.locales.length
      ? this.locales
      : undefined
  ) {
    return _requiresTranslation(
      this.resolveCanonicalLocale(sourceLocale),
      this.resolveCanonicalLocale(targetLocale),
      approvedLocales
        ? approvedLocales.map((locale) => this.resolveCanonicalLocale(locale))
        : undefined,
      this.customMapping
    );
  }

  /**
   * NOTE: consider moving LocaleCandidates type to this package, and
   * determineLocale could accept that as a parameter.
   */
  determineLocale(
    locales: string | string[],
    approvedLocales: string[] = this.locales
  ) {
    const approvedLocalePairs = approvedLocales.map((locale) => ({
      locale,
      canonicalLocale: this.resolveCanonicalLocale(locale),
    }));
    const resolvedLocale = _determineLocale(
      Array.isArray(locales)
        ? locales.map((locale) => this.resolveCanonicalLocale(locale))
        : this.resolveCanonicalLocale(locales),
      approvedLocalePairs.map(({ canonicalLocale }) => canonicalLocale),
      this.customMapping
    );
    if (!resolvedLocale) return undefined;
    const approvedLocale = approvedLocalePairs.find(
      ({ canonicalLocale }) => canonicalLocale === resolvedLocale
    );
    return approvedLocale?.locale ?? this.resolveAliasLocale(resolvedLocale);
  }

  getLocaleDirection(locale: string) {
    return _getLocaleDirection(this.resolveCanonicalLocale(locale));
  }

  isValidLocale(locale: string) {
    return _isValidLocale(locale, this.customMapping);
  }

  resolveCanonicalLocale(locale: string) {
    return _resolveCanonicalLocale(locale, this.customMapping);
  }

  resolveAliasLocale(locale: string) {
    return _resolveAliasLocale(locale, this.customMapping);
  }

  standardizeLocale(locale: string) {
    return _standardizeLocale(locale);
  }

  isSameDialect(...locales: (string | string[])[]) {
    return _isSameDialect(
      ...locales.map((locale) =>
        Array.isArray(locale)
          ? locale.map((code) => this.resolveCanonicalLocale(code))
          : this.resolveCanonicalLocale(locale)
      )
    );
  }

  isSameLanguage(...locales: (string | string[])[]) {
    return _isSameLanguage(
      ...locales.map((locale) =>
        Array.isArray(locale)
          ? locale.map((code) => this.resolveCanonicalLocale(code))
          : this.resolveCanonicalLocale(locale)
      )
    );
  }

  isSupersetLocale(superLocale: string, subLocale: string) {
    return _isSupersetLocale(
      this.resolveCanonicalLocale(superLocale),
      this.resolveCanonicalLocale(subLocale)
    );
  }
}
