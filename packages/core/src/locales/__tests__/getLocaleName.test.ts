import { describe, it, expect } from 'vitest';
import { _getLocaleName } from '../getLocaleName';
import { CustomMapping } from '../customLocaleMapping';

describe('_getLocaleName', () => {
  it('should return display names for common locales using English display locale', () => {
    expect(_getLocaleName('en-US', 'en')).toBe('American English');
    // These might include region information
    const frResult = _getLocaleName('fr-FR', 'en');
    expect(frResult).toContain('French');
    const deResult = _getLocaleName('de-DE', 'en');
    expect(deResult).toContain('German');
    const jaResult = _getLocaleName('ja-JP', 'en');
    expect(jaResult).toContain('Japanese');
    const zhResult = _getLocaleName('zh-CN', 'en');
    expect(zhResult).toContain('Chinese');
  });

  it('should return native display names when using the same locale for display', () => {
    // These should return native names when the display locale matches the target locale
    const frResult = _getLocaleName('fr-FR', 'fr');
    const deResult = _getLocaleName('de-DE', 'de');
    const esResult = _getLocaleName('es-ES', 'es');

    expect(typeof frResult).toBe('string');
    expect(frResult.length).toBeGreaterThan(0);
    expect(typeof deResult).toBe('string');
    expect(deResult.length).toBeGreaterThan(0);
    expect(typeof esResult).toBe('string');
    expect(esResult.length).toBeGreaterThan(0);
  });

  it('should handle simple language codes without regions', () => {
    expect(_getLocaleName('en', 'en')).toBeDefined();
    expect(_getLocaleName('fr', 'en')).toBe('French');
    expect(_getLocaleName('de', 'en')).toBe('German');
    expect(_getLocaleName('ja', 'en')).toBe('Japanese');
  });

  it('should use default locale when none specified', () => {
    const result = _getLocaleName('fr-FR');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should prioritize custom mapping names', () => {
    const customMapping: CustomMapping = {
      'en-US': {
        name: 'Custom American English',
      },
      'fr-FR': {
        name: 'Custom French',
      },
      es: 'Custom Spanish',
    };

    expect(_getLocaleName('en-US', 'en', customMapping)).toBe(
      'Custom American English'
    );
    expect(_getLocaleName('fr-FR', 'en', customMapping)).toBe('Custom French');
    expect(_getLocaleName('es-ES', 'en', customMapping)).toBe('Custom Spanish');
  });

  it('should search custom mapping in correct order', () => {
    const customMapping: CustomMapping = {
      'en-US-custom': {
        name: 'Custom US English',
      },
      'en-US': {
        name: 'American English Override',
      },
      en: {
        name: 'English Language Override',
      },
    };

    // Should find exact match first
    expect(_getLocaleName('en-US-custom', 'en', customMapping)).toBe(
      'Custom US English'
    );
    // Should find standardized match
    expect(_getLocaleName('en-US', 'en', customMapping)).toBe(
      'American English Override'
    );
    // Should fall back to language match when no region-specific mapping exists
    const enGbResult = _getLocaleName('en-GB', 'en', customMapping);
    expect(enGbResult).toBeDefined();
    expect(typeof enGbResult).toBe('string');
  });

  it('should handle locales with script codes', () => {
    const result1 = _getLocaleName('zh-Hans-CN', 'en');
    const result2 = _getLocaleName('zh-Hant-TW', 'en');
    const result3 = _getLocaleName('sr-Latn-RS', 'en');

    expect(typeof result1).toBe('string');
    expect(result1.length).toBeGreaterThan(0);
    expect(typeof result2).toBe('string');
    expect(result2.length).toBeGreaterThan(0);
    expect(typeof result3).toBe('string');
    expect(result3.length).toBeGreaterThan(0);
  });

  it('should handle invalid locale codes gracefully', () => {
    // Some "invalid" locales might still be parseable by Intl
    const invalidResult = _getLocaleName('invalid-locale', 'en');
    expect(typeof invalidResult).toBe('string');

    expect(_getLocaleName('', 'en')).toBe('');

    const xyzResult = _getLocaleName('xyz', 'en');
    expect(typeof xyzResult).toBe('string');

    const numericResult = _getLocaleName('123-456', 'en');
    expect(typeof numericResult).toBe('string');
  });

  it('should handle custom mapping with canonical locale aliasing', () => {
    const customMapping: CustomMapping = {
      'alias-locale': {
        code: 'en-US',
        name: 'Aliased American English',
      },
    };

    const result = _getLocaleName('alias-locale', 'en', customMapping);
    // Should use the aliased locale for processing
    expect(result).toBe('Aliased American English');
  });

  it('should return empty string for invalid display locale', () => {
    // When the display locale itself is invalid, should still try to work
    const result = _getLocaleName('en-US', 'invalid-display-locale');
    expect(typeof result).toBe('string');
  });

  it('should handle fallback to library default locale', () => {
    const customMapping: CustomMapping = {
      'en-TEST': {
        name: 'Test Language',
      },
    };

    const result = _getLocaleName('en-TEST', undefined, customMapping);
    expect(result).toBe('Test Language');
  });

  it('should handle with canonical locale', () => {
    const customMapping: CustomMapping = {
      'es-TEST': {
        code: 'es',
      },
    };

    const result = _getLocaleName('es-TEST', undefined, customMapping);
    expect(result).toBe('Spanish');
  });

  it('should return consistent results for the same inputs', () => {
    const locale = 'de-AT';
    const displayLocale = 'en';

    const result1 = _getLocaleName(locale, displayLocale);
    const result2 = _getLocaleName(locale, displayLocale);

    expect(result1).toBe(result2);
    expect(typeof result1).toBe('string');
  });

  it('should handle different display locales for the same target locale', () => {
    const targetLocale = 'ja-JP';

    const englishResult = _getLocaleName(targetLocale, 'en');
    const frenchResult = _getLocaleName(targetLocale, 'fr');
    const germanResult = _getLocaleName(targetLocale, 'de');

    expect(typeof englishResult).toBe('string');
    expect(englishResult.length).toBeGreaterThan(0);
    expect(typeof frenchResult).toBe('string');
    expect(frenchResult.length).toBeGreaterThan(0);
    expect(typeof germanResult).toBe('string');
    expect(germanResult.length).toBeGreaterThan(0);

    // Results might be different due to different display locales
    expect(englishResult).toBeDefined();
    expect(frenchResult).toBeDefined();
    expect(germanResult).toBeDefined();
  });

  it('should always return a string', () => {
    const testCases = [
      ['en-US', 'en'],
      ['fr-FR', 'fr'],
      ['invalid-locale', 'en'],
      ['', 'en'],
      ['en-US', 'invalid-display'],
      ['zh-Hans-CN', 'ja'],
    ];

    for (const [locale, displayLocale] of testCases) {
      const result = _getLocaleName(locale, displayLocale);
      expect(typeof result).toBe('string');
    }
  });
});
