import { describe, it, expect } from 'vitest';
import {
  trimNormalWhitespace,
  hasSignificantWhitespace,
  isNormalWhitespace,
} from '../whitespace';

describe('whitespace', () => {
  describe('trimNormalWhitespace', () => {
    it('should handle basic cases', () => {
      expect(trimNormalWhitespace('  hello  ')).toBe('hello');
      expect(trimNormalWhitespace('hello')).toBe('hello');
      expect(trimNormalWhitespace('')).toBe('');
    });

    it('should handle leading whitespace only', () => {
      expect(trimNormalWhitespace('  hello')).toBe('hello');
      expect(trimNormalWhitespace('\t\nhello')).toBe('hello');
      expect(trimNormalWhitespace('   \t  hello')).toBe('hello');
    });

    it('should handle trailing whitespace only', () => {
      expect(trimNormalWhitespace('hello  ')).toBe('hello');
      expect(trimNormalWhitespace('hello\t\n')).toBe('hello');
      expect(trimNormalWhitespace('hello   \t  ')).toBe('hello');
    });

    it('should handle mixed normal whitespace types', () => {
      expect(trimNormalWhitespace(' \t\n hello world \n\t ')).toBe(
        'hello world'
      );
      expect(trimNormalWhitespace('\n\r\t  content  \t\r\n')).toBe('content');
    });

    it('should return empty for all normal whitespace', () => {
      expect(trimNormalWhitespace('   \t\n   ')).toBe('');
      expect(trimNormalWhitespace('\n\n\n')).toBe('');
      expect(trimNormalWhitespace('\t\t\t')).toBe('');
      expect(trimNormalWhitespace(' ')).toBe('');
    });

    it('should preserve HTML entities (nbsp, shy, etc)', () => {
      expect(trimNormalWhitespace('\u00A0hello\u00A0')).toBe(
        '\u00A0hello\u00A0'
      );
      expect(trimNormalWhitespace('\u00ADhello\u00AD')).toBe(
        '\u00ADhello\u00AD'
      );
      expect(trimNormalWhitespace('\u202Fhello\u202F')).toBe(
        '\u202Fhello\u202F'
      );
      expect(trimNormalWhitespace('\u2060hello\u2060')).toBe(
        '\u2060hello\u2060'
      );
    });

    it('should handle mixed normal and significant whitespace', () => {
      expect(trimNormalWhitespace('  \u00A0hello\u00A0  ')).toBe(
        '\u00A0hello\u00A0'
      );
      expect(trimNormalWhitespace('\t\u00A0  hello  \u00A0\n')).toBe(
        '\u00A0  hello  \u00A0'
      );
      expect(trimNormalWhitespace(' \n\u202Fcontent\u202F \t')).toBe(
        '\u202Fcontent\u202F'
      );
    });

    it('should preserve all significant whitespace', () => {
      expect(trimNormalWhitespace('\u00A0\u00A0')).toBe('\u00A0\u00A0');
      expect(trimNormalWhitespace('\u202F')).toBe('\u202F');
      expect(trimNormalWhitespace('\u00A0\u00AD\u202F')).toBe(
        '\u00A0\u00AD\u202F'
      );
    });

    it('should preserve Unicode whitespace', () => {
      expect(trimNormalWhitespace('\u2000hello\u2000')).toBe(
        '\u2000hello\u2000'
      );
      expect(trimNormalWhitespace('\u3000content\u3000')).toBe(
        '\u3000content\u3000'
      );
    });

    it('should handle single character content', () => {
      expect(trimNormalWhitespace('  x  ')).toBe('x');
      expect(trimNormalWhitespace('\t\n\u00A0\n\t')).toBe('\u00A0');
    });

    it('should preserve internal normal whitespace', () => {
      expect(trimNormalWhitespace('  hello world  ')).toBe('hello world');
      expect(trimNormalWhitespace('\thello\tworld\t')).toBe('hello\tworld');
      expect(trimNormalWhitespace('\nhello\nworld\n')).toBe('hello\nworld');
    });

    it('should preserve internal significant whitespace', () => {
      expect(trimNormalWhitespace('  hello\u00A0world  ')).toBe(
        'hello\u00A0world'
      );
      expect(trimNormalWhitespace('\thello\u202Fworld\t')).toBe(
        'hello\u202Fworld'
      );
    });

    it('should handle complex mixed scenarios', () => {
      expect(
        trimNormalWhitespace(' \t\u00A0 hello \u202F world \u00A0\n ')
      ).toBe('\u00A0 hello \u202F world \u00A0');
      expect(trimNormalWhitespace('\n\u2000\u3000content\u3000\u2000\n')).toBe(
        '\u2000\u3000content\u3000\u2000'
      );
    });
  });

  describe('hasSignificantWhitespace', () => {
    it('should return false for no significant whitespace', () => {
      expect(hasSignificantWhitespace('hello world')).toBe(false);
      expect(hasSignificantWhitespace('  \t\n  ')).toBe(false);
      expect(hasSignificantWhitespace('')).toBe(false);
      expect(hasSignificantWhitespace('normal spaces only')).toBe(false);
    });

    it('should return true for HTML entities', () => {
      expect(hasSignificantWhitespace('\u00A0')).toBe(true);
      expect(hasSignificantWhitespace('hello\u00A0world')).toBe(true);
      expect(hasSignificantWhitespace('  \u202F  ')).toBe(true);
      expect(hasSignificantWhitespace('\u00AD')).toBe(true);
      expect(hasSignificantWhitespace('\u2060')).toBe(true);
    });

    it('should return true for Unicode whitespace', () => {
      expect(hasSignificantWhitespace('\u2000content')).toBe(true);
      expect(hasSignificantWhitespace('\u3000')).toBe(true);
    });

    it('should handle mixed cases', () => {
      expect(hasSignificantWhitespace(' \t\u00A0\n ')).toBe(true);
      expect(hasSignificantWhitespace('text\u2000text')).toBe(true);
    });
  });

  describe('isNormalWhitespace', () => {
    it('should recognize normal whitespace characters', () => {
      expect(isNormalWhitespace(' ')).toBe(true);
      expect(isNormalWhitespace('\t')).toBe(true);
      expect(isNormalWhitespace('\n')).toBe(true);
      expect(isNormalWhitespace('\r')).toBe(true);
    });

    it('should not recognize HTML entities as normal', () => {
      expect(isNormalWhitespace('\u00A0')).toBe(false); // &nbsp;
      expect(isNormalWhitespace('\u00AD')).toBe(false); // &shy;
      expect(isNormalWhitespace('\u202F')).toBe(false); // narrow no-break space
      expect(isNormalWhitespace('\u2060')).toBe(false); // word joiner
    });

    it('should not recognize Unicode whitespace as normal', () => {
      expect(isNormalWhitespace('\u2000')).toBe(false); // en quad
      expect(isNormalWhitespace('\u3000')).toBe(false); // ideographic space
    });

    it('should not recognize non-whitespace as normal', () => {
      expect(isNormalWhitespace('a')).toBe(false);
      expect(isNormalWhitespace('1')).toBe(false);
      expect(isNormalWhitespace('!')).toBe(false);
    });

    it('should handle multi-character strings correctly', () => {
      expect(isNormalWhitespace('  ')).toBe(false); // Multiple characters
      expect(isNormalWhitespace('')).toBe(false); // Empty string
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      expect(trimNormalWhitespace('')).toBe('');
      expect(hasSignificantWhitespace('')).toBe(false);
    });

    it('should handle strings with only significant whitespace', () => {
      expect(trimNormalWhitespace('\u00A0\u202F\u2000')).toBe(
        '\u00A0\u202F\u2000'
      );
      expect(hasSignificantWhitespace('\u00A0\u202F\u2000')).toBe(true);
    });

    it('should handle very long strings', () => {
      const longNormal =
        '   \t\n'.repeat(1000) + 'content' + '   \t\n'.repeat(1000);
      expect(trimNormalWhitespace(longNormal)).toBe('content');

      const longSignificant = '\u00A0'.repeat(1000);
      expect(trimNormalWhitespace(longSignificant)).toBe(longSignificant);
      expect(hasSignificantWhitespace(longSignificant)).toBe(true);
    });

    it('should handle mixed Unicode scenarios', () => {
      // Mix of all types
      const mixed = ' \t\n\u00A0\u202F\u2000content\u3000\u00AD\u2060 \t\n ';
      const expected = '\u00A0\u202F\u2000content\u3000\u00AD\u2060';
      expect(trimNormalWhitespace(mixed)).toBe(expected);
      expect(hasSignificantWhitespace(mixed)).toBe(true);
    });

    it('should be consistent with character classification', () => {
      const testChars = [
        ' ',
        '\t',
        '\n',
        '\r', // Normal
        '\u00A0',
        '\u00AD',
        '\u202F',
        '\u2060', // HTML entities
        '\u2000',
        '\u3000', // Unicode whitespace
        'a',
        '1',
        '!', // Non-whitespace
      ];

      for (const ch of testChars) {
        const isNormal = isNormalWhitespace(ch);
        const testString = `  ${ch}  `;
        const trimmed = trimNormalWhitespace(testString);

        if (isNormal) {
          // If character is normal whitespace, it should be part of trimmed content
          // unless it's the only content (in which case string becomes empty)
          expect(trimmed === '' || trimmed === ch).toBe(true);
        } else {
          // If character is not normal whitespace, it should be preserved
          expect(trimmed).toBe(ch);
        }
      }
    });
  });

  describe('real-world JSX scenarios', () => {
    it('should handle typical JSX whitespace', () => {
      // Common JSX text node scenarios
      expect(trimNormalWhitespace('\n  Hello world  \n')).toBe('Hello world');
      expect(trimNormalWhitespace('\t\t<span>content</span>\t\t')).toBe(
        '<span>content</span>'
      );
    });

    it('should preserve significant whitespace in JSX text', () => {
      // Intentional non-breaking spaces should be preserved
      expect(trimNormalWhitespace('\n  Hello\u00A0world  \n')).toBe(
        'Hello\u00A0world'
      );
      expect(trimNormalWhitespace('  Price:\u00A0$100  ')).toBe(
        'Price:\u00A0$100'
      );
    });

    it('should handle JSX with mixed whitespace types', () => {
      // Complex real-world scenario
      const jsxText = '\n    Welcome\u00A0to our\u202Fstore!    \n';
      expect(trimNormalWhitespace(jsxText)).toBe(
        'Welcome\u00A0to our\u202Fstore!'
      );
      expect(hasSignificantWhitespace(jsxText)).toBe(true);
    });
  });
});
