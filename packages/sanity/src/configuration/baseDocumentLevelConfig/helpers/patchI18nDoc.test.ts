import { afterEach, describe, expect, test, vi } from 'vitest';
import type { SanityClient } from 'sanity';
import { pluginConfig } from '../../../adapter/core';
import { patchI18nDoc } from './patchI18nDoc';

describe('patchI18nDoc', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('preserves existing translated dedupe fields during re-import', async () => {
    vi.spyOn(pluginConfig, 'getIgnoreFields').mockReturnValue([]);
    vi.spyOn(pluginConfig, 'getSkipFields').mockReturnValue([]);
    vi.spyOn(pluginConfig, 'getDedupeFields').mockReturnValue([
      { fields: [{ property: '$.slug', type: 'slug' }] },
    ]);

    const commit = vi.fn().mockResolvedValue({});
    const patch = vi.fn().mockReturnValue({ commit });
    const client = { patch } as unknown as SanityClient;

    await patchI18nDoc(
      'doc-1',
      'drafts.doc-1-es',
      {
        _id: 'doc-1',
        _type: 'article',
        title: 'About',
        slug: { _type: 'slug', current: 'about' },
      },
      {
        _id: 'doc-1',
        _type: 'article',
        title: 'Acerca de',
      },
      { title: 'Acerca de' },
      client,
      {
        _id: 'drafts.doc-1-es',
        _type: 'article',
        title: 'Acerca de',
        slug: { _type: 'slug', current: 'custom-spanish-slug' },
      }
    );

    expect(patch).toHaveBeenCalledWith('drafts.doc-1-es', {
      set: expect.objectContaining({
        title: 'Acerca de',
        slug: { _type: 'slug', current: 'custom-spanish-slug' },
      }),
    });
  });

  test('seeds a draft instead of writing to a published translation', async () => {
    vi.spyOn(pluginConfig, 'getIgnoreFields').mockReturnValue([]);
    vi.spyOn(pluginConfig, 'getSkipFields').mockReturnValue([]);
    vi.spyOn(pluginConfig, 'getDedupeFields').mockReturnValue([]);

    const commit = vi.fn().mockResolvedValue({});
    const transactionPatch = vi.fn().mockReturnThis();
    const createIfNotExists = vi.fn().mockReturnThis();
    const transaction = { createIfNotExists, patch: transactionPatch, commit };
    const directPatch = vi.fn();
    const client = {
      transaction: () => transaction,
      patch: directPatch,
    } as unknown as SanityClient;

    const publishedTranslation = {
      _id: 'doc-1-de',
      _type: 'article',
      title: 'Alte Übersetzung',
    };

    await patchI18nDoc(
      'doc-1',
      'doc-1-de',
      { _id: 'doc-1', _type: 'article', title: 'About' },
      { _id: 'doc-1', _type: 'article', title: 'Über uns' },
      { title: 'Über uns' },
      client,
      publishedTranslation
    );

    // The live document must not be touched.
    expect(directPatch).not.toHaveBeenCalled();

    expect(createIfNotExists).toHaveBeenCalledWith({
      ...publishedTranslation,
      _id: 'drafts.doc-1-de',
    });
    expect(transactionPatch).toHaveBeenCalledWith(
      'drafts.doc-1-de',
      expect.any(Function)
    );

    // The patch builder should set the translated fields on the draft.
    const set = vi.fn().mockReturnThis();
    transactionPatch.mock.calls[0]![1]({ set });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Über uns' })
    );
    expect(commit).toHaveBeenCalled();
  });
});
