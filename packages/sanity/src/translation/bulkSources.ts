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
  const languageFilter = `(!defined(${languageField}) || ${languageField} == "${sourceLocale}")`;

  const hasMarkedGroups = await client.fetch<boolean>(HAS_MARKED_GROUPS_QUERY);
  if (!hasMarkedGroups) {
    return {
      documents: await client.fetch<SanityDocument[]>(
        `*[${scopeFilter} && ${languageFilter}]`
      ),
      skippedOriginalCount: 0,
    };
  }

  const { documents, skippedOriginalIds } = await client.fetch<{
    documents: SanityDocument[];
    skippedOriginalIds: string[];
  }>(
    `{
      'documents': *[${scopeFilter} && ${languageFilter} && !(_id in ${MARKED_TRANSLATION_IDS})],
      'skippedOriginalIds': *[${scopeFilter} && _id in ${NON_DEFAULT_ORIGINAL_IDS}]._id
    }`,
    { sourceLocale }
  );

  return {
    documents,
    skippedOriginalCount: new Set(skippedOriginalIds.map(getPublishedId)).size,
  };
}
