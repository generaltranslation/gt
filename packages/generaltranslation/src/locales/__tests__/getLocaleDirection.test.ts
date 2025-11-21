import { describe, it, expect } from 'vitest';
import { _getLocaleDirection } from '../getLocaleDirection';

describe('_getLocaleDirection', () => {
  it('should return ltr for left-to-right languages', () => {
    const ltrLocales = [
      'en',
      'en-US',
      'fr-FR',
      'de-DE',
      'es-ES',
      'it-IT',
      'ja-JP',
      'zh-CN',
    ];

    for (const locale of ltrLocales) {
      const result = _getLocaleDirection(locale);
      expect(result).toBe('ltr');
    }
  });

  it('should return rtl for right-to-left languages', () => {
    const rtlLocales = [
      'ar',
      'ar-SA',
      'he',
      'he-IL',
      'fa',
      'fa-IR',
      'ur',
      'ur-PK',
    ];

    for (const locale of rtlLocales) {
      const result = _getLocaleDirection(locale);
      expect(result).toBe('rtl');
    }
  });

  it('should handle simple language codes', () => {
    expect(_getLocaleDirection('en')).toBe('ltr');
    expect(_getLocaleDirection('ar')).toBe('rtl');
    expect(_getLocaleDirection('he')).toBe('rtl');
    expect(_getLocaleDirection('ja')).toBe('ltr');
  });

  it('should handle locale codes with regions', () => {
    expect(_getLocaleDirection('en-US')).toBe('ltr');
    expect(_getLocaleDirection('ar-EG')).toBe('rtl');
    expect(_getLocaleDirection('he-IL')).toBe('rtl');
    expect(_getLocaleDirection('fr-CA')).toBe('ltr');
  });

  it('should handle locale codes with scripts and regions', () => {
    expect(_getLocaleDirection('zh-Hans-CN')).toBe('ltr');
    expect(_getLocaleDirection('ar-Arab-SA')).toBe('rtl');
    expect(_getLocaleDirection('en-Latn-US')).toBe('ltr');
  });

  it('should fallback to ltr for invalid locale codes', () => {
    const invalidLocales = ['invalid', 'xyz-123', '', 'not-a-locale', '123'];

    for (const locale of invalidLocales) {
      const result = _getLocaleDirection(locale);
      expect(result).toBe('ltr');
    }
  });

  it('should handle edge cases and special locales', () => {
    // Test some edge cases
    expect(_getLocaleDirection('root')).toBe('ltr');
    expect(_getLocaleDirection('und')).toBe('ltr');

    // Test mixed scripts - should default to ltr if parsing fails
    expect(_getLocaleDirection('mixed-script-locale')).toBe('ltr');
  });

  it('should return consistent results for the same locale', () => {
    const locale = 'en-US';
    const result1 = _getLocaleDirection(locale);
    const result2 = _getLocaleDirection(locale);

    expect(result1).toBe(result2);
    expect(result1).toBe('ltr');
  });

  it('should handle locale codes with different casings', () => {
    expect(_getLocaleDirection('EN-us')).toBe('ltr');
    expect(_getLocaleDirection('AR-sa')).toBe('rtl');
    expect(_getLocaleDirection('HE-il')).toBe('rtl');
  });

  it('should return only ltr or rtl values', () => {
    const testLocales = [
      'en',
      'ar',
      'he',
      'fr',
      'de',
      'ja',
      'zh',
      'es',
      'it',
      'pt',
      'en-US',
      'ar-SA',
      'he-IL',
      'invalid-locale',
      '',
      'xyz',
    ];

    for (const locale of testLocales) {
      const result = _getLocaleDirection(locale);
      expect(['ltr', 'rtl']).toContain(result);
    }
  });
});
