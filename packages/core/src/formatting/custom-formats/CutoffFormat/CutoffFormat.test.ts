import { describe, it, expect } from 'vitest';
import { CutoffFormatConstructor } from './CutoffFormat';

describe('CutoffFormatConstructor', () => {
  describe('constructor', () => {
    it('should create with default options', () => {
      const formatter = new CutoffFormatConstructor('en');
      const options = formatter.resolvedOptions();

      expect(options.style).toBeUndefined();
      expect(options.maxChars).toBeUndefined();
      expect(options.terminator).toBeUndefined();
      expect(options.separator).toBeUndefined();
    });

    it('should handle array of locales', () => {
      const formatter = new CutoffFormatConstructor(['fr', 'en']);
      const options = formatter.resolvedOptions();

      expect(options.terminator).toBeUndefined();
      expect(options.separator).toBeUndefined();
    });

    it('should handle empty locale array', () => {
      const formatter = new CutoffFormatConstructor([]);
      expect(() => formatter.format('test')).not.toThrow();
    });

    it('should throw error for invalid style', () => {
      expect(() => {
        new CutoffFormatConstructor('en', { style: 'invalid' as any });
      }).toThrow();
    });

    it('should handle malformed locales gracefully', () => {
      const formatter = new CutoffFormatConstructor('invalid-locale');
      expect(() => formatter.format('test')).not.toThrow();
    });

    it('should resolve terminator options for maxChars undefined', () => {
      const formatter = new CutoffFormatConstructor('fr', {
        maxChars: undefined,
      });
      const options = formatter.resolvedOptions();

      expect(options.terminator).toBeUndefined();
      expect(options.separator).toBeUndefined();
    });

    it('should resolve terminator options when maxChars is defined', () => {
      const formatter = new CutoffFormatConstructor('fr', { maxChars: 5 });
      const options = formatter.resolvedOptions();

      expect(options.terminator).toBe('…');
      expect(options.separator).toBe('\u202F');
    });
  });

  describe('format method', () => {
    describe('positive maxChars', () => {
      it('should truncate and add ellipsis', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 5 });
        expect(formatter.format('Hello, world!')).toBe('Hell…');
      });

      it('should return original string if shorter than maxChars', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 20 });
        expect(formatter.format('Short')).toBe('Short');
      });

      it('should return original string if equal to maxChars', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 5 });
        expect(formatter.format('Hello')).toBe('Hello');
      });
    });

    describe('negative maxChars', () => {
      it('should slice from end and prepend ellipsis', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: -3 });
        expect(formatter.format('Hello, world!')).toBe('…d!');
      });
    });

    describe('zero maxChars', () => {
      it('should return empty string', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 0 });
        expect(formatter.format('Hello, world!')).toBe('');
      });
    });

    describe('undefined maxChars', () => {
      it('should return original string with no cutoff', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: undefined,
        });
        expect(formatter.format('Hello, world!')).toBe('Hello, world!');
      });
    });

    describe('none style', () => {
      it('should truncate without terminator', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 5,
          style: 'none',
        });
        expect(formatter.format('Hello, world!')).toBe('Hello');
      });
    });

    describe('locale-specific terminators', () => {
      it('should use French terminator and separator', () => {
        const formatter = new CutoffFormatConstructor('fr', { maxChars: 7 });
        expect(formatter.format('Bonjour le monde')).toBe('Bonjo\u202F…');
      });

      it('should use Chinese terminator', () => {
        const formatter = new CutoffFormatConstructor('zh', { maxChars: 4 });
        expect(formatter.format('你好世界')).toBe('你好世界');
      });

      it('should use Japanese terminator', () => {
        const formatter = new CutoffFormatConstructor('ja', { maxChars: 4 });
        expect(formatter.format('こんにちは')).toBe('こん……');
      });

      it('should fall back to default terminator for unknown locale', () => {
        const formatter = new CutoffFormatConstructor('de', { maxChars: 6 });
        expect(formatter.format('Hallo Welt')).toBe('Hallo…');
      });
    });

    describe('custom terminator and separator', () => {
      it('should use custom terminator', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 8,
          terminator: '...',
        });
        expect(formatter.format('Hello, world!')).toBe('Hello...');
      });

      it('should use custom separator', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 9,
          terminator: '...',
          separator: ' ',
        });
        expect(formatter.format('Hello, world!')).toBe('Hello ...');
      });

      it('should override locale-specific separator', () => {
        const formatter = new CutoffFormatConstructor('fr', {
          maxChars: 7,
          separator: ' ',
        });
        expect(formatter.format('Bonjour')).toBe('Bonjour');
      });

      it('should ignore separator when no terminator', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 5,
          style: 'none',
          separator: ' ',
        });
        expect(formatter.format('Hello, world!')).toBe('Hello');
      });
    });

    describe('edge cases', () => {
      it('should handle empty string', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 5 });
        expect(formatter.format('')).toBe('');
      });

      it('should handle single character string', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 5 });
        expect(formatter.format('H')).toBe('H');
      });
    });
  });

  describe('formatToParts method', () => {
    describe('postpended cutoff (positive maxChars)', () => {
      it('should return parts without separator', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 5 });
        const parts = formatter.formatToParts('Hello, world!');
        expect(parts).toEqual(['Hell', '…']);
      });

      it('should return parts with separator', () => {
        const formatter = new CutoffFormatConstructor('fr', { maxChars: 7 });
        const parts = formatter.formatToParts('Bonjour');
        expect(parts).toEqual(['Bonjour']);
      });

      it('should return single part when no cutoff needed', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 10 });
        const parts = formatter.formatToParts('Short');
        expect(parts).toEqual(['Short']);
      });
    });

    describe('prepended cutoff (negative maxChars)', () => {
      it('should return prepended parts without separator', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: -3 });
        const parts = formatter.formatToParts('Hello, world!');
        expect(parts).toEqual(['…', 'd!']);
      });

      it('should return prepended parts with separator', () => {
        const formatter = new CutoffFormatConstructor('fr', {
          maxChars: -3,
          separator: ' ',
        });
        const parts = formatter.formatToParts('Bonjour');
        expect(parts).toEqual(['…', ' ', 'r']);
      });
    });

    describe('no cutoff scenarios', () => {
      it('should return single part when maxChars is undefined', () => {
        const formatter = new CutoffFormatConstructor('en');
        const parts = formatter.formatToParts('Hello, world!');
        expect(parts).toEqual(['Hello, world!']);
      });

      it('should return single part when style is none', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 5,
          style: 'none',
        });
        const parts = formatter.formatToParts('Hello, world!');
        expect(parts).toEqual(['Hello']);
      });

      it('should return empty string when maxChars is 0', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 0 });
        const parts = formatter.formatToParts('Hello');
        expect(parts).toEqual(['']);
      });
    });
  });

  describe('resolvedOptions method', () => {
    it('should return resolved options with all properties', () => {
      const formatter = new CutoffFormatConstructor('en', {
        maxChars: 10,
        style: 'ellipsis',
        terminator: '...',
        separator: ' ',
      });

      const options = formatter.resolvedOptions();
      expect(options).toEqual({
        maxChars: 10,
        style: 'ellipsis',
        terminator: '...',
        separator: ' ',
      });
    });

    it('should show undefined values correctly', () => {
      const formatter = new CutoffFormatConstructor('en', { style: 'none' });
      const options = formatter.resolvedOptions();

      expect(options.terminator).toBeUndefined();
      expect(options.separator).toBeUndefined();
      expect(options.maxChars).toBeUndefined();
    });
  });

  describe('integration with locale fallback', () => {
    it('should handle locale fallback correctly', () => {
      const formatter = new CutoffFormatConstructor('es-ES', { maxChars: 6 });
      expect(formatter.format('Hola mundo')).toBe('Hola …');
    });

    it('should use language code for terminator lookup', () => {
      const formatter = new CutoffFormatConstructor('zh-CN', { maxChars: 4 });
      expect(formatter.format('你好世界')).toBe('你好世界');
    });
  });

  describe('edge cases and boundary conditions', () => {
    describe('terminator length equals or exceeds maxChars', () => {
      it('should return empty string when maxChars equals terminator length', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 1,
          terminator: '…',
        });
        expect(formatter.format('Hello')).toBe('');
      });

      it('should return empty string when maxChars is less than terminator length', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 2,
          terminator: '...',
        });
        expect(formatter.format('Hello')).toBe('');
      });

      it('should return empty string when maxChars equals terminator + separator length', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 4,
          terminator: '...',
          separator: ' ',
        });
        expect(formatter.format('Hello')).toBe('');
      });

      it('should handle negative maxChars with long terminator', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: -1,
          terminator: '…',
        });
        expect(formatter.format('Hello')).toBe('');
      });
    });

    describe('zero and minimal adjustedChars scenarios', () => {
      it('should handle adjustedChars of exactly 0', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 3,
          terminator: '...',
        });
        expect(formatter.format('Hello')).toBe('');
      });

      it('should handle adjustedChars of 1 with positive maxChars', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 4,
          terminator: '...',
        });
        expect(formatter.format('Hello')).toBe('H...');
      });

      it('should handle adjustedChars of -1 with negative maxChars', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: -4,
          terminator: '...',
        });
        expect(formatter.format('Hello')).toBe('...o');
      });
    });

    describe('very long terminators and separators', () => {
      it('should handle very long custom terminator', () => {
        const longTerminator = '... (truncated) ...';
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 25,
          terminator: longTerminator,
        });
        expect(formatter.format('This is a very long string')).toBe(
          'This i... (truncated) ...'
        );
      });

      it('should handle long separator with long terminator', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 15,
          terminator: '...',
          separator: ' [MORE] ',
        });
        expect(formatter.format('Hello world')).toBe('Hello world');
      });

      it('should return empty string when terminator + separator exceeds maxChars', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 5,
          terminator: '...',
          separator: ' [MORE] ',
        });
        expect(formatter.format('Hello')).toBe('Hello');
      });
    });

    describe('boundary conditions with exact lengths', () => {
      it('should handle string length exactly matching maxChars', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 5 });
        expect(formatter.format('Hello')).toBe('Hello');
      });

      it('should handle string length one character longer than maxChars', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 5 });
        expect(formatter.format('Hello!')).toBe('Hell…');
      });

      it('should handle string length one character shorter than maxChars', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 6 });
        expect(formatter.format('Hello')).toBe('Hello');
      });

      it('should handle negative maxChars with exact string length', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: -5 });
        expect(formatter.format('Hello')).toBe('Hello');
      });
    });

    describe('unicode and special characters', () => {
      it('should handle mixed unicode and ASCII', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 6 });
        expect(formatter.format('Hello 世界')).toBe('Hello…');
      });

      it('should handle newlines and tabs in input', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 8 });
        expect(formatter.format('Line1\nLine2\tTab')).toBe('Line1\nL…');
      });

      it('should handle unicode terminator with unicode input', () => {
        const formatter = new CutoffFormatConstructor('zh', { maxChars: 5 });
        expect(formatter.format('这是一个测试字符串')).toBe('这是一……');
      });

      it('should handle zero-width characters', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 6 });
        const textWithZeroWidth = 'He\u200Bllo\u200CWor\u200Dld';
        expect(formatter.format(textWithZeroWidth)).toBe('He\u200Bll…');
      });
    });

    describe('formatToParts edge cases', () => {
      it('should return correct parts when adjustedChars is 0', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 3,
          terminator: '...',
        });
        expect(formatter.formatToParts('Hello')).toEqual(['']);
      });
      it('should return correct parts when adjustedChars is less than 0', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 2,
          terminator: '...',
        });
        expect(formatter.formatToParts('Hello')).toEqual(['']);
      });

      it('should return correct parts for negative adjustedChars', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: -4,
          terminator: '...',
        });
        expect(formatter.formatToParts('Hello')).toEqual(['...', 'o']);
      });

      it('should return truncated part when terminator is removed due to length', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 2,
          terminator: '...',
        });
        expect(formatter.formatToParts('Hello')).toEqual(['']);
      });
    });

    describe('extreme values', () => {
      it('should handle very large maxChars', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: 10000,
        });
        expect(formatter.format('Short string')).toBe('Short string');
      });

      it('should handle very large negative maxChars', () => {
        const formatter = new CutoffFormatConstructor('en', {
          maxChars: -10000,
        });
        expect(formatter.format('Short string')).toBe('Short string');
      });

      it('should handle maxChars of 1 with single character string', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: 1 });
        expect(formatter.format('H')).toBe('H');
      });

      it('should handle maxChars of -1 with single character string', () => {
        const formatter = new CutoffFormatConstructor('en', { maxChars: -1 });
        expect(formatter.format('H')).toBe('H');
      });
    });
  });
});
