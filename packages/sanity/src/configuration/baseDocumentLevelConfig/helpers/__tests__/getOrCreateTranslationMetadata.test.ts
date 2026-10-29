import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { pluginConfig } from '../../../../adapter/core';
import { getOrCreateTranslationMetadata } from '../getOrCreateTranslationMetadata';
import {
  createGroqClient,
  metadataDoc,
} from '../../../../utils/__tests__/groqClient';

const metadataIn = (dataset: Record<string, unknown>[]) =>
  dataset.filter((doc) => doc._type === 'translation.metadata');

beforeEach(() => {
  vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
  vi.spyOn(pluginConfig, 'getLanguageField').mockReturnValue('language');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getOrCreateTranslationMetadata for a non-default original', () => {
  test('finds an existing group by the document’s own id', async () => {
    const group = metadataDoc(
      'translation.metadata.page-fr',
      [
        ['fr', 'page-fr'],
        ['en', 'page-en'],
      ],
      { gtSourceLanguage: 'fr' }
    );
    const { client, createIfNotExists } = createGroqClient([group]);

    const metadata = await getOrCreateTranslationMetadata(
      'page-fr',
      { _id: 'page-fr', _type: 'page' },
      client,
      'fr'
    );

    expect(metadata._id).toBe('translation.metadata.page-fr');
    expect(createIfNotExists).not.toHaveBeenCalled();
  });

  test('marks a new group whose original is outside the source locale', async () => {
    const { client, dataset } = createGroqClient([]);

    await getOrCreateTranslationMetadata(
      'page-fr',
      { _id: 'drafts.page-fr', _type: 'page' },
      client,
      'fr'
    );

    expect(metadataIn(dataset)).toEqual([
      expect.objectContaining({
        _id: 'translation.metadata.page-fr',
        gtSourceLanguage: 'fr',
        translations: [
          expect.objectContaining({
            language: 'fr',
            value: expect.objectContaining({ _ref: 'page-fr' }),
          }),
        ],
      }),
    ]);
  });

  test('does not mark a new group whose original is in the source locale', async () => {
    const { client, dataset } = createGroqClient([]);

    await getOrCreateTranslationMetadata(
      'page',
      { _id: 'page', _type: 'page' },
      client,
      'en'
    );

    const [created] = metadataIn(dataset);
    expect(created).not.toHaveProperty('gtSourceLanguage');
  });

  test('refuses a translation instead of creating a second group for it', async () => {
    // Before this lookup went through the document's own id, a non-default
    // document already in a group was not found and got a new, conflicting
    // metadata document.
    const group = metadataDoc('translation.metadata.page', [
      ['en', 'page'],
      ['fr', 'page-fr'],
    ]);
    const { client, dataset, createIfNotExists } = createGroqClient([group]);

    await expect(
      getOrCreateTranslationMetadata(
        'page-fr',
        { _id: 'page-fr', _type: 'page' },
        client,
        'fr'
      )
    ).rejects.toThrow(/translation of en/);

    expect(createIfNotExists).not.toHaveBeenCalled();
    expect(metadataIn(dataset)).toHaveLength(1);
  });
});

describe('getOrCreateTranslationMetadata for a source-locale original', () => {
  test('looks the group up through the source-locale entry', async () => {
    const group = metadataDoc('translation.metadata.page', [
      ['en', 'page'],
      ['fr', 'page-fr'],
    ]);
    const { client, fetch, createIfNotExists } = createGroqClient([group]);

    const found = await getOrCreateTranslationMetadata(
      'page',
      { _id: 'page', _type: 'page' },
      client,
      'en'
    );

    expect(found._id).toBe('translation.metadata.page');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]).toEqual({ baseLanguage: 'en', id: 'page' });
    expect(createIfNotExists).not.toHaveBeenCalled();
  });

  test('refuses a source-locale translation in a group marked with another original', async () => {
    const group = metadataDoc(
      'translation.metadata.page-fr',
      [
        ['fr', 'page-fr'],
        ['en', 'page-en'],
      ],
      { gtSourceLanguage: 'fr' }
    );
    const { client, createIfNotExists } = createGroqClient([group]);

    await expect(
      getOrCreateTranslationMetadata(
        'page-en',
        { _id: 'page-en', _type: 'page' },
        client,
        'en'
      )
    ).rejects.toThrow(/translation of fr/);
    expect(createIfNotExists).not.toHaveBeenCalled();
  });
});
