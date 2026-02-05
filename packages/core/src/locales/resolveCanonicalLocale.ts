import { shouldUseCanonicalLocale } from './customLocaleMapping';
import { CustomMapping } from './customLocaleMapping';

/**
 * Resolves the canonical locale for a given locale.
 * @param locale - The locale to resolve the canonical locale for
 * @param customMapping - The custom mapping to use for resolving the canonical locale
 * @returns The canonical locale
 */
export function _resolveCanonicalLocale(
  locale: string,
  customMapping?: CustomMapping
): string {
  if (customMapping && shouldUseCanonicalLocale(locale, customMapping)) {
    return (customMapping[locale] as { code: string }).code;
  }

  return locale;
}
