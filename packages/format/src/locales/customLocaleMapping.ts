import type { LocaleProperties } from './getLocaleProperties';

export type CustomMapping = Record<string, string | Partial<LocaleProperties>>;

function isCustomLocaleObject(
  value: CustomMapping[string] | null | undefined
): value is Partial<LocaleProperties> {
  return typeof value === 'object' && value !== null;
}

export const getCustomProperty = (
  customMapping: CustomMapping,
  locale: string,
  property: keyof LocaleProperties
) => {
  const value = customMapping?.[locale];
  if (!value) return undefined;
  if (typeof value === 'string') {
    return property === 'name' ? value : undefined;
  }
  return value[property];
};

export const getCustomLocaleCode = (
  customMapping: CustomMapping | undefined,
  locale: string
) => {
  const value = customMapping?.[locale];
  return isCustomLocaleObject(value) && typeof value.code === 'string'
    ? value.code
    : undefined;
};
