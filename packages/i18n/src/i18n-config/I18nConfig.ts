import { LocaleConfig } from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import { libraryDefaultLocale } from 'generaltranslation/internal';
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
}
