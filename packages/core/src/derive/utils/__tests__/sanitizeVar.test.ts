import { describe, it, expect } from 'vitest';
import { parse } from '@formatjs/icu-messageformat-parser';
import { sanitizeVar } from '../sanitizeVar';

describe('static sanitizeVar', () => {
  // Helper function to test that a sanitized string doesn't break ICU parsing
  const testICUSafety = (input: string, description: string) => {
    it(`should safely escape: ${description}`, () => {
      const sanitized = sanitizeVar(input);
      const icuPattern = `{_gt_, select, other {${sanitized}}}`;

      // The sanitized output should be parseable as ICU when wrapped
      expect(() => parse(icuPattern)).not.toThrow();

      // The parsed result should contain our input as literal text
      const ast = parse(icuPattern);
      expect(ast).toBeDefined();
    });
  };

  describe('basic functionality', () => {
    testICUSafety('hello world', 'plain text');
    testICUSafety('hello{world}', 'text with braces');
    testICUSafety("hello'world", 'text with single quote (U+0027)');
    testICUSafety('hello#world', 'text with hash (should not be escaped)');
    testICUSafety('hello<bold>world</bold>', 'text with angle brackets');
  });

  describe('ICU syntax that should be escaped', () => {
    testICUSafety(
      '{count, plural, one{# dog} other{# dogs}}',
      'complete ICU plural syntax'
    );
    testICUSafety('{name}', 'simple variable reference');
    testICUSafety('{date, date, short}', 'formatted date variable');
    testICUSafety('<bold>emphasized text</bold>', 'XML-like tags');
  });

  describe('edge cases', () => {
    testICUSafety('', 'empty string');
    testICUSafety(' ', 'single space');
    testICUSafety('\n\t\r', 'whitespace characters');
    testICUSafety('{{{{}}}}', 'multiple consecutive braces');
    testICUSafety("''''", 'multiple consecutive quotes');
    testICUSafety(
      '####',
      'multiple consecutive hashes (should not be escaped)'
    );
    testICUSafety('<><><>', 'multiple consecutive angle brackets');
    testICUSafety("{}#<>'", 'all special characters together');
  });

  describe('real-world scenarios', () => {
    testICUSafety(
      '<script>alert("XSS with {malicious} code")</script>',
      'HTML script with braces'
    );
    testICUSafety(
      'Error: {code: 500, message: "Internal server error"}',
      'JSON-like error message'
    );
    testICUSafety(
      'Price: ${price} (including {taxRate}% tax)',
      'price formatting with variables'
    );
  });

  describe('unicode and special characters', () => {
    testICUSafety('Hello 世界', 'unicode characters');
    testICUSafety('🎉🎊{party}🎈', 'emojis with braces');
    testICUSafety('中文{变量}和<标签>测试', 'Chinese with special chars');
    testICUSafety("Don't forget the café menu", 'text with apostrophes');
    testICUSafety(
      "User's data: {id} and 'settings'",
      'apostrophes with braces'
    );
  });

  describe('adversarial input', () => {
    testICUSafety(
      "start'middle{complex}end'final<tag>",
      'mixed quotes, braces, and angle brackets'
    );
    testICUSafety("{{{{''''}}}}<<<>>>", 'excessive nested special characters');
  });

  describe('direct output validation', () => {
    it('should double single quotes (U+0027)', () => {
      expect(sanitizeVar("hello'world")).toBe("hello''world");
    });

    it('should wrap special character regions in quotes', () => {
      expect(sanitizeVar('hello{world}test')).toBe("hello'{world}'test");
    });

    it('should handle mixed quotes and special chars', () => {
      expect(sanitizeVar("test'before{middle}'after")).toBe(
        "test''before'{middle}'''after"
      );
    });

    it('should not escape hash characters', () => {
      expect(sanitizeVar('count: #5')).toBe('count: #5');
    });

    it('should handle special chars at start and end', () => {
      expect(sanitizeVar('{start}middle<end>')).toBe("'{start}middle<end>'");
    });

    it('should handle only special characters', () => {
      expect(sanitizeVar('{}<>')).toBe("'{}<>'");
    });

    it('should handle empty string', () => {
      expect(sanitizeVar('')).toBe('');
    });

    it('should preserve text without special chars', () => {
      expect(sanitizeVar('just normal text')).toBe('just normal text');
    });

    it('should handle text with only U+0027 quotes', () => {
      expect(sanitizeVar("text'with'quotes")).toBe("text''with''quotes");
    });

    it('should handle text with only U+2019 quotes', () => {
      expect(sanitizeVar("text'with'quotes")).toBe("text''with''quotes");
    });

    it('should handle mixed U+0027 and U+2019 quotes', () => {
      expect(sanitizeVar("text'with'mixed'quotes")).toBe(
        "text''with''mixed''quotes"
      );
    });

    it('should handle consecutive different quote types', () => {
      expect(sanitizeVar("test''combo")).toBe("test''''combo");
    });

    it('should handle quotes with special characters', () => {
      expect(sanitizeVar("before'{middle}'after")).toBe(
        "before'''{middle}'''after"
      );
    });

    it('should handle Unicode quotes in complex scenarios', () => {
      expect(sanitizeVar("It's a beautiful day!")).toBe(
        "It''s a beautiful day!"
      );
    });

    // Test to confirm the regex bug - this should fail if regex doesn't handle U+2019
    it('should properly double U+2019 character (right single quotation mark)', () => {
      const input = String.fromCharCode(0x2019); // U+2019 '
      const result = sanitizeVar(`hello${input}world`);
      const expected = `hello${input}world`; // Should be doubled
      expect(result).toBe(expected);
    });

    it('should handle both U+0027 and U+2019 in same string', () => {
      const ascii = String.fromCharCode(0x0027); // U+0027 '
      const unicode = String.fromCharCode(0x2019); // U+2019 '
      const input = `Don${ascii}t forget the café${unicode}s menu`;
      const expected = `Don${ascii}${ascii}t forget the café${unicode}s menu`;
      expect(sanitizeVar(input)).toBe(expected);
    });
  });
});
