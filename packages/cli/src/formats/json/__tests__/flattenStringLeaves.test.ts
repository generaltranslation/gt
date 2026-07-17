import { describe, it, expect } from 'vitest';
import { flattenStringLeaves } from '../flattenJson.js';

describe('flattenStringLeaves', () => {
  it('collects string leaves by JSON pointer', () => {
    expect(
      flattenStringLeaves({
        greeting: 'hi',
        nested: { deep: { message: 'hello' } },
        count: 4,
        enabled: true,
        nothing: null,
      })
    ).toEqual({
      '/greeting': 'hi',
      '/nested/deep/message': 'hello',
    });
  });

  it('walks arrays with index segments', () => {
    expect(flattenStringLeaves({ items: ['a', 'b'] })).toEqual({
      '/items/0': 'a',
      '/items/1': 'b',
    });
  });

  it('escapes ~ and / in keys per RFC 6901', () => {
    expect(flattenStringLeaves({ 'a/b': 'x', 'c~d': 'y' })).toEqual({
      '/a~1b': 'x',
      '/c~0d': 'y',
    });
  });

  it('returns an empty map for non-object roots', () => {
    expect(flattenStringLeaves('just a string')).toEqual({});
    expect(flattenStringLeaves(42)).toEqual({});
    expect(flattenStringLeaves(null)).toEqual({});
  });
});
