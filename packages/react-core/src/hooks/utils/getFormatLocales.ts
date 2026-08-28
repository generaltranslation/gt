import { getI18nConfig } from 'gt-i18n/internal';

// Pure helper shared by hook-based and RSC code paths. This module must stay
// free of hook/context imports so it can be reached from the components-rsc
// entrypoint.

const EMPTY_LOCALES_PROP: string[] = [];

type GetFormatLocalesParams = {
  locale: string;
  enableI18n: boolean;
  localesProp?: string[];
};

export function getFormatLocales({
  locale,
  enableI18n,
  localesProp = EMPTY_LOCALES_PROP,
}: GetFormatLocalesParams): string[] {
  const i18nConfig = getI18nConfig();
  const defaultLocale = i18nConfig.getDefaultLocale();
  const shouldTranslate = enableI18n && i18nConfig.requiresTranslation(locale);
  return shouldTranslate
    ? [...localesProp, locale, defaultLocale]
    : [defaultLocale];
}

export function getCanonicalFormatLocales(
  params: GetFormatLocalesParams
): string[] {
  const i18nConfig = getI18nConfig();
  const locales = getFormatLocales(params);
  return locales.map((locale) => i18nConfig.resolveCanonicalLocale(locale));
}
