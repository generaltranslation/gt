import { getCustomLocaleCode, type CustomMapping } from './customLocaleMapping';
import { _isValidLocale } from './isValidLocale';

/**
 * Resolves the canonical locale for a given locale.
 * @param locale - The locale to resolve the canonical locale for
 * @param customMapping - The custom mapping to use for resolving the canonical locale
 * @returns The canonical locale, or the input locale when no canonical mapping exists.
 */
export function _resolveCanonicalLocale(
  locale: string,
  customMapping?: CustomMapping
): string {
  const customLocaleCode = getCustomLocaleCode(customMapping, locale);
  return customLocaleCode && _isValidLocale(customLocaleCode)
    ? customLocaleCode
    : locale;
}
