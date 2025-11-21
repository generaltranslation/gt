import { describe, it, expect } from 'vitest';
import { _resolveAliasLocale } from '../resolveAliasLocale';
import { CustomMapping } from '../customLocaleMapping';

describe('_resolveAliasLocale', () => {
  it('should return original locale when no custom mapping provided', () => {
    expect(_resolveAliasLocale('en-US')).toBe('en-US');
    expect(_resolveAliasLocale('fr-FR')).toBe('fr-FR');
    expect(_resolveAliasLocale('de-DE')).toBe('de-DE');
  });

  it('should return original locale when custom mapping is empty', () => {
    const customMapping: CustomMapping = {};
    expect(_resolveAliasLocale('en-US', customMapping)).toBe('en-US');
    expect(_resolveAliasLocale('fr-FR', customMapping)).toBe('fr-FR');
  });

  it('should return original locale when locale not found in custom mapping', () => {
    const customMapping: CustomMapping = {
      'custom-locale': {
        name: 'Custom Language',
      },
    };
    expect(_resolveAliasLocale('en-US', customMapping)).toBe('en-US');
    expect(_resolveAliasLocale('fr-FR', customMapping)).toBe('fr-FR');
  });

  it('should return alias locale when mapping has code property', () => {
    const customMapping: CustomMapping = {
      'alias-locale': {
        code: 'en-US',
        name: 'Aliased American English',
      },
    };
    expect(_resolveAliasLocale('en-US', customMapping)).toBe('alias-locale');
  });

  it('should handle multiple aliases mapping to different locales', () => {
    const customMapping: CustomMapping = {
      'alias-en': {
        code: 'en-US',
        name: 'English Alias',
      },
      'alias-fr': {
        code: 'fr-FR',
        name: 'French Alias',
      },
      'alias-de': {
        code: 'de-DE',
        name: 'German Alias',
      },
    };

    expect(_resolveAliasLocale('en-US', customMapping)).toBe('alias-en');
    expect(_resolveAliasLocale('fr-FR', customMapping)).toBe('alias-fr');
    expect(_resolveAliasLocale('de-DE', customMapping)).toBe('alias-de');
    expect(_resolveAliasLocale('es-ES', customMapping)).toBe('es-ES');
  });

  it('should ignore string-only custom mapping entries', () => {
    const customMapping: CustomMapping = {
      'string-only': 'Just a string',
      'alias-locale': {
        code: 'en-US',
        name: 'Aliased American English',
      },
    };

    expect(_resolveAliasLocale('en-US', customMapping)).toBe('alias-locale');
    expect(_resolveAliasLocale('string-only', customMapping)).toBe(
      'string-only'
    );
  });

  it('should ignore custom mapping entries without code property', () => {
    const customMapping: CustomMapping = {
      'no-code': {
        name: 'No Code Property',
      },
      'with-code': {
        code: 'en-US',
        name: 'With Code Property',
      },
    };

    expect(_resolveAliasLocale('en-US', customMapping)).toBe('with-code');
    expect(_resolveAliasLocale('no-code', customMapping)).toBe('no-code');
  });

  it('should ignore custom mapping entries with null or undefined values', () => {
    const customMapping: CustomMapping = {
      'null-value': null as any,
      'undefined-value': undefined as any,
      'valid-alias': {
        code: 'en-US',
        name: 'Valid Alias',
      },
    };

    expect(_resolveAliasLocale('en-US', customMapping)).toBe('valid-alias');
    expect(_resolveAliasLocale('null-value', customMapping)).toBe('null-value');
    expect(_resolveAliasLocale('undefined-value', customMapping)).toBe(
      'undefined-value'
    );
  });

  it('should handle empty code property', () => {
    const customMapping: CustomMapping = {
      'empty-code': {
        code: '',
        name: 'Empty Code',
      },
      'valid-alias': {
        code: 'en-US',
        name: 'Valid Alias',
      },
    };

    expect(_resolveAliasLocale('en-US', customMapping)).toBe('valid-alias');
    expect(_resolveAliasLocale('', customMapping)).toBe('empty-code');
    expect(_resolveAliasLocale('empty-code', customMapping)).toBe('empty-code');
  });

  it('should return first matching alias when multiple aliases point to same locale', () => {
    const customMapping: CustomMapping = {
      'alias-one': {
        code: 'en-US',
        name: 'First Alias',
      },
      'alias-two': {
        code: 'en-US',
        name: 'Second Alias',
      },
    };

    const result = _resolveAliasLocale('en-US', customMapping);
    expect(['alias-one', 'alias-two']).toContain(result);
    expect(result).not.toBe('en-US');
  });

  it('should handle case sensitivity correctly', () => {
    const customMapping: CustomMapping = {
      'alias-locale': {
        code: 'en-US',
        name: 'Case Sensitive Alias',
      },
    };

    expect(_resolveAliasLocale('en-US', customMapping)).toBe('alias-locale');
    expect(_resolveAliasLocale('en-us', customMapping)).toBe('en-us');
    expect(_resolveAliasLocale('EN-US', customMapping)).toBe('EN-US');
  });

  it('should handle complex custom mapping scenarios', () => {
    const customMapping: CustomMapping = {
      'custom-english': {
        code: 'en-US',
        name: 'Custom English',
      },
      'brand-french': {
        code: 'fr-FR',
        name: 'Brand French',
      },
      'legacy-german': {
        code: 'de-DE',
        name: 'Legacy German',
      },
      'no-mapping': {
        name: 'No Code Mapping',
      },
      'string-entry': 'String Only',
    };

    expect(_resolveAliasLocale('en-US', customMapping)).toBe('custom-english');
    expect(_resolveAliasLocale('fr-FR', customMapping)).toBe('brand-french');
    expect(_resolveAliasLocale('de-DE', customMapping)).toBe('legacy-german');
    expect(_resolveAliasLocale('es-ES', customMapping)).toBe('es-ES');
    expect(_resolveAliasLocale('no-mapping', customMapping)).toBe('no-mapping');
    expect(_resolveAliasLocale('string-entry', customMapping)).toBe(
      'string-entry'
    );
  });

  it('should handle edge case with mixed data types in custom mapping', () => {
    const customMapping: CustomMapping = {
      'mixed-entry': {
        code: 42 as any, // Invalid type
        name: 'Mixed Types',
      },
      'valid-entry': {
        code: 'en-US',
        name: 'Valid Entry',
      },
    };

    expect(_resolveAliasLocale('en-US', customMapping)).toBe('valid-entry');
    expect(_resolveAliasLocale('mixed-entry', customMapping)).toBe(
      'mixed-entry'
    );
  });

  it('should return original locale for non-existent locale codes', () => {
    const customMapping: CustomMapping = {
      'alias-locale': {
        code: 'en-US',
        name: 'Existing Alias',
      },
    };

    expect(_resolveAliasLocale('nonexistent-locale', customMapping)).toBe(
      'nonexistent-locale'
    );
    expect(_resolveAliasLocale('invalid-code', customMapping)).toBe(
      'invalid-code'
    );
  });
});
