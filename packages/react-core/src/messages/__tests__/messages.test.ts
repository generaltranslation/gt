import { describe, it, expect } from 'vitest';
import { icuMessageContainsVariables, msg, decodeMsg } from '../messages';

describe('icuMessageContainsVariables', () => {
  describe('should return false for messages without variables', () => {
    it('should return false for plain text', () => {
      expect(icuMessageContainsVariables('Hello world')).toBe(false);
    });

    it('should return false for text with literal braces in quotes', () => {
      expect(
        icuMessageContainsVariables("This has '{literal braces}' in quotes")
      ).toBe(false);
    });

    it('should return false for text with escaped apostrophes', () => {
      expect(icuMessageContainsVariables("Don''t use variables here")).toBe(
        false
      );
    });

    it('should return false for empty braces', () => {
      expect(icuMessageContainsVariables('This has {} empty braces')).toBe(
        false
      );
    });

    it('should return false for whitespace-only braces', () => {
      expect(
        icuMessageContainsVariables('This has {   } whitespace braces')
      ).toBe(false);
    });

    it('should return false for unmatched opening brace', () => {
      expect(icuMessageContainsVariables('This has { unmatched brace')).toBe(
        false
      );
    });

    it('should return false for unmatched closing brace', () => {
      expect(icuMessageContainsVariables('This has } unmatched brace')).toBe(
        false
      );
    });

    it('should return false for braces inside quoted text', () => {
      expect(icuMessageContainsVariables("'This {variable} is quoted'")).toBe(
        false
      );
    });

    it('should return false for complex quoted text with braces', () => {
      expect(
        icuMessageContainsVariables(
          "Use 'single quotes to escape {braces}' in ICU"
        )
      ).toBe(false);
    });
  });

  describe('should return true for messages with variables', () => {
    it('should return true for simple variable', () => {
      expect(icuMessageContainsVariables('Hello {name}')).toBe(true);
    });

    it('should return true for multiple variables', () => {
      expect(
        icuMessageContainsVariables('Hello {name}, you have {count} messages')
      ).toBe(true);
    });

    it('should return true for ICU plural format', () => {
      expect(
        icuMessageContainsVariables(
          '{count, plural, =0 {no items} =1 {one item} other {{count} items}}'
        )
      ).toBe(true);
    });

    it('should return true for ICU select format', () => {
      expect(
        icuMessageContainsVariables(
          '{gender, select, male {He} female {She} other {They}} went to the store'
        )
      ).toBe(true);
    });

    it('should return true for ICU number format', () => {
      expect(
        icuMessageContainsVariables('The price is {price, number, currency}')
      ).toBe(true);
    });

    it('should return true for ICU date format', () => {
      expect(icuMessageContainsVariables('Today is {date, date, short}')).toBe(
        true
      );
    });

    it('should return true for variables after quoted text', () => {
      expect(
        icuMessageContainsVariables("'Quoted text' followed by {variable}")
      ).toBe(true);
    });

    it('should return true for variables before quoted text', () => {
      expect(
        icuMessageContainsVariables("{variable} followed by 'quoted text'")
      ).toBe(true);
    });
  });

  describe('should handle edge cases correctly', () => {
    it('should handle empty string', () => {
      expect(icuMessageContainsVariables('')).toBe(false);
    });

    it('should handle string with only quotes', () => {
      expect(icuMessageContainsVariables("'just quotes'")).toBe(false);
    });

    it('should handle nested quotes correctly', () => {
      expect(icuMessageContainsVariables("'outer ''inner'' quotes'")).toBe(
        false
      );
    });

    it('should handle unmatched quotes with variables', () => {
      // Single quote starts escaping, so {variable} should be ignored
      expect(icuMessageContainsVariables("'unmatched quote {variable}")).toBe(
        false
      );
    });

    it('should handle variable with special characters', () => {
      expect(icuMessageContainsVariables('Hello {user_name}')).toBe(true);
    });

    it('should handle multiple braces in complex message', () => {
      expect(
        icuMessageContainsVariables(
          "'{not_a_var}' but {real_var} is real {} and {another}"
        )
      ).toBe(true);
    });
  });

  describe('should handle ICU MessageFormat escaping correctly', () => {
    it('should ignore variables in single quotes', () => {
      expect(icuMessageContainsVariables("Text with 'literal {braces}'")).toBe(
        false
      );
    });

    it('should handle escaped single quotes', () => {
      expect(icuMessageContainsVariables("Don''t ignore {variable}")).toBe(
        true
      );
    });

    it('should handle mixed escaped and unescaped quotes', () => {
      expect(
        icuMessageContainsVariables("Don''t ignore {var1} but 'ignore {var2}'")
      ).toBe(true);
    });

    it('should handle alternating quotes correctly', () => {
      expect(
        icuMessageContainsVariables(
          "'ignore {var1}' process {var2} 'ignore {var3}'"
        )
      ).toBe(true);
    });
  });
});

describe('msg function integration', () => {
  it('should not format messages without variables', () => {
    const result = msg('Plain text message');
    const decoded = decodeMsg(result);
    expect(decoded).toBe('Plain text message');
  });

  it('should format messages with variables', () => {
    const result = msg('Hello {name}', { name: 'World' });
    const decoded = decodeMsg(result);
    expect(decoded).toBe('Hello World');
  });

  it('should not format variables in quoted text', () => {
    const result = msg("'Hello {name}'");
    const decoded = decodeMsg(result);
    expect(decoded).toBe("'Hello {name}'"); // The quotes are preserved in the output
  });

  it('should handle complex ICU messages', () => {
    const result = msg(
      '{count, plural, =0 {no items} =1 {one item} other {{count} items}}',
      { count: 5 }
    );
    const decoded = decodeMsg(result);
    expect(decoded).toBe('5 items');
  });
});
