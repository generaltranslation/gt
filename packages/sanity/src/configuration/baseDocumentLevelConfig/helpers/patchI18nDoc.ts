// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, SanityDocumentLike } from 'sanity';
import JSONPointer from 'jsonpointer';
import {
  applyDocuments,
  deleteMatchingFields,
  forEachMatchingField,
} from '../../../utils/applyDocuments';
import { pluginConfig } from '../../../adapter/core';
import { getPublishedId } from '../../../utils/documentIds';

const SYSTEM_FIELDS = ['_id', '_rev', '_updatedAt', 'language'];

const isSystemField = (field: string) => SYSTEM_FIELDS.includes(field);

export async function patchI18nDoc(
  sourceDocumentId: string,
  i18nDocId: string,
  sourceDocument: SanityDocumentLike,
  mergedDocument: SanityDocumentLike,
  translatedFields: Record<string, unknown>,
  client: SanityClient,
  existingDocument?: SanityDocumentLike
): Promise<void> {
  const cleanedMerge: Record<string, unknown> = {};
  Object.entries(mergedDocument).forEach(([key, value]) => {
    if (
      //only patch those fields that had translated strings
      key in translatedFields &&
      //don't overwrite any existing system values on the i18n doc
      !isSystemField(key)
    ) {
      cleanedMerge[key] = value;
    }
  });
  const cleanedSourceDocument: Record<string, unknown> = {};
  Object.entries(sourceDocument).forEach(([key, value]) => {
    if (
      // extract only the fields that are not system fields
      !isSystemField(key)
    ) {
      cleanedSourceDocument[key] = value;
    }
  });
  const appliedDocument = applyDocuments(
    sourceDocumentId,
    cleanedSourceDocument,
    cleanedMerge,
    pluginConfig.getIgnoreFields(),
    pluginConfig.getSkipFields()
  );
  const dedupeFields = pluginConfig.getDedupeFields();
  deleteMatchingFields(sourceDocumentId, appliedDocument, dedupeFields);
  if (existingDocument) {
    forEachMatchingField(
      sourceDocumentId,
      existingDocument,
      dedupeFields,
      (result) => {
        JSONPointer.set(appliedDocument, result.pointer, result.value);
      }
    );
  }
  if (i18nDocId.startsWith('drafts.')) {
    await client.patch(i18nDocId, { set: appliedDocument }).commit();
    return;
  }

  // A draft in Sanity is just a document whose id carries a `drafts.` prefix,
  // and the client writes to whatever id it is handed — it will not redirect a
  // write to the draft on your behalf. A published id here is therefore the
  // copy readers are served. Copy it into a draft and patch that, so the
  // translation lands somewhere reviewable and the live document only changes
  // when someone publishes.
  const seed = existingDocument ?? (await client.getDocument(i18nDocId));
  if (!seed) {
    // References in `translation.metadata` are weak, so they outlive the
    // documents they point at: deleting a translation leaves its entry behind.
    // With no document to copy there is nothing to seed a draft from, so patch
    // the id directly and let the missing document surface as an error.
    await client.patch(i18nDocId, { set: appliedDocument }).commit();
    return;
  }

  const draftId = `drafts.${getPublishedId(i18nDocId)}`;
  await client
    .transaction()
    .createIfNotExists({ ...seed, _id: draftId })
    .patch(draftId, (patch) => patch.set(appliedDocument))
    .commit();
}
