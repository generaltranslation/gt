import { describe, it, expect } from 'vitest';
import { condenseVars } from '../condenseVars';

describe('static condenseVars', () => {
  describe('basic functionality', () => {
    it('should convert select elements to arguments', () => {
      const input = 'Hello {_gt_1, select, other {World}}';
      const result = condenseVars(input);
      expect(result).toBe('Hello {_gt_1}');
    });

    it('should handle multiple indexed selects', () => {
      const input =
        'I play with {_gt_1, select, other {toys}} at the {_gt_2, select, other {park}}';
      const result = condenseVars(input);
      expect(result).toBe('I play with {_gt_1} at the {_gt_2}');
    });

    it('should preserve non-indexed selects', () => {
      const input =
        '{name, select, other {Hello}} {_gt_1, select, other {World}}';
      const result = condenseVars(input);
      expect(result).toBe('{name,select,other{Hello}} {_gt_1}');
    });

    it('should preserve plain text', () => {
      const input = 'Plain text without any variables';
      const result = condenseVars(input);
      expect(result).toBe('Plain text without any variables');
    });

    it('should preserve non-select variables', () => {
      const input = 'Hello {name}';
      const result = condenseVars(input);
      expect(result).toBe('Hello {name}');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const input = '';
      const result = condenseVars(input);
      expect(result).toBe('');
    });

    it('should handle selects with multiple options', () => {
      const input = '{_gt_1, select, one {book} other {books}}';
      const result = condenseVars(input);
      expect(result).toBe('{_gt_1}');
    });

    it('should handle nested selects within indexed select', () => {
      const input =
        '{_gt_1, select, other {I have {count, plural, one {book} other {books}}}}';
      const result = condenseVars(input);
      expect(result).toBe('{_gt_1}');
    });

    it('should handle mixed indexed and regular arguments', () => {
      const input =
        'User {username} has {_gt_1, select, other {completed}} {count} tasks';
      const result = condenseVars(input);
      expect(result).toBe('User {username} has {_gt_1} {count} tasks');
    });
  });

  describe('number variations', () => {
    it('should handle single digit indexes', () => {
      const input = '{_gt_5, select, other {value}}';
      const result = condenseVars(input);
      expect(result).toBe('{_gt_5}');
    });

    it('should handle multi-digit indexes', () => {
      const input = '{_gt_123, select, other {value}}';
      const result = condenseVars(input);
      expect(result).toBe('{_gt_123}');
    });

    it('should handle zero index', () => {
      const input = '{_gt_0, select, other {value}}';
      const result = condenseVars(input);
      expect(result).toBe('{_gt_0}');
    });
  });

  describe('invalid patterns should not be processed', () => {
    it('should not process selects without _gt_ prefix', () => {
      const input = '{gt_1, select, other {value}}';
      const result = condenseVars(input);
      expect(result).toBe('{gt_1, select, other {value}}');
    });

    it('should not process selects with invalid suffix', () => {
      const input = '{_gt_a, select, other {value}}';
      const result = condenseVars(input);
      expect(result).toBe('{_gt_a,select,other{value}}');
    });

    it('should not process selects with extra characters', () => {
      const input = '{_gt_1x, select, other {value}}';
      const result = condenseVars(input);
      expect(result).toBe('{_gt_1x,select,other{value}}');
    });

    it('should not process non-select elements with _gt_ pattern', () => {
      const input = 'Hello {_gt_1}';
      const result = condenseVars(input);
      expect(result).toBe('Hello {_gt_1}');
    });
  });

  describe('complex scenarios', () => {
    it('should handle the example from documentation', () => {
      const input =
        'I play with {_gt_1, select, other {toys}} at the {_gt_2, select, other {park}}';
      const result = condenseVars(input);
      expect(result).toBe('I play with {_gt_1} at the {_gt_2}');
    });

    it('should handle mixed content with text, selects, and arguments', () => {
      const input =
        'Welcome {username}! You have {_gt_1, select, one {message} other {messages}} and {count} notifications.';
      const result = condenseVars(input);
      expect(result).toBe(
        'Welcome {username}! You have {_gt_1} and {count} notifications.'
      );
    });

    it('should preserve formatting and whitespace', () => {
      const input =
        'Line 1\nHas {_gt_1, select, other {content}}\n  with spacing';
      const result = condenseVars(input);
      expect(result).toBe('Line 1\nHas {_gt_1}\n  with spacing');
    });
  });
});
