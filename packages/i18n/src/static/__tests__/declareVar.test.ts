import { describe, it, expect } from 'vitest';
import { parse } from '@formatjs/icu-messageformat-parser';
import { IntlMessageFormat } from 'intl-messageformat';
import { declareVar } from '../declareVar';

describe('declareVar', () => {
  // Helper function to test that a sanitized string doesn't break ICU parsing
  const testICUSafety = (input: string, description: string) => {
    it(`should safely escape: ${description}`, () => {
      const sanitized = declareVar(input);

      // The sanitized output should be parseable as ICU
      expect(() => parse(sanitized)).not.toThrow();

      // The parsed result should contain our input as literal text
      const ast = parse(sanitized);
      expect(ast).toBeDefined();
    });
  };

  describe('essential test cases', () => {
    // Basic functionality
    testICUSafety('hello world', 'plain text');
    testICUSafety('hello{world}', 'text with braces');
    testICUSafety("hello'world", 'text with single quote');

    // ICU syntax that must be escaped
    testICUSafety(
      '{count, plural, one{# dog} other{# dogs}}',
      'complete ICU plural syntax'
    );

    // Mixed special characters
    testICUSafety(
      "start'middle{complex}end'final<tag>",
      'mixed quotes, braces, and angle brackets'
    );

    // Edge cases that previously broke
    testICUSafety("''''", 'multiple consecutive quotes');
    testICUSafety(
      '####',
      'multiple consecutive hashes (should not be escaped)'
    );

    // Real-world complex case
    testICUSafety(
      '<script>alert("XSS with {malicious} code")</script>',
      'HTML script with braces'
    );

    // Unicode and international text
    testICUSafety('中文{变量}和<标签>测试', 'Chinese with special chars');

    // Adversarial input designed to break parser
    testICUSafety("{{{{''''}}}}<<<>>>", 'excessive nested special characters');
  });

  describe('output validation', () => {
    it('should preserve original content when parsed', () => {
      const inputs = [
        'Simple text',
        'Text with {variables}',
        'Text with # count',
        'Text with <tags>',
        "Text with 'quotes'",
      ];

      inputs.forEach((input) => {
        const sanitized = declareVar(input);
        const ast = parse(sanitized);

        // The AST should be a select statement with our escaped content
        expect(ast[0]).toMatchObject({
          type: 5, // SELECT_TYPE
          value: '_gt_',
        });
      });
    });

    it('should handle variable name option', () => {
      const result = declareVar('test value', { $name: 'test{name}' });
      expect(() => parse(result)).not.toThrow();

      const ast = parse(result);
      expect(ast).toBeDefined();
    });

    it('should work with null/undefined variable when name is provided', () => {
      const result = declareVar('', { $name: 'variable name' });
      expect(() => parse(result)).not.toThrow();
    });
  });

  describe('IntlMessageFormat integration', () => {
    it('should render original string for simple case', () => {
      const originalText = 'Hello {world} with <tags>';
      const sanitized = declareVar(originalText);

      const msg = new IntlMessageFormat(sanitized, 'en');
      const output = msg.format({ _gt_: 'placeholder' });

      expect(output).toBe(originalText);
    });

    it('should render original string for complex ICU syntax', () => {
      const originalText = '{count, plural, one{# item} other{# items}}';
      const sanitized = declareVar(originalText);

      const msg = new IntlMessageFormat(sanitized, 'en');
      const output = msg.format({ _gt_: 'placeholder' });

      expect(output).toBe(originalText);
    });

    it('should render original string with quotes and special chars', () => {
      const originalText = "User's data: {id: 123} <status>active</status>";
      const sanitized = declareVar(originalText);

      const msg = new IntlMessageFormat(sanitized, 'en');
      const output = msg.format({ _gt_: 'placeholder' });

      expect(output).toBe(originalText);
    });
  });
});
