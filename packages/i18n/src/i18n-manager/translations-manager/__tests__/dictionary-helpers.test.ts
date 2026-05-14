import { describe, expect, it } from 'vitest';
import {
  setDictionaryValueAtPath,
  resolveDictionaryLookupOptions,
} from '../utils/dictionary-helpers';
import type { Dictionary } from '../DictionaryCache';

describe('dictionary helpers', () => {
  it('maps deprecated context metadata to $context without keeping context as a variable', () => {
    expect(
      resolveDictionaryLookupOptions({
        context: 'homepage',
        custom: 'value',
      })
    ).toEqual({
      $format: 'ICU',
      $context: 'homepage',
      custom: 'value',
    });
  });

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
});
