import { LocaleConfig } from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import { libraryDefaultLocale } from 'generaltranslation/internal';

export type I18nConfigParams = {
  defaultLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
};

export class I18nConfig extends LocaleConfig {
  constructor({
    defaultLocale = libraryDefaultLocale,
    locales,
    customMapping,
  }: I18nConfigParams = {}) {
    const resolvedLocales = locales ?? [defaultLocale];

    super({
      defaultLocale,
      locales: Array.from(new Set([defaultLocale, ...resolvedLocales])),
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
