import { afterEach, describe, expect, test, vi } from 'vitest';
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

    const client = { fetch, patch, create } as any;

    await documentLevelPatch(
      { documentId: 'article-1' },
      { _id: 'article-1', _type: 'article', title: 'Hola' } as any,
      'es',
      client
    );

    expect(create).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalledWith('drafts.article-1-es', {
      set: expect.objectContaining({ title: 'Hola' }),
    });
  });
});
