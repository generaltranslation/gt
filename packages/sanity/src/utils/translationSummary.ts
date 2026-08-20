import type { SanityClient, SanityDocument } from 'sanity';
import { pluginConfig } from '../adapter/core';
import { getDocumentPublishedId } from './documentIds';

export type TranslationSummary = {
  /** Source documents the plugin is configured to translate. */
  documentsChecked: number;
  /** Source documents times target locales. */
  expected: number;
  /** Translated documents recorded in `translation.metadata`. */
  found: number;
  /** Found translations that exist only as a draft. */
  draftOnly: number;
  /** Found translations that have a published version. */
  published: number;
  /** Expected translations with no `translation.metadata` entry. */
  missing: number;
};

export const EMPTY_TRANSLATION_SUMMARY: TranslationSummary = {
  documentsChecked: 0,
  expected: 0,
  found: 0,
  draftOnly: 0,
  published: 0,
  missing: 0,
};

type MetadataEntry = { targets?: { language?: string; id?: string }[] };

export type SummarizeInput = {
  documentCount: number;
  targetLocaleCount: number;
  translatedIds: string[];
  publishedIds: string[];
  draftIds: string[];
};

/**
 * Counts translations by where they exist.
 *
 * A translation with no published version is only visible to a reader on the
 * drafts perspective, which is why `draftOnly` is reported separately rather
 * than folded into `found`.
 */
export function summarizeTranslations({
  documentCount,
  targetLocaleCount,
  translatedIds,
  publishedIds,
  draftIds,
}: SummarizeInput): TranslationSummary {
  const unique = Array.from(new Set(translatedIds));
  const publishedSet = new Set(publishedIds);
  const draftSet = new Set(draftIds);

  const published = unique.filter((id) => publishedSet.has(id)).length;
  const draftOnly = unique.filter(
    (id) => !publishedSet.has(id) && draftSet.has(`drafts.${id}`)
  ).length;
  const expected = documentCount * targetLocaleCount;

  return {
    documentsChecked: documentCount,
    expected,
    found: unique.length,
    draftOnly,
    published,
    missing: Math.max(0, expected - unique.length),
  };
}

/**
 * Reads `translation.metadata` for the given documents and reports how many
 * translations exist, and whether they are published or draft-only.
 */
export async function collectTranslationSummary(
  documents: SanityDocument[],
  client: SanityClient
): Promise<TranslationSummary> {
  const documentIds = documents.map(getDocumentPublishedId);
  const targetLocales = pluginConfig.getLocales();

  if (documentIds.length === 0) {
    return EMPTY_TRANSLATION_SUMMARY;
  }

  // Only the configured target locales are counted. Metadata can also hold
  // entries for the source and for locales dropped from the configuration
  // since, and neither is something this reports on.
  //
  // The metadata document is found by reference rather than by its
  // source-language entry: that entry records whatever `sourceLocale` was set
  // when it was created, so a project that later changed it would match none
  // of its own translations.
  const entries = await client.fetch<MetadataEntry[]>(
    `*[_type == 'translation.metadata' && references($documentIds)]{
      'targets': translations[language in $targetLocales && defined(value._ref)]{
        language,
        'id': value._ref
      }
    }`,
    { documentIds, targetLocales }
  );

  const translatedIds = entries
    .flatMap((entry) => entry.targets ?? [])
    .map((target) => target.id)
    .filter((id): id is string => Boolean(id));

  if (translatedIds.length === 0) {
    return summarizeTranslations({
      documentCount: documentIds.length,
      targetLocaleCount: targetLocales.length,
      translatedIds: [],
      publishedIds: [],
      draftIds: [],
    });
  }

  const unique = Array.from(new Set(translatedIds));
  const existence = await client.fetch<{
    publishedIds: string[];
    draftIds: string[];
  }>(
    `{
      'publishedIds': *[_id in $ids]._id,
      'draftIds': *[_id in $draftIds]._id
    }`,
    { ids: unique, draftIds: unique.map((id) => `drafts.${id}`) }
  );

  return summarizeTranslations({
    documentCount: documentIds.length,
    targetLocaleCount: targetLocales.length,
    translatedIds: unique,
    publishedIds: existence?.publishedIds ?? [],
    draftIds: existence?.draftIds ?? [],
  });
}
