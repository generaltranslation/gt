import { SanityClient } from 'sanity';
import { processBatch } from '../utils/batchProcessor';
import { findDocument } from './findDocuments';

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
          publishedId: documentId.replace('drafts.', ''),
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
