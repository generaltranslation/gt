import { getPublishedId } from '../utils/documentIds';
import { TRANSLATION_METADATA_TYPE } from '../utils/translationMetadata';
import { SOURCE_LANGUAGE_FIELD } from '../utils/translationSource';

/**
 * Translation groups that change which documents Translate All picks up when
 * non-default originals are allowed:
 * - marked groups, whose original is named by `gtSourceLanguage`;
 * - unmarked groups with no source-locale entry, which have no original.
 *
 * Every other group is unchanged: its source-locale entry is the original.
 * Requires `$sourceLocale`.
 */
export const BULK_TRANSLATION_GROUPS_QUERY = `*[
  _type == '${TRANSLATION_METADATA_TYPE}' &&
  (
    defined(${SOURCE_LANGUAGE_FIELD}) ||
    count(translations[language == $sourceLocale]) == 0
  )
] {
  'marked': defined(${SOURCE_LANGUAGE_FIELD}),
  'originalRef': translations[language == ^.${SOURCE_LANGUAGE_FIELD}][0].value._ref,
  'memberRefs': translations[defined(value._ref)].value._ref
}`;

export type BulkTranslationGroup = {
  marked: boolean;
  originalRef?: string | null;
  memberRefs?: string[] | null;
};

export type BulkSourcePlan = {
  /** Originals of marked groups, as published and draft ids. */
  originalIds: string[];
  /** Non-original members of marked groups, as published and draft ids. */
  excludedIds: string[];
  /** Groups with an in-scope member but no original to translate from. */
  unresolvedGroupCount: number;
};

/** A document id in both its published and draft forms. */
export function withIdVariants(ids: string[]): string[] {
  return Array.from(
    new Set(
      ids.flatMap((id) => {
        const publishedId = getPublishedId(id);
        return [publishedId, `drafts.${publishedId}`];
      })
    )
  );
}

/**
 * Decide which documents Translate All includes and excludes beyond the
 * source-locale documents it always considered.
 *
 * @param existingIds - published ids of group members that exist and match
 *   the `translateDocuments` filters.
 */
export function planBulkSources(
  groups: BulkTranslationGroup[],
  existingIds: Set<string>
): BulkSourcePlan {
  const originalIds: string[] = [];
  const excludedIds: string[] = [];
  let unresolvedGroupCount = 0;

  for (const group of groups) {
    const memberRefs = group.memberRefs ?? [];
    const originalRef = group.originalRef ?? undefined;
    const hasOriginal = Boolean(
      group.marked && originalRef && existingIds.has(originalRef)
    );

    if (group.marked) {
      // Default-locale pages in a group whose marker names another original
      // are translations, so they are never a source.
      excludedIds.push(...memberRefs.filter((ref) => ref !== originalRef));
    }
    if (hasOriginal && originalRef) {
      originalIds.push(originalRef);
    } else if (memberRefs.some((ref) => existingIds.has(ref))) {
      unresolvedGroupCount++;
    }
  }

  return {
    originalIds: withIdVariants(originalIds),
    excludedIds: withIdVariants(excludedIds),
    unresolvedGroupCount,
  };
}

/**
 * The document filter Translate All uses when non-default originals are
 * allowed: source-locale documents that are not translations in a marked
 * group, plus the originals of marked groups. Requires `$originalIds` and
 * `$excludedIds` from {@link planBulkSources}.
 */
export function bulkSourceLanguageFilter(
  languageField: string,
  sourceLocale: string
): string {
  return `(((!defined(${languageField}) || ${languageField} == "${sourceLocale}") && !(_id in $excludedIds)) || _id in $originalIds)`;
}
