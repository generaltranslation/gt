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
import { _determineLocale, type MatchLocale } from './locales/determineLocale';
import { _isSameLanguage } from './locales/isSameLanguage';
import { _getLocaleProperties } from './locales/getLocaleProperties';
import { _getLocaleEmoji } from './locales/getLocaleEmoji';
import { _isValidLocale, _standardizeLocale } from './locales/isValidLocale';
import { _getLocaleName } from './locales/getLocaleName';
import { _getLocaleDirection } from './locales/getLocaleDirection';
import {
  defaultLocaleMatcher,
  libraryDefaultLocale,
} from './settings/settings';
import { _isSameDialect } from './locales/isSameDialect';
import { _isSupersetLocale } from './locales/isSupersetLocale';
import type { FormatVariables } from './types';
import {
  snapshotLocaleConfig,
  type LocaleConfig,
  type LocaleMatcher,
} from './localeConfig';
import {
  getRegionProperties,
  type CustomRegionMapping,
} from './locales/getRegionProperties';
import { _resolveAliasLocale } from './locales/resolveAliasLocale';
import { _resolveCanonicalLocale } from './locales/resolveCanonicalLocale';
import type { CutoffFormatOptions } from './formatting/custom-formats/CutoffFormat/types';
import type { StringFormat } from './types-dir/jsx/content';

/** `locale` overrides the instance locale for one call. */
export type LocaleOption = {
  locale?: string;
};

/** `locales` replaces the whole formatting fallback list for one call. */
type WithLocales<T = object> = T &
  LocaleOption & {
    locales?: string | string[];
  };

