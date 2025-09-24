import { SanityClient } from 'sanity';
import { pluginConfig } from '../adapter/core';

export async function findTranslatedDocuments(
  documentId: string,
  client: SanityClient
) {
  const documents = await client.fetch(
    `*[_type == "translation.metadata" && references($documentId)]`
  );
  return documents;
}

export async function findTranslatedDocumentForLocale(
  sourceDocumentId: string,
  localeId: string,
  client: SanityClient
) {
  const cleanDocId = sourceDocumentId.replace('drafts.', '');

  // Try both clean and original IDs to be safe, and use -> to directly fetch the translated doc
  const query = `*[
    _type == "translation.metadata" &&
    (
      translations[_key == $sourceLocale][0].value._ref == $cleanDocId
    ) &&
    defined(translations[_key == $localeId])
  ][0].translations[_key == $localeId][0].value->`;

  const translatedDoc = await client.fetch(query, {
    sourceLocale: pluginConfig.getSourceLocale(),
    cleanDocId,
    localeId,
  });

  return translatedDoc || null;
}

export async function findDocument(documentId: string, client: SanityClient) {
  const query = `*[_id == $id]`;
  const params = { id: documentId };
  const document = await client.fetch(query, params);
  return document[0] || null;
}
