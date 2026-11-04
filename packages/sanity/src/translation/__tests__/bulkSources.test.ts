import { describe, expect, test } from 'vitest';
import {
  recheckBulkSourceDocuments,
  selectBulkSourceDocuments,
} from '../bulkSources';
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

describe('Translate All query', () => {
  test('runs the same document query as before when nothing is marked', async () => {
    const { client, fetch } = createGroqClient([
      page('a', 'en'),
      metadataDoc('m-a', [['en', 'a']]),
    ]);

    await selectBulkSourceDocuments({
      client,
      scopeFilter: SCOPE_FILTER,
      languageField: 'language',
      sourceLocale: 'en',
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]).toEqual([
      `*[${SCOPE_FILTER} && (!defined(language) || language == "en")]`,
    ]);
  });

  test('leaves out drafts of translations and every member but the original', async () => {
    const dataset = [
      page('b-fr', 'fr'),
      page('b-en', 'en'),
      page('drafts.b-en', 'en'),
      // A second fr entry is a member, not the original.
      page('b-fr-2', 'fr'),
      metadataDoc(
        'm-b',
        [
          ['fr', 'b-fr'],
          ['en', 'b-en'],
          ['fr', 'b-fr-2'],
        ],
        { gtSourceLanguage: 'fr' }
      ),
      page('a', 'en'),
    ];

    expect(await selectBulkSources(dataset)).toEqual({
      ids: ['a'],
      skippedOriginalCount: 1,
    });
  });

  test('counts an original with a draft once', async () => {
    const dataset = [
      page('b-fr', 'fr'),
      page('drafts.b-fr', 'fr'),
      metadataDoc('m-b', [['fr', 'b-fr']], { gtSourceLanguage: 'fr' }),
    ];

    expect(await selectBulkSources(dataset)).toEqual({
      ids: [],
      skippedOriginalCount: 1,
    });
  });
});

describe('rechecking a Translate All selection before upload', () => {
  const recheck = (
    dataset: Record<string, unknown>[],
    documents: { _id: string }[]
  ) => {
    const { client, fetch } = createGroqClient(
      dataset as (Record<string, unknown> & { _id: string })[]
    );
    return {
      fetch,
      result: recheckBulkSourceDocuments({
        client,
        documents,
        scopeFilter: SCOPE_FILTER,
        languageField: 'language',
        sourceLocale: 'en',
      }),
    };
  };

  test('drops a document that became a translation in a marked group', async () => {
    // Loaded as a standalone en original; since then it was added to a group
    // whose original is fr.
    const dataset = [
      page('a', 'en'),
      page('drafts.b-en', 'en'),
      page('b-fr', 'fr'),
      metadataDoc(
        'm-b',
        [
          ['fr', 'b-fr'],
          ['en', 'b-en'],
        ],
        { gtSourceLanguage: 'fr' }
      ),
    ];

    const { result } = recheck(dataset, [
      page('a', 'en'),
      page('drafts.b-en', 'en'),
    ]);
    expect(await result).toEqual({
      documents: [page('a', 'en')],
      droppedCount: 1,
    });
  });

  test('keeps an original whose draft is the one loaded', async () => {
    const dataset = [
      page('drafts.c', 'en'),
      metadataDoc('m-other', [['fr', 'x-fr']], { gtSourceLanguage: 'fr' }),
    ];

    const { result } = recheck(dataset, [page('drafts.c', 'en')]);
    expect(await result).toEqual({
      documents: [page('drafts.c', 'en')],
      droppedCount: 0,
    });
  });

  test('keeps the loaded selection without marked groups', async () => {
    // Its language changed since loading, but nothing is marked, so the
    // selection behaves as it always did.
    const dataset = [page('a', 'fr')];

    const { result, fetch } = recheck(dataset, [page('a', 'en')]);
    expect(await result).toEqual({
      documents: [page('a', 'en')],
      droppedCount: 0,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
