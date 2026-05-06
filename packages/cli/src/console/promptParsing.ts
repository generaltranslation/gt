import { gt } from '../utils/gt.js';

export function validateLocale(value: string) {
  const locale = value.trim();
  if (!locale) return 'Enter a valid locale (e.g., en)';
  return gt.isValidLocale(locale) || 'Enter a valid locale (e.g., en)';
}

export function parseTypedLocale(value: string) {
  const locale = value.trim();
  if (!locale) return null;
  return validateLocale(locale) === true ? locale : null;
}

export function parseLocaleList(value: string) {
  return value.trim().split(/\s+/).filter(Boolean);
}

export function validateLocaleList(value: string) {
  const locales = parseLocaleList(value);
  if (locales.length === 0) {
    return 'Enter at least one locale';
  }
  for (const locale of locales) {
    if (!gt.isValidLocale(locale)) {
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
