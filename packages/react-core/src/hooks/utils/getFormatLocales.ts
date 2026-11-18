import { getI18nConfig } from 'gt-i18n/internal';

// Pure helper shared by hook-based and RSC code paths. This module must stay
// free of hook/context imports so it can be reached from the components-rsc
// entrypoint.

const EMPTY_LOCALES_PROP: string[] = [];

/**
 * The locales a variable formats in: the `locales` prop as it is given, or
 * the locale its content renders in. Source content formats in the default
 * locale.
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
  const config = getI18nConfig();
  if (!enableI18n || !config.requiresTranslation({ locale })) {
    return [config.getDefaultLocale()];
  }
  return localesProp.length ? localesProp : [locale];
}
