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
  const shouldTranslate = getShouldTranslate({ locale, enableI18n });
  return shouldTranslate
    ? [...localesProp, locale, defaultLocale]
    : [defaultLocale];
}

export function getShouldTranslate({
  locale,
  enableI18n,
}: {
  locale: string;
  enableI18n: boolean;
}): boolean {
  return enableI18n && getI18nConfig().requiresTranslation(locale);
}
