import type { SanityClient, SanityDocument } from 'sanity';
import { pluginConfig } from '../adapter/core';
import { hasLocaleContent } from '../serialization/internationalizedArray/detect';
import type { TranslationFunctionContext } from '../types';
import {
  dedupeDocumentsPreferDraft,
  getDocumentPublishedId,
} from '../utils/documentIds';
import {
  metadataTranslationRef,
  metadataTranslations,
  TRANSLATION_METADATA_TYPE,
} from '../utils/translationMetadata';
import { serializeDocument } from '../utils/serialize';
import { getTranslationStrategy } from './strategy';

/**
 * A translation that already exists in Sanity (a human-edited translated
 * document or a translated internationalized-array item), serialized to the
 * same HTML format the source document is uploaded in.
 */
export type ExistingTranslation = {
  locale: string;
  content: string;
};

type TranslationMetadataRow = {
  sourceDocId?: string;
  translations?: { language?: string; docId?: string }[];
};

/**
 * Collect and serialize the translations that already exist in Sanity for the
 * given source documents, keyed by the source document's published id.
 *
 * - Document-level types: the translated documents linked through
 *   `translation.metadata`, preferring drafts so unpublished human edits are
 *   also preserved.
 * - Internationalized-array types: the target-locale items stored in the
 *   source document itself, collapsed per locale.
 *
 * Locales without existing content are omitted, so callers only upload
 * translations that a human could actually have edited.
 */
export async function collectExistingTranslations(
  documents: SanityDocument[],
  targetLocaleIds: string[],
  { client, schema }: TranslationFunctionContext
): Promise<Map<string, ExistingTranslation[]>> {
  const existing = new Map<string, ExistingTranslation[]>();
  if (documents.length === 0 || targetLocaleIds.length === 0) {
    return existing;
  }

  const sourceLocale = pluginConfig.getSourceLocale();
  const languageField = pluginConfig.getLanguageField();
  const localeIds = targetLocaleIds.filter(
    (localeId) => localeId !== sourceLocale
  );
  if (localeIds.length === 0) {
    return existing;
  }

  const documentLevelDocs: SanityDocument[] = [];
  for (const doc of documents) {
    const strategy = getTranslationStrategy(doc);
    if (strategy.level !== 'internationalizedArray') {
      documentLevelDocs.push(doc);
      continue;
    }

    // Array-level translations live in the source document itself. Collapsing
    // to the target locale reuses the source serialization path: fields with
    // no item for that locale are dropped, so only translated content ships.
    const { [languageField]: _language, ...cleanDoc } = doc;
    const translations: ExistingTranslation[] = [];
    for (const localeId of localeIds) {
      if (!hasLocaleContent(cleanDoc, localeId)) continue;
      const serialized = serializeDocument(
        cleanDoc as SanityDocument,
        schema,
        localeId,
        'internationalizedArray'
      );
      translations.push({ locale: localeId, content: serialized.content });
    }
    if (translations.length > 0) {
      existing.set(getDocumentPublishedId(doc), translations);
    }
  }

  if (documentLevelDocs.length > 0) {
    const documentLevel = await collectDocumentLevelTranslations(
      documentLevelDocs,
      localeIds,
      sourceLocale,
      languageField,
      client,
      schema
    );
    for (const [sourceDocId, translations] of documentLevel) {
      existing.set(sourceDocId, translations);
    }
  }

  return existing;
}

async function collectDocumentLevelTranslations(
  documents: SanityDocument[],
  localeIds: string[],
  sourceLocale: string,
  languageField: string,
  client: SanityClient,
  schema: TranslationFunctionContext['schema']
): Promise<Map<string, ExistingTranslation[]>> {
  const existing = new Map<string, ExistingTranslation[]>();
  const sourceDocIds = documents.map(getDocumentPublishedId);

  const query = `*[
    _type == '${TRANSLATION_METADATA_TYPE}' &&
    ${metadataTranslationRef('$sourceLocale')} in $sourceDocIds
  ] {
    'sourceDocId': ${metadataTranslationRef('$sourceLocale')},
    'translations': ${metadataTranslations('in $localeIds', 'defined(value._ref)')}{
      language,
      'docId': value._ref
    }
  }`;

  const metadataRows = await client.fetch<TranslationMetadataRow[]>(query, {
    sourceLocale,
    sourceDocIds,
    localeIds,
  });

  // Use the last entry per locale defensively: older plugin versions could
  // create duplicate locale entries when bulk imports raced.
  const refsBySource = new Map<string, Map<string, string>>();
  for (const row of metadataRows) {
    if (!row.sourceDocId) continue;
    const localeRefs =
      refsBySource.get(row.sourceDocId) ?? new Map<string, string>();
    for (const translation of row.translations ?? []) {
      if (translation.language && translation.docId) {
        localeRefs.set(translation.language, translation.docId);
      }
    }
    refsBySource.set(row.sourceDocId, localeRefs);
  }

  const translatedDocIds = Array.from(
    new Set(
      Array.from(refsBySource.values()).flatMap((localeRefs) =>
        Array.from(localeRefs.values())
      )
    )
  );
  if (translatedDocIds.length === 0) {
    return existing;
  }

  // Fetch published and draft versions in one query, preferring drafts so
  // unpublished human edits are included.
  const translatedDocs = await client.fetch<SanityDocument[]>(
    `*[_id in $ids || _id in $draftIds]`,
    {
      ids: translatedDocIds,
      draftIds: translatedDocIds.map((id) => `drafts.${id}`),
    }
  );
  const translatedById = new Map(
    dedupeDocumentsPreferDraft(translatedDocs).map((doc) => [
      getDocumentPublishedId(doc),
      doc,
    ])
  );

  for (const [sourceDocId, localeRefs] of refsBySource) {
    const translations: ExistingTranslation[] = [];
    for (const [localeId, translatedDocId] of localeRefs) {
      const translatedDoc = translatedById.get(translatedDocId);
      if (!translatedDoc) continue;
      const { [languageField]: _language, ...cleanDoc } = translatedDoc;
      const serialized = serializeDocument(
        cleanDoc as SanityDocument,
        schema,
        sourceLocale,
        'document'
      );
      translations.push({ locale: localeId, content: serialized.content });
    }
    if (translations.length > 0) {
      existing.set(sourceDocId, translations);
    }
  }

  return existing;
}
