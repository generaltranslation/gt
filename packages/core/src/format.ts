// `generaltranslation` language toolkit
// © 2026, General Translation, Inc.

import _requiresTranslation from './locales/requiresTranslation';
import _determineLocale from './locales/determineLocale';
import {
  _formatNum,
  _formatCurrency,
  _formatList,
  _formatRelativeTime,
  _formatRelativeTimeFromDate,
  _formatDateTime,
  _formatListToParts,
  _formatCutoff,
  _formatMessageICU,
  _formatMessageString,
} from './formatting/format';
import { CustomMapping, FormatVariables } from './types';
import _isSameLanguage from './locales/isSameLanguage';
import _getLocaleProperties, {
  LocaleProperties,
} from './locales/getLocaleProperties';
import _getLocaleEmoji from './locales/getLocaleEmoji';
import { _isValidLocale, _standardizeLocale } from './locales/isValidLocale';
import { _getLocaleName } from './locales/getLocaleName';
import { _getLocaleDirection } from './locales/getLocaleDirection';
import { libraryDefaultLocale } from './internal';
import _isSameDialect from './locales/isSameDialect';
import _isSupersetLocale from './locales/isSupersetLocale';
import {
  noSourceLocaleProvidedError,
  noTargetLocaleProvidedError,
  invalidLocaleError,
  invalidLocalesError,
} from './logging/errors';
import {
  _getRegionProperties,
  CustomRegionMapping,
} from './locales/getRegionProperties';
import { _resolveAliasLocale } from './locales/resolveAliasLocale';
import { _resolveCanonicalLocale } from './locales/resolveCanonicalLocale';
import { CutoffFormatOptions } from './formatting/custom-formats/CutoffFormat/types';
import { StringFormat } from './types-dir/jsx/content';

/**
 * Type representing the constructor parameters for the GTFormatter class.
 */
export type GTFormatterConstructorParams = {
  sourceLocale?: string;
  targetLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
};

/**
 * GTFormatter is a lightweight class for locale management and formatting.
 * It provides all formatting and locale utility methods without the API client overhead.
 * Use this instead of GT on the client side to reduce bundle size.
 *
 * @class GTFormatter
 */
export class GTFormatter {
  /** Source locale for translations */
  sourceLocale?: string;

  /** Target locale for translations */
  targetLocale?: string;

  /** Array of supported locales */
  locales?: string[];

  /** Array of locales used for rendering variables */
  _renderingLocales: string[] = [];

  /** Custom mapping for locale codes to their names */
  customMapping?: CustomMapping;

  /** Lazily derived reverse custom mapping for alias locales */
  reverseCustomMapping?: Record<string, string>;

  /** Lazily derived custom mapping for regions */
  customRegionMapping?: CustomRegionMapping;

  constructor(params: GTFormatterConstructorParams = {}) {
    this.setConfig(params);
  }

  setConfig({
    sourceLocale,
    targetLocale,
    locales,
    customMapping,
  }: GTFormatterConstructorParams) {
    // ----- Standardize locales ----- //

    // source locale
    if (sourceLocale) {
      this.sourceLocale = _standardizeLocale(sourceLocale);
      if (!_isValidLocale(this.sourceLocale, customMapping))
        throw new Error(invalidLocaleError(this.sourceLocale));
    }

    // target locale
    if (targetLocale) {
      this.targetLocale = _standardizeLocale(targetLocale);
      if (!_isValidLocale(this.targetLocale, customMapping))
        throw new Error(invalidLocaleError(this.targetLocale));
    }

    // rendering locales
    this._renderingLocales = [];
    if (this.sourceLocale) this._renderingLocales.push(this.sourceLocale);
    if (this.targetLocale) this._renderingLocales.push(this.targetLocale);
    this._renderingLocales.push(libraryDefaultLocale);

    // locales
    if (locales) {
      const result: string[] = [];
      const invalidLocales: string[] = [];
      locales.forEach((locale) => {
        const standardizedLocale = _standardizeLocale(locale);
        if (_isValidLocale(standardizedLocale)) {
          result.push(standardizedLocale);
        } else {
          invalidLocales.push(locale);
        }
      });
      if (invalidLocales.length > 0) {
        throw new Error(invalidLocalesError(invalidLocales));
      }
      this.locales = result;
    }

    // ----- Other properties ----- //
    if (customMapping) {
      this.customMapping = customMapping;
      this.reverseCustomMapping = Object.fromEntries(
        Object.entries(customMapping)
          .filter(
            ([, value]) => value && typeof value === 'object' && 'code' in value
          )
          .map(([key, value]) => [(value as { code: string }).code, key])
      );
    }
  }

