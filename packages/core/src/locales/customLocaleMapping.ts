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
