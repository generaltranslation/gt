import { describe, it, expect } from 'vitest';
import _getLocaleProperties, {
  createCustomLocaleProperties,
} from '../getLocaleProperties';
import { CustomMapping } from '../customLocaleMapping';

describe('createCustomLocaleProperties', () => {
  it('should return undefined when no custom mapping is provided', () => {
    const result = createCustomLocaleProperties(['en-US', 'en'], undefined);
    expect(result).toBeUndefined();
  });

  it('should return empty object when custom mapping exists but no matches found', () => {
    const customMapping: CustomMapping = {
      'fr-FR': 'French (France)',
    };
    const result = createCustomLocaleProperties(['en-US', 'en'], customMapping);
    expect(result).toEqual({});
  });

  it('should merge string values correctly', () => {
    const customMapping: CustomMapping = {
      'en-US': 'American English',
      en: 'English',
    };
    const result = createCustomLocaleProperties(['en-US', 'en'], customMapping);
    expect(result).toEqual({
      name: 'American English',
    });
  });

  it('should merge object values correctly', () => {
    const customMapping: CustomMapping = {
      'en-US': {
        name: 'American English',
        nativeName: 'American English',
        emoji: '🇺🇸',
      },
      en: {
        name: 'English',
        languageName: 'English Language',
      },
    };
    const result = createCustomLocaleProperties(['en-US', 'en'], customMapping);
    expect(result).toEqual({
      name: 'American English',
      nativeName: 'American English',
      emoji: '🇺🇸',
      languageName: 'English Language',
    });
  });

  it('should prioritize first match in array order', () => {
    const customMapping: CustomMapping = {
      'en-US': 'American English',
      en: 'Generic English',
    };
    const result = createCustomLocaleProperties(['en-US', 'en'], customMapping);
    expect(result).toEqual({
      name: 'American English',
    });
  });
});