  // -------------- Formatting -------------- //

  formatCutoff(
    value: string,
    options?: {
      locales?: string | string[];
    } & CutoffFormatOptions
  ): string {
    return _formatCutoff({
      value,
      locales: options?.locales || this._renderingLocales,
      options,
    });
  }

  formatMessage(
    message: string,
    options?: {
      locales?: string | string[];
      variables?: FormatVariables;
      dataFormat?: StringFormat;
    }
  ): string {
    if (options?.dataFormat === 'STRING') return _formatMessageString(message);
    return _formatMessageICU(
      message,
      options?.locales || this._renderingLocales,
      options?.variables
    );
  }

  formatNum(
    number: number,
    options?: {
      locales?: string | string[];
    } & Intl.NumberFormatOptions
  ): string {
    return _formatNum({
      value: number,
      locales: options?.locales || this._renderingLocales,
      options,
    });
  }

  formatDateTime(
    date: Date,
    options?: {
      locales?: string | string[];
    } & Intl.DateTimeFormatOptions
  ): string {
    return _formatDateTime({
      value: date,
      locales: options?.locales || this._renderingLocales,
      options,
    });
  }

  formatCurrency(
    value: number,
    currency: string,
    options?: {
      locales?: string | string[];
    } & Intl.NumberFormatOptions
  ): string {
    return _formatCurrency({
      value,
      currency,
      locales: options?.locales || this._renderingLocales,
      options,
    });
  }

  formatList(
    array: Array<string | number>,
    options?: {
      locales?: string | string[];
    } & Intl.ListFormatOptions
  ) {
    return _formatList({
      value: array,
      locales: options?.locales || this._renderingLocales,
      options,
    });
  }

  formatListToParts<T>(
    array: Array<T>,
    options?: {
      locales?: string | string[];
    } & Intl.ListFormatOptions
  ): Array<T | string> {
    return _formatListToParts<T>({
      value: array,
      locales: options?.locales || this._renderingLocales,
      options,
    });
  }

  formatRelativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options?: {
      locales?: string | string[];
    } & Omit<Intl.RelativeTimeFormatOptions, 'locales'>
  ): string {
    return _formatRelativeTime({
      value,
      unit,
      locales: options?.locales || this._renderingLocales,
      options,
    });
  }

  formatRelativeTimeFromDate(
    date: Date,
    options?: {
      locales?: string | string[];
      baseDate?: Date;
    } & Omit<Intl.RelativeTimeFormatOptions, 'locales'>
  ): string {
    const { locales, baseDate, ...intlOptions } = options || {};
    return _formatRelativeTimeFromDate({
      date,
      baseDate: baseDate ?? new Date(),
      locales: locales || this._renderingLocales,
      options: intlOptions,
    });
  }

  // -------------- Locale Properties -------------- //

  getLocaleName(locale = this.targetLocale): string {
    if (!locale) throw new Error(noTargetLocaleProvidedError('getLocaleName'));
    return _getLocaleName(locale, this.sourceLocale, this.customMapping);
  }

  getLocaleEmoji(locale = this.targetLocale): string {
    if (!locale) throw new Error(noTargetLocaleProvidedError('getLocaleEmoji'));
    return _getLocaleEmoji(locale, this.customMapping);
  }

  getLocaleProperties(locale = this.targetLocale): LocaleProperties {
    if (!locale)
      throw new Error(noTargetLocaleProvidedError('getLocaleProperties'));
    return _getLocaleProperties(locale, this.sourceLocale, this.customMapping);
  }

  getRegionProperties(
    region = this.getLocaleProperties().regionCode,
    customMapping?: CustomRegionMapping
  ): { code: string; name: string; emoji: string } {
    if (!customMapping) {
      if (this.customMapping && !this.customRegionMapping) {
        const customRegionMapping: CustomRegionMapping = {};
        for (const [locale, lp] of Object.entries(this.customMapping)) {
          if (
            lp &&
            typeof lp === 'object' &&
            lp.regionCode &&
            !customRegionMapping[lp.regionCode]
          ) {
            const { regionName: name, emoji } = lp;
            customRegionMapping[lp.regionCode] = {
              locale,
              ...(name && { name }),
              ...(emoji && { emoji }),
            };
          }
        }
        this.customRegionMapping = customRegionMapping;
      }
      customMapping = this.customRegionMapping;
    }
    return _getRegionProperties(region, this.targetLocale, customMapping);
  }

  requiresTranslation(
    sourceLocale = this.sourceLocale,
    targetLocale = this.targetLocale,
    approvedLocales: string[] | undefined = this.locales,
    customMapping: CustomMapping | undefined = this.customMapping
  ): boolean {
    if (!sourceLocale)
      throw new Error(noSourceLocaleProvidedError('requiresTranslation'));
    if (!targetLocale)
      throw new Error(noTargetLocaleProvidedError('requiresTranslation'));
    return _requiresTranslation(
      sourceLocale,
      targetLocale,
      approvedLocales,
      customMapping
    );
  }

  determineLocale(
    locales: string | string[],
    approvedLocales: string[] | undefined = this.locales || [],
    customMapping: CustomMapping | undefined = this.customMapping
  ): string | undefined {
    return _determineLocale(locales, approvedLocales, customMapping);
  }

  getLocaleDirection(locale = this.targetLocale): 'ltr' | 'rtl' {
    if (!locale)
      throw new Error(noTargetLocaleProvidedError('getLocaleDirection'));
    return _getLocaleDirection(locale);
  }

  isValidLocale(
    locale = this.targetLocale,
    customMapping: CustomMapping | undefined = this.customMapping
  ): boolean {
    if (!locale) throw new Error(noTargetLocaleProvidedError('isValidLocale'));
    return _isValidLocale(locale, customMapping);
  }

  resolveCanonicalLocale(
    locale: string | undefined = this.targetLocale,
    customMapping: CustomMapping | undefined = this.customMapping
  ): string {
    if (!locale)
      throw new Error(noTargetLocaleProvidedError('resolveCanonicalLocale'));
    return _resolveCanonicalLocale(locale, customMapping);
  }

  resolveAliasLocale(
    locale: string,
    customMapping: CustomMapping | undefined = this.customMapping
  ): string {
    if (!locale)
      throw new Error(noTargetLocaleProvidedError('resolveAliasLocale'));
    return _resolveAliasLocale(locale, customMapping);
  }

  standardizeLocale(locale = this.targetLocale): string {
    if (!locale)
      throw new Error(noTargetLocaleProvidedError('standardizeLocale'));
    return _standardizeLocale(locale);
  }

  isSameDialect(...locales: (string | string[])[]): boolean {
    return _isSameDialect(...locales);
  }

  isSameLanguage(...locales: (string | string[])[]): boolean {
    return _isSameLanguage(...locales);
  }

  isSupersetLocale(superLocale: string, subLocale: string): boolean {
    return _isSupersetLocale(superLocale, subLocale);
  }
}

// ============================================================ //
//                    Standalone utility functions               //
// ============================================================ //

export function formatCutoff(
  value: string,
  options?: {
    locales?: string | string[];
  } & CutoffFormatOptions
): string {
  return _formatCutoff({ value, locales: options?.locales, options });
}

export function formatMessage(
  message: string,
  options?: {
    locales?: string | string[];
    variables?: FormatVariables;
    dataFormat?: StringFormat;
  }
): string {
  switch (options?.dataFormat) {
    case 'STRING':
      return _formatMessageString(message);
    default:
      return _formatMessageICU(message, options?.locales, options?.variables);
  }
}

