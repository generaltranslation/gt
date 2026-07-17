import { describe, it, expect } from 'vitest';
import { collapseI18nextPlurals, diffKeyedCatalog } from '../catalogDiff.js';

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

describe('collapseI18nextPlurals', () => {
  it('folds CLDR plural suffixes into one family unit', () => {
    expect(
      collapseI18nextPlurals({
        '/item_one': '# item',
        '/item_other': '# items',
        '/plain': 'hello',
      })
    ).toEqual({
      '/item_[plural]': '# item',
      '/plain': 'hello',
    });
  });

  it('lets locale-specific categories match the same family', () => {
    const source = collapseI18nextPlurals({
      '/item_one': '# item',
      '/item_other': '# items',
    });
    const russian = collapseI18nextPlurals({
      '/item_one': '# элемент',
      '/item_few': '# элемента',
      '/item_many': '# элементов',
      '/item_other': '# элемента',
    });
    const diff = diffKeyedCatalog(source, russian);
    expect(diff.total).toBe(1);
    expect(diff.translated).toBe(1);
    expect(diff.missing).toEqual([]);
    expect(diff.stale).toEqual([]);
  });

  it('collapses exact-count suffixes too', () => {
    expect(
      collapseI18nextPlurals({ '/item_0': 'none', '/item_other': 'some' })
    ).toEqual({ '/item_[plural]': 'none' });
  });

  it('leaves context suffixes and unrelated underscores alone', () => {
    expect(
      collapseI18nextPlurals({
        '/friend_male': 'boyfriend',
        '/friend_female': 'girlfriend',
        '/snake_case_key': 'x',
      })
    ).toEqual({
      '/friend_male': 'boyfriend',
      '/friend_female': 'girlfriend',
      '/snake_case_key': 'x',
    });
  });
});
