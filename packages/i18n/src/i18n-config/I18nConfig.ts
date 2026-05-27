import { LocaleConfig } from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { LocaleCandidates } from '../condition-store/localeResolver';
import { validateI18nConfigParams } from './validation';

export type I18nConfigParams = {
  defaultLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
  projectId?: string;
  devApiKey?: string;
  apiKey?: string;
  cacheUrl?: string | null;
  runtimeUrl?: string | null;
};

export class I18nConfig extends LocaleConfig {
  constructor(params: I18nConfigParams = {}) {
    const {
      defaultLocale = libraryDefaultLocale,
      locales = [defaultLocale],
      customMapping,
    } = params;

    validateI18nConfigParams({
      ...params,
      defaultLocale,
      locales,
      customMapping,
    });

    super({
      defaultLocale,
      locales: Array.from(new Set([defaultLocale, ...locales])),
      customMapping: customMapping || {},
    });
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
