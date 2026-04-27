// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, SanityDocumentLike } from 'sanity';
import JSONPointer from 'jsonpointer';
import {
  applyDocuments,
  deleteMatchingFields,
  forEachMatchingField,
} from '../../../utils/applyDocuments';
import { pluginConfig } from '../../../adapter/core';

const SYSTEM_FIELDS = ['_id', '_rev', '_updatedAt', 'language'];

const isSystemField = (field: string) => SYSTEM_FIELDS.includes(field);

export async function patchI18nDoc(
  sourceDocumentId: string,
  i18nDocId: string,
  sourceDocument: SanityDocumentLike,
  mergedDocument: SanityDocumentLike,
  translatedFields: Record<string, any>,
  client: SanityClient,
  existingDocument?: SanityDocumentLike
): Promise<void> {
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
  const newDocument = await client
    .patch(i18nDocId, { set: appliedDocument })
    .commit();
}