export function formatNum(
  number: number,
  options: {
    locales: string | string[];
  } & Intl.NumberFormatOptions
): string {
  return _formatNum({
    value: number,
    locales: options.locales,
    options,
  });
}

export function formatDateTime(
  date: Date,
  options?: {
    locales?: string | string[];
  } & Intl.DateTimeFormatOptions
): string {
  return _formatDateTime({
    value: date,
    locales: options?.locales,
    options,
  });
}

export function formatCurrency(
  value: number,
  currency: string,
  options: {
    locales: string | string[];
  } & Intl.NumberFormatOptions
): string {
  return _formatCurrency({
    value,
    currency,
    locales: options.locales,
    options,
  });
}

export function formatList(
  array: Array<string | number>,
  options: {
    locales: string | string[];
  } & Intl.ListFormatOptions
): string {
  return _formatList({
    value: array,
    locales: options.locales,
    options,
  });
}

export function formatListToParts<T>(
  array: Array<T>,
  options?: {
    locales?: string | string[];
  } & Intl.ListFormatOptions
): Array<T | string> {
  return _formatListToParts<T>({
    value: array,
    locales: options?.locales,
    options: options,
  });
}

export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options: {
    locales: string | string[];
  } & Omit<Intl.RelativeTimeFormatOptions, 'locales'>
): string {
  return _formatRelativeTime({
    value,
    unit,
    locales: options.locales,
    options,
  });
}

export function formatRelativeTimeFromDate(
  date: Date,
  options: {
    locales: string | string[];
    baseDate?: Date;
  } & Omit<Intl.RelativeTimeFormatOptions, 'locales'>
): string {
  const { locales, baseDate, ...intlOptions } = options;
  return _formatRelativeTimeFromDate({
    date,
    baseDate: baseDate ?? new Date(),
    locales,
    options: intlOptions,
  });
}

export function getLocaleName(
  locale: string,
  defaultLocale?: string,
  customMapping?: CustomMapping
): string {
  return _getLocaleName(locale, defaultLocale, customMapping);
}

export function getLocaleEmoji(
  locale: string,
  customMapping?: CustomMapping
): string {
  return _getLocaleEmoji(locale, customMapping);
}

export function getLocaleProperties(
  locale: string,
  defaultLocale?: string,
  customMapping?: CustomMapping
): LocaleProperties {
  return _getLocaleProperties(locale, defaultLocale, customMapping);
}

export function getRegionProperties(
  region: string,
  defaultLocale?: string,
  customMapping?: CustomRegionMapping
): { code: string; name: string; emoji: string } {
  return _getRegionProperties(region, defaultLocale, customMapping);
}

export function requiresTranslation(
  sourceLocale: string,
  targetLocale: string,
  approvedLocales?: string[],
  customMapping?: CustomMapping
): boolean {
  return _requiresTranslation(
    sourceLocale,
    targetLocale,
    approvedLocales,
    customMapping
  );
}

export function determineLocale(
  locales: string | string[],
  approvedLocales: string[] | undefined = [],
  customMapping: CustomMapping | undefined = undefined
): string | undefined {
  return _determineLocale(locales, approvedLocales, customMapping);
}

export function getLocaleDirection(locale: string): 'ltr' | 'rtl' {
  return _getLocaleDirection(locale);
}

export function isValidLocale(
  locale: string,
  customMapping?: CustomMapping
): boolean {
  return _isValidLocale(locale, customMapping);
}

export function resolveAliasLocale(
  locale: string,
  customMapping?: CustomMapping
): string {
  return _resolveAliasLocale(locale, customMapping);
}

export function resolveCanonicalLocale(
  locale: string,
  customMapping?: CustomMapping
): string {
  return _resolveCanonicalLocale(locale, customMapping);
}

export function standardizeLocale(locale: string): string {
  return _standardizeLocale(locale);
}

export function isSameDialect(...locales: (string | string[])[]): boolean {
  return _isSameDialect(...locales);
}

export function isSameLanguage(...locales: (string | string[])[]): boolean {
  return _isSameLanguage(...locales);
}

export function isSupersetLocale(
  superLocale: string,
  subLocale: string
): boolean {
  return _isSupersetLocale(superLocale, subLocale);
}