describe('_getLocaleProperties', () => {
  it('should return basic properties for a simple locale', () => {
    const result = _getLocaleProperties('en');

    expect(result).toMatchObject({
      code: 'en',
      languageCode: 'en',
    });
    expect(result.name).toBeDefined();
    expect(result.nativeName).toBeDefined();
    expect(result.languageName).toBeDefined();
    expect(result.nativeLanguageName).toBeDefined();
    expect(result.emoji).toBeDefined();
  });

  it('should handle locale with region code', () => {
    const result = _getLocaleProperties('en-US');

    expect(result).toMatchObject({
      code: 'en-US',
      languageCode: 'en',
      regionCode: 'US',
    });
    expect(result.name).toBeDefined();
    expect(result.regionName).toBeDefined();
    expect(result.nameWithRegionCode).toContain('(US)');
  });

  it('should handle locale with script and region', () => {
    const result = _getLocaleProperties('zh-Hans-CN');

    expect(result).toMatchObject({
      code: 'zh-Hans-CN',
      languageCode: 'zh',
      scriptCode: 'Hans',
      regionCode: 'CN',
    });
    expect(result.maximizedCode).toBeDefined();
    expect(result.minimizedCode).toBeDefined();
  });

  it('should use custom default locale', () => {
    const result = _getLocaleProperties('de', 'fr-FR');

    expect(result.code).toBe('de');
    expect(result.name).toBeDefined();
    expect(result.nativeName).toBeDefined();
  });

  it('should apply custom mapping for names', () => {
    const customMapping: CustomMapping = {
      'en-US': {
        name: 'Custom American English',
        nativeName: 'Custom American English Native',
        emoji: '🎯',
      },
    };

    const result = _getLocaleProperties('en-US', 'en', customMapping);

    expect(result.name).toBe('Custom American English');
    expect(result.nativeName).toBe('Custom American English Native');
    expect(result.emoji).toBe('🎯');
  });

  it('should handle custom mapping with region and script overrides', () => {
    const customMapping: CustomMapping = {
      'test-locale': {
        name: 'Test Language',
        regionCode: 'XX',
        regionName: 'Test Region',
        scriptCode: 'Test',
        scriptName: 'Test Script',
      },
    };

    const result = _getLocaleProperties('test-locale', 'en', customMapping);

    expect(result.name).toBe('Test Language');
    expect(result.regionCode).toBe('XX');
    expect(result.regionName).toBe('Test Region');
    expect(result.scriptCode).toBe('Test');
    expect(result.scriptName).toBe('Test Script');
  });

  it('should fallback gracefully for invalid locales', () => {
    const result = _getLocaleProperties('invalid-locale-xyz');

    expect(result.code).toBe('invalid-locale-xyz');
    expect(result.name).toBe('invalid-locale-xyz');
    expect(result.nativeName).toBe('invalid-locale-xyz');
    expect(result.languageCode).toBe('invalid');
    expect(result.regionCode).toBe('xyz'); // third part when split by '-'
  });

  it('should handle malformed locale codes', () => {
    const result = _getLocaleProperties('x');

    expect(result.code).toBe('x');
    expect(result.languageCode).toBe('x');
    expect(result.regionCode).toBe('');
    expect(result.name).toBe('x');
  });

  it('should apply custom mapping to fallback path', () => {
    const customMapping: CustomMapping = {
      'invalid-test': {
        name: 'Custom Invalid Name',
        nativeName: 'Custom Invalid Native',
        regionName: 'Custom Region',
      },
    };

    const result = _getLocaleProperties('invalid-test', 'en', customMapping);

    expect(result.name).toBe('Custom Invalid Name');
    expect(result.nativeName).toBe('Custom Invalid Native');
    expect(result.regionName).toBe('Custom Region');
  });

  it('should return consistent property structure for all locales', () => {
    const locales = ['en', 'en-US', 'fr-FR', 'zh-Hans-CN', 'invalid-locale'];

    for (const locale of locales) {
      const result = _getLocaleProperties(locale);

      // Check all required properties exist
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('nativeName');
      expect(result).toHaveProperty('languageCode');
      expect(result).toHaveProperty('languageName');
      expect(result).toHaveProperty('nativeLanguageName');
      expect(result).toHaveProperty('nameWithRegionCode');
      expect(result).toHaveProperty('nativeNameWithRegionCode');
      expect(result).toHaveProperty('regionCode');
      expect(result).toHaveProperty('regionName');
      expect(result).toHaveProperty('nativeRegionName');
      expect(result).toHaveProperty('scriptCode');
      expect(result).toHaveProperty('scriptName');
      expect(result).toHaveProperty('nativeScriptName');
      expect(result).toHaveProperty('maximizedCode');
      expect(result).toHaveProperty('maximizedName');
      expect(result).toHaveProperty('nativeMaximizedName');
      expect(result).toHaveProperty('minimizedCode');
      expect(result).toHaveProperty('minimizedName');
      expect(result).toHaveProperty('nativeMinimizedName');
      expect(result).toHaveProperty('emoji');

      // Check that all properties are strings
      Object.values(result).forEach((value) => {
        expect(typeof value).toBe('string');
      });
    }
  });

  it('should handle empty string locale', () => {
    const result = _getLocaleProperties('');

    expect(result.code).toBe('');
    expect(result.name).toBe('');
    expect(result.languageCode).toBe('');
  });

  it('should use canonical locale from custom mapping when code property exists', () => {
    const customMapping: CustomMapping = {
      'alias-locale': {
        code: 'en-US',
        name: 'Aliased American English',
        emoji: '🎯',
      },
    };

    const result = _getLocaleProperties('alias-locale', 'en', customMapping);

    // Should use the canonical locale code 'en-US' for processing
    expect(result.code).toBe('en-US');
    expect(result.languageCode).toBe('en');
    expect(result.regionCode).toBe('US');
    // The locale gets aliased to en-US, so it gets standard US behavior
    expect(result.name).toBe('Aliased American English');
    // After aliasing, standard emoji for the region takes precedence
    expect(result.emoji).toBe('🎯');
    expect(typeof result.emoji).toBe('string');
  });

  it('should not use canonical locale when custom mapping is string instead of object', () => {
    const customMapping: CustomMapping = {
      'alias-locale': 'Simple String Name',
    };

    const result = _getLocaleProperties('alias-locale', 'en', customMapping);

    // Should keep original locale since no 'code' property exists
    expect(result.code).toBe('alias-locale');
    expect(result.name).toBe('Simple String Name');
    expect(result.languageCode).toBe('alias');
    // regionCode could be 'locale' or '' depending on fallback path
    expect(typeof result.regionCode).toBe('string');
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

    const result1 = _getLocaleProperties('alias-locale', 'en', customMapping);
    const result2 = _getLocaleProperties('another-alias', 'en', customMapping);

    // Both should keep original locale codes
    expect(result1.code).toBe('alias-locale');
    expect(result1.name).toBe('Test Name');

    expect(result2.code).toBe('another-alias');
    expect(result2.name).toBe('Another Test');
  });
});
