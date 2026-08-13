import { SanityClient } from 'sanity';
import { processBatch } from '../utils/batchProcessor';
import { findDocument } from './findDocuments';
import { getPublishedId } from '../utils/documentIds';

/**
 * Selects the translation documents belonging to a set of source documents.
 *
 * Source and translation entries are told apart by which document they
 * reference, never by their `language` label. A metadata document written
 * before the configured source locale was relabelled still carries the old
 * code, so matching the label would drop the whole group from the publish and
 * the inverse test would publish the source document as if it were a
 * translation.
 *
 * Expects a `$publishedDocumentIds` param holding every source document id.
 */
export const TRANSLATION_DOCS_FOR_PUBLISH_QUERY = `*[
  _type == 'translation.metadata' &&
  count(translations[defined(value._ref) && value._ref in $publishedDocumentIds]) > 0
] {
  'translationDocs': translations[
    defined(value._ref) && !(value._ref in $publishedDocumentIds)
  ]{
    _key,
    'docId': value._ref
  }
}`;

export async function publishDocument(
  documentId: string,
  client: SanityClient
) {
  try {
    // only publish if the document is a draft
    if (documentId.startsWith('drafts.')) {
      await client.action(
        {
          actionType: 'sanity.action.document.publish',
          draftId: documentId,
          publishedId: getPublishedId(documentId),
        },
        {}
      );
    }
  } catch (error) {
    console.error('Error publishing document', error);
  }
}

export async function publishTranslations(
  documentIds: string[],
  client: SanityClient
) {
  const publishedDocumentIds: string[] = [];
  await processBatch(
    documentIds,
    async (documentId) => {
      const document = await findDocument(`drafts.${documentId}`, client);
      if (!document) {
        return { documentId, published: false };
      }
      await publishDocument(document._id, client);
      publishedDocumentIds.push(documentId);
      return { documentId, published: true };
    },
    {
      onItemFailure: (documentId, error) => {
        console.error(`Failed to publish document ${documentId}:`, error);
      },
    }
  );
  return publishedDocumentIds;
}
