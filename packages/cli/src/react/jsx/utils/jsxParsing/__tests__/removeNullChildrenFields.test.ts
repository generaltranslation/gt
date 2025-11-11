import { describe, it, expect } from 'vitest';
import { removeNullChildrenFields } from '../removeNullChildrenFields.js';
import type {
  JsxChildren,
  JsxElement,
  GTProp,
  Variable,
} from 'generaltranslation/types';

describe('removeNullChildrenFields', () => {
  describe('string children', () => {
    it('should return string unchanged', () => {
      const input = 'Hello world';
      const result = removeNullChildrenFields(input);
      expect(result).toBe('Hello world');
    });

    it('should handle empty string', () => {
      const input = '';
      const result = removeNullChildrenFields(input);
      expect(result).toBe('');
    });
  });

  describe('array of children', () => {
    it('should handle array of strings', () => {
      const input: JsxChildren = ['Hello', ' ', 'world'];
      const result = removeNullChildrenFields(input);
      expect(result).toEqual(['Hello', ' ', 'world']);
    });

    it('should handle mixed array with elements', () => {
      const input: JsxChildren = [
        'Text',
        { t: 'div', c: 'content' },
        'More text',
      ];
      const expected = ['Text', { t: 'div', c: 'content' }, 'More text'];
      const result = removeNullChildrenFields(input);
      expect(result).toEqual(expected);
    });

    it('should handle empty array', () => {
      const input: JsxChildren = [];
      const result = removeNullChildrenFields(input);
      expect(result).toEqual([]);
    });
  });

  describe('variable children', () => {
    it('should return variable unchanged', () => {
      const variable = { k: 'count' };
      const input = variable as any; // Type assertion for test
      const result = removeNullChildrenFields(input);
      expect(result).toBe(variable);
    });
  });

  describe('JsxElement with null children field', () => {
    it('should remove null c field', () => {
      const input: JsxElement = {
        t: 'div',
        c: null,
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({ t: 'div' });
      expect(result).not.toHaveProperty('c');
    });

    it('should remove undefined c field', () => {
      const input: JsxElement = {
        t: 'div',
        c: undefined,
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({ t: 'div' });
      expect(result).not.toHaveProperty('c');
    });

    it('should preserve non-null c field', () => {
      const input: JsxElement = {
        t: 'div',
        c: 'content',
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({ t: 'div', c: 'content' });
    });
  });

  describe('JsxElement with all fields', () => {
    it('should preserve all non-null fields', () => {
      const input: JsxElement = {
        t: 'div',
        i: 123,
        d: { pl: 'Enter text' },
        c: 'Hello world',
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({
        t: 'div',
        i: 123,
        d: { pl: 'Enter text' },
        c: 'Hello world',
      });
    });

    it('should remove only null/undefined fields', () => {
      const input: JsxElement = {
        t: 'div',
        i: null,
        d: { pl: 'Enter text' },
        c: undefined,
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({
        t: 'div',
        d: { pl: 'Enter text' },
      });
      expect(result).not.toHaveProperty('i');
      expect(result).not.toHaveProperty('c');
    });

    it('should handle zero as valid id', () => {
      const input: JsxElement = {
        t: 'div',
        i: 0,
        c: 'content',
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({
        t: 'div',
        i: 0,
        c: 'content',
      });
    });

    it('should handle empty string as valid tag', () => {
      const input: JsxElement = {
        t: '',
        c: 'content',
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({
        t: '',
        c: 'content',
      });
      expect(result).toHaveProperty('t');
    });
  });

  describe('GTProp handling', () => {
    it('should preserve GTProp branches', () => {
      const input: JsxElement = {
        t: 'div',
        d: {
          b: {
            case1: 'First case',
            case2: 'Second case',
          },
          t: 'b',
        },
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({
        t: 'div',
        d: {
          b: {
            case1: 'First case',
            case2: 'Second case',
          },
          t: 'b',
        },
      });
    });

    it('should recursively process GTProp content props', () => {
      const input: JsxElement = {
        t: 'div',
        d: {
          b: {
            case1: { t: 'span', c: null as unknown as string },
            case2: { t: 'strong', c: 'text' },
          },
        },
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({
        t: 'div',
        d: {
          b: {
            case1: { t: 'span' },
            case2: { t: 'strong', c: 'text' },
          },
        },
      });
    });

    it('should handle null GTProp', () => {
      const input: JsxElement = {
        t: 'div',
        d: null,
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({ t: 'div' });
      expect(result).not.toHaveProperty('d');
    });

    it('should preserve GTProp with only HTML content props', () => {
      const input: JsxElement = {
        t: 'input',
        d: {
          pl: 'Enter your name',
          ti: 'Name field',
          alt: 'Name input',
        },
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({
        t: 'input',
        d: {
          pl: 'Enter your name',
          ti: 'Name field',
          alt: 'Name input',
        },
      });
    });
  });

  describe('nested structures', () => {
    it('should recursively process nested children', () => {
      const input: JsxElement = {
        t: 'div',
        c: [
          { t: 'span', c: null },
          { t: 'p', c: 'text' },
          { t: 'div', c: [{ t: 'strong', c: undefined }] },
        ],
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({
        t: 'div',
        c: [
          { t: 'span' },
          { t: 'p', c: 'text' },
          { t: 'div', c: [{ t: 'strong' }] },
        ],
      });
    });

    it('should handle deeply nested structures', () => {
      const input: JsxElement = {
        t: 'div',
        c: {
          t: 'section',
          c: {
            t: 'article',
            c: null,
          },
        },
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({
        t: 'div',
        c: {
          t: 'section',
          c: { t: 'article' },
        },
      });
    });

    it('should handle complex nested structure with mixed content', () => {
      const input: JsxChildren = [
        'Text before',
        {
          t: 'div',
          i: 1,
          d: {
            b: { case1: [{ t: 'span', c: null }, 'text'] },
            pl: { t: 'input', c: undefined },
          },
          c: [
            { t: 'p', c: null },
            'Some text',
            { t: 'strong', c: 'bold text' },
          ],
        },
        'Text after',
      ];

      const result = removeNullChildrenFields(input);
      expect(result).toEqual([
        'Text before',
        {
          t: 'div',
          i: 1,
          d: {
            b: { case1: [{ t: 'span' }, 'text'] },
            pl: { t: 'input' },
          },
          c: [{ t: 'p' }, 'Some text', { t: 'strong', c: 'bold text' }],
        },
        'Text after',
      ]);
    });
  });

  describe('edge cases', () => {
    it('should handle element with only null fields', () => {
      const input: JsxElement = {
        t: null,
        i: null,
        d: null,
        c: null,
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({});
    });

    it('should handle empty element object', () => {
      const input: JsxElement = {};
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({});
    });

    it('should handle element with falsy but valid values', () => {
      const input: JsxElement = {
        t: '',
        i: 0,
        c: '',
      };
      const result = removeNullChildrenFields(input);
      expect(result).toEqual({
        t: '',
        i: 0,
        c: '',
      });
      // Empty string tag should be filtered out, but empty string content should be preserved
    });
  });

  describe('performance and type safety', () => {
    it('should maintain object reference equality for unchanged strings', () => {
      const input = 'unchanged';
      const result = removeNullChildrenFields(input);
      expect(result).toBe(input); // Same reference
    });

    it('should handle large nested structures', () => {
      // Create a large nested structure
      let nested: JsxElement = { t: 'div', c: 'base' };
      for (let i = 0; i < 100; i++) {
        nested = {
          t: 'div',
          i: i,
          c: [nested, { t: 'span', c: null }],
        };
      }

      const result = removeNullChildrenFields(nested);
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('t', 'div');
      // Should not throw stack overflow or performance issues
    });
  });
});
