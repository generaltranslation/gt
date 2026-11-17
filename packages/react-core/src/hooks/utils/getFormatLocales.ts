import { getI18nConfig } from 'gt-i18n/internal';

// Pure helper shared by hook-based and RSC code paths. This module must stay
// free of hook/context imports so it can be reached from the components-rsc
// entrypoint.

/**
 * The locale a variable formats in: the locale its content renders in.
 * Source content formats in the default locale.
 */
export function getFormatLocales({
  locale,
  enableI18n,
}: {
  locale: string;
  enableI18n: boolean;
}): string[] {
  const config = getI18nConfig();
  if (!enableI18n || !config.requiresTranslation({ locale })) {
    return [config.getDefaultLocale()];
  }
  return [locale];
}
