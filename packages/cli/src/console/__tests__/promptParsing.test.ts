import { describe, expect, it } from 'vitest';
import {
  parseGlobPatterns,
  parseLocaleList,
  parseTypedLocale,
  validateLocale,
  validateLocaleList,
} from '../promptParsing.js';

describe('prompt parsing', () => {
  it('splits locale lists on whitespace', () => {
    expect(parseLocaleList(' es\tfr\n de  ')).toEqual(['es', 'fr', 'de']);
  });

  it('validates locale lists', () => {
    expect(validateLocale('en')).toBe(true);
    expect(validateLocale('not_a_locale')).toBe(
      'Enter a valid locale (e.g., en)'
    );
    expect(validateLocaleList('es fr de')).toBe(true);
    expect(validateLocaleList('')).toBe('Enter at least one locale');
    expect(validateLocaleList('es not_a_locale')).toBe(
      'Enter a valid locale (e.g., es fr de)'
    );
  });

  it('parses typed locale tags without remapping them', () => {
    expect(parseTypedLocale(' zh-Hans-CN ')).toBe('zh-Hans-CN');
    expect(parseTypedLocale('')).toBeNull();
    expect(parseTypedLocale('   ')).toBeNull();
    expect(parseTypedLocale('not_a_locale')).toBeNull();
  });

  it('splits glob patterns on whitespace only', () => {
    expect(
      parseGlobPatterns('./{app,pages}/[locale]/*.json ./docs/[locale]/*.md')
    ).toEqual(['./{app,pages}/[locale]/*.json', './docs/[locale]/*.md']);
    expect(parseGlobPatterns('./{app,pages}/[locale]/*.json')).toEqual([
      './{app,pages}/[locale]/*.json',
    ]);
  });
});
