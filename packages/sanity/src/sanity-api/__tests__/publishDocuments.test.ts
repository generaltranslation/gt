import { describe, expect, test } from 'vitest';
import { evaluate, parse } from 'groq-js';
import { TRANSLATION_DOCS_FOR_PUBLISH_QUERY } from '../publishDocuments';

type MetadataEntry = { language: string; ref: string };

function metadata(id: string, entries: MetadataEntry[]) {
  return {
    _id: `translation.metadata.${id}`,
    _type: 'translation.metadata',
    translations: entries.map((entry, index) => ({
      _key: `k${index}`,
      _type: 'internationalizedArrayReferenceValue',
      language: entry.language,
      value: { _type: 'reference', _ref: entry.ref },
    })),
  };
}

/** Runs the real publish query the provider sends, via Sanity's own GROQ engine. */
async function selectTranslationDocIds(
  dataset: unknown[],
  publishedDocumentIds: string[]
): Promise<string[]> {
  const tree = parse(TRANSLATION_DOCS_FOR_PUBLISH_QUERY);
  const value = await evaluate(tree, {
    dataset,
    params: { publishedDocumentIds },
  });
  const result = (await value.get()) as {
    translationDocs?: { docId?: string }[];
  }[];

  return result
    .flatMap((entry) => entry.translationDocs ?? [])
    .map((doc) => doc.docId)
    .filter((docId): docId is string => Boolean(docId))
    .sort();
}

describe('TRANSLATION_DOCS_FOR_PUBLISH_QUERY', () => {
  test('selects every translation of a source document', async () => {
    const dataset = [
      metadata('page-a', [
        { language: 'en-US', ref: 'page-a' },
        { language: 'fr-FR', ref: 'page-a-fr' },
        { language: 'de-DE', ref: 'page-a-de' },
      ]),
    ];

    expect(await selectTranslationDocIds(dataset, ['page-a'])).toEqual([
      'page-a-de',
      'page-a-fr',
    ]);
  });

  test('still selects translations when the source entry keeps an older locale label', async () => {
    // The configured source locale is `en-US`, but this metadata document was
    // written while it was `en`. Matching on the label found nothing here and
    // silently dropped the group from the publish.
    const dataset = [
      metadata('page-legacy', [
        { language: 'en', ref: 'page-legacy' },
        { language: 'fr-FR', ref: 'page-legacy-fr' },
        { language: 'ja-JP', ref: 'page-legacy-ja' },
      ]),
    ];

    expect(await selectTranslationDocIds(dataset, ['page-legacy'])).toEqual([
      'page-legacy-fr',
      'page-legacy-ja',
    ]);
  });

  test('never returns a source document, whatever locale it is labelled with', async () => {
    // Two sources, each labelled differently, plus a stale entry pointing at
    // the other source. Testing `language != sourceLocale` would have queued
    // both source documents for publishing.
    const dataset = [
      metadata('page-a', [
        { language: 'en-US', ref: 'page-a' },
        { language: 'en', ref: 'page-b' },
        { language: 'fr-FR', ref: 'page-a-fr' },
      ]),
      metadata('page-b', [
        { language: 'en', ref: 'page-b' },
        { language: 'de-DE', ref: 'page-b-de' },
      ]),
    ];

    const selected = await selectTranslationDocIds(dataset, [
      'page-a',
      'page-b',
    ]);

    expect(selected).toEqual(['page-a-fr', 'page-b-de']);
    expect(selected).not.toContain('page-a');
    expect(selected).not.toContain('page-b');
  });

  test('ignores metadata for documents outside the requested set', async () => {
    const dataset = [
      metadata('page-a', [
        { language: 'en-US', ref: 'page-a' },
        { language: 'fr-FR', ref: 'page-a-fr' },
      ]),
      metadata('page-other', [
        { language: 'en-US', ref: 'page-other' },
        { language: 'fr-FR', ref: 'page-other-fr' },
      ]),
    ];

    expect(await selectTranslationDocIds(dataset, ['page-a'])).toEqual([
      'page-a-fr',
    ]);
  });

  test('skips entries with no reference', async () => {
    const dataset = [
      {
        _id: 'translation.metadata.page-a',
        _type: 'translation.metadata',
        translations: [
          {
            _key: 'k0',
            language: 'en-US',
            value: { _type: 'reference', _ref: 'page-a' },
          },
          { _key: 'k1', language: 'fr-FR', value: {} },
          {
            _key: 'k2',
            language: 'de-DE',
            value: { _type: 'reference', _ref: 'page-a-de' },
          },
        ],
      },
    ];

    expect(await selectTranslationDocIds(dataset, ['page-a'])).toEqual([
      'page-a-de',
    ]);
  });
});
