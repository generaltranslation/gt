import { LocaleConfig, standardizeLocale } from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { LocaleCandidates } from '../condition-store/localeResolver';

export type I18nConfigParams = {
  defaultLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
};

export class I18nConfig {
  private localeConfig: LocaleConfig;

  constructor(params: I18nConfigParams = {}) {
    this.localeConfig = new LocaleConfig(standardizeI18nConfigParams(params));
  }

  getDefaultLocale(): string {
    return this.localeConfig.defaultLocale;
  }

  getLocales(): string[] {
    return this.localeConfig.locales;
  }

  getCustomMapping(): CustomMapping {
    return this.localeConfig.customMapping || {};
  }

  isValidLocale(locale: string): boolean {
    return this.localeConfig.isValidLocale(locale);
  }

  determineSupportedLocale(candidates: LocaleCandidates): string | undefined {
    if (
      candidates == null ||
      (Array.isArray(candidates) && candidates.length === 0)
    ) {
      return undefined;
    }
    return this.localeConfig.determineLocale(candidates);
  }

  resolveSupportedLocale(candidates?: LocaleCandidates): string {
    return this.determineSupportedLocale(candidates) || this.getDefaultLocale();
  }

  resolveLocale(locale: string): string {
    const resolvedLocale = this.determineSupportedLocale(locale);
    if (!this.isValidLocale(locale) || !resolvedLocale) {
      throw new Error(
        `Locale "${locale}" is not valid. Use a valid BCP 47 locale code or add a custom mapping.`
      );
    }
    return resolvedLocale;
  }

  requiresTranslation(locale: string): boolean {
    return this.localeConfig.requiresTranslation(locale);
  }

  requiresDialectTranslation(locale: string): boolean {
    return (
      this.requiresTranslation(locale) &&
      this.localeConfig.isSameLanguage(this.getDefaultLocale(), locale)
    );
  }

  getLocaleProperties(locale: string) {
    return this.localeConfig.getLocaleProperties(locale);
  }

  getLocaleName(locale: string) {
    return this.localeConfig.getLocaleName(locale);
  }

  getLocaleEmoji(locale: string) {
    return this.localeConfig.getLocaleEmoji(locale);
  }

  getLocaleDirection(locale: string) {
    return this.localeConfig.getLocaleDirection(locale);
  }

  resolveCanonicalLocale(locale: string): string {
    return this.localeConfig.resolveCanonicalLocale(locale);
  }

  resolveAliasLocale(locale: string): string {
    return this.localeConfig.resolveAliasLocale(locale);
  }

  standardizeLocale(locale: string): string {
    return this.localeConfig.standardizeLocale(locale);
  }
}

export function standardizeI18nConfigParams(
  {
    defaultLocale = libraryDefaultLocale,
    locales = [libraryDefaultLocale],
    customMapping,
  }: I18nConfigParams = {},
  standardize = false
): Required<I18nConfigParams> {
  const dedupedConfig: Required<I18nConfigParams> = {
    defaultLocale,
    locales: Array.from(new Set([defaultLocale, ...locales])),
    customMapping: customMapping || {},
  };
  if (!standardize) return dedupedConfig;

  return {
    defaultLocale: standardizeLocale(dedupedConfig.defaultLocale),
    locales: dedupedConfig.locales.map((locale) => {
      const mappedLocale =
        typeof dedupedConfig.customMapping[locale] === 'string'
          ? dedupedConfig.customMapping[locale]
          : dedupedConfig.customMapping[locale]?.code;
      return mappedLocale ? locale : standardizeLocale(locale);
    }),
    customMapping: Object.fromEntries(
      Object.entries(dedupedConfig.customMapping).map(([key, value]) => [
        key,
        typeof value === 'string'
          ? standardizeLocale(value)
          : {
              ...value,
              ...(value?.code ? { code: standardizeLocale(value.code) } : {}),
            },
      ])
    ),
  };
}
