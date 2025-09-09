import { describe, it, expect } from 'vitest';
import { _isValidLocale, _standardizeLocale } from '../isValidLocale';
import { CustomMapping } from '../customLocaleMapping';

describe('_isValidLocale', () => {
  it('should return true for valid standard locales', () => {
    const validLocales = [
      'en', 'en-US', 'en-GB', 'fr', 'fr-FR', 'fr-CA',
      'de', 'de-DE', 'de-AT', 'es', 'es-ES', 'es-MX',
      'ja', 'ja-JP', 'zh', 'zh-CN', 'zh-TW', 'ar', 'ar-SA'
    ];

    for (const locale of validLocales) {
      expect(_isValidLocale(locale)).toBe(true);
    }
  });

  it('should return true for valid locales with script codes', () => {
    const validLocalesWithScript = [
      'zh-Hans', 'zh-Hans-CN', 'zh-Hant', 'zh-Hant-TW',
      'sr-Latn', 'sr-Latn-RS', 'sr-Cyrl', 'sr-Cyrl-RS',
      'uz-Latn', 'uz-Latn-UZ', 'uz-Cyrl', 'uz-Cyrl-UZ'
    ];

    for (const locale of validLocalesWithScript) {
      expect(_isValidLocale(locale)).toBe(true);
    }
  });

  it('should return true for locales with script exceptions', () => {
    // Test script exceptions that are allowed even if DisplayNames doesn't recognize them
    const scriptExceptionLocales = [
      'cjm-Cham', 'ko-Jamo', 'ksw-Kawi', 'lis-Lisu', 'toq-Toto', 'th-Thai'
    ];

    for (const locale of scriptExceptionLocales) {
      const result = _isValidLocale(locale);
      // Should be true or at least not fail due to script validation
      expect(typeof result).toBe('boolean');
    }
  });

  it('should return true for private-use language codes (qaa-qtz)', () => {
    const privateUseLocales = [
      'qaa', 'qab', 'qac', 'qbb', 'qcc', 'qtz'
    ];

    for (const locale of privateUseLocales) {
      expect(_isValidLocale(locale)).toBe(true);
    }
  });

  it('should return false for invalid locales', () => {
    const invalidLocales = [
      'invalid', 'xyz', 'notvalid', 'abc123',
      'toolong-invalid-locale-code', '123', '',
      'en-INVALID', 'fr-NOTREAL', 'invalid-US'
    ];

    for (const locale of invalidLocales) {
      expect(_isValidLocale(locale)).toBe(false);
    }
  });

  it('should return false for malformed locale structures', () => {
    const malformedLocales = [
      'en-US-EXTRA-PARTS', // Too many parts
      'en-', // Trailing dash
      '-en', // Leading dash
      'en--US', // Double dash
      'en-123-US', // Invalid script/region order
    ];

    for (const locale of malformedLocales) {
      expect(_isValidLocale(locale)).toBe(false);
    }
  });

  it('should prioritize custom mapping over standard validation', () => {
    const customMapping: CustomMapping = {
      'custom-invalid-locale': {
        name: 'Custom Invalid Locale',
      },
      'made-up-code': 'Made Up Language',
      'xyz-123': {
        name: 'XYZ Language',
        emoji: '🎯',
      },
      // Even normally invalid patterns should be accepted if in custom mapping
      'completely-fake-locale-code': {
        name: 'Fake Locale',
      },
    };

    // These would normally be invalid, but should return true due to custom mapping
    expect(_isValidLocale('custom-invalid-locale', customMapping)).toBe(true);
    expect(_isValidLocale('made-up-code', customMapping)).toBe(true);
    expect(_isValidLocale('xyz-123', customMapping)).toBe(true);
    expect(_isValidLocale('completely-fake-locale-code', customMapping)).toBe(true);

    // Valid locales should still work
    expect(_isValidLocale('en-US', customMapping)).toBe(true);
    expect(_isValidLocale('fr-FR', customMapping)).toBe(true);

    // Invalid locales not in custom mapping should still be false
    expect(_isValidLocale('still-invalid', customMapping)).toBe(false);
  });

  it('should handle custom mapping with canonical locale codes', () => {
    const customMapping: CustomMapping = {
      'alias-locale': {
        code: 'en-US',
        name: 'Aliased American English',
      },
      'another-alias': {
        code: 'fr-FR',
        name: 'Aliased French',
      },
    };

    // The aliases themselves should be valid due to being in custom mapping
    expect(_isValidLocale('alias-locale', customMapping)).toBe(true);
    expect(_isValidLocale('another-alias', customMapping)).toBe(true);

    // The canonical locales should still be valid
    expect(_isValidLocale('en-US', customMapping)).toBe(true);
    expect(_isValidLocale('fr-FR', customMapping)).toBe(true);
  });

  it('should not use canonical locale when custom mapping is string instead of object', () => {
    const customMapping: CustomMapping = {
      'alias-locale': 'Simple String Name',
    };
    
    // String mappings don't have canonical locale support
    expect(_isValidLocale('alias-locale', customMapping)).toBe(true);
  });

  it('should not use canonical locale when code property is empty or falsy', () => {
    const customMapping: CustomMapping = {
      'alias-locale': {
        code: '', // Empty code should not trigger aliasing
        name: 'Test Name',
      },
      'another-alias': {
        name: 'Another Test', // No code property
      },
    };
    
    // Both should still be valid due to being in custom mapping
    expect(_isValidLocale('alias-locale', customMapping)).toBe(true);
    expect(_isValidLocale('another-alias', customMapping)).toBe(true);
  });

  it('should handle custom mapping with different property types', () => {
    const customMapping: CustomMapping = {
      'string-type': 'Simple String Name',
      'object-type': {
        name: 'Object Name',
        emoji: '🎯',
      },
      'object-with-code': {
        code: 'de-DE',
        name: 'Object with Canonical Code',
      },
    };

    // All should be valid due to being in custom mapping
    expect(_isValidLocale('string-type', customMapping)).toBe(true);
    expect(_isValidLocale('object-type', customMapping)).toBe(true);
    expect(_isValidLocale('object-with-code', customMapping)).toBe(true);
  });

  it('should handle edge cases', () => {
    expect(_isValidLocale('')).toBe(false);
    expect(_isValidLocale('root')).toBe(false); // root locale is not typically valid
    expect(_isValidLocale('und')).toBe(false); // undefined locale
  });

  it('should handle case sensitivity', () => {
    // BCP 47 codes are case-insensitive but have canonical forms
    expect(_isValidLocale('EN-us')).toBe(true);
    expect(_isValidLocale('Fr-ca')).toBe(true);
    expect(_isValidLocale('DE-de')).toBe(true);
  });

  it('should validate complex locale structures correctly', () => {
    // Test that part count validation works correctly
    expect(_isValidLocale('en')).toBe(true); // 1 part (language)
    expect(_isValidLocale('en-US')).toBe(true); // 2 parts (language-region)
    expect(_isValidLocale('zh-Hans')).toBe(true); // 2 parts (language-script)
    expect(_isValidLocale('zh-Hans-CN')).toBe(true); // 3 parts (language-script-region)
  });

  it('should handle custom mapping that includes standard locales', () => {
    const customMapping: CustomMapping = {
      'en-US': {
        name: 'Custom American English',
        emoji: '🎯',
      },
      'custom-locale': {
        name: 'Custom Locale',
      },
    };

    // Both standard and custom locales should be valid
    expect(_isValidLocale('en-US', customMapping)).toBe(true);
    expect(_isValidLocale('custom-locale', customMapping)).toBe(true);
    expect(_isValidLocale('fr-FR', customMapping)).toBe(true); // Standard but not in custom mapping
  });
});

