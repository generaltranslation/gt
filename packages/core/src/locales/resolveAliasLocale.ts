import { CustomMapping } from './customLocaleMapping';

/**
 * Resolves the alias locale for a given locale.
 * @param locale - The locale to resolve the alias locale for
 * @param customMapping - The custom mapping to use for resolving the alias locale
 * @returns The alias locale
 */
export function _resolveAliasLocale(
  locale: string,
  customMapping?: CustomMapping
): string {
  let reverseCustomMapping: Record<string, string> | undefined;
  if (customMapping) {
    reverseCustomMapping = Object.fromEntries(
      Object.entries(customMapping)
        .filter(
          ([_, value]) => value && typeof value === 'object' && 'code' in value
        )
        .map(([key, value]) => [(value as { code: string }).code, key])
    );
  }

  return reverseCustomMapping?.[locale] || locale;
}
