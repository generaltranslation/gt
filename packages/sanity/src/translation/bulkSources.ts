import type { SanityClient, SanityDocument } from 'sanity';
import { getPublishedId } from '../utils/documentIds';
import { TRANSLATION_METADATA_TYPE } from '../utils/translationMetadata';
import { SOURCE_LANGUAGE_FIELD } from '../utils/translationSource';

/**
 * Translation groups whose marker names their original. Unmarked groups need
 * no special handling: their source-locale entry is the original, which is
 * what Translate All has always picked up. Requires `$sourceLocale`.
 */
export const MARKED_TRANSLATION_GROUPS_QUERY = `*[
  _type == '${TRANSLATION_METADATA_TYPE}' &&
  defined(${SOURCE_LANGUAGE_FIELD})
] {
  'nonDefaultOriginal': ${SOURCE_LANGUAGE_FIELD} != $sourceLocale,
  'originalRef': translations[language == ^.${SOURCE_LANGUAGE_FIELD}][0].value._ref,
  'memberRefs': translations[defined(value._ref)].value._ref
}`;

export type MarkedTranslationGroup = {
  nonDefaultOriginal: boolean;
  originalRef?: string | null;
  memberRefs?: string[] | null;
};

export type BulkSourcePlan = {
  /**
   * Members of marked groups other than their original, as published and
   * draft ids. Translate All never picks them up, even in the source locale.
   */
  excludedIds: string[];
  /**
   * Originals outside the source locale, as published and draft ids.
   * Translate All skips them; each is translated from its own Translate dialog.
   */
  nonDefaultOriginalIds: string[];
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
 * Decide which source-locale documents Translate All leaves out because they
 * are translations in a marked group, and which originals it skips because
 * they are not in the source locale.
 */
export function planBulkSources(
  groups: MarkedTranslationGroup[]
): BulkSourcePlan {
  const excludedIds: string[] = [];
  const nonDefaultOriginalIds: string[] = [];

  for (const group of groups) {
    const originalRef = group.originalRef ?? undefined;
    excludedIds.push(
      ...(group.memberRefs ?? []).filter((ref) => ref !== originalRef)
    );
    if (group.nonDefaultOriginal && originalRef) {
      nonDefaultOriginalIds.push(originalRef);
    }
  }

  return {
    excludedIds: withIdVariants(excludedIds),
    nonDefaultOriginalIds: withIdVariants(nonDefaultOriginalIds),
  };
}

/**
 * The documents Translate All translates: source-locale documents in scope,
 * except translations in a marked group. Also counts the originals outside
 * the source locale it skips, among those in scope.
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
  const plan = planBulkSources(
    await client.fetch<MarkedTranslationGroup[]>(
      MARKED_TRANSLATION_GROUPS_QUERY,
      { sourceLocale }
    )
  );

  // Without marked groups this is the selection Translate All always made.
  const documents =
    plan.excludedIds.length > 0
      ? await client.fetch<SanityDocument[]>(
          `*[${scopeFilter} && ${languageFilter} && !(_id in $excludedIds)]`,
          { excludedIds: plan.excludedIds }
        )
      : await client.fetch<SanityDocument[]>(
          `*[${scopeFilter} && ${languageFilter}]`
        );

  const skippedOriginalIds =
    plan.nonDefaultOriginalIds.length > 0
      ? await client.fetch<string[]>(
          `*[${scopeFilter} && _id in $originalIds]._id`,
          { originalIds: plan.nonDefaultOriginalIds }
        )
      : [];

  return {
    documents,
    skippedOriginalCount: new Set(skippedOriginalIds.map(getPublishedId)).size,
  };
}
