import { LocaleConfig, standardizeLocale } from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { LocaleCandidates } from '../condition-store/localeResolver';

export type I18nConfigParams = {
  defaultLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
};

export class I18nConfig extends LocaleConfig {
  constructor(params: I18nConfigParams = {}, standardize = false) {
    super(standardizeI18nConfigParams(params, standardize));
  }

  getDefaultLocale(): string {
    return this.defaultLocale;
  }

  getLocales(): string[] {
    return this.locales;
  }

  getCustomMapping(): CustomMapping {
    return this.customMapping || {};
  }

  determineSupportedLocale(candidates: LocaleCandidates): string | undefined {
    if (
      candidates == null ||
      (Array.isArray(candidates) && candidates.length === 0)
    ) {
      return undefined;
    }
    return this.determineLocale(candidates);
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

  requiresDialectTranslation(locale: string): boolean {
    return (
      this.requiresTranslation(locale) &&
      this.isSameLanguage(this.getDefaultLocale(), locale)
    );
  }
}

function standardizeI18nConfigParams(
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
