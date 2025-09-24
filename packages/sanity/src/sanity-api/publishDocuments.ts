import { SanityClient } from 'sanity';
import { processBatch } from '../utils/batchProcessor';

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
  await processBatch(
    documentIds,
    async (documentId) => {
      await publishDocument(documentId, client);
      return { documentId, published: true };
    },
    {
      onItemFailure: (documentId, error) => {
        console.error(`Failed to publish document ${documentId}:`, error);
      },
    }
  );
}
