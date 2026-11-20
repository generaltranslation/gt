import { getI18nConfig } from 'gt-i18n/internal';

// Pure helper shared by hook-based and RSC code paths. This module must stay
// free of hook/context imports so it can be reached from the components-rsc
// entrypoint.

/**
 * The locales a variable formats in: the locale its content renders in, then
 * the default locale, which `Intl` formats in when it has no data for the
 * first. Source content formats in the default locale.
 */
export function getFormatLocales({
  locale,
  enableI18n,
}: {
  locale: string;
  enableI18n: boolean;
}): string[] {
  const config = getI18nConfig();
  const defaultLocale = config.getDefaultLocale();
  if (!enableI18n || !config.requiresTranslation({ locale })) {
    return [defaultLocale];
  }
  return [locale, defaultLocale];
}
