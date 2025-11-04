import { describe, it, expect, vi } from 'vitest';
import hashSource from '../calculateHash';
import { DataFormat } from 'generaltranslation/types';

// Mock the generaltranslation/id module
vi.mock('generaltranslation/id', () => ({
  hashSource: vi.fn(({ source, context, id, dataFormat }) => `mocked-hash-${dataFormat}`),
}));

const mockHashSource = vi.mocked(await import('generaltranslation/id')).hashSource;

describe('calculateHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ICU and I18NEXT data formats', () => {
    it('should delegate to original hashSource for ICU format', () => {
      const params = {
        source: 'Hello world',
        context: 'greeting',
        id: 'test-id',
        dataFormat: 'ICU' as DataFormat,
      };

      const result = hashSource(params);

      expect(mockHashSource).toHaveBeenCalledWith(params);
      expect(result).toBe('mocked-hash-ICU');
    });

    it('should delegate to original hashSource for I18NEXT format', () => {
      const params = {
        source: 'Hello world',
        context: 'greeting',
        id: 'test-id',
        dataFormat: 'I18NEXT' as DataFormat,
      };

      const result = hashSource(params);

      expect(mockHashSource).toHaveBeenCalledWith(params);
      expect(result).toBe('mocked-hash-I18NEXT');
    });
  });

  describe('JSX data format - no static components', () => {
    it('should return hash for string source', () => {
      const result = hashSource({
        source: 'Hello world',
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).toHaveBeenCalled();
      expect(result).toBe('mocked-hash-JSX');
    });

    it('should return hash for simple variable without type "s"', () => {
      const result = hashSource({
        source: [{ k: 'name' }],
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).toHaveBeenCalled();
      expect(result).toBe('mocked-hash-JSX');
    });

    it('should return hash for variable with different type', () => {
      const result = hashSource({
        source: [{ k: 'name', v: 'text' }],
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).toHaveBeenCalled();
      expect(result).toBe('mocked-hash-JSX');
    });

    it('should return hash for JSX element without static components', () => {
      const result = hashSource({
        source: [
          {
            t: 'div',
            c: ['Hello ', { k: 'name' }, '!'],
          },
        ],
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).toHaveBeenCalled();
      expect(result).toBe('mocked-hash-JSX');
    });

    it('should return hash for nested JSX elements without static components', () => {
      const result = hashSource({
        source: [
          {
            t: 'div',
            c: [
              {
                t: 'span',
                c: ['Hello ', { k: 'name' }],
              },
            ],
          },
        ],
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).toHaveBeenCalled();
      expect(result).toBe('mocked-hash-JSX');
    });
  });

  describe('JSX data format - with static components', () => {
    it('should return empty string for variable with type "s"', () => {
      const result = hashSource({
        source: [{ k: 'staticVar', v: 's' }],
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).not.toHaveBeenCalled();
      expect(result).toBe('');
    });

    it('should return empty string for array containing variable with type "s"', () => {
      const result = hashSource({
        source: ['Hello ', { k: 'staticVar', v: 's' }, '!'],
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).not.toHaveBeenCalled();
      expect(result).toBe('');
    });

    it('should return empty string for JSX element containing static variable', () => {
      const result = hashSource({
        source: [
          {
            t: 'div',
            c: ['Hello ', { k: 'staticVar', v: 's' }],
          },
        ],
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).not.toHaveBeenCalled();
      expect(result).toBe('');
    });

    it('should return empty string for deeply nested static variable', () => {
      const result = hashSource({
        source: [
          {
            t: 'div',
            c: [
              {
                t: 'span',
                c: ['Text ', { k: 'staticVar', v: 's' }],
              },
            ],
          },
        ],
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).not.toHaveBeenCalled();
      expect(result).toBe('');
    });

    it('should return empty string when static variable is in branch', () => {
      const result = hashSource({
        source: [
          {
            t: 'div',
            d: {
              t: 'p',
              b: {
                one: ['One item'],
                other: ['Multiple ', { k: 'staticVar', v: 's' }],
              },
            },
          },
        ],
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).not.toHaveBeenCalled();
      expect(result).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const result = hashSource({
        source: [],
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).toHaveBeenCalled();
      expect(result).toBe('mocked-hash-JSX');
    });

    it('should handle JSX element without children', () => {
      const result = hashSource({
        source: [{ t: 'br' }],
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).toHaveBeenCalled();
      expect(result).toBe('mocked-hash-JSX');
    });

    it('should handle variable with index property', () => {
      const result = hashSource({
        source: [{ k: 'name', i: 1 }],
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).toHaveBeenCalled();
      expect(result).toBe('mocked-hash-JSX');
    });

    it('should handle variable with both value and index properties', () => {
      const result = hashSource({
        source: [{ k: 'name', v: 'text', i: 1 }],
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).toHaveBeenCalled();
      expect(result).toBe('mocked-hash-JSX');
    });

    it('should return empty string for variable with type "s" and index', () => {
      const result = hashSource({
        source: [{ k: 'staticVar', v: 's', i: 1 }],
        dataFormat: 'JSX' as DataFormat,
      });

      expect(mockHashSource).not.toHaveBeenCalled();
      expect(result).toBe('');
    });
  });
});