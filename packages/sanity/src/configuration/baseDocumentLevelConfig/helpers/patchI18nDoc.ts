// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, SanityDocumentLike } from 'sanity';
import { applyDocuments } from '../../../utils/applyDocuments';
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
  publish: boolean = false
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
    pluginConfig.getIgnoreFields()
  );
  const newDocument = await client
    .patch(i18nDocId, { set: appliedDocument })
    .commit();

  if (publish) {
    try {
      // only publish if the document is a draft
      if (newDocument._id.startsWith('drafts.')) {
        await client.action(
          {
            actionType: 'sanity.action.document.publish',
            draftId: newDocument._id,
            publishedId: newDocument._id.replace('drafts.', ''),
          },
          {}
        );
      }
    } catch (error) {
      console.error('Error publishing document', error);
    }
  }
}
