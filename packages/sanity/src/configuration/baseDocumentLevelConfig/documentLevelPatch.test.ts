import { afterEach, describe, expect, test, vi } from 'vitest';
import type { SanityClient, SanityDocument } from 'sanity';
import { pluginConfig } from '../../adapter/core';
import { documentLevelPatch } from './documentLevelPatch';

describe('documentLevelPatch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('rechecks metadata before creating a translated document', async () => {
    vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
    vi.spyOn(pluginConfig, 'getIgnoreFields').mockReturnValue([]);
    vi.spyOn(pluginConfig, 'getSkipFields').mockReturnValue([]);
    vi.spyOn(pluginConfig, 'getDedupeFields').mockReturnValue([]);

    const sourceDoc = {
      _id: 'article-1',
      _type: 'article',
      _rev: 'source-rev',
      title: 'Hello',
    };
    const existingTargetDoc = {
      _id: 'drafts.article-1-es',
      _type: 'article',
      _rev: 'target-rev',
      title: 'Hola',
      language: 'es',
    };

    const fetch = vi
      .fn()
      .mockResolvedValueOnce([sourceDoc])
      .mockResolvedValueOnce({
        _id: 'translation.metadata.article-1',
        _type: 'translation.metadata',
        translations: [
          {
            language: 'en',
            value: { _type: 'reference', _ref: 'article-1' },
          },
        ],
      })
      .mockResolvedValueOnce({
        _id: 'translation.metadata.article-1',
        _type: 'translation.metadata',
        translations: [
          {
            language: 'en',
            value: { _type: 'reference', _ref: 'article-1' },
          },
          {
            language: 'es',
            value: { _type: 'reference', _ref: 'article-1-es' },
          },
        ],
      })
      .mockResolvedValueOnce([existingTargetDoc]);
    const commit = vi.fn().mockResolvedValue({});
    const patch = vi.fn().mockReturnValue({ commit });
    const create = vi.fn();

    const client = { fetch, patch, create } as unknown as SanityClient;

    await documentLevelPatch(
      { documentId: 'article-1' },
      {
        _id: 'article-1',
        _type: 'article',
        _rev: 'translated-rev',
        _createdAt: '2024-01-01T00:00:00Z',
        _updatedAt: '2024-01-01T00:00:00Z',
        title: 'Hola',
      } as SanityDocument,
      'es',
      client
    );

    expect(create).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalledWith('drafts.article-1-es', {
      set: expect.objectContaining({ title: 'Hola' }),
    });
  });

  test('creates the translated document as a draft and never publishes it', async () => {
    // The customer-facing question this pins down: with auto-publish off, does
    // importing a translation still produce a document? It does — as a draft,
    // which is invisible from the Studio's published perspective.
    vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
    vi.spyOn(pluginConfig, 'getIgnoreFields').mockReturnValue([]);
    vi.spyOn(pluginConfig, 'getSkipFields').mockReturnValue([]);
    vi.spyOn(pluginConfig, 'getDedupeFields').mockReturnValue([]);
    vi.spyOn(pluginConfig, 'getSingletons').mockReturnValue([]);

    const sourceDoc = {
      _id: 'article-1',
      _type: 'article',
      _rev: 'source-rev',
      title: 'Hello',
    };
    // Metadata exists for the source language only — no target document yet.
    const metadataWithoutTarget = {
      _id: 'translation.metadata.article-1',
      _type: 'translation.metadata',
      translations: [
        { language: 'en', value: { _type: 'reference', _ref: 'article-1' } },
      ],
    };

    const fetch = vi
      .fn()
      .mockResolvedValueOnce([sourceDoc])
      .mockResolvedValueOnce(metadataWithoutTarget)
      .mockResolvedValueOnce(metadataWithoutTarget);

    const create = vi
      .fn()
      .mockResolvedValue({ _id: 'drafts.generated-id', _type: 'article' });

    const transactionCommit = vi.fn().mockResolvedValue({});
    const transactionPatch = vi.fn();
    const transactionObject = {
      patch: transactionPatch,
      commit: transactionCommit,
    };
    transactionPatch.mockReturnValue(transactionObject);
    const transaction = vi.fn().mockReturnValue(transactionObject);

    // Publishing goes through client.action; it must not be reached.
    const action = vi.fn();

    const client = {
      fetch,
      create,
      transaction,
      action,
    } as unknown as SanityClient;

    await documentLevelPatch(
      { documentId: 'article-1' },
      {
        _id: 'article-1',
        _type: 'article',
        _rev: 'translated-rev',
        _createdAt: '2024-01-01T00:00:00Z',
        _updatedAt: '2024-01-01T00:00:00Z',
        title: 'Hola',
      } as SanityDocument,
      'es',
      client
    );

    expect(create).toHaveBeenCalledTimes(1);
    const created = create.mock.calls[0][0];
    // Sanity fills in the generated id after the `drafts.` prefix.
    expect(created._id).toBe('drafts.');
    expect(created.language).toBe('es');
    expect(created.title).toBe('Hola');

    expect(action).not.toHaveBeenCalled();
    // The metadata reference is written, so the translation is discoverable
    // from the source document even while it is only a draft.
    expect(transactionPatch).toHaveBeenCalledWith(
      'translation.metadata.article-1',
      expect.any(Function)
    );
  });
  test('recreates the translation when metadata points at a deleted document', async () => {
    vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
    vi.spyOn(pluginConfig, 'getIgnoreFields').mockReturnValue([]);
    vi.spyOn(pluginConfig, 'getSkipFields').mockReturnValue([]);
    vi.spyOn(pluginConfig, 'getDedupeFields').mockReturnValue([]);
    vi.spyOn(pluginConfig, 'getSingletons').mockReturnValue([]);

    const sourceDoc = {
      _id: 'article-1',
      _type: 'article',
      _rev: 'source-rev',
      title: 'Hello',
    };
    /*
     * References in `translation.metadata` are weak, so deleting a translated
     * document leaves its entry behind. The de-DE entry below points at a
     * document that no longer resolves.
     */
    const metadata = {
      _id: 'translation.metadata.article-1',
      _type: 'translation.metadata',
      translations: [
        { language: 'en', value: { _type: 'reference', _ref: 'article-1' } },
        {
          language: 'de-DE',
          value: { _type: 'reference', _ref: 'article-1-de' },
        },
      ],
    };

    const fetch = vi.fn(async (query: string, params?: { id?: string }) => {
      if (query.includes('translation.metadata')) return metadata;
      if (params?.id === 'article-1') return [sourceDoc];
      return [];
    });

    const commit = vi.fn().mockResolvedValue({});
    const patch = vi.fn().mockReturnValue({ commit });
    const transactionPatch = vi.fn().mockReturnValue({ commit });
    const create = vi
      .fn()
      .mockResolvedValue({ _id: 'drafts.article-1-de-new', _type: 'article' });

    const client = {
      fetch,
      patch,
      create,
      transaction: () => ({ patch: transactionPatch, commit }),
    } as unknown as SanityClient;

    await documentLevelPatch(
      { documentId: 'article-1' },
      {
        _id: 'article-1',
        _type: 'article',
        _rev: 'translated-rev',
        _createdAt: '2024-01-01T00:00:00Z',
        _updatedAt: '2024-01-01T00:00:00Z',
        title: 'Hallo',
      } as SanityDocument,
      'de-DE',
      client
    );

    // A fresh translated document replaces the dangling reference rather than
    // the import throwing on the missing document.
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      _id: 'drafts.',
      _type: 'article',
      language: 'de-DE',
    });
    expect(transactionPatch).toHaveBeenCalledWith(
      'translation.metadata.article-1',
      expect.any(Function)
    );
  });

  test('throws a readable error when the source document is gone', async () => {
    vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');

    const client = {
      fetch: vi.fn().mockResolvedValue([]),
    } as unknown as SanityClient;

    await expect(
      documentLevelPatch(
        { documentId: 'article-gone' },
        {
          _id: 'article-gone',
          _type: 'article',
          _rev: 'rev',
          _createdAt: '2024-01-01T00:00:00Z',
          _updatedAt: '2024-01-01T00:00:00Z',
          title: 'Gone',
        } as SanityDocument,
        'de-DE',
        client
      )
    ).rejects.toThrow(/Could not find the document to translate/);
  });
});
