import { describe, it, expect } from 'vitest';
import {
  JsxHasher,
  VariableType,
  SanitizedElement,
  SanitizedChild,
  SanitizedChildren,
  SanitizedVariable,
  SanitizedData,
} from '../hash';

describe('hash', () => {
  describe('JsxHasher.hashString', () => {
    it('should produce consistent hashes for same input', () => {
      const input = 'test string';
      const hash1 = JsxHasher.hashString(input);
      const hash2 = JsxHasher.hashString(input);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(16);

      // Verify it's hex
      expect(/^[0-9a-f]+$/i.test(hash1)).toBe(true);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = JsxHasher.hashString('input1');
      const hash2 = JsxHasher.hashString('input2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = JsxHasher.hashString('');
      expect(hash.length).toBe(16);
      expect(/^[0-9a-f]+$/i.test(hash)).toBe(true);
    });
  });

  describe('sanitized variable serialization', () => {
    it('should serialize SanitizedVariable correctly', () => {
      const variable: SanitizedVariable = {
        k: 'name',
        v: VariableType.Variable,
        t: undefined,
      };

      const json = JSON.stringify(variable);

      expect(json).toContain('"k":"name"');
      expect(json).toContain('"v":"v"');
      expect(json).not.toContain('"i"'); // Should not contain 'i' field
    });

    it('should handle all variable types', () => {
      const types = [
        { type: VariableType.Variable, expected: 'v' },
        { type: VariableType.Number, expected: 'n' },
        { type: VariableType.Date, expected: 'd' },
        { type: VariableType.Currency, expected: 'c' },
      ];

      for (const { type, expected } of types) {
        const variable: SanitizedVariable = {
          k: 'test',
          v: type,
        };

        const json = JSON.stringify(variable);
        expect(json).toContain(`"v":"${expected}"`);
      }
    });
  });

  describe('sanitized children serialization', () => {
    it('should serialize text children', () => {
      const child: SanitizedChild = 'Hello world';
      const json = JSON.stringify(child);

      expect(json).toBe('"Hello world"');
    });

    it('should serialize single child', () => {
      const children: SanitizedChildren = 'Hello';
      const json = JSON.stringify(children);

      expect(json).toBe('"Hello"');
    });

    it('should serialize multiple children', () => {
      const children: SanitizedChildren = [
        'Hello ',
        {
          k: 'name',
          v: VariableType.Variable,
        } as SanitizedVariable,
        '!',
      ];

      const json = JSON.stringify(children);

      expect(json.startsWith('[')).toBe(true);
      expect(json.endsWith(']')).toBe(true);
      expect(json).toContain('"Hello "');
      expect(json).toContain('"k":"name"');
    });
  });

  describe('sanitized element serialization', () => {
    it('should serialize SanitizedElement correctly', () => {
      const element: SanitizedElement = {
        c: 'content',
        t: 'div',
      };

      const json = JSON.stringify(element);

      expect(json).toContain('"t":"div"');
      expect(json).toContain('"c":"content"');
      expect(json).not.toContain('"i"'); // Should not contain 'i' field
    });

    it('should handle elements with branches', () => {
      const element: SanitizedElement = {
        b: {
          case1: 'content1',
          case2: 'content2',
        },
        t: 'branch',
      };

      const json = JSON.stringify(element);

      expect(json).toContain('"t":"branch"');
      expect(json).toContain('"case1"');
      expect(json).toContain('"case2"');
    });
  });

  describe('sanitized structures have no IDs', () => {
    it('should not include ID fields in serialized output', () => {
      const element: SanitizedElement = {
        c: {
          k: 'name',
          v: VariableType.Variable,
        } as SanitizedVariable,
        t: 'div',
      };

      const json = JSON.stringify(element);

      // Verify no 'i' fields are present
      expect(json).not.toContain('"i":');
      expect(json).toContain('"k":"name"'); // Variable key should be preserved
      expect(json).toContain('"t":"div"'); // Element tag should be preserved
    });
  });

  describe('hash source with simple text', () => {
    it('should hash simple text content consistently', () => {
      const children: SanitizedChildren = 'Hello world';
      const sanitizedData: SanitizedData = {
        source: children,
        dataFormat: 'JSX',
      };

      const hash = JsxHasher.hashJsxContent(sanitizedData);

      expect(hash.length).toBe(16);

      // Same input should produce same hash
      const hash2 = JsxHasher.hashJsxContent(sanitizedData);
      expect(hash).toBe(hash2);
    });

    it('should use convenience method for direct hashing', () => {
      const children: SanitizedChildren = 'Hello world';

      const hash1 = JsxHasher.hashJsxSource(children);
      const hash2 = JsxHasher.hashJsxSource(children);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(16);
    });
  });

  describe('hash source with context and ID', () => {
    it('should produce different hashes for different context/ID', () => {
      const children: SanitizedChildren = 'Hello';

      const hash1 = JsxHasher.hashJsxSource(children);
      const hash2 = JsxHasher.hashJsxSource(children, undefined, 'context');
      const hash3 = JsxHasher.hashJsxSource(children, 'id');

      // All should be different
      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });

    it('should handle both ID and context', () => {
      const children: SanitizedChildren = 'Hello';

      const hash1 = JsxHasher.hashJsxSource(children);
      const hash2 = JsxHasher.hashJsxSource(children, 'id', 'context');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('stable stringify key ordering', () => {
    it('should sort keys alphabetically', () => {
      const data: SanitizedData = {
        source: 'test text',
        dataFormat: 'JSX',
        context: 'test',
        id: 'test-id',
      };

      const stableJson = JsxHasher.stableStringifyRecursive(data);

      // Keys should be in alphabetical order: context, dataFormat, id, source
      const expectedOrder = ['context', 'dataFormat', 'id', 'source'];
      const keys = Object.keys(data).sort();

      expect(keys).toEqual(expectedOrder);
      expect(stableJson).toContain('"context":"test"');
      expect(stableJson).toContain('"dataFormat":"JSX"');
    });

    it('should produce consistent results regardless of key order', () => {
      // Create same data with different property order
      const data1 = {
        source: 'test',
        dataFormat: 'JSX',
        id: 'test-id',
      };

      const data2 = {
        id: 'test-id',
        dataFormat: 'JSX',
        source: 'test',
      };

      const hash1 = JsxHasher.hashJsxContent(data1);
      const hash2 = JsxHasher.hashJsxContent(data2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('branch component empty hash', () => {
    it('should hash empty branch components consistently', () => {
      const emptyChildren: SanitizedChildren = [];
      const data: SanitizedData = {
        source: emptyChildren,
        dataFormat: 'JSX',
      };

      const hash = JsxHasher.hashJsxContent(data);

      expect(hash.length).toBe(16);

      // Direct JSON should produce same hash
      const expectedJson = '{"dataFormat":"JSX","source":[]}';
      const expectedHash = JsxHasher.hashString(expectedJson);
      expect(hash).toBe(expectedHash);
    });

    it('should handle empty arrays consistently', () => {
      const hash1 = JsxHasher.hashJsxSource([]);
      const hash2 = JsxHasher.hashJsxSource([]);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(16);
    });
  });

  describe('hash source complex structure', () => {
    it('should hash complex structures consistently', () => {
      const children: SanitizedChildren = [
        'Hello ',
        {
          k: 'name',
          v: VariableType.Variable,
        } as SanitizedVariable,
        '!',
      ];

      const hash1 = JsxHasher.hashJsxSource(children);

      // Create same structure again
      const children2: SanitizedChildren = [
        'Hello ',
        {
          k: 'name',
          v: VariableType.Variable,
        } as SanitizedVariable,
        '!',
      ];

      const hash2 = JsxHasher.hashJsxSource(children2);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(16);
    });

    it('should handle nested elements', () => {
      const element: SanitizedElement = {
        t: 'div',
        c: [
          'Hello ',
          {
            t: 'span',
            c: 'world',
          } as SanitizedElement,
        ],
      };

      const hash = JsxHasher.hashJsxSource(element);
      expect(hash.length).toBe(16);
    });

    it('should handle boolean and null values', () => {
      const children: SanitizedChildren = ['Text', true, false, null];

      const hash = JsxHasher.hashJsxSource(children);
      expect(hash.length).toBe(16);

      // Same structure should hash the same
      const hash2 = JsxHasher.hashJsxSource(['Text', true, false, null]);
      expect(hash).toBe(hash2);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined and null values', () => {
      const data: SanitizedData = {
        source: null,
        id: undefined,
        context: undefined,
        dataFormat: 'JSX',
      };

      const hash = JsxHasher.hashJsxContent(data);
      expect(hash.length).toBe(16);
    });

    it('should handle deeply nested structures', () => {
      const deepStructure: SanitizedElement = {
        t: 'div',
        c: {
          t: 'span',
          c: {
            t: 'em',
            c: 'deep content',
          },
        },
      };

      const hash = JsxHasher.hashJsxSource(deepStructure);
      expect(hash.length).toBe(16);
    });

    it('should handle special characters in strings', () => {
      const children: SanitizedChildren = 'Hello\n\t"world"\\test';
      const hash = JsxHasher.hashJsxSource(children);

      expect(hash.length).toBe(16);

      // Same content should produce same hash
      const hash2 = JsxHasher.hashJsxSource('Hello\n\t"world"\\test');
      expect(hash).toBe(hash2);
    });
  });

  describe('SanitizedData factory methods', () => {
    it('should create sanitized data with createSanitizedData', () => {
      const source: SanitizedChildren = 'test content';
      const data = JsxHasher.createSanitizedData(
        source,
        'test-id',
        'test-context'
      );

      expect(data.source).toBe(source);
      expect(data.id).toBe('test-id');
      expect(data.context).toBe('test-context');
      expect(data.dataFormat).toBe('JSX');
    });

    it('should create sanitized data with minimal parameters', () => {
      const source: SanitizedChildren = 'test content';
      const data = JsxHasher.createSanitizedData(source);

      expect(data.source).toBe(source);
      expect(data.id).toBeUndefined();
      expect(data.context).toBeUndefined();
      expect(data.dataFormat).toBe('JSX');
    });
  });
});
