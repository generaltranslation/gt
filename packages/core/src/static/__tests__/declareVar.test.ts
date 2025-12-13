import { describe, it, expect } from 'vitest';
import { parse } from '@formatjs/icu-messageformat-parser';
import { IntlMessageFormat } from 'intl-messageformat';
import { declareVar } from '../declareVar';
import { indexVars } from 'generaltranslation/internal';
import { decodeVars } from '../decodeVars';

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

  describe('exact output validation', () => {
    it('should handle null/undefined variable', () => {
      const originalText = undefined;
      const sanitized = declareVar(originalText);

      expect(sanitized).toBe('{_gt_, select, other {}}');
    });
  });

  describe('indexVars with declareVar integration', () => {
    it('should index variables in strings with single declareVar invocation', () => {
      const declaredVar = declareVar('Hello World');
      const input = `Welcome to ${declaredVar} application`;
      const result = indexVars(input);

      expect(result).toBe(
        'Welcome to {_gt_1, select, other {Hello World}} application'
      );
      expect(() => parse(result)).not.toThrow();
    });

    it('should index multiple declareVar invocations', () => {
      const firstVar = declareVar('John');
      const secondVar = declareVar('Developer');
      const input = `Hello ${firstVar}, you are a ${secondVar}!`;
      const result = indexVars(input);

      expect(result).toBe(
        'Hello {_gt_1, select, other {John}}, you are a {_gt_2, select, other {Developer}}!'
      );
      expect(() => parse(result)).not.toThrow();
    });

    it('should handle declareVar with complex content', () => {
      const complexVar = declareVar(
        '{count, plural, one{# item} other{# items}}'
      );
      const input = `You have ${complexVar} in your cart`;
      const result = indexVars(input);

      expect(result).toBe(
        "You have {_gt_1, select, other {'{count, plural, one{# item} other{# items}}'}} in your cart"
      );
      expect(() => parse(result)).not.toThrow();
    });

    it('should handle declareVar with named variables', () => {
      const namedVar = declareVar('User Profile', { $name: 'profile_section' });
      const input = `Navigate to ${namedVar} page`;
      const result = indexVars(input);

      expect(result).toBe(
        'Navigate to {_gt_1, select, other {User Profile} _gt_var_name {profile_section}} page'
      );
      expect(() => parse(result)).not.toThrow();
    });

    it('should handle mixed declareVar and manual ICU placeholders', () => {
      const declaredVar = declareVar('dynamic content');
      const input = `Welcome {_gt_, select, other {user}}! Here is ${declaredVar} and {_gt_, select, other {more info}}`;
      const result = indexVars(input);

      expect(result).toBe(
        'Welcome {_gt_1, select, other {user}}! Here is {_gt_2, select, other {dynamic content}} and {_gt_3, select, other {more info}}'
      );
      expect(() => parse(result)).not.toThrow();
    });

    it('should handle nested scenarios with declareVar inside ICU plurals', () => {
      const innerVar = declareVar('message');
      const input = `{count, plural, =0 {No ${innerVar}} =1 {One ${innerVar}} other {# messages}}`;
      const result = indexVars(input);

      expect(result).toBe(
        '{count, plural, =0 {No {_gt_1, select, other {message}}} =1 {One {_gt_2, select, other {message}}} other {# messages}}'
      );
      expect(() => parse(result)).not.toThrow();
    });

    it('should handle declareVar with special characters and maintain validity', () => {
      const specialVar = declareVar("Text with 'quotes' and {braces}");
      const emojiVar = declareVar('🚀 Rocket Launch 🌟');
      const input = `Status: ${specialVar} Event: ${emojiVar}`;
      const result = indexVars(input);

      expect(result).toBe(
        "Status: {_gt_1, select, other {Text with ''quotes'' and '{braces}'}} Event: {_gt_2, select, other {🚀 Rocket Launch 🌟}}"
      );
      expect(() => parse(result)).not.toThrow();
    });

    it('should handle complex real-world scenario with multiple declareVar calls', () => {
      const userName = declareVar('John Doe', { $name: 'user_name' });
      const itemCount = declareVar('{count, number}', { $name: 'item_count' });
      const timestamp = declareVar('{date, date, short}', {
        $name: 'last_login',
      });

      const input = `Welcome back ${userName}! You have ${itemCount} items. Last login: ${timestamp}`;
      const result = indexVars(input);

      const expected =
        "Welcome back {_gt_1, select, other {John Doe} _gt_var_name {user_name}}! You have {_gt_2, select, other {'{count, number}'} _gt_var_name {item_count}} items. Last login: {_gt_3, select, other {'{date, date, short}'} _gt_var_name {last_login}}";
      expect(result).toBe(expected);
      expect(() => parse(result)).not.toThrow();
    });
  });

  describe('decodeVars with declareVar integration', () => {
    it('should decode variables created with declareVar', () => {
      const declaredVar1 = declareVar('Hello World');
      const declaredVar2 = declareVar('Amazing');
      const input = `Welcome to ${declaredVar1} application! It is ${declaredVar2}!`;
      const result = decodeVars(input);

      expect(result).toBe('Welcome to Hello World application! It is Amazing!');
    });

    it('should decode variables with complex declareVar content', () => {
      const complexVar = declareVar(
        '{count, plural, one{# item} other{# items}}'
      );
      const input = `You have ${complexVar} in your cart`;
      const result = decodeVars(input);

      expect(result).toBe(
        'You have {count, plural, one{# item} other{# items}} in your cart'
      );
    });

    it('should decode variables with special characters from declareVar', () => {
      const specialVar = declareVar("Text with 'quotes' and {braces}");
      const emojiVar = declareVar('🚀 Rocket Launch 🌟');
      const input = `Status: ${specialVar} Event: ${emojiVar}`;
      const result = decodeVars(input);

      expect(result).toBe(
        "Status: Text with 'quotes' and {braces} Event: 🚀 Rocket Launch 🌟"
      );
    });

    it('should work with named variables from declareVar', () => {
      const namedVar = declareVar('User Profile', { $name: 'profile_section' });
      const input = `Navigate to ${namedVar} page`;
      const result = decodeVars(input);

      expect(result).toBe('Navigate to User Profile page');
    });
  });

  describe('integration with indexVars', () => {
    it('should decode indexed variables correctly', () => {
      const var1 = declareVar('John');
      const var2 = declareVar('Developer');
      const input = `Hello ${var1}, you are a ${var2}!`;

      // Then decode them
      const decoded = decodeVars(input);
      expect(decoded).toBe('Hello John, you are a Developer!');
    });

    it('should handle complex round-trip with indexVars', () => {
      const userName = declareVar('Alice', { $name: 'user_name' });
      const itemCount = declareVar('5 items', { $name: 'item_count' });
      const input = `Welcome back ${userName}! You have ${itemCount}.`;

      const decoded = decodeVars(input);

      expect(decoded).toBe('Welcome back Alice! You have 5 items.');
    });
  });
});
