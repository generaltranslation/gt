import { SanityClient, SanityDocumentLike } from 'sanity';
import { applyDocuments } from '../../../utils/applyDocuments';
import { gtConfig } from '../../../adapter/core';

const SYSTEM_FIELDS = ['_id', '_rev', '_updatedAt', 'language'];

const isSystemField = (field: string) => SYSTEM_FIELDS.includes(field);

export const patchI18nDoc = (
  sourceDocumentId: string,
  i18nDocId: string,
  sourceDocument: SanityDocumentLike,
  mergedDocument: SanityDocumentLike,
  translatedFields: Record<string, any>,
  client: SanityClient
): void => {
  const cleanedMerge: Record<string, any> = {};
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
  const cleanedSourceDocument: Record<string, any> = {};
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
    gtConfig.getIgnoreFields()
  );
  console.log('appliedDocument', appliedDocument);
  client
    .transaction()
    .patch(i18nDocId, (p) => p.set(appliedDocument))
    .commit();
};
