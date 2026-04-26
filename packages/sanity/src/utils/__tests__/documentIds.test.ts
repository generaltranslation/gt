import { describe, expect, test } from 'vitest';
import {
  createStableTranslationKey,
  createTranslationStatusKey,
  dedupeDocumentsPreferDraft,
  getPublishedId,
} from '../documentIds';

describe('document ID helpers', () => {
  test('normalizes only draft prefixes', () => {
    expect(getPublishedId('drafts.article-1')).toBe('article-1');
    expect(getPublishedId('article-drafts-copy')).toBe('article-drafts-copy');
  });

  test('dedupes draft and published documents by preferring the draft', () => {
    const result = dedupeDocumentsPreferDraft([
      { _id: 'article-1', _type: 'article', _rev: 'published' },
      { _id: 'drafts.article-1', _type: 'article', _rev: 'draft' },
      { _id: 'article-2', _type: 'article', _rev: 'published-2' },
    ] as any);

    expect(result).toEqual([
      { _id: 'drafts.article-1', _type: 'article', _rev: 'draft' },
      { _id: 'article-2', _type: 'article', _rev: 'published-2' },
    ]);
  });

  test('builds keys from the published document id', () => {
    expect(
      createTranslationStatusKey('branch', 'drafts.article-1', 'rev', 'es')
    ).toBe('branch:article-1:rev:es');
    expect(createStableTranslationKey('branch', 'drafts.article-1', 'es')).toBe(
      'branch:article-1:es'
    );
    expect(
      createTranslationStatusKey(undefined, 'drafts.article-1', 'rev', 'es')
    ).toBe('article-1:rev:es');
    expect(
      createStableTranslationKey(undefined, 'drafts.article-1', 'es')
    ).toBe('article-1:es');
  });
});
