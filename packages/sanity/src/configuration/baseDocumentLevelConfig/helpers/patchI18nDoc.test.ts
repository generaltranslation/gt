import { afterEach, describe, expect, test, vi } from 'vitest';
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
    const client = { patch } as any;

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
});
