import { describe, it, expect } from 'vitest';
import { extractVars } from '../extractVars';

describe('static extractVars', () => {
  describe('basic functionality', () => {
    it('should extract single variable from select element', () => {
      const input = 'Hello {_gt_1, select, other {World}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'World' });
    });

    it('should extract multiple variables', () => {
      const input =
        'I play with {_gt_1, select, other {toys}} at the {_gt_2, select, other {park}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'toys', _gt_2: 'park' });
    });

    it('should return empty object when no variables present', () => {
      const input = 'Plain text without any variables';
      const result = extractVars(input);
      expect(result).toEqual({});
    });

    it('should return empty object when no _gt_ variables present', () => {
      const input = 'Hello {name, select, other {World}}';
      const result = extractVars(input);
      expect(result).toEqual({});
    });

    it('should handle empty string', () => {
      const input = '';
      const result = extractVars(input);
      expect(result).toEqual({});
    });
  });

  describe('variable value extraction', () => {
    it('should extract simple text values', () => {
      const input = '{_gt_1, select, other {simple text}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'simple text' });
    });

    it('should extract empty value when other option is empty', () => {
      const input = '{_gt_1, select, other {}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: '' });
    });

    it('should handle values with special characters', () => {
      const input = '{_gt_1, select, other {Hello, World! How are you?}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'Hello, World! How are you?' });
    });

    it('should handle values with numbers and symbols', () => {
      const input = '{_gt_1, select, other {Price: $29.99}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'Price: $29.99' });
    });

    it('should handle values with unicode characters', () => {
      const input = '{_gt_1, select, other {café naïve résumé}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'café naïve résumé' });
    });
  });

  describe('number variations', () => {
    it('should handle single digit indexes', () => {
      const input = '{_gt_5, select, other {value5}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_5: 'value5' });
    });

    it('should handle multi-digit indexes', () => {
      const input = '{_gt_123, select, other {value123}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_123: 'value123' });
    });

    it('should handle zero index', () => {
      const input = '{_gt_0, select, other {value0}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_0: 'value0' });
    });
  });

  describe('multiple select options', () => {
    it('should extract from other option when multiple options present', () => {
      const input = '{_gt_1, select, one {book} other {books}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'books' });
    });

    it('should extract from other option with complex case structure', () => {
      const input =
        '{_gt_1, select, zero {no items} one {one item} few {few items} other {many items}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'many items' });
    });
  });

  describe('mixed content scenarios', () => {
    it('should extract variables while preserving non-_gt_ content', () => {
      const input =
        'User {username} has {_gt_1, select, other {completed}} {count} tasks';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'completed' });
    });

    it('should handle variables mixed with regular selects', () => {
      const input =
        '{name, select, other {Hello}} {_gt_1, select, other {World}} {_gt_2, select, other {!}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'World', _gt_2: '!' });
    });

    it('should handle variables with surrounding text', () => {
      const input =
        'Welcome! You have {_gt_1, select, other {new messages}} and {_gt_2, select, other {notifications}}.';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'new messages', _gt_2: 'notifications' });
    });
  });

  describe('invalid patterns should be ignored', () => {
    it('should ignore selects without _gt_ prefix', () => {
      const input = '{gt_1, select, other {value}}';
      const result = extractVars(input);
      expect(result).toEqual({});
    });

    it('should ignore selects with invalid suffix', () => {
      const input = '{_gt_a, select, other {value}}';
      const result = extractVars(input);
      expect(result).toEqual({});
    });

    it('should ignore selects with extra characters', () => {
      const input = '{_gt_1x, select, other {value}}';
      const result = extractVars(input);
      expect(result).toEqual({});
    });

    it('should ignore non-select elements with _gt_ pattern', () => {
      const input = 'Hello {_gt_1}';
      const result = extractVars(input);
      expect(result).toEqual({});
    });

    it('should ignore plural elements with _gt_ pattern', () => {
      const input = '{_gt_1, plural, other {items}}';
      const result = extractVars(input);
      expect(result).toEqual({});
    });
  });

  describe('complex scenarios', () => {
    it('should handle the example from documentation', () => {
      const input =
        'I play with {_gt_1, select, other {toys}} at the {_gt_2, select, other {park}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'toys', _gt_2: 'park' });
    });

    it('should handle translated string format', () => {
      const input =
        '我在{_gt_2, select, other {公园}}跟{_gt_1, select, other {玩具}}去玩儿';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: '玩具', _gt_2: '公园' });
    });

    it('should handle mixed ordering of variables', () => {
      const input =
        'First {_gt_3, select, other {third}} then {_gt_1, select, other {first}} finally {_gt_2, select, other {second}}';
      const result = extractVars(input);
      expect(result).toEqual({
        _gt_1: 'first',
        _gt_2: 'second',
        _gt_3: 'third',
      });
    });

    it('should handle variables with whitespace and newlines', () => {
      const input =
        'Line 1\n{_gt_1, select, other {content with spaces}}\n  Line 3';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'content with spaces' });
    });
  });

  describe('edge cases with malformed input', () => {
    it('should ignore selects with non-literal content in other option', () => {
      const input = "{_gt_1, select, other {'{name}' says hello}}";
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: '{name} says hello' });
    });

    it('should handle duplicate variable numbers', () => {
      const input =
        '{_gt_1, select, other {first}} and {_gt_1, select, other {second}}';
      const result = extractVars(input);
      // Should extract the last occurrence
      expect(result).toEqual({ _gt_1: 'second' });
    });
  });
});
