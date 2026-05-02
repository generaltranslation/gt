import { shouldUseCanonicalLocale } from './customLocaleMapping';
import { CustomMapping } from './customLocaleMapping';

/**
 * Resolves the canonical locale for a custom alias.
 * @param locale - The locale to resolve.
 * @param customMapping - The custom mapping to inspect.
 * @returns The canonical locale, or the input locale when no canonical mapping exists.
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
