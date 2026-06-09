import { getI18nConfig } from 'gt-i18n/internal';

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
