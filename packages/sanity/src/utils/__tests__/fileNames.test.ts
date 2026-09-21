import { describe, expect, test } from 'vitest';
import type { SanityDocument } from 'sanity';
import { getDocumentFileName, resolveFileName } from '../fileNames';

const doc = (fields: Record<string, unknown>) =>
  ({ _id: 'abc-123', _type: 'article', ...fields }) as SanityDocument;

describe('getDocumentFileName', () => {
  test('prefers title, then name, then slug', () => {
    expect(getDocumentFileName(doc({ title: ' Pricing ' }))).toBe(
      'sanity/article/Pricing'
    );
    expect(getDocumentFileName(doc({ name: 'Sam' }))).toBe(
      'sanity/article/Sam'
    );
    expect(getDocumentFileName(doc({ slug: { current: 'a-slug' } }))).toBe(
      'sanity/article/a-slug'
    );
  });

  test('falls back to the published id', () => {
    expect(getDocumentFileName(doc({ _id: 'drafts.abc-123', title: '' }))).toBe(
      'sanity/article/abc-123'
    );
  });
});

test('resolveFileName keeps the legacy id-based name as fallback', () => {
  expect(resolveFileName({ documentId: 'abc' })).toBe('sanity/abc');
  expect(resolveFileName({ documentId: 'abc', fileName: 'x' })).toBe('x');
});
