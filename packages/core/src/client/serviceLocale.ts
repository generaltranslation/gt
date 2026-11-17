import {
  resolveCanonicalLocale,
  standardizeLocale,
  type CustomMapping,
} from '@generaltranslation/format';

/**
 * @internal
 * Mapping resolves aliases; standardization also canonicalizes configured
 * spellings such as en-us before they cross the service boundary.
 */
export function resolveServiceLocale(
  locale: string,
  customMapping: CustomMapping | undefined
): string {
  return standardizeLocale(resolveCanonicalLocale(locale, customMapping));
}
