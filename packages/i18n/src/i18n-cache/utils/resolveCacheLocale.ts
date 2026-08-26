import { getI18nConfig } from '../../i18n-config/singleton-operations';

export function resolveLocale(locale: string): string {
  const i18nConfig = getI18nConfig();
  const resolvedLocale = i18nConfig.determineLocale(locale);
  if (!i18nConfig.isValidLocale(locale) || !resolvedLocale) {
    throw new Error(
      `Locale "${locale}" is not valid. Use a valid BCP 47 locale code or add a custom mapping.`
    );
  }
  return resolvedLocale;
}

export function resolveCacheLocale(locale: string): string | undefined {
  const resolvedLocale = resolveLocale(locale);
  const i18nConfig = getI18nConfig();
  if (i18nConfig.requiresTranslation(resolvedLocale)) {
    return resolvedLocale;
  }

  const aliasLocale = i18nConfig.resolveAliasLocale(
    i18nConfig.standardizeLocale(locale)
  );
  if (i18nConfig.requiresTranslation(aliasLocale)) {
    return aliasLocale;
  }
}
