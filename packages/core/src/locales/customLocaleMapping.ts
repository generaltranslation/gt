import { LocaleProperties } from './getLocaleProperties';

export type CustomMapping = Record<string, string | LocaleProperties>;

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
