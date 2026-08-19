import { SanityClient } from 'sanity';
import { processBatch } from '../utils/batchProcessor';
import { findDocument } from './findDocuments';
import { getPublishedId } from '../utils/documentIds';

/**
 * Selects the translation documents belonging to a set of source documents.
 *
 * A document is classified as a source by its id, never by the `language`
 * label on its metadata entry. Locale codes get renamed — `en` to `en-US`, say
 * — and entries written beforehand keep the old code, so a group whose source
 * label no longer matches the configured source locale would be skipped
 * entirely and its source would be mistaken for a translation.
 *
 * The two id sets answer different questions:
 *
 * - `$publishedDocumentIds` — which groups are in scope. There is nothing to
 *   publish until the source itself exists published.
 * - `$sourceDocumentIds` — what counts as a source. Every source under
 *   management, including ones that only exist as a draft, so a source is
 *   never returned as a translation of some other document.
 *
 * Known limitation: a group is in scope if it references any requested source,
 * so metadata that wrongly links two sources into one group can return the
 * other source's translations. Which source owns a translation is not
 * recoverable from the metadata once it is inconsistent, and the alternative —
 * skipping ambiguous groups — silently drops valid translations, which is the
 * worse outcome.
 */
export const TRANSLATION_DOCS_FOR_PUBLISH_QUERY = `*[
  _type == 'translation.metadata' &&
  count(translations[defined(value._ref) && value._ref in $publishedDocumentIds]) > 0
] {
  'translationDocs': translations[
    defined(value._ref) && !(value._ref in $sourceDocumentIds)
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