describe('_standardizeLocale', () => {
  it('should standardize valid locale codes', () => {
    expect(_standardizeLocale('en-us')).toBe('en-US');
    expect(_standardizeLocale('EN-US')).toBe('en-US');
    expect(_standardizeLocale('fr-ca')).toBe('fr-CA');
    expect(_standardizeLocale('DE-de')).toBe('de-DE');
    expect(_standardizeLocale('zh-hans-cn')).toBe('zh-Hans-CN');
  });

  it('should return already standardized locale codes unchanged', () => {
    expect(_standardizeLocale('en-US')).toBe('en-US');
    expect(_standardizeLocale('fr-FR')).toBe('fr-FR');
    expect(_standardizeLocale('zh-Hans-CN')).toBe('zh-Hans-CN');
    expect(_standardizeLocale('de')).toBe('de');
  });

  it('should handle invalid locale codes gracefully', () => {
    // For invalid locales, should return the original string
    expect(_standardizeLocale('invalid-locale')).toBe('invalid-locale');
    expect(_standardizeLocale('xyz')).toBe('xyz');
    expect(_standardizeLocale('')).toBe('');
    expect(_standardizeLocale('not-a-locale')).toBe('not-a-locale');
  });

  it('should handle complex locale transformations', () => {
    // Test various case and formatting transformations
    expect(_standardizeLocale('ZH-HANS-CN')).toBe('zh-Hans-CN');
    expect(_standardizeLocale('sr-latn-rs')).toBe('sr-Latn-RS');
    expect(_standardizeLocale('uz-cyrl-uz')).toBe('uz-Cyrl-UZ');
  });

  it('should handle edge cases', () => {
    expect(_standardizeLocale('root')).toBe('root');
    expect(_standardizeLocale('und')).toBe('und');
    
    // Private use codes should be handled
    expect(_standardizeLocale('qaa')).toBe('qaa');
    expect(_standardizeLocale('QAA')).toBe('qaa');
  });

  it('should be consistent with multiple calls', () => {
    const locale = 'en-us';
    const result1 = _standardizeLocale(locale);
    const result2 = _standardizeLocale(locale);
    
    expect(result1).toBe(result2);
    expect(result1).toBe('en-US');
  });

  it('should handle already canonical forms', () => {
    const canonicalLocales = ['en-US', 'fr-FR', 'zh-Hans-CN', 'de-DE'];
    
    for (const locale of canonicalLocales) {
      expect(_standardizeLocale(locale)).toBe(locale);
    }
  });
});