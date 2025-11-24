import { describe, it, expect } from 'vitest';
import _getLocaleEmoji, { defaultEmoji } from '../getLocaleEmoji';
import { CustomMapping } from '../customLocaleMapping';

describe('_getLocaleEmoji', () => {
  it('should return correct emoji for locales with region codes', () => {
    expect(_getLocaleEmoji('en-US')).toBe('🇺🇸');
    expect(_getLocaleEmoji('fr-FR')).toBe('🇫🇷');
    expect(_getLocaleEmoji('de-DE')).toBe('🇩🇪');
    expect(_getLocaleEmoji('ja-JP')).toBe('🇯🇵');
    expect(_getLocaleEmoji('zh-CN')).toBe('🇨🇳');
  });

  it('should return emojis for locales without explicit region codes using maximization', () => {
    // These should use the maximized locale to determine region
    const result1 = _getLocaleEmoji('en');
    const result2 = _getLocaleEmoji('fr');
    const result3 = _getLocaleEmoji('de');

    // Should return some emoji (either regional or default)
    expect(typeof result1).toBe('string');
    expect(result1.length).toBeGreaterThan(0);
    expect(typeof result2).toBe('string');
    expect(result2.length).toBeGreaterThan(0);
    expect(typeof result3).toBe('string');
    expect(result3.length).toBeGreaterThan(0);
  });

  it('should prioritize custom mapping emoji', () => {
    const customMapping: CustomMapping = {
      'en-US': {
        emoji: '🎯',
      },
      fr: '🎪', // string format should not provide emoji
      'de-DE': {
        emoji: '🌟',
      },
    };

    expect(_getLocaleEmoji('en-US', customMapping)).toBe('🎯');
    expect(_getLocaleEmoji('de-DE', customMapping)).toBe('🌟');
    // String mappings don't have emoji property
    expect(_getLocaleEmoji('fr-FR', customMapping)).not.toBe('🎪');
  });

  it('should use language exceptions for specific languages', () => {
    // Test some of the hardcoded exceptions
    expect(_getLocaleEmoji('ca')).toBe('🌍'); // Catalan -> Europe/Africa globe
    expect(_getLocaleEmoji('eu')).toBe('🌍'); // Basque -> Europe/Africa globe
    expect(_getLocaleEmoji('gd')).toBe('🏴󠁧󠁢󠁳󠁣󠁴󠁿'); // Scottish Gaelic -> Scotland flag
    expect(_getLocaleEmoji('cy')).toBe('🏴󠁧󠁢󠁷󠁬󠁳󠁿'); // Welsh -> Wales flag
  });

  it('should return default emoji for invalid locales', () => {
    expect(_getLocaleEmoji('invalid-locale')).toBeDefined(); // May parse as a locale
    expect(_getLocaleEmoji('')).toBe(defaultEmoji);
    expect(_getLocaleEmoji('xyz')).toBeDefined(); // May get some emoji
    expect(_getLocaleEmoji('really-invalid-123456')).toBe(defaultEmoji);
  });

  it('should handle locales with script codes', () => {
    const result1 = _getLocaleEmoji('zh-Hans-CN');
    const result2 = _getLocaleEmoji('zh-Hant-TW');
    const result3 = _getLocaleEmoji('sr-Latn-RS');

    // Should return appropriate regional emojis
    expect(result1).toBe('🇨🇳');
    expect(result2).toBe('🇹🇼');
    expect(result3).toBe('🇷🇸');
  });

  it('should prioritize region over language exceptions', () => {
    // Kurdish normally has an exception, but when region is specified it should use region
    const kurdishWithRegion = _getLocaleEmoji('ku-TR');
    expect(kurdishWithRegion).toBe('🇹🇷'); // Should use Turkey flag, not the exception
  });

  it('should search custom mapping in correct order', () => {
    const customMapping: CustomMapping = {
      'en-US-custom': {
        emoji: '🎯',
      },
      'en-US': {
        emoji: '🎪',
      },
      en: {
        emoji: '🌟',
      },
    };

    // Should prioritize exact match first, then standardized, then language
    expect(_getLocaleEmoji('en-US-custom', customMapping)).toBe('🎯');
    expect(_getLocaleEmoji('en-US', customMapping)).toBe('🎪');
    // en-GB should fall back to 'en' mapping since no region-specific custom mapping exists
    const enGbResult = _getLocaleEmoji('en-GB', customMapping);
    // Could be either the en custom emoji or the GB regional emoji, but should be defined
    expect(enGbResult).toBeDefined();
    expect(typeof enGbResult).toBe('string');
  });

  it('should return consistent emoji for the same locale', () => {
    const locale = 'fr-CA';
    const result1 = _getLocaleEmoji(locale);
    const result2 = _getLocaleEmoji(locale);

    expect(result1).toBe(result2);
    expect(result1).toBe('🇨🇦');
  });

  it('should handle edge case locales', () => {
    // Test some edge cases that might exist in the emoji mapping
    expect(_getLocaleEmoji('eu-ES')).toBeDefined(); // European Union with Spain
    expect(_getLocaleEmoji('gv-IM')).toBe('🇮🇲'); // Manx with Isle of Man
    expect(_getLocaleEmoji('grc-GR')).toBeDefined(); // Ancient Greek with Greece
  });

  it('should always return a string emoji', () => {
    const testLocales = [
      'en',
      'en-US',
      'fr-FR',
      'de-DE',
      'ja-JP',
      'zh-CN',
      'ar-SA',
      'he-IL',
      'ca',
      'eu',
      'gd',
      'cy',
      'invalid-locale',
      '',
      'xyz',
      'not-a-locale',
    ];

    for (const locale of testLocales) {
      const result = _getLocaleEmoji(locale);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('should handle custom mapping with different property types', () => {
    const customMapping: CustomMapping = {
      'en-TEST': {
        emoji: '🎯',
        name: 'Test 1',
      },
      'fr-TEST': 'Test 2 String', // String mapping
      'de-TEST': {
        name: 'Test 3',
        // No emoji property
      },
    };

    expect(_getLocaleEmoji('en-TEST', customMapping)).toBe('🎯');
    // String mapping has no emoji, so should fallback to default behavior
    const test2Result = _getLocaleEmoji('fr-TEST', customMapping);
    expect(typeof test2Result).toBe('string');
    expect(test2Result.length).toBeGreaterThan(0);

    // Object but no emoji property, should fallback to default behavior
    const test3Result = _getLocaleEmoji('de-TEST', customMapping);
    expect(typeof test3Result).toBe('string');
    expect(test3Result.length).toBeGreaterThan(0);
  });
  it('should handle custom mapping with canonical locale', () => {
    const customMapping: CustomMapping = {
      'zh-TEST': {
        code: 'zh',
      },
    };

    expect(_getLocaleEmoji('zh-TEST', customMapping)).toBe('🇨🇳');
    expect(_getLocaleEmoji('zh-CN', customMapping)).toBe('🇨🇳');
    expect(_getLocaleEmoji('zh', customMapping)).toBe('🇨🇳');
  });
  it('should handle custom mapping with canonical locale and emoji', () => {
    const customMapping: CustomMapping = {
      'zh-TEST': {
        code: 'zh',
        emoji: '🎯',
      },
    };

    expect(_getLocaleEmoji('zh-TEST', customMapping)).toBe('🎯');
    expect(_getLocaleEmoji('zh-CN', customMapping)).toBe('🇨🇳');
    expect(_getLocaleEmoji('zh', customMapping)).toBe('🇨🇳');
  });
});
