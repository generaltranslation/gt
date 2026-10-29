import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { pluginConfig } from '../../adapter/core';
import {
  EXISTING_TRANSLATIONS_BY_ORIGINAL_QUERY,
  resolveDocumentRole,
  resolveTranslationRole,
} from '../translationSource';
import { createGroqClient, metadataDoc } from './groqClient';

beforeEach(() => {
  vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
  vi.spyOn(pluginConfig, 'getLanguageField').mockReturnValue('language');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveTranslationRole', () => {
  test('a document outside any group is an original in its own language', () => {
    expect(
      resolveTranslationRole({
        documentId: 'page-fr',
        documentLanguage: 'fr',
        metadata: null,
      })
    ).toEqual({ kind: 'original', language: 'fr' });
  });

  test('without a marker, the source-locale entry is the original', () => {
    const metadata = metadataDoc('m', [
      ['en', 'page'],
      ['fr', 'page-fr'],
    ]);

    expect(
      resolveTranslationRole({
        documentId: 'drafts.page',
        documentLanguage: 'en',
        metadata,
      })
    ).toEqual({ kind: 'original', language: 'en' });
    expect(
      resolveTranslationRole({
        documentId: 'page-fr',
        documentLanguage: 'fr',
        metadata,
      })
    ).toEqual({ kind: 'translation', language: 'fr', originalLanguage: 'en' });
  });

  test('with a marker, only the marked language is the original', () => {
    const metadata = metadataDoc(
      'm',
      [
        ['fr', 'page-fr'],
        ['en', 'page-en'],
      ],
      { gtSourceLanguage: 'fr' }
    );

    expect(
      resolveTranslationRole({
        documentId: 'page-fr',
        documentLanguage: 'fr',
        metadata,
      })
    ).toEqual({ kind: 'original', language: 'fr' });
    // A source-locale page is a translation when the marker names another
    // original.
    expect(
      resolveTranslationRole({
        documentId: 'page-en',
        documentLanguage: 'en',
        metadata,
      })
    ).toEqual({ kind: 'translation', language: 'en', originalLanguage: 'fr' });
  });

  test('a group with no marker and no source-locale entry has no original', () => {
    const metadata = metadataDoc('m', [
      ['fr', 'page-fr'],
      ['de', 'page-de'],
    ]);

    expect(
      resolveTranslationRole({
        documentId: 'page-fr',
        documentLanguage: 'fr',
        metadata,
      })
    ).toEqual({ kind: 'unresolved', language: 'fr', reason: 'noOriginal' });
  });

  test('a group whose marked original was deleted has no original', () => {
    const metadata = metadataDoc(
      'm',
      [
        ['fr', 'page-fr'],
        ['en', 'page-en'],
      ],
      { gtSourceLanguage: 'fr' }
    );

    expect(
      resolveTranslationRole({
        documentId: 'page-en',
        documentLanguage: 'en',
        metadata,
        originalExists: false,
      })
    ).toEqual({
      kind: 'unresolved',
      language: 'en',
      reason: 'originalMissing',
    });

    const withoutEntry = metadataDoc('m', [['en', 'page-en']], {
      gtSourceLanguage: 'fr',
    });
    expect(
      resolveTranslationRole({
        documentId: 'page-en',
        documentLanguage: 'en',
        metadata: withoutEntry,
      })
    ).toEqual({
      kind: 'unresolved',
      language: 'en',
      reason: 'originalMissing',
    });
  });
});

describe('resolveDocumentRole', () => {
  test('finds the group by the document’s own id, not the source-locale entry', async () => {
    const { client } = createGroqClient([
      { _id: 'page-fr', _type: 'page', language: 'fr' },
      { _id: 'page-en', _type: 'page', language: 'en' },
      metadataDoc(
        'translation.metadata.page-fr',
        [
          ['fr', 'page-fr'],
          ['en', 'page-en'],
        ],
        { gtSourceLanguage: 'fr' }
      ),
    ]);

    const original = await resolveDocumentRole(
      { _id: 'drafts.page-fr', _type: 'page', language: 'fr' },
      client
    );
    expect(original.role).toEqual({ kind: 'original', language: 'fr' });
    expect(original.metadata?._id).toBe('translation.metadata.page-fr');

    const translation = await resolveDocumentRole(
      { _id: 'page-en', _type: 'page', language: 'en' },
      client
    );
    expect(translation.role).toEqual({
      kind: 'translation',
      language: 'en',
      originalLanguage: 'fr',
    });
  });

  test('reports a group whose original no longer exists', async () => {
    const { client } = createGroqClient([
      { _id: 'page-en', _type: 'page', language: 'en' },
      metadataDoc(
        'translation.metadata.page-fr',
        [
          ['fr', 'page-fr'],
          ['en', 'page-en'],
        ],
        { gtSourceLanguage: 'fr' }
      ),
    ]);

    const { role } = await resolveDocumentRole(
      { _id: 'page-en', _type: 'page', language: 'en' },
      client
    );
    expect(role).toEqual({
      kind: 'unresolved',
      language: 'en',
      reason: 'originalMissing',
    });
  });
});

describe('EXISTING_TRANSLATIONS_BY_ORIGINAL_QUERY', () => {
  test('finds translations through each group’s original, in any language', async () => {
    const { client } = createGroqClient([
      metadataDoc('a', [
        ['en', 'page-a'],
        ['fr', 'page-a-fr'],
      ]),
      metadataDoc(
        'b',
        [
          ['fr', 'page-b'],
          ['en', 'page-b-en'],
        ],
        { gtSourceLanguage: 'fr' }
      ),
    ]);

    const rows = await client.fetch(EXISTING_TRANSLATIONS_BY_ORIGINAL_QUERY, {
      sourceLocale: 'en',
      documentIds: ['page-a', 'page-b', 'page-b-en'],
      localeIds: ['en', 'fr'],
    });

    expect(rows).toEqual([
      {
        sourceDocId: 'page-a',
        sourceLanguage: 'en',
        existingTranslations: ['en', 'fr'],
      },
      {
        sourceDocId: 'page-b',
        sourceLanguage: 'fr',
        existingTranslations: ['fr', 'en'],
      },
    ]);
  });
});
