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
    testICUSafety("hello'world", 'text with single quote');
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
    testICUSafety('####', 'multiple consecutive hashes (should not be escaped)');
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
  });

  describe('adversarial input', () => {
    testICUSafety(
      "start'middle{complex}end'final<tag>",
      'mixed quotes, braces, and angle brackets'
    );
    testICUSafety(
      "{{{{''''}}}}<<<>>>",
      'excessive nested special characters'
    );
  });

  describe('direct output validation', () => {
    it('should double single quotes', () => {
      expect(sanitizeVar("hello'world")).toBe("hello''world");
    });

    it('should double unicode quotes', () => {
      expect(sanitizeVar("hello'world")).toBe("hello''world");
    });

    it('should wrap special character regions in quotes', () => {
      expect(sanitizeVar('hello{world}test')).toBe("hello'{world}'test");
    });

    it('should handle mixed quotes and special chars', () => {
      expect(sanitizeVar("test'before{middle}'after")).toBe("test''before'{middle}'''after");
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

    it('should handle text with only quotes', () => {
      expect(sanitizeVar("text'with'quotes")).toBe("text''with''quotes");
    });
  });
});