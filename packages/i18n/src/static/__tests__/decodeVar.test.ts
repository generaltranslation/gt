import { describe, it, expect } from 'vitest';
import { declareVar } from '../declareVar';
import { decodeVar } from '../decodeVar';

describe('decodeVar', () => {
  // Helper function to test round-trip sanitization/desanitization
  const testRoundTrip = (input: string, description: string) => {
    it(`should round-trip: ${description}`, () => {
      const sanitized = declareVar(input);
      const desanitized = decodeVar(sanitized);

      expect(desanitized).toBe(input);
    });
  };

  describe('round-trip tests', () => {
    // Basic functionality
    testRoundTrip('hello world', 'plain text');
    testRoundTrip('hello{world}', 'text with braces');
    testRoundTrip("hello'world", 'text with single quote');
    testRoundTrip('hello#world', 'text with hash');
    testRoundTrip('hello<bold>world</bold>', 'text with angle brackets');

    // ICU syntax that must be escaped
    testRoundTrip(
      '{count, plural, one{# dog} other{# dogs}}',
      'complete ICU plural syntax'
    );
    testRoundTrip('{name}', 'simple variable reference');
    testRoundTrip('{date, date, short}', 'formatted date variable');
    testRoundTrip('<bold>emphasized text</bold>', 'XML-like tags');

    // Edge cases
    testRoundTrip('', 'empty string');
    testRoundTrip(' ', 'single space');
    testRoundTrip('\n\t\r', 'whitespace characters');
    testRoundTrip('{{{{}}}}', 'multiple consecutive braces');
    testRoundTrip("''''", 'multiple consecutive quotes');
    testRoundTrip('####', 'multiple consecutive hashes');
    testRoundTrip('<><><>', 'multiple consecutive angle brackets');
    testRoundTrip("{}#<>'", 'all special characters together');

    // Real-world scenarios
    testRoundTrip(
      'Error: {code: 500, message: "Internal server error"}',
      'JSON-like error message'
    );
    testRoundTrip(
      '<script>alert("XSS with {malicious} code")</script>',
      'HTML script with braces'
    );
    testRoundTrip(
      'Price: ${price} (including {taxRate}% tax)',
      'price formatting with variables'
    );

    // Unicode and special characters
    testRoundTrip('Hello 世界', 'unicode characters');
    testRoundTrip('🎉🎊{party}🎈', 'emojis with braces');
    testRoundTrip('café & naïve résumé', 'accented characters');
    testRoundTrip('中文{变量}和<标签>测试', 'Chinese with special chars');

    // Complex cases that previously broke
    testRoundTrip(
      "start'middle{complex}end'final<tag>",
      'mixed quotes, braces, and angle brackets'
    );
    testRoundTrip("{{{{''''}}}}<<<>>>", 'excessive nested special characters');

    // Mix of various quote types
    testRoundTrip('\' " ` \' \' " " ` `', 'all types of quote characters');
  });

  describe('direct decodeVar tests', () => {
    it('should extract simple text from sanitized ICU', () => {
      const sanitizedICU = '{_gt_, select, other {hello world}}';
      const result = decodeVar(sanitizedICU);
      expect(result).toBe('hello world');
    });

    it('should extract text with escaped quotes', () => {
      const sanitizedICU = "{_gt_, select, other {hello''world}}";
      const result = decodeVar(sanitizedICU);
      expect(result).toBe("hello'world");
    });

    it('should extract text with quoted special characters', () => {
      const sanitizedICU = "{_gt_, select, other {hello'{'world'}'}}";
      const result = decodeVar(sanitizedICU);
      expect(result).toBe('hello{world}');
    });

    it('should handle empty sanitized content', () => {
      const sanitizedICU = '{_gt_, select, other {}}';
      const result = decodeVar(sanitizedICU);
      expect(result).toBe('');
    });

    it('should handle complex escaped content', () => {
      const sanitizedICU =
        "{_gt_, select, other {User''s data: '{'id: 123'}' '<'status'>'active'<'/status'>'}}";
      const result = decodeVar(sanitizedICU);
      expect(result).toBe("User's data: {id: 123} <status>active</status>");
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed ICU gracefully', () => {
      // This should not throw, but might return empty string or original
      expect(() => decodeVar('invalid icu')).not.toThrow();
    });

    it('should handle empty string input', () => {
      const result = decodeVar('');
      expect(result).toBe('');
    });

    it('should preserve content that was never special', () => {
      // Test with content that has no special chars and shouldn't be quoted
      const input = 'just normal text';
      const sanitized = declareVar(input);
      const desanitized = decodeVar(sanitized);
      expect(desanitized).toBe(input);
    });
  });
});
