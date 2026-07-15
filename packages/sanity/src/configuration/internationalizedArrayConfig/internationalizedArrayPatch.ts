import { SanityClient, SanityDocument } from 'sanity';
import { pluginConfig } from '../../adapter/core';
import { mergeInternationalizedArrays } from '../../serialization/internationalizedArray/merge';
import type { GTFile } from '../../types';
import { getPublishedId } from '../../utils/documentIds';
import { findLatestDraft } from '../utils/findLatestDraft';

/**
 * Import a translated internationalized-array document in place.
 *
 * Unlike document-level import (which creates per-locale documents and tracks
 * translation metadata), array localization upserts the target-locale `value`
 * into the same source document. We read the latest draft so concurrent edits
 * to the source are not clobbered, merge only the changed top-level fields, and
 * commit a single patch.
 */
export const internationalizedArrayPatch = async (
  docInfo: GTFile,
  translatedFields: SanityDocument,
  localeId: string,
  client: SanityClient
): Promise<void> => {
  const sourceLocale = pluginConfig.getSourceLocale();

  const baseDoc = await findLatestDraft(docInfo.documentId, client);
  if (!baseDoc) {
    return;
  }

  const changes = mergeInternationalizedArrays(
    baseDoc as Record<string, unknown>,
    translatedFields as Record<string, unknown>,
    localeId,
    sourceLocale
  );

  if (Object.keys(changes).length === 0) {
    return;
  }

  // Every key in `changes` already exists on the base document (merge only
  // returns existing fields), so a full `set` of the merged field is safe and
  // preserves all other locale items and their random `_key`s.
  if (baseDoc._id.startsWith('drafts.')) {
    await client.patch(baseDoc._id).set(changes).commit();
    return;
  }

  // Only the published document exists. Mutations via the client write to the
  // exact id given (drafts are a Studio convention, not created server-side),
  // so patch a draft seeded from the published state instead of publishing
  // translated content directly.
  const draftId = `drafts.${getPublishedId(baseDoc._id)}`;
  await client
    .transaction()
    .createIfNotExists({ ...baseDoc, _id: draftId })
    .patch(draftId, (patch) => patch.set(changes))
    .commit();
};
