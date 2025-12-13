import { describe, it, expect } from 'vitest';
import { extractVars } from '../extractVars';
import { GT } from 'generaltranslation';

describe('static extractVars', () => {
  describe('basic functionality', () => {
    it('should extract single variable from select element', () => {
      const input = 'Hello {_gt_, select, other {World}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'World' });
    });

    it('should extract multiple variables', () => {
      const input =
        'I play with {_gt_, select, other {toys}} at the {_gt_, select, other {park}}';
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
      const input = '{_gt_, select, other {simple text}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'simple text' });
    });

    it('should extract empty value when other option is empty', () => {
      const input = '{_gt_, select, other {}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: '' });
    });

    it('should handle values with special characters', () => {
      const input = '{_gt_, select, other {Hello, World! How are you?}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'Hello, World! How are you?' });
    });

    it('should handle values with numbers and symbols', () => {
      const input = '{_gt_, select, other {Price: $29.99}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'Price: $29.99' });
    });

    it('should handle values with unicode characters', () => {
      const input = '{_gt_, select, other {café naïve résumé}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'café naïve résumé' });
    });
  });

  describe('multiple unindexed variables', () => {
    it('should index multiple unindexed variables sequentially', () => {
      const input = '{_gt_, select, other {first}} then {_gt_, select, other {second}} then {_gt_, select, other {third}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'first', _gt_2: 'second', _gt_3: 'third' });
    });

    it('should handle many unindexed variables', () => {
      const input = '{_gt_, select, other {one}} {_gt_, select, other {two}} {_gt_, select, other {three}} {_gt_, select, other {four}} {_gt_, select, other {five}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'one', _gt_2: 'two', _gt_3: 'three', _gt_4: 'four', _gt_5: 'five' });
    });

    it('should handle unindexed variables with spacing variations', () => {
      const input = 'Start {_gt_, select, other {middle}} end';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'middle' });
    });
  });

  describe('multiple select options', () => {
    it('should extract from other option when multiple options present', () => {
      const input = '{_gt_, select, one {book} other {books}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'books' });
    });

    it('should extract from other option with complex case structure', () => {
      const input =
        '{_gt_, select, zero {no items} one {one item} few {few items} other {many items}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'many items' });
    });
  });

  describe('mixed content scenarios', () => {
    it('should extract variables while preserving non-_gt_ content', () => {
      const input =
        'User {username} has {_gt_, select, other {completed}} {count} tasks';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'completed' });
    });

    it('should handle variables mixed with regular selects', () => {
      const input =
        '{name, select, other {Hello}} {_gt_, select, other {World}} {_gt_, select, other {!}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'World', _gt_2: '!' });
    });

    it('should handle variables with surrounding text', () => {
      const input =
        'Welcome! You have {_gt_, select, other {new messages}} and {_gt_, select, other {notifications}}.';
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
        'I play with {_gt_, select, other {toys}} at the {_gt_, select, other {park}}';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'toys', _gt_2: 'park' });
    });

    it('should handle translated string format', () => {
      const input =
        '我在{_gt_, select, other {公园}}跟{_gt_, select, other {玩具}}去玩儿';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: '公园', _gt_2: '玩具' });
    });

    it('should handle multiple variables with consistent indexing', () => {
      const input =
        'First {_gt_, select, other {first}} then {_gt_, select, other {second}} finally {_gt_, select, other {third}}';
      const result = extractVars(input);
      expect(result).toEqual({
        _gt_1: 'first',
        _gt_2: 'second',
        _gt_3: 'third',
      });
    });

    it('should handle variables with whitespace and newlines', () => {
      const input =
        'Line 1\n{_gt_, select, other {content with spaces}}\n  Line 3';
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: 'content with spaces' });
    });
  });

  describe('edge cases with malformed input', () => {
    it('should ignore selects with non-literal content in other option', () => {
      const input = "{_gt_, select, other {'{name}' says hello}}";
      const result = extractVars(input);
      expect(result).toEqual({ _gt_1: '{name} says hello' });
    });

    it('should handle multiple unindexed variables correctly', () => {
      const input =
        '{_gt_, select, other {first}} and {_gt_, select, other {second}}';
      const result = extractVars(input);
      // Should index them sequentially
      expect(result).toEqual({ _gt_1: 'first', _gt_2: 'second' });
    });
  });

  describe('integration with formatMessage', () => {
    it('should extract variables from source and use them in target formatting', () => {
      const gt = new GT();
      
      // Source message with unindexed variables
      const source = 'I play with my friend {_gt_, select, other {Brian}} at the {_gt_, select, other {park}}';
      
      // Target message with collapsed indexed variables (no select syntax)
      const target = 'Je joue avec mon ami {_gt_1} au {_gt_2}';
      
      // Extract and index variables from the source
      const declaredVars = extractVars(source);
      
      // Format the target message with extracted variables
      const result = gt.formatMessage(target, {
        locales: ['fr'],
        variables: {
          ...declaredVars,
        },
      });
      
      // Should result in the properly translated message
      expect(result).toBe('Je joue avec mon ami Brian au park');
      
      // Verify that the extracted variables are correct
      expect(declaredVars).toEqual({
        _gt_1: 'Brian',
        _gt_2: 'park',
      });
    });

    it('should handle more complex source-to-target translation with multiple variables', () => {
      const gt = new GT();
      
      const source = 'Welcome {_gt_, select, other {John}}! You have {_gt_, select, other {5 messages}} in your {_gt_, select, other {inbox}}';
      const target = 'Bienvenue {_gt_1} ! Vous avez {_gt_2} dans votre {_gt_3}';
      
      const declaredVars = extractVars(source);
      
      const result = gt.formatMessage(target, {
        locales: ['fr'],
        variables: {
          ...declaredVars,
        },
      });
      
      expect(result).toBe('Bienvenue John ! Vous avez 5 messages dans votre inbox');
      expect(declaredVars).toEqual({
        _gt_1: 'John',
        _gt_2: '5 messages', 
        _gt_3: 'inbox',
      });
    });

    it('should handle empty other fields in source correctly', () => {
      const gt = new GT();
      
      const source = 'Hello {_gt_, select, other {}} world {_gt_, select, other {test}}';
      const target = 'Bonjour {_gt_1} monde {_gt_2}';
      
      const declaredVars = extractVars(source);
      
      const result = gt.formatMessage(target, {
        locales: ['fr'],
        variables: {
          ...declaredVars,
        },
      });
      
      expect(result).toBe('Bonjour  monde test');
      expect(declaredVars).toEqual({
        _gt_1: '',
        _gt_2: 'test',
      });
    });
  });
});
