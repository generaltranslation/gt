import { describe, it, expect } from 'vitest';
import { get, set } from '../indexDict';
import { Dictionary } from '../../types/types';

describe('indexDict', () => {
  describe('get function', () => {
    describe('should get values from object dictionaries', () => {
      it('should get string value from object dictionary', () => {
        const dictionary: Dictionary = { greeting: 'Hello' };
        const result = get(dictionary, 'greeting');
        expect(result).toBe('Hello');
      });

      it('should get nested object from dictionary', () => {
        const dictionary: Dictionary = {
          user: { name: 'John', age: 30 },
        };
        const result = get(dictionary, 'user');
        expect(result).toEqual({ name: 'John', age: 30 });
      });

      it('should get array value from object dictionary', () => {
        const dictionary: Dictionary = {
          messages: ['Hello', 'Goodbye'],
        };
        const result = get(dictionary, 'messages');
        expect(result).toEqual(['Hello', 'Goodbye']);
      });

      it('should return undefined for non-existent key', () => {
        const dictionary: Dictionary = { greeting: 'Hello' };
        const result = get(dictionary, 'nonexistent');
        expect(result).toBeUndefined();
      });

      it('should handle numeric string keys', () => {
        const dictionary: Dictionary = { '123': 'numeric key' };
        const result = get(dictionary, '123');
        expect(result).toBe('numeric key');
      });
    });

    describe('should get values from array dictionaries', () => {
      it('should get value from array dictionary by index', () => {
        const dictionary: Dictionary = ['first', 'second', 'third'];
        const result = get(dictionary, 1);
        expect(result).toBe('second');
      });

      it('should get first element from array', () => {
        const dictionary: Dictionary = ['hello', 'world'];
        const result = get(dictionary, 0);
        expect(result).toBe('hello');
      });

      it('should get last element from array', () => {
        const dictionary: Dictionary = ['hello', 'world'];
        const result = get(dictionary, 1);
        expect(result).toBe('world');
      });

      it('should return undefined for out-of-bounds index', () => {
        const dictionary: Dictionary = ['hello'];
        const result = get(dictionary, 5);
        expect(result).toBeUndefined();
      });

      it('should handle negative indices', () => {
        const dictionary: Dictionary = ['hello', 'world'];
        const result = get(dictionary, -1);
        expect(result).toBeUndefined();
      });

      it('should get nested objects from array', () => {
        const dictionary: Dictionary = [{ name: 'John' }, { name: 'Jane' }];
        const result = get(dictionary, 0);
        expect(result).toEqual({ name: 'John' });
      });
    });

    describe('should handle edge cases and errors', () => {
      it('should throw error for null dictionary', () => {
        expect(() => get(null as any, 'key')).toThrow(
          'Cannot index into an undefined dictionary'
        );
      });

      it('should throw error for undefined dictionary', () => {
        expect(() => get(undefined as any, 'key')).toThrow(
          'Cannot index into an undefined dictionary'
        );
      });

      it('should handle empty object dictionary', () => {
        const dictionary: Dictionary = {};
        const result = get(dictionary, 'any');
        expect(result).toBeUndefined();
      });

      it('should handle empty array dictionary', () => {
        const dictionary: Dictionary = [];
        const result = get(dictionary, 0);
        expect(result).toBeUndefined();
      });
    });
  });

  describe('set function', () => {
    describe('should set values in object dictionaries', () => {
      it('should set string value in object dictionary', () => {
        const dictionary: Dictionary = { existing: 'value' };
        set(dictionary, 'greeting', 'Hello');
        expect(dictionary).toEqual({ existing: 'value', greeting: 'Hello' });
      });

      it('should set nested object in dictionary', () => {
        const dictionary: Dictionary = {};
        const userObj = { name: 'John', age: 30 };
        set(dictionary, 'user', userObj);
        expect(dictionary).toEqual({ user: { name: 'John', age: 30 } });
      });

      it('should set array value in object dictionary', () => {
        const dictionary: Dictionary = {};
        const arrayValue = ['Hello', 'World'];
        set(dictionary, 'messages', arrayValue);
        expect(dictionary).toEqual({ messages: ['Hello', 'World'] });
      });

      it('should overwrite existing value', () => {
        const dictionary: Dictionary = { greeting: 'Hello' };
        set(dictionary, 'greeting', 'Goodbye');
        expect(dictionary).toEqual({ greeting: 'Goodbye' });
      });

      it('should handle numeric string keys', () => {
        const dictionary: Dictionary = {};
        set(dictionary, '123', 'numeric key');
        expect(dictionary).toEqual({ '123': 'numeric key' });
      });

      it('should set dictionary entry array format', () => {
        const dictionary: Dictionary = {};
        const entry = ['Hello {name}', { $context: 'greeting' }];
        set(dictionary, 'greeting', entry);
        expect(dictionary).toEqual({
          greeting: ['Hello {name}', { $context: 'greeting' }],
        });
      });
    });

    describe('should set values in array dictionaries', () => {
      it('should set value in array dictionary by index', () => {
        const dictionary: Dictionary = ['first', 'second'];
        set(dictionary, 1, 'updated');
        expect(dictionary).toEqual(['first', 'updated']);
      });

      it('should set value at specific index in array', () => {
        const dictionary: Dictionary = ['a', 'b', 'c'];
        set(dictionary, 0, 'new first');
        expect(dictionary).toEqual(['new first', 'b', 'c']);
      });

      it('should expand array when setting beyond current length', () => {
        const dictionary: Dictionary = ['a', 'b'];
        set(dictionary, 3, 'new value');
        expect(dictionary).toEqual(['a', 'b', undefined, 'new value']);
      });

      it('should set nested object in array', () => {
        const dictionary: Dictionary = [null, null];
        const userObj = { name: 'John' };
        set(dictionary, 1, userObj);
        expect(dictionary).toEqual([null, { name: 'John' }]);
      });

      it('should set dictionary entry in array', () => {
        const dictionary: Dictionary = [];
        const entry = ['Hello world', { $context: 'greeting' }];
        set(dictionary, 0, entry);
        expect(dictionary).toEqual([['Hello world', { $context: 'greeting' }]]);
      });
    });

    describe('should handle edge cases', () => {
      it('should handle setting with numeric indices on objects', () => {
        const dictionary: Dictionary = {};
        set(dictionary, 0, 'zero');
        expect(dictionary).toEqual({ '0': 'zero' });
      });

      it('should handle setting string keys on arrays', () => {
        const dictionary: Dictionary = ['a', 'b'];
        set(dictionary, 'length', 5);
        expect((dictionary as any).length).toBe(5);
      });

      it('should preserve other properties when setting', () => {
        const dictionary: Dictionary = { a: 'value a', b: 'value b' };
        set(dictionary, 'c', 'value c');
        expect(dictionary).toEqual({
          a: 'value a',
          b: 'value b',
          c: 'value c',
        });
      });

      it('should handle complex nested structures', () => {
        const dictionary: Dictionary = {
          users: [{ name: 'John' }, { name: 'Jane' }],
        };
        const newUser = { name: 'Bob', role: 'admin' };
        set(dictionary, 'admin', newUser);
        expect(dictionary).toEqual({
          users: [{ name: 'John' }, { name: 'Jane' }],
          admin: { name: 'Bob', role: 'admin' },
        });
      });
    });
  });

  describe('integration tests', () => {
    it('should work together - set then get', () => {
      const dictionary: Dictionary = {};
      set(dictionary, 'greeting', 'Hello World');
      const result = get(dictionary, 'greeting');
      expect(result).toBe('Hello World');
    });

    it('should work with array operations', () => {
      const dictionary: Dictionary = [];
      set(dictionary, 0, 'first');
      set(dictionary, 1, 'second');
      expect(get(dictionary, 0)).toBe('first');
      expect(get(dictionary, 1)).toBe('second');
    });

    it('should handle complex mixed operations', () => {
      const dictionary: Dictionary = { data: [] };
      const dataArray = get(dictionary, 'data') as Dictionary;
      set(dataArray, 0, { id: 1, name: 'Item 1' });
      set(dataArray, 1, { id: 2, name: 'Item 2' });

      expect(get(dictionary, 'data')).toEqual([
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ]);
      expect(get(get(dictionary, 'data') as Dictionary, 0)).toEqual({
        id: 1,
        name: 'Item 1',
      });
    });
  });
});
