import { LocaleProperties } from 'generaltranslation/types';

// helper function to replace locale placeholders in a string
// with the corresponding locale properties
// ex: {locale} -> will be replaced with the locale code
// ex: {localeName} -> will be replaced with the locale name
export function replaceLocalePlaceholders(
  string: string,
  localeProperties: LocaleProperties
): string {
  return string.replace(/\{(\w+)\}/g, (match, property) => {
    // Handle common aliases
    if (property === 'locale' || property === 'localeCode') {
      return localeProperties.code;
    }
    if (property === 'localeName') {
      return localeProperties.name;
    }
    if (property === 'localeNativeName') {
      return localeProperties.nativeName;
    }
    // Check if the property exists in localeProperties
    if (property in localeProperties) {
      return localeProperties[property as keyof typeof localeProperties];
    }
    // Return the original placeholder if property not found
    return match;
  });
}
