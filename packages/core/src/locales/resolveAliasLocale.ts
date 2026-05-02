import { CustomMapping } from './customLocaleMapping';

/**
 * Resolves the alias locale for a canonical locale.
 * @param locale - The canonical locale to resolve.
 * @param customMapping - The custom mapping to inspect.
 * @returns The alias locale, or the input locale when no alias exists.
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
          ([, value]) => value && typeof value === 'object' && 'code' in value
        )
        .map(([key, value]) => [(value as { code: string }).code, key])
    );
  }

  return reverseCustomMapping?.[locale] || locale;
}
