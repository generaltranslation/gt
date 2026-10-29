import { describe, expect, test } from 'vitest';
import {
  BULK_TRANSLATION_GROUPS_QUERY,
  bulkSourceLanguageFilter,
  planBulkSources,
  withIdVariants,
  type BulkTranslationGroup,
} from '../bulkSources';
import { getPublishedId } from '../../utils/documentIds';
import {
  createGroqClient,
  metadataDoc,
} from '../../utils/__tests__/groqClient';

const page = (id: string, language?: string) => ({
  _id: id,
  _type: 'page',
  ...(language && { language }),
});

/** The Translate All document selection, as the provider runs it. */
async function selectBulkSources(dataset: Record<string, unknown>[]) {
  const { client } = createGroqClient(
    dataset as (Record<string, unknown> & { _id: string })[]
  );
  const baseFilter = `!(_type in ["system.group"]) && !(_id in path("_.**")) && (_type == "page")`;
  const groups = await client.fetch<BulkTranslationGroup[]>(
    BULK_TRANSLATION_GROUPS_QUERY,
    { sourceLocale: 'en' }
  );
  const memberIds = withIdVariants(
    groups.flatMap((group) => group.memberRefs ?? [])
  );
  const existing = await client.fetch<string[]>(
    `*[${baseFilter} && _id in $memberIds]._id`,
    { memberIds }
  );
  const plan = planBulkSources(groups, new Set(existing.map(getPublishedId)));
  const docs = await client.fetch<{ _id: string }[]>(
    `*[${baseFilter} && ${bulkSourceLanguageFilter('language', 'en')}]`,
    { originalIds: plan.originalIds, excludedIds: plan.excludedIds }
  );
  return {
    ids: docs.map((doc) => doc._id).sort(),
    unresolvedGroupCount: plan.unresolvedGroupCount,
  };
}

describe('Translate All document selection', () => {
  test('includes marked originals and skips groups without an original', async () => {
    const dataset = [
      // Standalone source-locale page: an original, as before.
      page('standalone'),
      // Unmarked group: the source-locale entry is the original.
      page('a', 'en'),
      page('a-fr', 'fr'),
      metadataDoc('m-a', [
        ['en', 'a'],
        ['fr', 'a-fr'],
      ]),
      // Marked group: the fr page is the original, the en page a translation.
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
      // Marked group whose original was deleted.
      page('c-en', 'en'),
      metadataDoc(
        'm-c',
        [
          ['fr', 'c-fr'],
          ['en', 'c-en'],
        ],
        { gtSourceLanguage: 'fr' }
      ),
      // Unmarked group without a source-locale entry.
      page('d-fr', 'fr'),
      page('d-de', 'de'),
      metadataDoc('m-d', [
        ['fr', 'd-fr'],
        ['de', 'd-de'],
      ]),
    ];

    expect(await selectBulkSources(dataset)).toEqual({
      ids: ['a', 'drafts.b-fr', 'standalone'],
      unresolvedGroupCount: 2,
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
    ];

    expect(await selectBulkSources(dataset)).toEqual({
      ids: ['a', 'b'],
      unresolvedGroupCount: 0,
    });
  });
});

describe('planBulkSources', () => {
  test('lists originals and excluded members in published and draft form', () => {
    const plan = planBulkSources(
      [
        {
          marked: true,
          originalRef: 'b-fr',
          memberRefs: ['b-fr', 'b-en'],
        },
      ],
      new Set(['b-fr', 'b-en'])
    );

    expect(plan).toEqual({
      originalIds: ['b-fr', 'drafts.b-fr'],
      excludedIds: ['b-en', 'drafts.b-en'],
      unresolvedGroupCount: 0,
    });
  });

  test('does not count a group none of whose members are in scope', () => {
    const plan = planBulkSources(
      [{ marked: false, originalRef: null, memberRefs: ['x-fr'] }],
      new Set()
    );

    expect(plan.unresolvedGroupCount).toBe(0);
  });
});
