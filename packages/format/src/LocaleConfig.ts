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
import {
  _prepareApprovedLocales,
  type ApprovedLocales,
} from './locales/approvedLocales';
import { _requiresTranslationWithScope } from './locales/requiresTranslation';
import { _determineLocaleWithIndex } from './locales/determineLocale';
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
import { getCustomLocaleCode } from './locales/customLocaleMapping';
import type { CutoffFormatOptions } from './formatting/custom-formats/CutoffFormat/types';
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
 * Approved-locales work that requiresTranslation and determineLocale would
 * otherwise redo on every call: canonical codes plus the validated and
 * indexed scope built from them.
 */
type LocaleResolutionScope = {
  approvedLocalePairs: { locale: string; canonicalLocale: string }[];
  canonicalMappingCodes: (string | undefined)[];
  approved: ApprovedLocales;
};

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
  // Built lazily so construction stays cheap for instances that never resolve
  // locales. The snapshot is refreshed if callers mutate the public locale or
  // custom-mapping collections retained by this instance.
  private resolutionScope?: LocaleResolutionScope;

  private getResolutionScope(): LocaleResolutionScope {
    if (
      this.resolutionScope &&
      this.isResolutionScopeCurrent(this.resolutionScope)
    ) {
      return this.resolutionScope;
    }
    const resolutionScope = this.buildResolutionScope(this.locales);
    Object.defineProperty(this, 'resolutionScope', {
      configurable: true,
      value: resolutionScope,
      writable: true,
    });
    return resolutionScope;
  }

  private isResolutionScopeCurrent(scope: LocaleResolutionScope): boolean {
    if (scope.approvedLocalePairs.length !== this.locales.length) return false;
    for (let index = 0; index < this.locales.length; index++) {
      const locale = this.locales[index];
      const pair = scope.approvedLocalePairs[index];
      if (
        pair.locale !== locale ||
        pair.canonicalLocale !== this.resolveCanonicalLocale(locale) ||
        scope.canonicalMappingCodes[index] !==
          getCustomLocaleCode(this.customMapping, pair.canonicalLocale)
      ) {
        return false;
      }
    }
    return true;
  }

  private buildResolutionScope(
    approvedLocales: string[]
  ): LocaleResolutionScope {
    const approvedLocalePairs = approvedLocales.map((locale) => ({
      locale,
      canonicalLocale: this.resolveCanonicalLocale(locale),
    }));
    return {
      approvedLocalePairs,
      canonicalMappingCodes: approvedLocalePairs.map(({ canonicalLocale }) =>
        getCustomLocaleCode(this.customMapping, canonicalLocale)
      ),
      approved: _prepareApprovedLocales(
        approvedLocalePairs.map(({ canonicalLocale }) => canonicalLocale),
        this.customMapping
      ),
    };
  }

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
    // The default scope (this.locales) is prepared once per instance; a
    // caller-provided list is prepared for that call only. No configured
    // locales means no approved-locales restriction.
    const approvedScope = approvedLocales
      ? approvedLocales === this.locales
        ? this.getResolutionScope().approved
        : _prepareApprovedLocales(
            approvedLocales.map((locale) =>
              this.resolveCanonicalLocale(locale)
            ),
            this.customMapping
          )
      : undefined;
    return _requiresTranslationWithScope(
      this.resolveCanonicalLocale(sourceLocale),
      this.resolveCanonicalLocale(targetLocale),
      approvedScope,
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
    const { approvedLocalePairs, approved } =
      approvedLocales === this.locales
        ? this.getResolutionScope()
        : this.buildResolutionScope(approvedLocales);
    const resolvedLocale = _determineLocaleWithIndex(
      Array.isArray(locales)
        ? locales.map((locale) => this.resolveCanonicalLocale(locale))
        : this.resolveCanonicalLocale(locales),
      approved,
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
