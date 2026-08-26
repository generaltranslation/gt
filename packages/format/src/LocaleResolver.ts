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
import type { CustomMapping } from './types';
import { _resolveAliasLocale } from './locales/resolveAliasLocale';
import { _resolveCanonicalLocale } from './locales/resolveCanonicalLocale';
import { getCustomLocaleCode } from './locales/customLocaleMapping';

export type LocaleResolverConstructorParams = {
  defaultLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
};

type LocaleResolutionScope = {
  approvedLocalePairs: { locale: string; canonicalLocale: string }[];
  canonicalMappingCodes: (string | undefined)[];
  approved: ApprovedLocales;
};

/** Locale metadata and resolution without value or message formatting. */
export class LocaleResolver {
  readonly defaultLocale: string;
  readonly locales: string[];
  readonly customMapping?: CustomMapping;
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
  }: LocaleResolverConstructorParams = {}) {
    this.defaultLocale = defaultLocale;
    this.locales = locales;
    this.customMapping = customMapping;
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
