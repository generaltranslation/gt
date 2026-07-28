import { SanityClient } from 'sanity';
import { pluginConfig } from '../adapter/core';
import { getPublishedId } from '../utils/documentIds';
import {
  metadataTranslationRef,
  metadataTranslations,
  TRANSLATION_METADATA_TYPE,
} from '../utils/translationMetadata';
import { findLatestDraft } from '../configuration/utils/findLatestDraft';

export async function findTranslatedDocuments(
  documentId: string,
  client: SanityClient
) {
  const documents = await client.fetch(
    `*[_type == "${TRANSLATION_METADATA_TYPE}" && references($documentId)]`
  );
  return documents;
}

export async function findTranslatedDocumentForLocale(
  sourceDocumentId: string,
  localeId: string,
  client: SanityClient
) {
  const cleanDocId = getPublishedId(sourceDocumentId);

  // Use the last locale entry defensively. Older versions could create
  // duplicate locale entries when bulk imports raced.
  const query = `*[
    _type == "${TRANSLATION_METADATA_TYPE}" &&
    (
      ${metadataTranslationRef('$sourceLocale')} == $cleanDocId
    ) &&
    defined(${metadataTranslations('== $localeId')})
  ][0].${metadataTranslations('== $localeId')}.value._ref`;

  const translatedDocIds = await client.fetch(query, {
    sourceLocale: pluginConfig.getSourceLocale(),
    cleanDocId,
    localeId,
  });

  const translatedDocId = translatedDocIds?.[translatedDocIds.length - 1];
  if (!translatedDocId) return null;

  return (await findLatestDraft(translatedDocId, client)) || null;
}

export async function findDocument(documentId: string, client: SanityClient) {
  const query = `*[_id == $id]`;
  const params = { id: documentId };
  const document = await client.fetch(query, params);
  return document[0] || null;
}
