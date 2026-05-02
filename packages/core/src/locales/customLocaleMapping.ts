import { LocaleProperties } from './getLocaleProperties';
import { _isValidLocale } from './isValidLocale';

export type FullCustomMapping = Record<string, LocaleProperties>;
export type CustomMapping = Record<string, string | Partial<LocaleProperties>>;

export const getCustomProperty = (
  customMapping: CustomMapping,
  locale: string,
  property: keyof LocaleProperties
): string | undefined => {
  if (customMapping?.[locale]) {
    if (typeof customMapping[locale] === 'string') {
      return property === 'name' ? customMapping[locale] : undefined;
    }
    return customMapping[locale][property];
  }
  return undefined;
};

/**
 * Checks whether a custom locale entry points to a valid canonical locale.
 * @param locale - The locale to check.
 * @param customMapping - The custom mapping to inspect.
 * @returns True if the locale should resolve to its canonical code.
 */
export const shouldUseCanonicalLocale = (
  locale: string,
  customMapping: CustomMapping
): boolean => {
  return !!(
    customMapping?.[locale] &&
    typeof customMapping[locale] === 'object' &&
    'code' in (customMapping[locale] as Object) &&
    (customMapping[locale] as { code: string }).code &&
    _isValidLocale((customMapping[locale] as { code: string }).code)
  );
};
