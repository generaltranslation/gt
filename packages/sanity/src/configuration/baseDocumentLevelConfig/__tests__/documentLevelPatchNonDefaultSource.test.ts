import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { SanityDocument } from 'sanity';
import { pluginConfig } from '../../../adapter/core';
import { documentLevelPatch } from '../documentLevelPatch';
import {
  createGroqClient,
  metadataDoc,
} from '../../../utils/__tests__/groqClient';

const translated = (title: string) =>
  ({
    _id: 'page-fr',
    _type: 'page',
    _rev: 'translated-rev',
    title,
  }) as unknown as SanityDocument;

const frOriginal = {
  _id: 'page-fr',
  _type: 'page',
  _rev: 'rev-1',
  language: 'fr',
  title: 'Bonjour',
};

const metadataIn = (dataset: Record<string, unknown>[]) =>
  dataset.filter((doc) => doc._type === 'translation.metadata');

beforeEach(() => {
  vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
  vi.spyOn(pluginConfig, 'getLanguageField').mockReturnValue('language');
  vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
    true
  );
  vi.spyOn(pluginConfig, 'getIgnoreFields').mockReturnValue([]);
  vi.spyOn(pluginConfig, 'getSkipFields').mockReturnValue([]);
  vi.spyOn(pluginConfig, 'getDedupeFields').mockReturnValue([]);
  vi.spyOn(pluginConfig, 'getSingletons').mockReturnValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('documentLevelPatch from a non-default original', () => {
  test('creates one marked group and reuses it for every locale', async () => {
    const { client, dataset } = createGroqClient([frOriginal]);

    await documentLevelPatch(
      { documentId: 'page-fr' },
      translated('Hello'),
      'en',
      client
    );
    await documentLevelPatch(
      { documentId: 'page-fr' },
      translated('Hallo'),
      'de',
      client
    );

    const metadata = metadataIn(dataset);
    expect(metadata).toHaveLength(1);
    expect(metadata[0]).toMatchObject({
      _id: 'translation.metadata.page-fr',
      gtSourceLanguage: 'fr',
    });
    const entries = (
      metadata[0].translations as {
        language: string;
        value: { _ref: string };
      }[]
    ).map((entry) => [entry.language, entry.value._ref]);
    expect(entries).toEqual([
      ['fr', 'page-fr'],
      ['en', 'generated-1'],
      ['de', 'generated-2'],
    ]);

    // Translations are written in their own language, into the source locale
    // too.
    expect(dataset.find((doc) => doc._id === 'drafts.generated-1')).toEqual(
      expect.objectContaining({ language: 'en', title: 'Hello' })
    );
  });

  test('patches an existing translation without touching the original entry', async () => {
    const group = metadataDoc(
      'translation.metadata.page-fr',
      [
        ['fr', 'page-fr'],
        ['en', 'page-en'],
      ],
      { gtSourceLanguage: 'fr' }
    );
    const { client, inserts, patch } = createGroqClient([
      frOriginal,
      { _id: 'drafts.page-en', _type: 'page', language: 'en', title: 'Old' },
      group,
    ]);

    await documentLevelPatch(
      { documentId: 'page-fr' },
      translated('Hello'),
      'en',
      client
    );

    expect(patch).toHaveBeenCalledWith('drafts.page-en', {
      set: expect.objectContaining({ title: 'Hello' }),
    });
    expect(inserts).toEqual([]);
  });

  test('never writes a translation over the original', async () => {
    const { client, dataset, create, patch } = createGroqClient([frOriginal]);

    await expect(
      documentLevelPatch(
        { documentId: 'page-fr' },
        translated('Bonjour'),
        'fr',
        client
      )
    ).rejects.toThrow(/fr original/);

    expect(create).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
    expect(metadataIn(dataset)).toHaveLength(0);
  });

  test('refuses to translate from a translation', async () => {
    const group = metadataDoc(
      'translation.metadata.page-fr',
      [
        ['fr', 'page-fr'],
        ['en', 'page-en'],
      ],
      { gtSourceLanguage: 'fr' }
    );
    const { client, dataset, create } = createGroqClient([
      frOriginal,
      { _id: 'page-en', _type: 'page', language: 'en', title: 'Hello' },
      group,
    ]);

    await expect(
      documentLevelPatch(
        { documentId: 'page-en' },
        { ...translated('Hallo'), _id: 'page-en' } as SanityDocument,
        'de',
        client
      )
    ).rejects.toThrow(/translation of fr/);

    expect(create).not.toHaveBeenCalled();
    expect(metadataIn(dataset)).toHaveLength(1);
  });
});
