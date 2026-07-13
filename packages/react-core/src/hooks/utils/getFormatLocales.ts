import { getI18nConfig } from 'gt-i18n/internal';

// Pure helper shared by hook-based and RSC code paths. This module must stay
// free of hook/context imports so it can be reached from the components-rsc
// entrypoint.

const EMPTY_LOCALES_PROP: string[] = [];

export function getFormatLocales({
  locale,
  enableI18n,
  localesProp = EMPTY_LOCALES_PROP,
}: {
  locale: string;
  enableI18n: boolean;
  localesProp?: string[];
}): string[] {
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate =
    enableI18n && getI18nConfig().requiresTranslation(locale);
  return shouldTranslate
    ? [...localesProp, locale, defaultLocale]
    : [defaultLocale];
}
