import { describe, expect, it } from 'vitest';
import { setDictionaryValueAtPath } from '../utils/dictionary-helpers';
import type { Dictionary } from '../DictionaryCache';

describe('dictionary helpers', () => {
  it.each(['__proto__', 'constructor', 'prototype'])(
    'rejects unsafe dictionary path segment %s',
    (segment) => {
      expect(() =>
        setDictionaryValueAtPath({}, `safe.${segment}.leaf`, 'value')
      ).toThrow(
        `Dictionary path "safe.${segment}.leaf" contains an unsafe segment`
      );
    }
  );

  it('does not pollute Object.prototype when setting unsafe dictionary paths', () => {
    const dictionary: Dictionary = {};

    expect(() =>
      setDictionaryValueAtPath(dictionary, '__proto__.polluted', 'yes')
    ).toThrow(
      'Dictionary path "__proto__.polluted" contains an unsafe segment'
    );
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
    expect(dictionary).toEqual({});
  });

  it('creates plain objects for missing intermediate dictionary paths', () => {
    const dictionary: Dictionary = {};

    setDictionaryValueAtPath(dictionary, 'safe.path.leaf', 'value');

    expect(Object.getPrototypeOf(dictionary.safe)).toBe(Object.prototype);
    expect(Object.getPrototypeOf((dictionary.safe as Dictionary).path)).toBe(
      Object.prototype
    );
    expect(dictionary).toEqual({ safe: { path: { leaf: 'value' } } });
  });

  it('rejects unsafe root dictionary keys without mutating the cache prototype', () => {
    const dictionary: Dictionary = {};
    const value = JSON.parse('{"__proto__":{"polluted":"yes"}}') as Dictionary;

    expect(() => setDictionaryValueAtPath(dictionary, '', value)).toThrow(
      'Dictionary path "__proto__" contains an unsafe segment'
    );
    expect(dictionary).toEqual({});
    expect((dictionary as { polluted?: string }).polluted).toBeUndefined();
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
  });

  it('rejects unsafe nested dictionary keys before storing subtrees', () => {
    const dictionary: Dictionary = {};
    const value = JSON.parse('{"__proto__":{"polluted":"yes"}}') as Dictionary;

    expect(() => setDictionaryValueAtPath(dictionary, 'safe', value)).toThrow(
      'Dictionary path "safe.__proto__" contains an unsafe segment'
    );
    expect(dictionary).toEqual({});
  });
});
