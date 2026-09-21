import { isValidLocale } from 'generaltranslation';
import type { CustomMapping } from 'generaltranslation/types';

export function validateLocale(value: string, customMapping?: CustomMapping) {
  const locale = value.trim();
  if (!locale) return 'Enter a valid locale (e.g., en)';
  return (
    isValidLocale(locale, customMapping) || 'Enter a valid locale (e.g., en)'
  );
}

export function parseTypedLocale(value: string, customMapping?: CustomMapping) {
  const locale = value.trim();
  if (!locale) return null;
  return validateLocale(locale, customMapping) === true ? locale : null;
}

export function parseLocaleList(value: string) {
  return value.trim().split(/\s+/).filter(Boolean);
}

export function validateLocaleList(
  value: string,
  customMapping?: CustomMapping
) {
  const locales = parseLocaleList(value);
  if (locales.length === 0) {
    return 'Enter at least one locale';
  }
  for (const locale of locales) {
    if (!isValidLocale(locale, customMapping)) {
      return 'Enter a valid locale (e.g., es fr de)';
    }
  }
  return true;
}

export function parseGlobPatterns(value: string) {
  return value
    .split(/\s+/)
    .map((path) => path.trim())
    .filter(Boolean);
}
