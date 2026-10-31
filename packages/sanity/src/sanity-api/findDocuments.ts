import { SanityClient } from 'sanity';
import { pluginConfig } from '../adapter/core';
import { getPublishedId } from '../utils/documentIds';
import { findLatestDraft } from '../configuration/utils/findLatestDraft';
import {
  allowsNonDefaultSourceLocales,
  GROUP_ORIGINAL_REF,
} from '../utils/translationSource';

export async function findTranslatedDocuments(
  documentId: string,
  client: SanityClient
) {
  const documents = await client.fetch(
    `*[_type == "translation.metadata" && references($documentId)]`
  );
  return documents;
}

/**
 * @param sourceLanguage - language of the original `sourceDocumentId`.
 *   Defaults to the configured source locale.
 */
export async function findTranslatedDocumentForLocale(
  sourceDocumentId: string,
  localeId: string,
  client: SanityClient,
  sourceLanguage: string = pluginConfig.getSourceLocale()
) {
  const cleanDocId = getPublishedId(sourceDocumentId);

  // Use the last locale entry defensively. Older versions could create
  // duplicate locale entries when bulk imports raced.
  // With `allowNonDefaultSourceLocales`, an original outside the configured
  // source locale is found through its group's marker.
  const originalRef =
    allowsNonDefaultSourceLocales() &&
    sourceLanguage !== pluginConfig.getSourceLocale()
      ? GROUP_ORIGINAL_REF
      : 'translations[language == $sourceLocale][0].value._ref';
  const query = `*[
    _type == "translation.metadata" &&
    (
      ${originalRef} == $cleanDocId
    ) &&
    defined(translations[language == $localeId])
  ][0].translations[language == $localeId].value._ref`;

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
