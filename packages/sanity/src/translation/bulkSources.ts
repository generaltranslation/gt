import type { SanityClient, SanityDocument } from 'sanity';
import { getPublishedId } from '../utils/documentIds';
import { TRANSLATION_METADATA_TYPE } from '../utils/translationMetadata';
import { SOURCE_LANGUAGE_FIELD } from '../utils/translationSource';

/**
 * Translation groups whose marker names their original. Unmarked groups need
 * no special handling: their source-locale entry is the original, which is
 * what Translate All has always picked up.
 */
const MARKED_GROUP_FILTER = `_type == '${TRANSLATION_METADATA_TYPE}' && defined(${SOURCE_LANGUAGE_FIELD})`;
const MARKED_GROUPS = `*[${MARKED_GROUP_FILTER}]`;

/** Whether the dataset has any marked translation group. */
export const HAS_MARKED_GROUPS_QUERY = `defined(${MARKED_GROUPS}[0]._id)`;

/**
 * Whether the dataset has any marked translation group. Without one, every
 * source-locale document is an original, as it always was.
 */
export function hasMarkedTranslationGroups(
  client: SanityClient
): Promise<boolean> {
  return client.fetch<boolean>(HAS_MARKED_GROUPS_QUERY);
}

/** Projects a `translations[]` entry to its document's published and draft ids. */
const ENTRY_ID_VARIANTS = `{'ids': [value._ref, 'drafts.' + value._ref]}.ids`;

/**
 * Members of marked groups other than their original, as published and draft
 * ids. Translate All never picks them up, even in the source locale.
 */
export const MARKED_TRANSLATION_IDS = `${MARKED_GROUPS}{
  'ids': translations[
    value._ref != ^.translations[language == ^.^.${SOURCE_LANGUAGE_FIELD}][0].value._ref
  ]${ENTRY_ID_VARIANTS}[]
}.ids[]`;

/**
 * Originals outside the source locale, as published and draft ids. Translate
 * All skips them; each is translated from its own Translate dialog. Requires
 * `$sourceLocale`.
 */
export const NON_DEFAULT_ORIGINAL_IDS = `*[${MARKED_GROUP_FILTER} && ${SOURCE_LANGUAGE_FIELD} != $sourceLocale]{
  'ids': translations[language == ^.${SOURCE_LANGUAGE_FIELD}][0]${ENTRY_ID_VARIANTS}
}.ids[]`;

/** Documents in the source locale; untagged documents are in it too. */
function getLanguageFilter(languageField: string, sourceLocale: string) {
  return `(!defined(${languageField}) || ${languageField} == "${sourceLocale}")`;
}

/**
 * The Translate All selection without marked groups: every source-locale
 * document in scope. This is the query Translate All has always run, and the
 * only one it runs without `allowNonDefaultSourceLocales`.
 *
 * @param scopeFilter - GROQ filter for the `translateDocuments` scope.
 */
export function getSourceLocaleSelectionQuery({
  scopeFilter,
  languageField,
  sourceLocale,
}: {
  scopeFilter: string;
  languageField: string;
  sourceLocale: string;
}): string {
  return `*[${scopeFilter} && ${getLanguageFilter(languageField, sourceLocale)}]`;
}

/** The Translate All selection when the dataset has marked groups. */
function getMarkedSelectionFilter(scopeFilter: string, languageFilter: string) {
  return `${scopeFilter} && ${languageFilter} && !(_id in ${MARKED_TRANSLATION_IDS})`;
}

/**
 * The documents Translate All translates: source-locale documents in scope,
 * except translations in a marked group. Also counts the originals outside
 * the source locale it skips, among those in scope.
 *
 * Without marked groups — every project translating only from the source
 * locale — the document query is exactly the one Translate All always ran.
 *
 * @param scopeFilter - GROQ filter for the `translateDocuments` scope.
 */
export async function selectBulkSourceDocuments({
  client,
  scopeFilter,
  languageField,
  sourceLocale,
}: {
  client: SanityClient;
  scopeFilter: string;
  languageField: string;
  sourceLocale: string;
}): Promise<{ documents: SanityDocument[]; skippedOriginalCount: number }> {
  const hasMarkedGroups = await hasMarkedTranslationGroups(client);
  if (!hasMarkedGroups) {
    return {
      documents: await client.fetch<SanityDocument[]>(
        getSourceLocaleSelectionQuery({
          scopeFilter,
          languageField,
          sourceLocale,
        })
      ),
      skippedOriginalCount: 0,
    };
  }

  const languageFilter = getLanguageFilter(languageField, sourceLocale);

  const { documents, skippedOriginalIds } = await client.fetch<{
    documents: SanityDocument[];
    skippedOriginalIds: string[];
  }>(
    `{
      'documents': *[${getMarkedSelectionFilter(scopeFilter, languageFilter)}],
      'skippedOriginalIds': *[${scopeFilter} && _id in ${NON_DEFAULT_ORIGINAL_IDS}]._id
    }`,
    { sourceLocale }
  );

  return {
    documents,
    skippedOriginalCount: new Set(skippedOriginalIds.map(getPublishedId)).size,
  };
}

/**
 * Check a Translate All selection again right before it is uploaded, keeping
 * only the documents the selection would still pick up. A document can stop
 * being an original after the selection was loaded — added to a marked group
 * as a translation, or its language changed — and only originals are ever
 * uploaded as sources.
 *
 * Without marked groups the selection is kept as loaded, as it always was.
 *
 * @param scopeFilter - GROQ filter for the `translateDocuments` scope.
 */
export async function recheckBulkSourceDocuments<T extends { _id: string }>({
  client,
  documents,
  scopeFilter,
  languageField,
  sourceLocale,
}: {
  client: SanityClient;
  documents: T[];
  scopeFilter: string;
  languageField: string;
  sourceLocale: string;
}): Promise<{ documents: T[]; droppedCount: number }> {
  if (documents.length === 0 || !(await hasMarkedTranslationGroups(client))) {
    return { documents, droppedCount: 0 };
  }

  const ids = documents.flatMap((document) => {
    const publishedId = getPublishedId(document._id);
    return [publishedId, `drafts.${publishedId}`];
  });
  const eligibleIds = await client.fetch<string[]>(
    `*[${getMarkedSelectionFilter(
      scopeFilter,
      getLanguageFilter(languageField, sourceLocale)
    )} && _id in $ids]._id`,
    { ids }
  );
  const eligible = new Set(eligibleIds.map(getPublishedId));
  const kept = documents.filter((document) =>
    eligible.has(getPublishedId(document._id))
  );
  return { documents: kept, droppedCount: documents.length - kept.length };
}
