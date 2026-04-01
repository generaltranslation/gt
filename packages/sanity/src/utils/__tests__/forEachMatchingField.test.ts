import { describe, expect, test, vi } from 'vitest';
import { forEachMatchingField } from '../applyDocuments';
import type { IgnoreFields } from '../../adapter/types';

describe('forEachMatchingField', () => {
  const doc = {
    _id: 'doc-1',
    title: 'Hello',
    slug: 'hello-world',
    metadata: {
      _type: 'metadata',
      seo: { _type: 'seoConfig', title: 'SEO Title', description: 'desc' },
      internal: 'notes',
    },
    items: [
      { _type: 'card', _key: 'a', label: 'Card A' },
      { _type: 'banner', _key: 'b', label: 'Banner B' },
    ],
  };

  test('calls callback for matching top-level field', () => {
    const fields: IgnoreFields[] = [{ fields: [{ property: '$.slug' }] }];
    const cb = vi.fn();
    forEachMatchingField('doc-1', doc, fields, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].value).toBe('hello-world');
  });

  test('calls callback for nested field', () => {
    const fields: IgnoreFields[] = [
      { fields: [{ property: '$.metadata.internal' }] },
    ];
    const cb = vi.fn();
    forEachMatchingField('doc-1', doc, fields, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].value).toBe('notes');
  });

  test('calls callback for recursive descent path', () => {
    const fields: IgnoreFields[] = [{ fields: [{ property: '$..label' }] }];
    const cb = vi.fn();
    forEachMatchingField('doc-1', doc, fields, cb);

    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls[0][0].value).toBe('Card A');
    expect(cb.mock.calls[1][0].value).toBe('Banner B');
  });

  test('filters by documentId — matching', () => {
    const fields: IgnoreFields[] = [
      { documentId: 'doc-1', fields: [{ property: '$.title' }] },
    ];
    const cb = vi.fn();
    forEachMatchingField('doc-1', doc, fields, cb);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('filters by documentId — non-matching', () => {
    const fields: IgnoreFields[] = [
      { documentId: 'doc-other', fields: [{ property: '$.title' }] },
    ];
    const cb = vi.fn();
    forEachMatchingField('doc-1', doc, fields, cb);

    expect(cb).not.toHaveBeenCalled();
  });

  test('applies globally when documentId is undefined', () => {
    const fields: IgnoreFields[] = [{ fields: [{ property: '$.title' }] }];
    const cb = vi.fn();
    forEachMatchingField('doc-1', doc, fields, cb);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('applies globally when documentId is null', () => {
    const fields: IgnoreFields[] = [
      { documentId: null as any, fields: [{ property: '$.title' }] },
    ];
    const cb = vi.fn();
    forEachMatchingField('doc-1', doc, fields, cb);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('filters by type — matching _type', () => {
    const fields: IgnoreFields[] = [
      { fields: [{ property: '$.metadata.seo', type: 'seoConfig' }] },
    ];
    const cb = vi.fn();
    forEachMatchingField('doc-1', doc, fields, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].value._type).toBe('seoConfig');
  });

  test('filters by type — non-matching _type', () => {
    const fields: IgnoreFields[] = [
      { fields: [{ property: '$.metadata.seo', type: 'wrongType' }] },
    ];
    const cb = vi.fn();
    forEachMatchingField('doc-1', doc, fields, cb);

    expect(cb).not.toHaveBeenCalled();
  });

  test('filters by type in recursive descent', () => {
    const fields: IgnoreFields[] = [
      { fields: [{ property: '$.items[*]', type: 'card' }] },
    ];
    const cb = vi.fn();
    forEachMatchingField('doc-1', doc, fields, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].value._key).toBe('a');
  });

  test('skips entry with no fields array', () => {
    const fields: IgnoreFields[] = [{ documentId: 'doc-1' }];
    const cb = vi.fn();
    forEachMatchingField('doc-1', doc, fields, cb);

    expect(cb).not.toHaveBeenCalled();
  });

  test('handles multiple entries and multiple fields', () => {
    const fields: IgnoreFields[] = [
      { fields: [{ property: '$.title' }, { property: '$.slug' }] },
      { fields: [{ property: '$.metadata.internal' }] },
    ];
    const cb = vi.fn();
    forEachMatchingField('doc-1', doc, fields, cb);

    expect(cb).toHaveBeenCalledTimes(3);
  });

  test('does not throw on invalid JSONPath', () => {
    const fields: IgnoreFields[] = [{ fields: [{ property: '$[invalid[[' }] }];
    const cb = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => forEachMatchingField('doc-1', doc, fields, cb)).not.toThrow();
    expect(cb).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  test('does not call callback when path matches nothing', () => {
    const fields: IgnoreFields[] = [
      { fields: [{ property: '$.nonexistent' }] },
    ];
    const cb = vi.fn();
    forEachMatchingField('doc-1', doc, fields, cb);

    expect(cb).not.toHaveBeenCalled();
  });

  test('provides correct pointer in callback result', () => {
    const fields: IgnoreFields[] = [
      { fields: [{ property: '$.metadata.seo.title' }] },
    ];
    const cb = vi.fn();
    forEachMatchingField('doc-1', doc, fields, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].pointer).toBe('/metadata/seo/title');
  });
});
