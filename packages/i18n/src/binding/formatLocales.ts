import { getI18nConfig } from '../i18n-config/singleton-operations';

const EMPTY_LOCALES_PROP: string[] = [];

/**
 * Resolves the locale chain used to format variables (numbers, currencies,
 * dates): user-provided locales first, then the current locale, then the
 * default locale — or only the default locale when not translating.
 *
 * Shared by the framework bindings (gt-react via react-core, gt-vue).
 */
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

/**
 * Whether content should be translated for the given locale.
 */
export function getShouldTranslate({
  locale,
  enableI18n,
}: {
  locale: string;
  enableI18n: boolean;
}): boolean {
  return enableI18n && getI18nConfig().requiresTranslation(locale);
}
