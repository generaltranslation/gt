import { getCustomLocaleCode, type CustomMapping } from './customLocaleMapping';

/**
 * Resolves the alias locale for a given locale.
 * @param locale - The locale to resolve the alias locale for
 * @param customMapping - The custom mapping to use for resolving the alias locale
 * @returns The configured alias for a canonical locale, or the input locale when already an alias or no alias mapping exists.
 */
export function _resolveAliasLocale(
  locale: string,
  customMapping?: CustomMapping
): string {
  if (!customMapping) return locale;

  return (
    Object.keys(customMapping).find(
      (alias) => getCustomLocaleCode(customMapping, alias) === locale
    ) ?? locale
  );
}
