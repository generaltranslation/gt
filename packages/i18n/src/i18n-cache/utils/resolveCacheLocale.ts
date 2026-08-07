import { getI18nConfig } from '../../i18n-config/singleton-operations';
import type { LookupOptions } from '../../translation-functions/types/options';

export function resolveCacheLocale(locale: string): string | undefined {
  const i18nConfig = getI18nConfig();
  const resolvedLocale = i18nConfig.resolveLocale(locale);
  if (i18nConfig.requiresTranslation(resolvedLocale)) {
    return resolvedLocale;
  }

  const aliasLocale = i18nConfig.resolveAliasLocale(
    i18nConfig.standardizeLocale(locale)
  );
  return i18nConfig.requiresTranslation(aliasLocale) ? aliasLocale : undefined;
}

export function resolveDictionaryCacheLocale(locale: string): string {
  return resolveCacheLocale(locale) ?? getI18nConfig().getDefaultLocale();
}

export function resolveLookupParams(locale: string, options: LookupOptions) {
  const translationLocale = resolveCacheLocale(locale);
  return {
    translationLocale,
    options:
      translationLocale && options.$locale
        ? { ...options, $locale: translationLocale }
        : options,
  };
}