function getCustomRegionMapping(
  customMapping: NonNullable<LocaleConfig['customMapping']>
): CustomRegionMapping {
  const customRegionMapping: CustomRegionMapping = {};
  for (const [locale, lp] of Object.entries(customMapping)) {
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
  return customRegionMapping;
}

function getMatchLocale(tag: string): MatchLocale {
  const locale = new Intl.Locale(tag);
  return {
    tag,
    language: locale.language,
    script: locale.maximize().script ?? '',
  };
}

/**
 * Approved-locales work that requiresTranslation and determineLocale would
 * otherwise redo on every call: the valid approved locales prepared for
 * matching, in approved order, plus the validated and indexed scope.
 */
type LocaleResolutionScope = {
  configuredLocales: (MatchLocale & {
    locale: string;
    canonicalLocale: string;
  })[];
  approved: ApprovedLocales;
};

/**
 * Formatting and locale helpers for a {@link LocaleConfig}, without
 * credentials. Every method takes the values it acts on positionally and an
 * optional options object last; `options.locale` overrides the instance
 * `locale` for one call, and the default locale is the fallback. The locale
 * description helpers (`getLocaleName`, `getLocaleProperties`,
 * `getLocaleEmoji`, `getLocaleDirection`) describe that target locale when
 * called without one, and name locales and regions in it. The configuration
 * is copied and frozen at construction.
 *
 * @example
 * const intl = new GTIntl({ defaultLocale: 'en', locales: ['en', 'es'] }, { locale: 'es' });
 * intl.formatNum(1234); // in es
 * intl.formatNum(1234, { locale: 'fr' }); // in fr
 */
export class GTIntl {
  readonly defaultLocale: string;
  readonly locales: readonly string[];
  readonly customMapping?: LocaleConfig['customMapping'];
  readonly localeMatcher: LocaleMatcher;
  readonly locale?: string;
  // Omitted locales mean no approved-locales restriction; an explicit empty
  // list approves none.
  private readonly approvedLocales?: readonly string[];
  // Built lazily so construction stays cheap for instances that never resolve
  // locales.
  private resolutionScope?: LocaleResolutionScope;
  private customRegionMapping?: ReturnType<typeof getCustomRegionMapping>;

  private getCustomRegionMapping() {
    if (!this.customMapping) return undefined;
    if (this.customRegionMapping) return this.customRegionMapping;
    const customRegionMapping = getCustomRegionMapping(this.customMapping);
    Object.defineProperty(this, 'customRegionMapping', {
      configurable: true,
      value: customRegionMapping,
      writable: true,
    });
    return customRegionMapping;
  }

  private getResolutionScope(): LocaleResolutionScope {
    if (this.resolutionScope) return this.resolutionScope;
    const resolutionScope = this.buildResolutionScope(this.locales);
    Object.defineProperty(this, 'resolutionScope', {
      configurable: true,
      value: resolutionScope,
      writable: true,
    });
    return resolutionScope;
  }

  private buildResolutionScope(
    approvedLocales: readonly string[]
  ): LocaleResolutionScope {
    const approvedLocalePairs = approvedLocales.map((locale) => {
      const canonicalLocale = this.resolveCanonicalLocale(locale);
      return {
        locale,
        canonicalLocale,
        // Normalize once with the prepared scope, not during every fallback
        // lookup over the configured list (the regression in #2067).
        standardizedLocale: _standardizeLocale(canonicalLocale),
      };
    });
    const approved = _prepareApprovedLocales(
      approvedLocalePairs.map(({ canonicalLocale }) => canonicalLocale),
      this.customMapping
    );
    // Reuse validation from the prepared scope instead of validating the entire
    // list again when callers supply a separate approved-locale array.
    const validCodes = new Set(
      Array.from(approved.byLanguage.values()).flatMap((codes) =>
        Array.from(codes)
      )
    );
    return {
      configuredLocales: approvedLocalePairs
        .filter(({ standardizedLocale }) => validCodes.has(standardizedLocale))
        .map(({ locale, canonicalLocale, standardizedLocale }) => ({
          locale,
          canonicalLocale,
          ...getMatchLocale(standardizedLocale),
        })),
      approved,
    };
  }

  constructor(localeConfig: LocaleConfig = {}, { locale }: LocaleOption = {}) {
    const { defaultLocale, locales, customMapping, localeMatcher } =
      snapshotLocaleConfig(localeConfig);
    this.defaultLocale = defaultLocale ?? libraryDefaultLocale;
    this.locales = locales ?? Object.freeze([]);
    this.approvedLocales = locales;
    this.customMapping = customMapping;
    this.localeMatcher = localeMatcher ?? defaultLocaleMatcher;
    this.locale = locale;
  }

  private getTargetLocale(options: LocaleOption): string {
    return options.locale || this.locale || this.defaultLocale;
  }

  private getFormattingLocales(
    locale: string | undefined,
    locales: string | string[] | undefined
  ) {
    return (
      locales === undefined
        ? [locale || this.locale, this.defaultLocale, libraryDefaultLocale]
        : Array.isArray(locales)
          ? locales
          : [locales]
    )
      .filter((locale): locale is string => !!locale)
      .map((locale) => this.resolveCanonicalLocale(locale));
  }

  formatNum(
    value: number,
    options: WithLocales<Intl.NumberFormatOptions> = {}
  ) {
    const { locale, locales, ...intlOptions } = options;
    return _formatNum({
      value,
      locales: this.getFormattingLocales(locale, locales),
      options: intlOptions,
    });
  }

  formatDateTime(
    value: Date,
    options: WithLocales<Intl.DateTimeFormatOptions> = {}
  ) {
    const { locale, locales, ...intlOptions } = options;
    return _formatDateTime({
      value,
      locales: this.getFormattingLocales(locale, locales),
      options: intlOptions,
    });
  }

  formatCurrency(
    value: number,
    currency: string,
    options: WithLocales<Intl.NumberFormatOptions> = {}
  ) {
    const { locale, locales, ...intlOptions } = options;
    return _formatCurrency({
      value,
      currency,
      locales: this.getFormattingLocales(locale, locales),
      options: intlOptions,
    });
  }

  formatRelativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options: WithLocales<Intl.RelativeTimeFormatOptions> = {}
  ) {
    const { locale, locales, ...intlOptions } = options;
    return _formatRelativeTime({
      value,
      unit,
      locales: this.getFormattingLocales(locale, locales),
      options: intlOptions,
    });
  }

  formatRelativeTimeFromDate(
    date: Date,
    options: WithLocales<
      Intl.RelativeTimeFormatOptions & { baseDate?: Date }
    > = {}
  ) {
    const { locale, locales, baseDate, ...intlOptions } = options;
    const { value, unit } = _selectRelativeTimeUnit(
      date,
      baseDate ?? new Date()
    );
    return _formatRelativeTime({
      value,
      unit,
      locales: this.getFormattingLocales(locale, locales),
      options: intlOptions,
    });
  }

  formatCutoff(value: string, options: WithLocales<CutoffFormatOptions> = {}) {
    const { locale, locales, ...formatOptions } = options;
    return intlCache
      .get(
        'CutoffFormat',
        this.getFormattingLocales(locale, locales),
        formatOptions
      )
      .format(value);
  }

  formatMessage(
    message: string,
    options: WithLocales<{
      variables?: FormatVariables;
      dataFormat?: StringFormat;
    }> = {}
  ) {
    const { locale, locales, variables, dataFormat } = options;
    if (dataFormat === 'STRING') return message;
    return _formatMessageICU(
      message,
      this.getFormattingLocales(locale, locales),
      variables
    );
  }

  formatList(
    array: Array<string | number>,
    options: WithLocales<Intl.ListFormatOptions> = {}
  ) {
    const { locale, locales, ...intlOptions } = options;
    return _formatList({
      value: array,
      locales: this.getFormattingLocales(locale, locales),
      options: intlOptions,
    });
  }

  formatListToParts<T>(
    array: Array<T>,
    options: WithLocales<Intl.ListFormatOptions> = {}
  ) {
    const { locale, locales, ...intlOptions } = options;
    return _formatListToParts<T>({
      value: array,
      locales: this.getFormattingLocales(locale, locales),
      options: intlOptions,
    });
  }

  /** The name of `locale` (default: the target locale), in the target locale. */
  getLocaleName(locale?: string, options: LocaleOption = {}) {
    const targetLocale = this.getTargetLocale(options);
    return _getLocaleName(
      locale || targetLocale,
      this.resolveCanonicalLocale(targetLocale),
      this.customMapping
    );
  }

  /** The emoji of `locale` (default: the target locale). */
  getLocaleEmoji(locale?: string, options: LocaleOption = {}) {
    return _getLocaleEmoji(
      locale || this.getTargetLocale(options),
      this.customMapping
    );
  }

  /**
   * The properties of `locale` (default: the target locale), with names in
   * the target locale.
   */
  getLocaleProperties(locale?: string, options: LocaleOption = {}) {
    const targetLocale = this.getTargetLocale(options);
    return _getLocaleProperties(
      locale || targetLocale,
      this.resolveCanonicalLocale(targetLocale),
      this.customMapping
    );
  }

  /**
   * Region code, name and emoji, with the name in the target locale. Names and
   * emojis from the `regionCode` entries of `customMapping` (the first locale
   * per region) take precedence.
   */
  getRegionProperties(region: string, options: LocaleOption = {}) {
    return getRegionProperties(
      region,
      this.resolveCanonicalLocale(this.getTargetLocale(options)),
      this.getCustomRegionMapping()
    );
  }

  /**
   * Whether content in `sourceLocale` (default: the default locale) needs
   * translating for the target locale, within `approvedLocales` (default: the
   * configured locales). Omitted locales mean no restriction; an empty list
   * approves no locale.
   */
  requiresTranslation(
    options: LocaleOption & {
      sourceLocale?: string;
      approvedLocales?: readonly string[];
    } = {}
  ) {
    const {
      sourceLocale = this.defaultLocale,
      approvedLocales = this.approvedLocales,
    } = options;
    // The default scope (this.locales) is prepared once per instance; a
    // caller-provided list is prepared for that call only.
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
      this.resolveCanonicalLocale(this.getTargetLocale(options)),
      approvedScope,
      this.customMapping
    );
  }

  /**
   * The best match for `locales` (in preference order) among
   * `approvedLocales` (default: the configured locales), under its approved
   * spelling, using the configured `localeMatcher`.
   */
  determineLocale(
    locales: string | string[],
    {
      approvedLocales = this.locales,
    }: { approvedLocales?: readonly string[] } = {}
  ) {
    const { configuredLocales } =
      approvedLocales === this.locales
        ? this.getResolutionScope()
        : this.buildResolutionScope(approvedLocales);
    const requestedLocales = (Array.isArray(locales) ? locales : [locales])
      .map((locale) => ({
        locale,
        canonicalLocale: this.resolveCanonicalLocale(locale),
      }))
      .filter(({ canonicalLocale }) => {
        try {
          // RFC 4647 §4.1: Lookup ignores extension and private-use subtags,
          // so only the base tag has to be valid.
          return _isValidLocale(
            new Intl.Locale(canonicalLocale).baseName,
            this.customMapping
          );
        } catch {
          return false;
        }
      })
      .map(({ locale, canonicalLocale }) => ({
        locale,
        ...getMatchLocale(_standardizeLocale(canonicalLocale)),
      }));
    const match = _determineLocale(
      requestedLocales,
      configuredLocales,
      this.localeMatcher
    );
    if (!match) return undefined;
    const { requested, available } = match;
    if (requested.tag !== available.tag) return available.locale;
    // Distinct configured aliases may share a canonical tag. For an exact
    // match, preserve the requested identity, then an exact mapped code,
    // before equivalent spellings.
    return (
      configuredLocales.find(({ locale }) => locale === requested.locale) ??
      configuredLocales.find(
        ({ canonicalLocale }) => canonicalLocale === available.tag
      ) ??
      available
    ).locale;
  }

  /** The text direction of `locale` (default: the target locale). */
  getLocaleDirection(locale?: string, options: LocaleOption = {}) {
    return _getLocaleDirection(
      this.resolveCanonicalLocale(locale || this.getTargetLocale(options))
    );
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

  /** Normalizes the spelling of `locale`; it does not resolve `customMapping` aliases. */
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
