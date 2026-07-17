import { describe, it, expect } from 'vitest';
import { diffKeyedCatalog, flattenStringLeaves } from '../catalogDiff.js';

describe('diffKeyedCatalog', () => {
  it('reports full coverage when every source key is translated', () => {
    const diff = diffKeyedCatalog(
      { a: 'one', b: 'two' },
      { a: 'uno', b: 'dos' }
    );
    expect(diff).toEqual({
      total: 2,
      translated: 2,
      missing: [],
      stale: [],
    });
  });

  it('reports every key missing when the catalog is absent', () => {
    const diff = diffKeyedCatalog({ a: 'one', b: 'two' }, null);
    expect(diff.total).toBe(2);
    expect(diff.translated).toBe(0);
    expect(diff.missing).toEqual(['a', 'b']);
    expect(diff.stale).toEqual([]);
  });

  it('reports source-only keys as missing and translation-only keys as stale', () => {
    const diff = diffKeyedCatalog(
      { a: 'one', b: 'two' },
      { b: 'dos', c: 'tres' }
    );
    expect(diff.total).toBe(2);
    expect(diff.translated).toBe(1);
    expect(diff.missing).toEqual(['a']);
    expect(diff.stale).toEqual(['c']);
  });

  it('handles an empty source catalog', () => {
    expect(diffKeyedCatalog({}, { a: 'x' })).toEqual({
      total: 0,
      translated: 0,
      missing: [],
      stale: ['a'],
    });
  });
});

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
