import { describe, expect, test } from 'vitest';
import { planBulkSources, selectBulkSourceDocuments } from '../bulkSources';
import {
  createGroqClient,
  metadataDoc,
} from '../../utils/__tests__/groqClient';

const page = (id: string, language?: string) => ({
  _id: id,
  _type: 'page',
  ...(language && { language }),
});

const SCOPE_FILTER = `!(_type in ["system.group"]) && !(_id in path("_.**")) && (_type == "page")`;

/** The Translate All document selection, as the provider runs it. */
async function selectBulkSources(dataset: Record<string, unknown>[]) {
  const { client } = createGroqClient(
    dataset as (Record<string, unknown> & { _id: string })[]
  );
  const { documents, skippedOriginalCount } = await selectBulkSourceDocuments({
    client,
    scopeFilter: SCOPE_FILTER,
    languageField: 'language',
    sourceLocale: 'en',
  });
  return {
    ids: documents.map((doc) => doc._id).sort(),
    skippedOriginalCount,
  };
}

describe('Translate All document selection', () => {
  test('covers only source-locale originals', async () => {
    const dataset = [
      // Standalone source-locale page: an original, as before.
      page('standalone'),
      // Standalone page in another locale: never picked up, as before.
      page('lonely-fr', 'fr'),
      // Unmarked group: the source-locale entry is the original.
      page('a', 'en'),
      page('a-fr', 'fr'),
      metadataDoc('m-a', [
        ['en', 'a'],
        ['fr', 'a-fr'],
      ]),
      // Marked group with a fr original: skipped, and its en page is a
      // translation, so it is left out too.
      page('drafts.b-fr', 'fr'),
      page('b-en', 'en'),
      metadataDoc(
        'm-b',
        [
          ['fr', 'b-fr'],
          ['en', 'b-en'],
        ],
        { gtSourceLanguage: 'fr' }
      ),
      // Marked group whose original was deleted: its en page is still a
      // translation.
      page('c-en', 'en'),
      metadataDoc(
        'm-c',
        [
          ['fr', 'c-fr'],
          ['en', 'c-en'],
        ],
        { gtSourceLanguage: 'fr' }
      ),
      // Group marked with the source locale: its en page is the original.
      page('d-en', 'en'),
      page('d-de', 'de'),
      metadataDoc(
        'm-d',
        [
          ['en', 'd-en'],
          ['de', 'd-de'],
        ],
        { gtSourceLanguage: 'en' }
      ),
    ];

    expect(await selectBulkSources(dataset)).toEqual({
      ids: ['a', 'd-en', 'standalone'],
      skippedOriginalCount: 1,
    });
  });

  test('selects exactly the source-locale documents when nothing is marked', async () => {
    const dataset = [
      page('a', 'en'),
      page('a-fr', 'fr'),
      metadataDoc('m-a', [
        ['en', 'a'],
        ['fr', 'a-fr'],
      ]),
      page('b'),
      page('c-de', 'de'),
    ];

    expect(await selectBulkSources(dataset)).toEqual({
      ids: ['a', 'b'],
      skippedOriginalCount: 0,
    });
  });

  test('does not count skipped originals outside the translateDocuments scope', async () => {
    const dataset = [
      { _id: 'post-fr', _type: 'post', language: 'fr' },
      metadataDoc('m-post', [['fr', 'post-fr']], { gtSourceLanguage: 'fr' }),
    ];

    expect(await selectBulkSources(dataset)).toEqual({
      ids: [],
      skippedOriginalCount: 0,
    });
  });
});

describe('planBulkSources', () => {
  test('lists excluded members and skipped originals in published and draft form', () => {
    expect(
      planBulkSources([
        {
          nonDefaultOriginal: true,
          originalRef: 'b-fr',
          memberRefs: ['b-fr', 'b-en'],
        },
      ])
    ).toEqual({
      excludedIds: ['b-en', 'drafts.b-en'],
      nonDefaultOriginalIds: ['b-fr', 'drafts.b-fr'],
    });
  });

  test('keeps the original of a group marked with the source locale', () => {
    expect(
      planBulkSources([
        {
          nonDefaultOriginal: false,
          originalRef: 'a',
          memberRefs: ['a', 'a-fr'],
        },
      ])
    ).toEqual({
      excludedIds: ['a-fr', 'drafts.a-fr'],
      nonDefaultOriginalIds: [],
    });
  });
});
